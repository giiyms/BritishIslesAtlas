#!/usr/bin/env python3
"""GP practices across the isles from each nation's official register, OSM where none exists.

    python3 scripts/build_health.py SRC_DIR OSM_OUT_DIR COUNTRIES_GEOJSON

SRC_DIR holds:
  epraccur.csv            NHS ODS predefined report "epraccur" (England and Wales; OGL)
  scot.csv                Public Health Scotland GP practice contact details and list sizes (OGL)
  ni.csv                  BSO GP Practice Reference File via OpenDataNI (OGL)
  ratings-Locations.csv   CQC latest ratings, Locations sheet (OGL), joined on ODS code
  ie_gps.csv              HSE Service Directory "Family Practice (GP) Sites", May 2022 (CC BY 4.0; data.gov.ie,
                          since withdrawn there, archived copy at web.archive.org)
  postcodes.json          postcode -> [lon, lat] cache, filled from postcodes.io (ONS Postcode Directory, OGL)
OSM_OUT_DIR/doctors.jsonl (scripts/extract_pbf.py) supplies the Isle of Man and the Channel Islands, which publish no register.
"""
from __future__ import annotations

import csv
import json
import re
import sys
import urllib.request
from datetime import date
from pathlib import Path

from shapely.geometry import Point, shape
from shapely.prepared import prep

REPO = Path(__file__).resolve().parents[1]
KEEP_UPPER = {"NHS", "GP", "PCN", "UK", "HC", "MC", "UHB", "LLP", "BMA", "II", "III"}


def norm_pc(pc: str) -> str:
    return re.sub(r"\s+", "", pc).upper()


def tidy(name: str) -> str:
    """Register names are upper case: title-case them, keeping acronyms and small words."""
    name = re.sub(r"\s+", " ", name).strip()
    letters = [c for c in name if c.isalpha()]
    if not letters or sum(c.isupper() for c in letters) < 0.8 * len(letters):
        return name
    out = []
    for n, w in enumerate(name.split(" ")):
        if w in KEEP_UPPER:
            out.append(w)
        elif n and w.lower() in ("and", "of", "the", "at", "in", "on"):
            out.append(w.lower())
        else:
            out.append(re.sub(r"[A-Za-z]+('[A-Za-z]+)?", lambda m: m.group(0).capitalize(), w.lower()))
    return " ".join(out)


def geocode(pcs: set[str], cache_file: Path) -> dict:
    cache = json.loads(cache_file.read_text()) if cache_file.exists() else {}
    todo = sorted(p for p in pcs if p not in cache)
    for i in range(0, len(todo), 100):
        chunk = todo[i:i + 100]
        req = urllib.request.Request("https://api.postcodes.io/postcodes", data=json.dumps({"postcodes": chunk}).encode(),
                                     headers={"Content-Type": "application/json"})
        for item in json.load(urllib.request.urlopen(req, timeout=60))["result"]:
            r = item["result"]
            cache[norm_pc(item["query"])] = [r["longitude"], r["latitude"]] if r and r.get("longitude") is not None else None
    if todo:
        cache_file.write_text(json.dumps(cache))
    return cache


def main(src: Path, osm_out: Path, countries: Path) -> int:
    rows = []
    for r in csv.reader(open(src / "epraccur.csv", encoding="latin-1")):
        if r[12] == "ACTIVE" and r[25] == "RO76":  # RO76 = GP practice
            rows.append({"name": tidy(r[1]), "nation": "Wales" if r[0].startswith("W") else "England", "code": r[0], "pc": norm_pc(r[9])})
    for r in csv.DictReader(open(src / "scot.csv", encoding="utf-8-sig")):
        rows.append({"name": tidy(r["GPPracticeName"]), "nation": "Scotland", "code": r["PracticeCode"], "pc": norm_pc(r["Postcode"]),
                     "patients": int(r["PracticeListSize"])})
    for r in csv.DictReader(open(src / "ni.csv", encoding="utf-8-sig", errors="replace")):
        if not r.get("PracNo", "").strip().isdigit():
            continue
        a1 = r["Address1"].strip()
        label = a1 if re.search(r"PRACTICE|SURGERY|CENTRE|CLINIC|MEDICAL|HEALTH", a1, re.I) else r["PracticeName"]
        rows.append({"name": tidy(label), "nation": "Northern Ireland", "code": r["PracNo"].strip(), "pc": norm_pc(r["Postcode"]),
                     "patients": int(r["Registered_Patients"]), "partners": tidy(r["PracticeName"])})
    coords = geocode({r["pc"] for r in rows}, src / "postcodes.json")

    cqc = {}
    for r in csv.DictReader(open(src / "ratings-Locations.csv", encoding="utf-8", errors="replace")):
        if r["Location Primary Inspection Category"] == "GP Practices" and r["Domain"] == "Overall" and r["Service / Population Group"] == "Overall" \
                and r["Location ODS Code"]:
            cqc[r["Location ODS Code"]] = (r["Latest Rating"], r["Publication Date"], r["Location ID"])

    feats, missing = [], 0
    for r in rows:
        ll = coords.get(r["pc"])
        if not ll:
            missing += 1
            continue
        p = {"name": r["name"], "nation": r["nation"], "code": r["code"]}
        for k in ("patients", "partners"):
            if r.get(k):
                p[k] = r[k]
        if r["code"] in cqc:
            rating, when, cid = cqc[r["code"]]
            p["cqc_rating"], p["cqc_id"] = rating, cid
            if re.fullmatch(r"\d\d/\d\d/\d{4}", when):
                m, d, y = when.split("/")
                p["cqc_date"] = f"{y}-{m}-{d}"
        feats.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(ll[0], 5), round(ll[1], 5)]}, "properties": p})

    hse = 0
    for r in csv.DictReader(open(src / "ie_gps.csv", encoding="utf-8-sig", errors="replace")):
        try:
            lat, lon = float(r["Latitude"]), float(r["Longitude"])
        except ValueError:
            continue
        if not (51.3 < lat < 55.5 and -10.7 < lon < -5.9) or not r["Name"].strip():
            continue
        feats.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(lon, 5), round(lat, 5)]},
                      "properties": {"name": tidy(r["Name"]), "nation": "Ireland", "address": r["Address"].strip(),
                                     "hse_id": r["Id"].strip(), "updated": r["Date Of Last Update"].strip()}})
        hse += 1

    uk = prep(shape({"type": "GeometryCollection", "geometries": [f["geometry"] for f in json.load(open(countries))["features"]]}).buffer(0.002))
    osm = 0
    for line in open(osm_out / "doctors.jsonl", encoding="utf-8"):
        rec = json.loads(line)
        t = rec["tags"]
        lon, lat = rec["lon"], rec["lat"]
        if not t.get("name") or uk.contains(Point(lon, lat)):
            continue
        if -4.9 < lon < -4.3 and 54.0 < lat < 54.45:
            nation = "Isle of Man"
        elif lat < 49.8 and lon < -1.9:
            nation = "Channel Islands"
        else:
            continue  # Ireland comes from the HSE register
        feats.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(lon, 5), round(lat, 5)]},
                      "properties": {"name": t["name"], "nation": nation, "osm_id": rec["osm_id"]}})
        osm += 1
    feats.sort(key=lambda f: (f["properties"]["nation"], f["properties"]["name"]))
    (REPO / "public/data/health.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False, separators=(",", ":")) + "\n")
    meta_path = REPO / "public/data/extract-meta.json"
    meta = json.loads(meta_path.read_text())
    meta["health"] = {"extracted_at": date.today().isoformat(), "layer": "health", "count": len(feats),
                      "method": "NHS ODS epraccur + PHS + BSO registers geocoded by postcode; HSE Service Directory (Ireland, May 2022); OSM amenity=doctors for the Isle of Man and Channel Islands",
                      "license": "OGL v3 (UK registers, CQC, ONSPD); CC BY 4.0 (HSE); ODbL 1.0 (OSM part)"}
    meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
    from collections import Counter
    print(len(feats), "missing postcodes", missing, "hse", hse, "osm", osm, "cqc", sum("cqc_rating" in f["properties"] for f in feats),
          Counter(f["properties"]["nation"] for f in feats))
    return 0


if __name__ == "__main__":
    sys.exit(main(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])))
