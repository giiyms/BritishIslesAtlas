#!/usr/bin/env python3
"""Census layer: one marker per local authority with its latest census headline figures.

England & Wales: Census 2021 via Nomis (TS001 residents, TS004 country of birth, TS007B age),
    2023 local authorities (geography TYPE424). Open Government Licence.
        https://www.nomisweb.co.uk/api/v01/dataset/NM_2021_1.data.csv?date=latest&geography=TYPE424&measures=20100
        (same for NM_2024_1 and NM_2018_1)
Scotland: Census 2022 output-area bulk tables UV101b and UV204b (National Records of Scotland, OGL),
    summed to council areas with the NRS OutputAreaCent2022 lookup (maps.gov.scot NRS/Census2022
    MapServer layer 2, fields code,council). NRS perturbs OA cells, so sums can differ slightly
    from NRS's own council totals.
Northern Ireland: Census 2021, NISRA flexible table builder (OGL)
        https://build.nisra.gov.uk/en/custom/table.csv?d=PEOPLE&v=LGD14&v=COB_BASIC
        https://build.nisra.gov.uk/en/custom/table.csv?d=PEOPLE&v=LGD14&v=AGE_BAND_5YR
Ireland: Census 2022, CSO PxStat SAP2022T1T1ACTY (age) and SAP2022T2T1CTY (birthplace), CC BY 4.0.
Marker positions: ONS LAD December 2023 BGC LAT/LONG (OGL) for the UK; for Ireland the centroid
    of the largest part of each Tailte Éireann 2024 local authority boundary (CC BY 4.0).

    python3 scripts/build_census.py <dir with the downloads>
"""
from __future__ import annotations

import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
NATION = {"E": "England", "W": "Wales", "S": "Scotland", "N": "Northern Ireland"}


def rows(path: Path):
    with open(path, encoding="utf-8-sig") as fh:
        yield from csv.DictReader(fh)


def england_wales(src: Path) -> dict[str, dict]:
    out: dict[str, dict] = defaultdict(dict)
    for r in rows(src / "NM_2021_1.csv"):
        if r["C2021_RESTYPE_3_NAME"].startswith("Total"):
            out[r["GEOGRAPHY_CODE"]].update(name=r["GEOGRAPHY_NAME"], residents=int(r["OBS_VALUE"]))
    for r in rows(src / "NM_2024_1.csv"):
        if r["C2021_COB_12_NAME"] == "Europe: United Kingdom":
            out[r["GEOGRAPHY_CODE"]]["uk_born"] = int(r["OBS_VALUE"])
    for r in rows(src / "NM_2018_1.csv"):
        age = r["C2021_AGE_12A_NAME"]
        o = out[r["GEOGRAPHY_CODE"]]
        if age in ("Aged 65 to 74 years", "Aged 75 to 84 years", "Aged 85 years and over"):
            o["over65"] = o.get("over65", 0) + int(r["OBS_VALUE"])
    for code, o in out.items():
        o.update(born_outside=o["residents"] - o["uk_born"], year=2021, source="ONS Census 2021 (Nomis)",
                 url=f"https://www.ons.gov.uk/explore-local-statistics/areas/{code}")
    return out


def num(cell: str) -> int:
    """NRS writes '-' for a zero cell."""
    cell = cell.strip()
    return 0 if cell in ("-", "") else int(cell)


def scot_table(path: Path, header: str) -> dict[str, int]:
    with open(path, encoding="utf-8-sig") as fh:
        data = list(csv.reader(fh))
    col = next(i for i, (a, b, c) in enumerate(zip(data[4], data[5], data[6])) if a == header and b == "All people" and c == "Total")
    return {r[0]: num(r[col]) for r in data[7:] if r and r[0].startswith("S00")}


def scotland(src: Path) -> dict[str, dict]:
    council = json.loads((src / "scot_oa_council.json").read_text())
    age_path = src / "scot/UV101b - Usual resident population by sex by age (6).csv"
    cob_path = src / "scot/UV204b - Country of birth (14) by sex by age (6).csv"
    total = scot_table(age_path, "All people")
    with open(age_path, encoding="utf-8-sig") as fh:
        data = list(csv.reader(fh))
    c65 = next(i for i, (a, b, c) in enumerate(zip(data[4], data[5], data[6])) if a == "All people" and b == "All people" and c == "65 and over")
    over65 = {r[0]: num(r[c65]) for r in data[7:] if r and r[0].startswith("S00")}
    uk_born = scot_table(cob_path, "Europe: United Kingdom: Total")
    out: dict[str, dict] = defaultdict(lambda: {"residents": 0, "over65": 0, "uk_born": 0})
    for oa, n in total.items():
        o = out[council[oa]]
        o["residents"] += n
        o["over65"] += over65.get(oa, 0)
        o["uk_born"] += uk_born.get(oa, 0)
    for o in out.values():
        o.update(born_outside=o["residents"] - o["uk_born"], year=2022, source="Scotland's Census 2022 (NRS)",
                 url="https://www.scotlandscensus.gov.uk/search-the-census")
    return out


def northern_ireland(src: Path) -> dict[str, dict]:
    out: dict[str, dict] = defaultdict(lambda: {"residents": 0, "over65": 0, "uk_born": 0})
    for r in rows(src / "ni_age.csv"):
        o = out[r["Local Government District 2014 Code"]]
        o["name"] = r["Local Government District 2014 Label"]
        n = int(r["Count"])
        o["residents"] += n
        if int(r["Age - 19 Categories Label"].split("-")[0].split()[0].rstrip("+")) >= 65:
            o["over65"] += n
    for r in rows(src / "ni_v_LGD14_v_COB_BASIC.csv"):
        if r["Country of Birth - 12 Categories Label"].startswith("Europe: United Kingdom"):
            out[r["Local Government District 2014 Code"]]["uk_born"] += int(r["Count"])
    for o in out.values():
        o.update(born_outside=o["residents"] - o["uk_born"], year=2021, source="NISRA Census 2021",
                 url="https://build.nisra.gov.uk/en/custom/data?d=PEOPLE&v=LGD14&v=COB_BASIC")
    return out


def ireland(src: Path) -> list[dict]:
    cent = json.loads((src / "ie_la_cent.json").read_text())
    norm = lambda s: " ".join(s.upper().replace("&", "AND").replace("DÚN", "DUN").replace(" RATHDOWN", "-RATHDOWN").split())
    out: dict[str, dict] = defaultdict(lambda: {"over65": 0})
    for r in rows(src / "ie_SAP2022T1T1ACTY.csv"):
        if r["Sex"] != "Both Sexes" or r["Administrative Counties 2019"] == "Ireland":
            continue
        o = out[r["Administrative Counties 2019"]]
        if r["Age"] == "Total":
            o["residents"] = int(r["VALUE"])
        elif int(r["Age"].split()[1].split("-")[0]) >= 65:
            o["over65"] += int(r["VALUE"])
    for r in rows(src / "ie_SAP2022T2T1CTY.csv"):
        if r["Statistic Label"].endswith("birthplace") and r["Administrative Counties"] in out:
            o = out[r["Administrative Counties"]]
            if r["Location"] == "Total":
                o["birth_total"] = int(r["VALUE"])
            elif r["Location"] == "Ireland":
                o["ie_born"] = int(r["VALUE"])
    feats = []
    for name, o in out.items():
        lon, lat = cent[norm(name)]
        feats.append(feature(lon, lat, " ".join(name.split()), "Ireland", f"cso-{norm(name).lower().replace(' ', '-')}", o["residents"],
                             o["birth_total"] - o["ie_born"], o["birth_total"], o["over65"], 2022,
                             "CSO Census 2022", "https://data.cso.ie/table/SAP2022T2T1CTY", "born_outside_ie_pct"))
    return feats


def feature(lon, lat, name, nation, code, residents, born_outside, birth_base, over65, year, source, url, born_key):
    return {"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(lon, 5), round(lat, 5)]},
            "properties": {"name": name, "layer": "census", "area_code": code, "nation": nation, "census_year": year,
                           "residents": residents, born_key: round(100 * born_outside / birth_base, 1),
                           "over65_pct": round(100 * over65 / residents, 1), "source": source, "url": url}}


def main(src_dir: str) -> int:
    src = Path(src_dir)
    lad = {f["attributes"]["LAD23CD"]: f["attributes"] for f in json.loads((src / "lad23.json").read_text())["features"]}
    feats = []
    for table in (england_wales(src), scotland(src), northern_ireland(src)):
        for code, o in table.items():
            a = lad[code]
            feats.append(feature(a["LONG"], a["LAT"], o.get("name") or a["LAD23NM"], NATION[code[0]], code, o["residents"],
                                 o["born_outside"], o["residents"], o["over65"], o["year"], o["source"], o["url"], "born_outside_uk_pct"))
    feats += ireland(src)
    missing = set(lad) - {f["properties"]["area_code"] for f in feats}
    assert not missing, f"no census figures for {sorted(missing)}"
    feats.sort(key=lambda f: -f["properties"]["residents"])
    (REPO / "public/data/census.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False, separators=(",", ":")) + "\n")
    meta_path = REPO / "public/data/extract-meta.json"
    meta = json.loads(meta_path.read_text())
    meta["census"] = {"layer": "census", "count": len(feats), "license": "OGL v3 (ONS, NRS, NISRA); CC BY 4.0 (CSO, Tailte Éireann)",
                      "source": "Census 2021 (E&W, NI), Census 2022 (Scotland, Ireland)",
                      "url": "https://www.nomisweb.co.uk/sources/census_2021", "filter": "one marker per local authority"}
    meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
    print(len(feats), sum(f["properties"]["residents"] for f in feats))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
