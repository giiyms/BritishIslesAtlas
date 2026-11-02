#!/usr/bin/env python3
"""Mountains layer from the Database of British and Irish Hills (DoBIH), CC BY 4.0.

Input: DoBIH csv (hillcsv.zip from https://www.hill-bagging.co.uk/dobih/downloads/),
unzipped; pass the csv path. Keeps the hills on the lists people actually climb:
Marilyns (150 m drop), Munros, Hewitts, Arderins and Wainwrights.

    python3 scripts/build_mountains.py path/to/DoBIH_v18_6.csv
"""
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
LISTS = {"Ma": "Marilyn", "M": "Munro", "C": "Corbett", "G": "Graham", "D": "Donald", "Hew": "Hewitt",
         "N": "Nuttall", "A": "Arderin", "VL": "Vandeleur-Lynam", "W": "Wainwright", "F": "Furth"}
KEEP = ("Ma", "M", "Hew", "A", "W")
COUNTRY = {"S": "Scotland", "E": "England", "W": "Wales", "I": "Ireland", "M": "Isle of Man", "C": "Channel Islands", "ES": "England/Scotland border"}


def main(path: str) -> int:
    version = re.search(r"v(\d+_\d+)", Path(path).name)
    rows = [{k.strip(): (v or "").strip() for k, v in r.items()} for r in csv.DictReader(open(path, encoding="latin-1"))]
    feats = []
    for r in rows:
        if not any(r.get(k) == "1" for k in KEEP):
            continue
        lists = [label for key, label in LISTS.items() if r.get(key) == "1"]
        name, _, alt = r["Name"].partition(" [")
        props = {
            "name": name.strip(),
            "layer": "mountains",
            "note": "Database of British and Irish Hills",
            "source": "DoBIH",
            "ele": round(float(r["Metres"]), 1),
            "prominence": round(float(r["Drop"]), 1) if r["Drop"] else None,
            "lists": ", ".join(lists),
            "county": r["County"],
            "country": COUNTRY.get(r["Country"], r["Country"]),
            "dobih_id": int(r["Number"]),
            "url": r["Hill-bagging"],
        }
        if alt:
            props["alt_name"] = alt.rstrip("]").strip()
        if r.get("Feature"):
            props["summit_feature"] = r["Feature"]
        feats.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [
            round(float(r["Longitude"]), 6), round(float(r["Latitude"]), 6)]}, "properties": props})
    feats.sort(key=lambda f: f["properties"]["dobih_id"])
    out = REPO / "public/data/mountains.geojson"
    out.write_text(json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False, separators=(",", ":")) + "\n")
    meta_path = REPO / "public/data/extract-meta.json"
    meta = json.loads(meta_path.read_text())
    meta["mountains"] = {"layer": "mountains", "count": len(feats), "license": "CC BY 4.0",
                         "source": f"Database of British and Irish Hills v{version.group(1).replace('_', '.') if version else '?'}",
                         "url": "https://www.hill-bagging.co.uk/dobih/downloads/",
                         "filter": "Marilyn, Munro, Hewitt, Arderin or Wainwright"}
    meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
    print(len(feats))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
