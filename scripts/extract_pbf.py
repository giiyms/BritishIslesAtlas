#!/usr/bin/env python3
"""One pass over Geofabrik extracts (OSM, ODbL) for the layers Overpass can no longer serve.

    python extract_pbf.py OUTDIR file1.osm.pbf [file2.osm.pbf ...]

Needs pyosmium (>= 4) and shapely. Writes OUTDIR/<category>.jsonl, one JSON object per line:
{"osm_id": "node/1", "lon": .., "lat": .., "tags": {...}, "area_m2": ..} for points/areas and
{"osm_id": "way/1", "coords": [[lon, lat], ...], "tags": {...}} for road ways. Objects present
in more than one extract (Northern Ireland is in both the UK and Ireland files) are written once.
"""
from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path

import osmium
from shapely import wkb

LEGEND_NAME = re.compile(
    r"\b(fairy|fairies|faerie|giant'?s|devil'?s|witch'?s|wishing well|king arthur|arthur'?s (?:seat|stone|chair|table|cave|well|quoit|grave)"
    r"|merlin'?s|fionn|finn mac|finn mccool|cu ?chulainn|cuchulain|robin hood'?s|piskie|pixie|boggart|druid'?s|dragon'?s)\b", re.I)


def categories(kind: str, t: dict[str, str]) -> list[str]:
    out = []
    if kind != "way":
        if t.get("amenity") == "school":
            out.append("schools")
        if t.get("landuse") == "cemetery" or t.get("amenity") == "grave_yard":
            out.append("cemeteries")
        if t.get("barrier") == "border_control":
            out.append("border-control")
        if t.get("amenity") == "doctors" or t.get("healthcare") == "doctor":
            out.append("doctors")
        if (t.get("power") == "plant" and "nuclear" in t.get("plant:source", "")) or (
            t.get("power") == "generator" and t.get("generator:source") == "nuclear"):
            out.append("nuclear")
        if t.get("historic") == "archaeological_site":
            out.append("archaeological")
        holy = "holy_well" in (t.get("place_of_worship", ""), t.get("historic", ""), t.get("amenity", ""), t.get("man_made", ""), t.get("natural", ""))
        name = t.get("name", "")
        if holy or (t.get("natural") == "spring" and re.search(r"\b(holy|st\.?|saint|lady'?s|tobar|ffynnon)\b", name, re.I) and "well" in name.lower()) \
                or (name and LEGEND_NAME.search(name)):
            out.append("legends")
    elif t.get("highway") in ("motorway", "trunk"):
        out.append("roads")
    return out


class Collector:
    def __init__(self, outdir: Path):
        self.outdir = outdir
        self.files: dict[str, object] = {}
        self.seen: set[str] = set()
        self.geom = osmium.geom.WKBFactory()

    def write(self, cat: str, rec: dict) -> None:
        key = cat + rec["osm_id"]
        if key in self.seen:
            return
        self.seen.add(key)
        if cat not in self.files:
            self.files[cat] = open(self.outdir / f"{cat}.jsonl", "a", encoding="utf-8")
        self.files[cat].write(json.dumps(rec, ensure_ascii=False) + "\n")

    def run(self, path: str) -> None:
        n = 0
        fp = osmium.FileProcessor(path).with_locations("flex_mem").with_areas()
        for o in fp:
            n += 1
            if n % 20_000_000 == 0:
                print(path, n, flush=True)
            if not o.tags:
                continue
            if o.is_node():
                tags = dict(o.tags)
                for cat in categories("node", tags):
                    self.write(cat, {"osm_id": f"node/{o.id}", "lon": round(o.location.lon, 6), "lat": round(o.location.lat, 6), "tags": tags})
            elif o.is_way():
                tags = dict(o.tags)
                cats = categories("way", tags)
                if cats:
                    coords = [[round(nd.location.lon, 5), round(nd.location.lat, 5)] for nd in o.nodes if nd.location.valid()]
                    if len(coords) >= 2:
                        self.write("roads", {"osm_id": f"way/{o.id}", "coords": coords, "tags": tags})
            elif o.is_area():
                tags = dict(o.tags)
                cats = categories("area", tags)
                if not cats:
                    continue
                try:
                    shape = wkb.loads(self.geom.create_multipolygon(o), hex=True)
                except Exception:
                    continue
                pt = shape.representative_point()
                lat = pt.y
                area = shape.area * (111_320 ** 2) * math.cos(math.radians(lat))
                osm_id = f"{'way' if o.from_way() else 'relation'}/{o.orig_id()}"
                for cat in cats:
                    self.write(cat, {"osm_id": osm_id, "lon": round(pt.x, 6), "lat": round(lat, 6), "tags": tags, "area_m2": round(area)})
        print(path, "done", n, flush=True)


def main() -> int:
    outdir = Path(sys.argv[1])
    outdir.mkdir(parents=True, exist_ok=True)
    for f in outdir.glob("*.jsonl"):
        f.unlink()
    c = Collector(outdir)
    for path in sys.argv[2:]:
        c.run(path)
    for f in c.files.values():
        f.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
