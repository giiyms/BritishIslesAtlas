#!/usr/bin/env python3
"""Build public/data/immigration.geojson: where people enter the British Isles, and where the UK detains them.

Inputs (downloaded into SRC, not committed):
  caa_10_1_2025.csv  CAA annual airport data 2025, Table 10.1 (EU and other international terminal passengers)
  spas0101.xlsx      DfT sea passenger statistics SPAS0101 (international passengers by UK port, 2025), from the .ods
  taa05.json         CSO PxStat TAA05 (passengers by Irish airport)
  TBA12.json         CSO PxStat TBA12 (roll-on/roll-off traffic by Irish port)
  det.xlsx           Home Office immigration detention summary tables, Det_03a (people in detention by place), from the .ods

Coordinates: Wikidata P625 by ICAO code (airports) or QID; an OSM element for a named ferry or cruise terminal
where the port's Wikidata point is the harbour, not the terminal; postcodes.io for a gov.uk address.

Usage: python3 scripts/build_immigration.py /workspace/osm/src/immigration
"""
from __future__ import annotations

import csv
import json
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

import openpyxl

REPO = Path(__file__).resolve().parent.parent
UA = {"User-Agent": "BritishIslesAtlas/1.0 (data build)"}

CAA_URL = "https://www.caa.co.uk/data-and-analysis/uk-aviation-market/airports/uk-airport-data/uk-airport-data-2025/annual-2025/"
DFT_URL = "https://www.gov.uk/government/statistical-data-sets/sea-passenger-statistics-spas"
CSO_AIR_URL = "https://data.cso.ie/table/TAA05"
CSO_PORT_URL = "https://data.cso.ie/table/TBA12"
HO_URL = "https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables"

# CAA reporting airport -> (display name, ICAO)
UK_AIRPORTS = {
    "GATWICK": ("London Gatwick", "EGKK"), "HEATHROW": ("London Heathrow", "EGLL"),
    "LONDON CITY": ("London City", "EGLC"), "LUTON": ("London Luton", "EGGW"),
    "SOUTHEND": ("London Southend", "EGMC"), "STANSTED": ("London Stansted", "EGSS"),
    "ABERDEEN": ("Aberdeen", "EGPD"), "BELFAST CITY (GEORGE BEST)": ("Belfast City", "EGAC"),
    "BELFAST INTERNATIONAL": ("Belfast International", "EGAA"), "BIRMINGHAM": ("Birmingham", "EGBB"),
    "BLACKPOOL": ("Blackpool", "EGNH"), "BOURNEMOUTH": ("Bournemouth", "EGHH"), "BRISTOL": ("Bristol", "EGGD"),
    "CARDIFF WALES": ("Cardiff", "EGFF"), "EAST MIDLANDS INTERNATIONAL": ("East Midlands", "EGNX"),
    "EDINBURGH": ("Edinburgh", "EGPH"), "EXETER": ("Exeter", "EGTE"), "FARNBOROUGH": ("Farnborough", "EGLF"),
    "GLASGOW": ("Glasgow", "EGPF"), "HUMBERSIDE": ("Humberside", "EGNJ"), "INVERNESS": ("Inverness", "EGPE"),
    "LEEDS BRADFORD": ("Leeds Bradford", "EGNM"), "LIVERPOOL (JOHN LENNON)": ("Liverpool John Lennon", "EGGP"),
    "MANCHESTER": ("Manchester", "EGCC"), "NEWCASTLE": ("Newcastle", "EGNT"), "NEWQUAY": ("Cornwall Newquay", "EGHQ"),
    "NORWICH": ("Norwich", "EGSH"), "PRESTWICK": ("Glasgow Prestwick", "EGPK"), "SOUTHAMPTON": ("Southampton", "EGHI"),
    "SUMBURGH": ("Sumburgh", "EGPB"), "TEESSIDE INTERNATIONAL AIRPORT": ("Teesside", "EGNV"),
    "GUERNSEY": ("Guernsey", "EGJB"), "ISLE OF MAN": ("Isle of Man (Ronaldsway)", "EGNS"), "JERSEY": ("Jersey", "EGJJ"),
}
MIN_INTL = 10_000  # below this the airport's international traffic is a handful of charters
IE_AIRPORTS = {"EIDW": "Dublin", "EICK": "Cork", "EINN": "Shannon", "EIKN": "Ireland West (Knock)", "EIKY": "Kerry", "EIDL": "Donegal"}

# DfT port rows (short-sea ferry, cruise) -> (display name, place). Rows under 20,000 passengers are left out.
UK_PORTS = [
    ("Port of Dover", ["Dover"], "Q739207"),
    ("Holyhead", ["Holyhead"], "Q7231154"),
    ("Portsmouth International Port", ["Portsmouth"], "Q17018120"),
    ("Harwich International Port", ["Harwich"], "LL:1.2510,51.9457 osm:way/1493514521"),
    ("Port of Tyne International Passenger Terminal", ["Tyne"], "LL:-1.4522,54.9925 osm:node/11295271648"),
    ("Hull Ferry Terminal", ["Hull"], "LL:-0.2788,53.7419 osm:way/153258992"),
    ("Plymouth (Millbay)", ["Plymouth"], "Q141523501"),
    ("Newhaven", ["Newhaven"], "Q7231216"),
    ("Fishguard Harbour", ["Fishguard"], "Q121221997"),
    ("Pembroke Dock (Milford Haven)", ["Milford Haven"], "Q104699552"),
    ("Poole", ["Poole"], "Q24677892"),
    ("Immingham (Grimsby and Immingham)", ["Grimsby and Immingham"], "LL:-0.2009,53.6384 osm:way/101338872"),
    ("Southampton cruise terminals", ["Southampton"], "Q7231265"),
    ("London International Cruise Terminal, Tilbury", ["London"], "LL:0.3664,51.4509 osm:node/9010543968"),
    ("Liverpool Cruise Terminal", ["Liverpool"], "LL:-2.9984,53.4068 osm:way/667061582"),
]
IE_PORTS = [("Dublin Port", "IEDUB", "Q2182478"), ("Rosslare Europort", "IEROS", "Q2281650"),
            ("Ringaskiddy (Port of Cork)", "IEORK", "LL:-8.3224,51.8323 osm:way/71433422")]

# Home Office Det_03a row -> (display name, kind, place)
DETENTION = {
    "Brook House": ("Brook House IRC", "Removal centre", "Q28970343"),
    "Colnbrook": ("Colnbrook IRC", "Removal centre", "Q5147761"),
    "Derwentside": ("Derwentside IRC", "Removal centre", "Q66139098"),  # on the former Hassockfield site
    "Campsfield House": ("Campsfield House IRC", "Removal centre", "Q5028541"),
    "Dungavel": ("Dungavel House IRC", "Removal centre", "Q5315105"),
    "Harmondsworth": ("Harmondsworth IRC", "Removal centre", "Q5659193"),
    "Tinsley House": ("Tinsley House IRC", "Removal centre", "Q55099454"),
    "Yarl's Wood": ("Yarl's Wood IRC", "Removal centre", "Q8049351"),
    "Larne House": ("Larne House", "Short-term holding facility", "Q130581362"),
    "Manchester": ("Manchester Airport", "Short-term holding facility", "PC:M905PZ"),  # gov.uk: Building 302, Argosy Drive
    "Swinderby": ("Swinderby", "Short-term holding facility", "Q6914869"),  # the former Morton Hall IRC
}


def get(url: str):
    return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60))


def wikidata_points(ids: list[str]) -> dict[str, tuple[float, float]]:
    out = {}
    for i in range(0, len(ids), 40):
        ents = get("https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=" + "|".join(ids[i:i + 40]))["entities"]
        for qid, ent in ents.items():
            c = ent.get("claims", {}).get("P625")
            if c:
                v = c[0]["mainsnak"]["datavalue"]["value"]
                out[qid] = (round(v["longitude"], 5), round(v["latitude"], 5))
    return out


def icao_points(codes: list[str]) -> dict[str, tuple[str, tuple[float, float]]]:
    values = " ".join(f'"{c}"' for c in codes)
    q = f'SELECT ?icao ?item ?coord WHERE {{ VALUES ?icao {{ {values} }} ?item wdt:P239 ?icao; wdt:P625 ?coord. }}'
    rows = get("https://query.wikidata.org/sparql?format=json&query=" + urllib.parse.quote(q))["results"]["bindings"]
    out = {}
    for r in rows:
        lon, lat = r["coord"]["value"].removeprefix("Point(").rstrip(")").split()
        out.setdefault(r["icao"]["value"], (r["item"]["value"].rsplit("/", 1)[1], (round(float(lon), 5), round(float(lat), 5))))
    return out


def place(spec: str, wd: dict) -> tuple[tuple[float, float], dict]:
    if spec.startswith("Q"):
        return wd[spec], {"wikidata": spec}
    if spec.startswith("LL:"):
        ll, osm = spec[3:].split(" osm:")
        lon, lat = (float(x) for x in ll.split(","))
        return (lon, lat), {"osm_id": osm, "osm_url": f"https://www.openstreetmap.org/{osm}"}
    r = get("https://api.postcodes.io/postcodes/" + spec[3:])["result"]
    return (round(r["longitude"], 5), round(r["latitude"], 5)), {}


def jsonstat_value(d: dict, want: dict[str, str]):
    ids, sizes = d["id"], d["size"]
    idx = 0
    for k, n in zip(ids, sizes):
        cats = list(d["dimension"][k]["category"]["index"])
        idx = idx * n + cats.index(want[k])
    v = d["value"]
    return v[idx] if isinstance(v, list) else v.get(str(idx))


def main(src: Path) -> None:
    feats = []

    def add(name, kind, lonlat, extra, **props):
        feats.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": list(lonlat)},
                      "properties": {"name": name, "kind": kind, **{k: v for k, v in props.items() if v is not None}, **extra}})

    # UK airports (CAA 2025 international terminal passengers)
    intl = {}
    for r in csv.DictReader(open(src / "caa_10_1_2025.csv", encoding="utf-8-sig")):
        intl[r["rpt_apt_name"].strip()] = int(r["total_pax_tp"].replace(",", "") or 0)
    keep = {k: v for k, v in intl.items() if v >= MIN_INTL}
    missing = set(keep) - set(UK_AIRPORTS)
    assert not missing, f"unmapped CAA airports: {missing}"
    pts = icao_points([UK_AIRPORTS[k][1] for k in keep] + list(IE_AIRPORTS))
    for k, pax in sorted(keep.items(), key=lambda kv: -kv[1]):
        name, icao = UK_AIRPORTS[k]
        qid, ll = pts[icao]
        add(name, "Airport", ll, {"wikidata": qid}, icao=icao, passengers=pax,
            passengers_note="International terminal passengers, 2025",
            source="CAA annual airport data 2025, Table 10.1", url=CAA_URL)

    # Irish airports (CSO TAA05, all passengers)
    taa = json.load(open(src / "taa05.json"))
    for icao, name in IE_AIRPORTS.items():
        pax = jsonstat_value(taa, {"STATISTIC": "TAA05", "TLIST(A1)": "2025", "C02935V03550": icao})
        qid, ll = pts[icao]
        add(f"{name} Airport", "Airport", ll, {"wikidata": qid}, icao=icao, passengers=int(pax),
            passengers_note="Passengers, 2025 (all routes)", source="CSO aviation statistics, table TAA05", url=CSO_AIR_URL)

    # UK seaports (DfT SPAS0101, 2025, thousands)
    ws = openpyxl.load_workbook(src / "spas0101.xlsx", read_only=True)["SPAS0101"]
    rows = list(ws.iter_rows(values_only=True))
    head = rows[6]
    col = max(i for i, h in enumerate(head) if h == "2025")
    sea: dict[str, dict[str, float]] = {}
    for r in rows[7:]:
        if not r[0] or not r[2]:
            continue
        port = str(r[2]).split(" [")[0].strip()
        kind = "cruise" if str(r[0]).startswith("International Cruise") else "ferry" if str(r[0]).startswith("Ferry") else None
        if kind and isinstance(r[col], (int, float)):
            sea.setdefault(port, {})[kind] = r[col]
        if str(r[0]).startswith("Channel Tunnel"):
            tunnel = r[col]
    wd = wikidata_points(sorted({s for *_, s in UK_PORTS + IE_PORTS if s.startswith("Q")} | {s for *_, s in DETENTION.values() if s.startswith("Q")}))
    for name, rows_, spec in UK_PORTS:
        f = sum(sea.get(p, {}).get("ferry", 0) for p in rows_)
        c = sum(sea.get(p, {}).get("cruise", 0) for p in rows_)
        assert f + c >= 20, name
        ll, extra = place(spec, wd)
        kind = "Cruise terminal" if f < 20 else "Seaport"
        add(name, kind, ll, extra, passengers=round((f + c) * 1000),
            ferry_passengers=round(f * 1000) if f >= 1 else None, cruise_passengers=round(c * 1000) if c >= 1 else None,
            passengers_note="International sea passengers, 2025",
            source="DfT sea passenger statistics, table SPAS0101", url=DFT_URL)
    ll, extra = place("Q5413870", wikidata_points(["Q5413870"]))
    add("Channel Tunnel (Folkestone terminal)", "Rail tunnel", ll, {"wikidata": "Q5413870"}, passengers=round(tunnel * 1000),
        passengers_note="Channel Tunnel passengers, 2025 (Eurotunnel and Eurostar)",
        source="DfT SPAS0101 (Office of Rail and Road Channel Tunnel figures)", url=DFT_URL)
    ll, _ = place("Q720102", wikidata_points(["Q720102"]))
    add("St Pancras International (Eurostar)", "Rail terminal", ll, {"wikidata": "Q720102"},
        passengers_note="Counted in the Channel Tunnel total; French border checks happen here before boarding",
        source="DfT SPAS0101 (Office of Rail and Road Channel Tunnel figures)", url=DFT_URL)

    # Irish ports (CSO TBA12 passenger cars; CSO stopped publishing foot passengers by port after 2019)
    tba = json.load(open(src / "TBA12.json"))
    for name, code, spec in IE_PORTS:
        cars = jsonstat_value(tba, {"STATISTIC": "TBA12C1", "TLIST(A1)": "2025", "C02354V02832": "-", "C01855V02284": code})
        ll, extra = place(spec, wd)
        add(name, "Seaport", ll, extra, passenger_cars=int(cars),
            source="CSO statistics of port traffic, table TBA12", url=CSO_PORT_URL)

    # UK immigration detention (Home Office Det_03a, as at 30 June 2026)
    ws = openpyxl.load_workbook(src / "det.xlsx", read_only=True)["Det_03a"]
    rows = list(ws.iter_rows(values_only=True))
    col = rows[5].index("30 Jun 2026")
    seen = set()
    section = None
    for r in rows[6:]:
        key = (r[0] or "").strip()
        if key.endswith("(IRC)") or key.endswith("(STHF)") or key.endswith("(PDA)") or key.startswith("HM Prisons"):
            section = key
            continue
        if section and section.endswith(("(IRC)", "(STHF)")) and isinstance(r[col], (int, float)) and key not in seen:
            assert key in DETENTION, f"unmapped detention site: {key}"
            seen.add(key)
            name, kind, spec = DETENTION[key]
            ll, extra = place(spec, wd)
            add(name, kind, ll, extra, detained=int(r[col]), detained_note="People detained, 30 June 2026",
                source="Home Office immigration detention statistics, table Det_03a", url=HO_URL)
    assert len(seen) >= 8, seen  # closed sites (z in the latest column) drop out on their own

    out = REPO / "public/data/immigration.geojson"
    out.write_text(json.dumps({"type": "FeatureCollection", "features": feats}, separators=(",", ":")) + "\n")
    meta_path = REPO / "public/data/extract-meta.json"
    meta = json.loads(meta_path.read_text())
    meta["immigration"] = {"extracted_at": date.today().isoformat(), "layer": "immigration", "count": len(feats),
                           "method": "CAA 2025 and CSO airport passengers, DfT SPAS0101 and CSO port traffic, Home Office Det_03a detention; Wikidata, OSM and postcodes.io coordinates",
                           "license": "CAA statistics (cited); OGL v3 (DfT, Home Office, ONSPD); CC BY 4.0 (CSO); CC0 (Wikidata); ODbL (OSM)"}
    meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
    print(len(feats))
    for f in feats:
        p = f["properties"]
        print(p["kind"], "|", p["name"], f["geometry"]["coordinates"], p.get("passengers") or p.get("passenger_cars") or p.get("detained"))


if __name__ == "__main__":
    main(Path(sys.argv[1]))
