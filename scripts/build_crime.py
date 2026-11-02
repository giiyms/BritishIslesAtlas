#!/usr/bin/env python3
"""Build public/data/crime.geojson: police-recorded crime for every local area in the British Isles.

One point per area the police publish counts for, financial year April 2025 to March 2026 in the UK, calendar 2025 in Ireland:
  England and Wales  every Community Safety Partnership (Home Office open data tables)
  Scotland           every council area (Scottish Government, Recorded Crime in Scotland 2025-26)
  Northern Ireland   every policing district (PSNI police recorded crime tables to 31 March 2026)
  Ireland            every Garda station (CSO table CJA07, recorded crime incidents, under reservation)

Inputs (downloaded into SRC, not committed):
  csp-2025_26.csv    sheet 2025_26 of prc-csp-mar21-jun26-tables-221026.ods (Home Office), as CSV
  lu.json            ONS LAD25_CSP25_PFA25_EW_LU lookup (ArcGIS query, f=json)
  scot.xlsx          Recorded Crime in Scotland 2025-26 tables
  psni.xlsx          Police Recorded Crime Tables Period Ending 31st March 2026
  CJA07.json         CSO PxStat CJA07, JSON-stat 2.0
  lad18.geojson      ONS LAD Dec 2018 BGC boundaries for the former districts that are still partnerships (ArcGIS, f=geojson)
  msoa_pwc_*.json    ONS MSOA Dec 2021 population-weighted centroids (ArcGIS, four pages of 2,000)
  msoa_pop.csv       Census 2021 usual residents by MSOA in the merged councils (Nomis NM_2021_1; Cumbria by its 2021 district codes)
  ie_police.json     amenity=police nodes and areas from the Geofabrik Ireland extract (OSM)
  ie_places.json     place=* nodes from the same extract
  IE.txt             GeoNames Ireland dump (populated places)

Coordinates: UK areas sit on the census layer's council marker (ONS LAD BGC centroid); a partnership covering
several councils sits on the resident-weighted mean of their markers. Partnerships that are still a former district
of a merged council (Cumbria, Northamptonshire, Buckinghamshire, East Suffolk, Bournemouth and Poole) are rebuilt
from the Census 2021 MSOAs inside that district's 2018 boundary: residents summed, position resident-weighted. A Garda station sits on its OSM police
station when OSM has it by name; otherwise on the OSM or GeoNames village of that name (Irish names via an
explicit English-name table), snapped to an unnamed OSM police station within 1.5 km when there is one.

Usage: python3 scripts/build_crime.py <downloads>/crime
"""
from __future__ import annotations

import collections
import csv
import json
import math
import re
import statistics
import sys
import unicodedata
from datetime import date
from pathlib import Path

import openpyxl

REPO = Path(__file__).resolve().parent.parent
HO_URL = "https://www.gov.uk/government/statistical-data-sets/police-recorded-crime-and-outcomes-open-data-tables"
SG_URL = "https://www.gov.scot/publications/recorded-crime-scotland-2025-26/"
PSNI_URL = "https://www.psni.police.uk/about-us/our-publications-and-reports/official-statistics/police-recorded-crime-statistics"
CSO_URL = "https://data.cso.ie/table/CJA07"
UK_PERIOD = "April 2025 to March 2026"

# Home Office CSP names that differ from the ONS lookup
CSP_ALIAS = {"Folkestone and Hythe": "Shepway", "Kings Lynn and West Norfolk": "King's Lynn and West Norfolk",
             "London, City of": "City of London", "Northern Devon": "North Devon"}
LAD_ALIAS = {"E08000038": "E08000016", "E08000039": "E08000019"}  # Barnsley, Sheffield recoded in 2025
# Kent Police records these partnerships together (Home Office force note, 2024 onwards)
KENT_GROUP = ["Maidstone", "Medway", "Tonbridge and Malling", "Tunbridge Wells"]
UNASSIGNED_SHARE = 0.03  # flag a force's partnerships when this share of its crime has no partnership

SCOT_LA = {"Argyll & Bute": "Argyll and Bute", "Dumfries & Galloway": "Dumfries and Galloway",
           "Edinburgh, City of": "City of Edinburgh", "Perth & Kinross": "Perth and Kinross"}
NI_DISTRICT = {"Belfast City": "N09000003", "Lisburn & Castlereagh City": "N09000007", "Ards and North Down": "N09000011",
               "Newry, Mourne & Down": "N09000010", "Armagh City, Banbridge & Craigavon": "N09000002",
               "Mid Ulster": "N09000009", "Fermanagh & Omagh": "N09000006", "Derry City & Strabane": "N09000005",
               "Causeway Coast & Glens": "N09000004", "Mid & East Antrim": "N09000008", "Antrim & Newtownabbey": "N09000001"}

# CSO station label -> name to look up (Irish-language or misspelt labels; English forms per logainm.ie)
IE_ALIAS = {
    "Ailt an Chorraiin": "Burtonport", "An Clochain Liath": "Dungloe", "An Fail Carrach": "Falcarragh",
    "An Maim": "Maum", "Aran More": "Oranmore", "Ard an Raitha": "Ardara", "Ballaghderreen": "Ballaghaderreen",
    "Ballingarry North": "Ballingarry", "Ballingarry South": "Ballingarry", "Ballymacarberry": "Ballymacarbry",
    "Bridewell Cork": "Bridewell", "Bridewell Dublin": "Bridewell", "Carrig na Bhfear": "Carrignavar",
    "Beal an Mhuirthead": "Belmullet", "Clonbologue": "Clonbullogue", "Corofin Co. Galway": "Corrofin", "Glasson": "Glassan", "Dun Fionnachaid": "Dunfanaghy", "Glantaine": "Glantane",
    "Hackballscross": "Hackballs Cross", "Indreabhain": "Inverin", "Kealkil": "Kealkill", "Kells Ceanannus Mor": "Kells",
    "Kilrickle": "Kilreekill", "Lanesboro": "Lanesborough", "Leach Seoirse": "Leacht Seoirse (Loughgeorge)",
    "Leamybrien": "Lemybrien", "Leitir Mor": "Lettermore", "Oylegate": "Oilgate", "Rosslare Strand": "Rosslare",
    "Roxboro Road": "Roxboro", "Sundrive Road": "Sundrive", "Taughmaconnell": "Taghmaconnell",
    "Milford, Co Cork": "Milford", "Milford, Co Donegal": "Milford", "Newport, Co Mayo": "Newport",
    "Newport, Co Tipperary": "Newport",
}
# Stations whose name is only a townland or street in OSM (Nominatim lookup, centre of the OSM object)
IE_FIXED = {
    "Clonark": (-8.03805, 53.36923, "relation/5296484"),        # Cloonark townland, Drumlosh ED, Co Roscommon
    "Drumad": (-6.35955, 54.08516, "relation/5200953"),         # Drumad townland, Ravensdale ED, Co Louth
    "Shevry": (-8.06615, 52.68795, "relation/5610987"),         # Shevry townland, Upperchurch, Co Tipperary
    "Smear": (-7.61620, 53.87385, "relation/2284037"),          # Smear townland, Columbkille ED, Co Longford
    "Tarelton": (-8.98583, 51.83775, "relation/6004422"),       # Teerelton townland, Co Cork
    "Taughmaconnell": (-8.12229, 53.38100, "relation/5344879"), # Taghmaconnell townland, Co Roscommon
    "Watercourse Road": (-8.47344, 51.90963, "way/31346515"),   # Watercourse Road, Blackpool, Cork
}
IE_GROUPS = {"03": "assaults", "07": "burglary", "08": "theft", "10": "drugs", "12": "damage", "13": "public_order"}


def strip_accents(s: str) -> str:
    s = unicodedata.normalize("NFKD", s.replace("\x81", ""))
    return "".join(c for c in s if not unicodedata.combining(c))


def norm(s: str) -> str:
    s = strip_accents(s).lower()
    for w in ("garda station", "garda siochana", "staisiun an gharda", "gharda", "garda", "station"):
        s = s.replace(w, " ")
    s = re.sub(r"['’]", "", s)
    return " ".join(re.sub(r"[^a-z0-9 ]", " ", s).split())


def ie_display(label: str) -> str:
    """CSO station label as it should read: restore the fadas the CSO export lost, and write 'X, Co Y'."""
    label = label.replace("A\x81", "Á").replace("a\x81", "Á").replace("Chorraiin", "Chorráin")
    return re.sub(r",?\s+Co\.?\s+(\w+)$", r", Co \1", label)


def km(a, b) -> float:
    return math.hypot((a[0] - b[0]) * math.cos(math.radians(a[1])) * 111.32, (a[1] - b[1]) * 111.32)


def weighted(points: list[tuple[tuple[float, float], int]]) -> list[float]:
    w = sum(r for _, r in points)
    return [round(sum(p[0] * r for p, r in points) / w, 5), round(sum(p[1] * r for p, r in points) / w, 5)]


def tidy(name: str) -> str:
    m = re.match(r"^(.*), City of$", name)
    return f"City of {m.group(1)}" if m else name


def per_1000(n: int, residents: int) -> float:
    return round(n * 1000 / residents, 1)


# partnerships that are former districts of a council merged since 2019 -> their LAD18 districts
OLD_DISTRICT_CSP = {"Daventry and South Northamptonshire": ["Daventry", "South Northamptonshire"]}
MERGED_LADS = {"E06000058", "E06000060", "E06000061", "E06000062", "E06000063", "E06000064", "E07000244"}


def former_districts(src: Path) -> dict[str, tuple[list[float], int]]:
    """Census 2021 residents and resident-weighted position of each former district, from MSOAs."""
    from shapely.geometry import Point, shape

    pos = {}
    for page in sorted(src.glob("msoa_pwc_*.json")):
        for f in json.loads(page.read_text())["features"]:
            pos[f["attributes"]["MSOA21CD"]] = (f["geometry"]["x"], f["geometry"]["y"])
    lads = [(f["properties"]["lad18nm"], shape(f["geometry"])) for f in json.loads((src / "lad18.geojson").read_text())["features"]]
    members = collections.defaultdict(list)
    with open(src / "msoa_pop.csv", newline="") as fh:
        for r in csv.DictReader(fh):
            p = pos[r["GEOGRAPHY_CODE"]]
            pt = Point(p)
            name = min(lads, key=lambda l: l[1].distance(pt))[0]  # inside, or nearest on generalised coastlines
            members[name].append((p, int(r["OBS_VALUE"])))
    return {n: (weighted(m), sum(r for _, r in m)) for n, m in members.items()}


def main(src: Path) -> None:
    census = {f["properties"]["area_code"]: f for f in json.loads((REPO / "public/data/census.geojson").read_text())["features"]}
    feats = []

    def add(name, lonlat, **props):
        feats.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": lonlat},
                      "properties": {"name": name, "layer": "crime", **{k: v for k, v in props.items() if v not in (None, "")}}})

    # ---- England and Wales: Community Safety Partnerships ----
    lookup = collections.defaultdict(list)
    for a in (x["attributes"] for x in json.loads((src / "lu.json").read_text())["features"]):
        lookup[a["CSP25NM"]].append(LAD_ALIAS.get(a["LAD25CD"], a["LAD25CD"]))
    counts: dict[tuple[str, str], collections.Counter] = collections.defaultdict(collections.Counter)
    with open(src / "csp-2025_26.csv", newline="") as fh:
        for r in csv.DictReader(fh):
            assert r["Financial Year"] == "2025/26", r
            n = int(r["Offence Count"] or 0)
            c = counts[(r["Police Force"], r["CSP Name"])]
            c["recorded"] += n
            g, sg = r["Offence Group"], r["Offence Subgroup"]
            key = {"Violence against the person": "violence", "Sexual offences": "sexual", "Robbery": "robbery",
                   "Criminal damage and arson": "damage", "Drug offences": "drugs"}.get(g)
            if key:
                c[key] += n
            if sg in ("Residential burglary", "Non-residential burglary"):
                c["burglary"] += n
            elif sg == "Vehicle offences":
                c["vehicle"] += n
            elif sg == "Shoplifting":
                c["shoplifting"] += n
    force_total = collections.Counter()
    unassigned = {}
    for (force, csp), c in counts.items():
        force_total[force] += c["recorded"]
        if csp.startswith("Unassigned"):
            unassigned[force] = c
    kent = collections.Counter(unassigned.pop("Kent"))
    keys = ["recorded", "violence", "sexual", "robbery", "burglary", "vehicle", "shoplifting", "damage", "drugs"]

    old = former_districts(src)
    # MSOA counts are rounded for disclosure control, so sums drift by a handful of people
    assert abs(sum(r for _, r in old.values()) / sum(census[l]["properties"]["residents"] for l in MERGED_LADS | {"E06000059"}) - 1) < 1e-3, \
        sorted((n, r) for n, (_, r) in old.items())
    assert abs(old["Allerdale"][1] - 96157) < 50, old["Allerdale"]  # Census 2021 count for the district (Nomis TYPE154)

    def uk_point(name, lads, c, force, kind, note=None, nation=None):
        if name in OLD_DISTRICT_CSP or name in old:
            pts = [(tuple(old[d][0]), old[d][1]) for d in OLD_DISTRICT_CSP.get(name, [name])]
            lads = lads[:1]
        elif name == "Dorset":  # Dorset Council plus Christchurch, the part of BCP outside Bournemouth and Poole
            pts = [(tuple(census["E06000059"]["geometry"]["coordinates"]), census["E06000059"]["properties"]["residents"]),
                   (tuple(old["Christchurch"][0]), old["Christchurch"][1])]
            lads = ["E06000059"]
        else:
            pts = [(tuple(census[l]["geometry"]["coordinates"]), census[l]["properties"]["residents"]) for l in lads]
        residents = sum(r for _, r in pts)
        covers = ", ".join(census[l]["properties"]["name"] for l in lads) if len(lads) > 1 else None
        if name == "Dorset":
            covers = "Dorset Council area and Christchurch"
        add(tidy(name), weighted(pts), kind=kind, nation=nation or census[lads[0]]["properties"]["nation"], force=force,
            period=UK_PERIOD, covers=covers, **{k: int(c[k]) for k in keys}, per_1000=per_1000(c["recorded"], residents),
            rate_basis="Census 2021 residents", note=note,
            source="Home Office police recorded crime open data, Community Safety Partnership tables", url=HO_URL)

    for (force, csp), c in sorted(counts.items()):
        if csp.startswith("Unassigned"):
            continue
        if force == "Kent" and csp in KENT_GROUP:
            kent.update(c)
            continue
        if csp == "Manchester Airport":
            airport = next(f for f in json.loads((REPO / "public/data/immigration.geojson").read_text())["features"]
                           if f["properties"].get("icao") == "EGCC")
            add("Manchester Airport", airport["geometry"]["coordinates"], kind="Community safety partnership",
                nation="England", force=force, period=UK_PERIOD, **{k: int(c[k]) for k in keys},
                note="Greater Manchester Police counts the airport as its own partnership",
                source="Home Office police recorded crime open data, Community Safety Partnership tables", url=HO_URL)
            continue
        lads = lookup[CSP_ALIAS.get(csp, csp)]
        assert lads, f"no councils for {force} / {csp}"
        note = None
        if force in unassigned and unassigned[force]["recorded"] > UNASSIGNED_SHARE * force_total[force]:
            note = (f"{force} Police could not place a further {unassigned[force]['recorded']:,} crimes in any partnership"
                    " this year; they are in the force total only")
        uk_point(csp, lads, c, force, "Community safety partnership", note)
    kent_lads = [l for csp in KENT_GROUP for l in lookup[csp]]
    uk_point("Maidstone, Medway, Tonbridge and Malling and Tunbridge Wells", kent_lads, kent, "Kent",
             "Community safety partnership",
             "Kent Police records these four partnerships together, with any other Kent crime it could not place"
             " (Home Office force note, 2024 onwards)")

    # ---- Scotland: council areas ----
    wb = openpyxl.load_workbook(src / "scot.xlsx", read_only=True)
    t1 = list(wb["Table_1"].iter_rows(values_only=True))
    hdr = t1[2]
    col = hdr.index("2025-26")
    t4 = list(wb["Table_4"].iter_rows(values_only=True))
    col4 = t4[2].index("2025-26")
    scot = collections.defaultdict(collections.Counter)
    for r in t1[3:]:
        la, grp, typ, v = r[0], r[1], r[2], r[col]
        if not la or la == "Scotland" or not isinstance(v, (int, float)):
            continue
        c = scot[la]
        if grp == "Total Crimes":
            c["recorded"] += v
        elif typ == "Total" and grp in ("Non-sexual crimes of violence", "Sexual crimes", "Damage and reckless behaviour"):
            c[{"Non-sexual crimes of violence": "violence", "Sexual crimes": "sexual",
               "Damage and reckless behaviour": "damage"}[grp]] += v
        elif typ == "Robbery":
            c["robbery"] += v
        elif typ == "Housebreaking":
            c["burglary"] += v
        elif typ in ("Theft from a motor vehicle", "Theft of a motor vehicle"):
            c["vehicle"] += v
        elif typ == "Shoplifting":
            c["shoplifting"] += v
        elif typ in ("Drugs - Supply", "Drugs - Possession"):
            c["drugs"] += v
    rate = {r[0]: r[col4] for r in t4[3:] if r[1] == "Total Crimes" and r[2] == "Total"}
    by_name = {f["properties"]["name"]: code for code, f in census.items()}
    assert len(scot) == 32, sorted(scot)
    for la, c in sorted(scot.items()):
        code = by_name[SCOT_LA.get(la, la)]
        f = census[code]
        add(f["properties"]["name"], f["geometry"]["coordinates"], kind="Council area", nation="Scotland",
            force="Police Scotland", period=UK_PERIOD, **{k: int(c[k]) for k in keys},
            per_1000=round(rate[la] / 10, 1), rate_basis="NRS mid-2024 population",
            note="Scotland counts crimes under its own law; lesser offences such as speeding are counted separately and are not included",
            source="Scottish Government, Recorded Crime in Scotland 2025-26, tables 1 and 4", url=SG_URL)

    # ---- Northern Ireland: policing districts ----
    rows = list(openpyxl.load_workbook(src / "psni.xlsx", read_only=True)["Summary-District"].iter_rows(values_only=True))
    district, ni = None, collections.defaultdict(dict)
    ni_key = {"VIOLENCE AGAINST THE PERSON": "violence", "SEXUAL OFFENCES": "sexual", "ROBBERY": "robbery",
              "Burglary": "burglary", "Vehicle offences": "vehicle", "Shoplifting": "shoplifting",
              "CRIMINAL DAMAGE": "damage", "DRUG OFFENCES": "drugs", "TOTAL POLICE RECORDED CRIME": "recorded"}
    for r in rows:
        if r and r[1] == "return to index page":
            district = r[0]
            continue
        if r and r[1] == "Apr'24-Mar'25":
            assert r[2] == "Apr'25-Mar'26", r
        label = (r[0] or "").strip() if r else ""
        if district and district != "Northern Ireland" and label in ni_key and isinstance(r[2], (int, float)):
            ni[district][ni_key[label]] = int(r[2])
    assert len(ni) == 11 and all(len(v) == len(keys) for v in ni.values()), ni
    for dname, c in sorted(ni.items()):
        f = census[NI_DISTRICT[dname]]
        uk = dict(c)
        add(f["properties"]["name"], f["geometry"]["coordinates"], kind="Policing district", nation="Northern Ireland",
            force="Police Service of Northern Ireland", period=UK_PERIOD, **uk,
            per_1000=per_1000(uk["recorded"], f["properties"]["residents"]), rate_basis="Census 2021 residents",
            source="PSNI police recorded crime tables, period ending 31 March 2026", url=PSNI_URL)

    # ---- Ireland: Garda stations ----
    d = json.loads((src / "CJA07.json").read_text())
    dims = d["id"]
    sdim = next(k for k in dims if k.startswith("C03037"))
    odim = next(k for k in dims if k.startswith("C02480"))
    years = list(d["dimension"]["TLIST(A1)"]["category"]["index"])
    stations = list(d["dimension"][sdim]["category"]["index"])
    offences = list(d["dimension"][odim]["category"]["index"])
    olabel = d["dimension"][odim]["category"]["label"]
    slabel = d["dimension"][sdim]["category"]["label"]
    assert dims == ["STATISTIC", "TLIST(A1)", sdim, odim] and years[-1] == "2025"
    y = years.index("2025")
    pol = json.loads((src / "ie_police.json").read_text())
    pol_idx = collections.defaultdict(list)
    for p in pol:
        for k in ("name", "name:en", "name:ga", "alt_name", "official_name", "old_name", "short_name", "loc_name"):
            for v in (p["tags"].get(k) or "").split(";"):
                if v:
                    pol_idx[norm(v)].append(p)
    places = collections.defaultdict(list)
    for p in json.loads((src / "ie_places.json").read_text()):
        for v in p["names"]:
            places[norm(v)].append(((p["lon"], p["lat"]), f"https://www.openstreetmap.org/node/{p['id']}"))
    with open(src / "IE.txt", encoding="utf-8") as fh:
        for line in fh:
            c = line.rstrip("\n").split("\t")
            if c[6] == "P":
                for v in {c[1], c[2], *c[3].split(",")}:
                    if v:
                        places[norm(v)].append(((float(c[5]), float(c[4])), f"https://www.geonames.org/{c[0]}"))
    recs = []
    for i, s in enumerate(stations):
        head, div = slabel[s].rsplit(", ", 1)
        code, label = head.split(" ", 1)
        label = label.strip()
        q = IE_ALIAS.get(strip_accents(label), re.sub(r",?\s*co\.?\s+\w+$", "", label, flags=re.I).strip())
        vals = {offences[j]: d["value"][(y * len(stations) + i) * len(offences) + j] or 0 for j in range(len(offences))}
        recs.append({"code": code, "label": label, "q": q, "div": div, "vals": vals})
    # anchor each district (first three digits of the station code) and division on its unambiguous OSM matches
    anchors = collections.defaultdict(list)
    for r in recs:
        m = pol_idx.get(norm(r["q"]))
        if m and len(m) == 1:
            anchors[r["code"][:3]].append((m[0]["lon"], m[0]["lat"]))
            anchors[r["div"]].append((m[0]["lon"], m[0]["lat"]))
    centre = {k: (statistics.median(p[0] for p in v), statistics.median(p[1] for p in v)) for k, v in anchors.items()}
    how = collections.Counter()
    missing = []
    for r in recs:
        c = dc = centre[r["div"]]
        if r["code"][:3] in centre and km(centre[r["code"][:3]], dc) < 40:  # a few station codes sit outside their division
            c = centre[r["code"][:3]]

        def near(x):  # same-named places elsewhere in Ireland are 150 km or more away
            return km(x[0], c) < 60 or km(x[0], dc) < 100
        cands = [((p["lon"], p["lat"]), f"https://www.openstreetmap.org/{p['t']}/{p['id']}") for p in pol_idx.get(norm(r["q"]), [])]
        cands = [x for x in cands if near(x)]
        located = "OpenStreetMap police station"
        if not cands and r["label"] in IE_FIXED:
            lon, lat, ref = IE_FIXED[r["label"]]
            cands = [((lon, lat), f"https://www.openstreetmap.org/{ref}")]
            located = "Townland or street centre; the station itself is not mapped"
        if not cands:
            towns = [x for x in places.get(norm(r["q"]), []) if near(x)]
            if not towns:
                missing.append(f"{r['label']} ({r['div']})")
                continue
            town = min(towns, key=lambda x: km(x[0], c))
            near = min(pol, key=lambda p: km((p["lon"], p["lat"]), town[0]))
            if km((near["lon"], near["lat"]), town[0]) < 1.5:
                cands = [((near["lon"], near["lat"]), f"https://www.openstreetmap.org/{near['t']}/{near['id']}")]
                located = "Unnamed OpenStreetMap police station in the village"
            else:
                cands = [town]
                located = "Village centre; the station itself is not mapped"
        how[located] += 1
        (lon, lat), loc_url = min(cands, key=lambda x: km(x[0], c))
        total = int(sum(r["vals"].values()))
        if total == 0:
            continue
        grp = {IE_GROUPS[re.search(r"\((\d+)\)$", olabel[o]).group(1)]: int(v) for o, v in r["vals"].items()
               if re.search(r"\((\d+)\)$", olabel[o]).group(1) in IE_GROUPS}
        add(f"{ie_display(r['label'])} Garda station", [round(lon, 5), round(lat, 5)], kind="Garda station", nation="Ireland",
            force="An Garda Síochána", division=r["div"].replace(" Division", " Garda Division"), period="2025",
            recorded=total, **grp, located=located, located_url=loc_url,
            note="CSO publishes these counts under reservation: Garda recording quality is still under review",
            source="CSO recorded crime incidents by Garda station, table CJA07", url=CSO_URL)
    print(how)
    assert not missing, missing

    out = REPO / "public/data/crime.geojson"
    out.write_text(json.dumps({"type": "FeatureCollection", "features": feats}, separators=(",", ":")) + "\n")
    meta_path = REPO / "public/data/extract-meta.json"
    meta = json.loads(meta_path.read_text())
    meta["crime"] = {"extracted_at": date.today().isoformat(), "layer": "crime", "count": len(feats),
                     "method": "Home Office CSP open data and PSNI tables (Apr 2025 to Mar 2026), Scottish Government council tables 2025-26, CSO CJA07 Garda stations 2025; ONS council centroids, OSM and GeoNames station positions",
                     "license": "OGL v3 (Home Office, ONS, Scottish Government, PSNI); CC BY 4.0 (CSO, GeoNames); ODbL (OSM)"}
    meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
    kinds = collections.Counter(f["properties"]["kind"] for f in feats)
    print(len(feats), kinds)


if __name__ == "__main__":
    main(Path(sys.argv[1]))
