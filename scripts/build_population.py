#!/usr/bin/env python3
"""Population layer: settlements of 10,000+ people from GeoNames (CC BY 4.0).

    curl -O https://download.geonames.org/export/dump/cities1000.zip && unzip cities1000.zip
    python3 scripts/build_population.py cities1000.txt

Keeps Great Britain, Ireland, the Isle of Man, Jersey and Guernsey; skips PPLX (sections of a
populated place, e.g. districts inside a city) so a city is not counted twice by its own parts.
"""
from __future__ import annotations

import csv
import json
import math
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
COUNTRIES = {"GB", "IE", "IM", "JE", "GG"}
NATION = {("GB", "ENG"): "England", ("GB", "SCT"): "Scotland", ("GB", "WLS"): "Wales", ("GB", "NIR"): "Northern Ireland",
          ("IM", ""): "Isle of Man", ("JE", ""): "Jersey", ("GG", ""): "Guernsey"}
MIN_POP = 10_000


def main(path: str) -> int:
    feats = []
    with open(path, encoding="utf-8") as fh:
        for r in csv.reader(fh, delimiter="\t", quoting=csv.QUOTE_NONE):
            gid, name, _ascii, _alt, lat, lon, fclass, fcode, cc = r[:9]
            admin1, pop, modified = r[10], int(r[14] or 0), r[18]
            if cc not in COUNTRIES or fclass != "P" or fcode == "PPLX" or pop < MIN_POP:
                continue
            if not (-11 < float(lon) < 2 and 49 < float(lat) < 61):  # e.g. Dhekelia, a UK base in Cyprus

                continue
            nation = "Ireland" if cc == "IE" else NATION.get((cc, admin1), NATION.get((cc, ""), cc))
            feats.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(float(lon), 5), round(float(lat), 5)]},
                          "properties": {"name": name, "layer": "population", "pop": pop, "nation": nation,
                                         "r": round(max(5, min(32, math.sqrt(pop) / 75)), 1),
                                         "geonames_id": int(gid), "updated": modified, "source": "GeoNames",
                                         "url": f"https://www.geonames.org/{gid}"}})
    feats.sort(key=lambda f: -f["properties"]["pop"])  # big discs first, small ones drawn on top
    (REPO / "public/data/population.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False, separators=(",", ":")) + "\n")
    meta_path = REPO / "public/data/extract-meta.json"
    meta = json.loads(meta_path.read_text())
    meta["population"] = {"layer": "population", "count": len(feats), "license": "CC BY 4.0", "source": "GeoNames cities1000",
                          "url": "https://download.geonames.org/export/dump/", "filter": f"population >= {MIN_POP:,}, not PPLX"}
    meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
    print(len(feats))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
