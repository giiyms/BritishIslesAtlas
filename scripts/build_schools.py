#!/usr/bin/env python3
"""Schools layer: every open school in the isles, with Ofsted grades for England.

Card links (Ofsted report, GIAS record or OSM object) are built in src/fact-rows.ts from urn/osm_id
to keep this default-on file small.

England: Get Information about Schools (DfE, OGL) all-establishments extract, open schools only,
    joined on URN to Ofsted's "State-funded schools inspections and outcomes" management information
    (OGL). Positions are GIAS easting/northing (OSGB36) converted to WGS84.
        https://get-information-schools.service.gov.uk/Downloads  (edubasealldata*.csv, latin-1)
        https://www.gov.uk/government/statistical-data-sets/monthly-management-information-ofsteds-school-inspections-outcomes
Wales, Scotland, Northern Ireland, Ireland, the Isle of Man and the Channel Islands:
    OpenStreetMap amenity=school (ODbL) from scripts/extract_pbf.py, minus anything inside England
    (ONS Countries December 2023 BUC, OGL) or within 150 m of a GIAS school.

    python3 scripts/build_schools.py gias.csv ofsted.csv countries.geojson schools.jsonl
"""
from __future__ import annotations

import csv
import json
import math
import sys
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import Point, shape
from shapely.strtree import STRtree

REPO = Path(__file__).resolve().parents[1]
SKIP_TYPES = {"British schools overseas", "Offshore schools", "Online provider", "Welsh establishment",
              "Service children's education", "Miscellaneous"}
SKIP_GROUPS = {"Universities"}
OEIF = {"1": "Outstanding", "2": "Good", "3": "Requires improvement", "4": "Inadequate"}
INSPECTORATE = {"Wales": "Estyn", "Scotland": "Education Scotland", "Northern Ireland": "Education and Training Inspectorate",
                "Ireland": "Department of Education Inspectorate", "Isle of Man": "Isle of Man Department of Education",
                "Jersey": "Jersey Schools Review Framework", "Guernsey": "Guernsey Education Services"}
REPORT_CARD = [("Achievement", "achievement"), ("Curriculum and teaching", "curriculum"),
               ("Attendance and behaviour", "behaviour"), ("Personal development and wellbeing", "wellbeing"),
               ("Inclusion", "inclusion"), ("Leadership and governance", "leadership"),
               ("Safeguarding standards", "safeguarding")]


def val(v: str) -> str:
    v = (v or "").strip()
    return "" if v in ("NULL", "Not applicable", "Not judged") else v


def uk_date(d: str) -> str:
    d = val(d)
    if not d:
        return ""
    day, month, year = d.split("/")
    return f"{year}-{month}-{day}"


def ofsted(row: dict) -> dict:
    out: dict = {}
    if val(row["Inspection type"]):
        for col, key in REPORT_CARD:
            if val(row[col]):
                out[f"ofsted_{key}"] = val(row[col])
        out["ofsted_date"] = uk_date(row["Inspection start date"])
        out["ofsted_framework"] = "Report card"
    grade = OEIF.get(val(row["Latest OEIF overall effectiveness"]))
    if grade:
        out["ofsted_overall"] = grade
        out["ofsted_overall_date"] = uk_date(row["Inspection start date of latest OEIF graded inspection"])
    if val(row["Ungraded inspection overall outcome"]):
        out["ofsted_ungraded"] = val(row["Ungraded inspection overall outcome"]).split(" - ")[0]
        out["ofsted_ungraded_date"] = uk_date(row["Date of latest ungraded inspection"])
    return out


def england(gias: str, ofsted_csv: str) -> list[dict]:
    with open(ofsted_csv, encoding="cp1252") as fh:
        grades = {r["URN"]: ofsted(r) for r in csv.DictReader(fh)}
    bng = Transformer.from_crs("EPSG:27700", "EPSG:4326", always_xy=True)
    feats = []
    with open(gias, encoding="latin-1") as fh:
        for r in csv.DictReader(fh):
            if not r["EstablishmentStatus (name)"].startswith("Open") or not r["Easting"]:
                continue
            if r["TypeOfEstablishment (name)"] in SKIP_TYPES or r["EstablishmentTypeGroup (name)"] in SKIP_GROUPS:
                continue
            if r["Country (name)"] not in ("", "United Kingdom"):
                continue
            lon, lat = bng.transform(float(r["Easting"]), float(r["Northing"]))
            urn = r["URN"]
            p = {"name": r["EstablishmentName"], "nation": "England", "urn": int(urn),
                 "phase": val(r["PhaseOfEducation (name)"]), "school_type": r["TypeOfEstablishment (name)"],
                 "ages": f'{r["StatutoryLowAge"]}–{r["StatutoryHighAge"]}' if r["StatutoryLowAge"] and r["StatutoryHighAge"] else "",
                 "pupils": int(r["NumberOfPupils"]) if r["NumberOfPupils"].isdigit() else None,
                 "gender": val(r["Gender (name)"]), "religion": val(r["ReligiousCharacter (name)"]).replace("Does not apply", ""),
                 "town": r["Town"]}
            p.update(grades.get(urn, {}))
            if r["EstablishmentTypeGroup (name)"] == "Independent schools":
                insp = val(r["InspectorateName (name)"])
                p["inspectorate"] = {"ISI": "Independent Schools Inspectorate", "SIS": "School Inspection Service"}.get(insp, insp) or "Ofsted"
            feats.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(lon, 5), round(lat, 5)]},
                          "properties": {k: v for k, v in p.items() if v not in (None, "")}})
    return feats


def nation_of(pt: Point, countries: dict) -> str | None:
    for name, geom in countries.items():
        if geom.contains(pt):
            return name
    lon, lat = pt.x, pt.y
    if -4.9 < lon < -4.25 and 54.0 < lat < 54.45:
        return "Isle of Man"
    if lat < 49.8 and lon > -2.7:
        return "Guernsey" if lon < -2.35 or lat > 49.4 else "Jersey"
    near = min(countries, key=lambda n: countries[n].distance(pt))
    return near if countries[near].distance(pt) < 0.06 else ("Ireland" if lon < -5.4 else None)


def others(countries_path: str, jsonl: str, gias_feats: list[dict]) -> list[dict]:
    countries = {f["properties"]["CTRY23NM"]: shape(f["geometry"]) for f in json.load(open(countries_path))["features"]}
    gias_pts = [Point(f["geometry"]["coordinates"]) for f in gias_feats]
    tree = STRtree(gias_pts)
    feats, seen = [], []
    for line in open(jsonl, encoding="utf-8"):
        rec = json.loads(line)
        t = rec["tags"]
        name = t.get("name") or t.get("name:en")
        if not name or t.get("disused") or t.get("abandoned") or t.get("school") == "closed":
            continue
        pt = Point(rec["lon"], rec["lat"])
        nation = nation_of(pt, countries)
        if nation in (None, "England"):
            continue
        near = tree.query(pt.buffer(0.0022))  # ~150-240 m
        if any(gias_pts[i].distance(pt) < 0.0022 for i in near):
            continue
        p = {"name": name, "nation": nation, "osm_id": rec["osm_id"], "inspectorate": INSPECTORATE[nation]}
        for k, key in (("isced:level", "isced"), ("school", "school_kind")):
            if t.get(k):
                p[key] = t[k]
        feats.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(rec["lon"], 5), round(rec["lat"], 5)]}, "properties": p})
    # an OSM school mapped as both a node and a building outline: keep the outline's point
    feats.sort(key=lambda f: (f["properties"]["name"].lower(), not f["properties"]["osm_id"].startswith("node")))
    kept: list[dict] = []
    for f in feats:
        if kept and kept[-1]["properties"]["name"].lower() == f["properties"]["name"].lower() and \
                Point(kept[-1]["geometry"]["coordinates"]).distance(Point(f["geometry"]["coordinates"])) < 0.003:
            continue
        kept.append(f)
    return kept


def main(gias: str, ofsted_csv: str, countries: str, jsonl: str) -> int:
    eng = england(gias, ofsted_csv)
    rest = others(countries, jsonl, eng)
    feats = eng + rest
    (REPO / "public/data/schools.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False, separators=(",", ":")) + "\n")
    meta_path = REPO / "public/data/extract-meta.json"
    meta = json.loads(meta_path.read_text())
    meta["schools"] = {"layer": "schools", "count": len(feats), "license": "OGL v3 (DfE, Ofsted); ODbL (OpenStreetMap)",
                       "source": "GIAS + Ofsted MI (England); OpenStreetMap amenity=school (elsewhere)",
                       "url": "https://get-information-schools.service.gov.uk/Downloads", "filter": "open schools; universities excluded"}
    meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
    from collections import Counter
    print(len(eng), len(rest), Counter(f["properties"]["nation"] for f in feats))
    return 0


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:5]))
