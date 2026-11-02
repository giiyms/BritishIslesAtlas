#!/usr/bin/env python3
"""Town gazetteer for place search and the "nearest town" on cards, from GeoNames (CC BY 4.0).

    curl -O https://download.geonames.org/export/dump/cities1000.zip && unzip cities1000.zip
    python3 scripts/build_towns.py cities1000.txt

Writes public/data/towns.json: [name, region, lon, lat, population] for every populated place of
1,000+ people in Great Britain, Ireland, the Isle of Man, Jersey and Guernsey. PPLX (sections of a
populated place) are skipped, as in the population layer, so a card names the town, not a district.
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
REGION = {("GB", "ENG"): "England", ("GB", "SCT"): "Scotland", ("GB", "WLS"): "Wales",
          ("GB", "NIR"): "Northern Ireland"}


def main(path: str) -> int:
    rows = []
    with open(path, encoding="utf-8") as fh:
        for r in csv.reader(fh, delimiter="\t", quoting=csv.QUOTE_NONE):
            name, lat, lon, fclass, fcode, cc, admin1, pop = r[1], r[4], r[5], r[6], r[7], r[8], r[10], int(r[14] or 0)
            if cc not in {"GB", "IE", "IM", "JE", "GG"} or fclass != "P" or fcode == "PPLX" or pop < 1000:
                continue
            region = "Ireland" if cc == "IE" else REGION.get((cc, admin1), "Crown dependency" if cc != "GB" else "")
            if not region:
                continue
            x, y = float(lon), float(lat)
            if not (-11 < x < 2.1 and 49 < y < 61):  # inside the isles (drops e.g. Dhekelia)
                continue
            rows.append([name, region, round(x, 4), round(y, 4), pop])
    rows.sort(key=lambda row: -row[4])
    assert len(rows) > 3000, len(rows)
    (REPO / "public/data/towns.json").write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(len(rows), "towns")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
