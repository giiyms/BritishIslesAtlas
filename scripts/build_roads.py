#!/usr/bin/env python3
"""Roads layer: every motorway and trunk road in the isles from OpenStreetMap (ODbL).

Input is roads.jsonl from scripts/extract_pbf.py (highway=motorway|trunk ways from the Geofabrik
Great Britain, Ireland and Northern Ireland, Isle of Man and Guernsey and Jersey extracts). Ways are
grouped by road number (ref, else name) and class, merged into continuous lines, simplified to about
25 m and written as one feature per road.

Road numbers repeat across jurisdictions (there is an M1 in England, Northern Ireland and Ireland),
so ways are also split by nation using the ONS Countries December 2023 outlines (OGL).

    python3 scripts/build_roads.py roads.jsonl countries.geojson
"""
from __future__ import annotations

import json
import math
import sys
from collections import defaultdict
from pathlib import Path

from shapely import line_merge, simplify
from shapely.geometry import LineString, MultiLineString, Point, mapping, shape
from shapely.strtree import STRtree

REPO = Path(__file__).resolve().parents[1]
TOLERANCE = 0.00025  # degrees, ~25 m north-south


def length_km(geom) -> float:
    total = 0.0
    lines = geom.geoms if hasattr(geom, "geoms") else [geom]
    for line in lines:
        pts = list(line.coords)
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
            dx = (x2 - x1) * 111.32 * math.cos(math.radians((y1 + y2) / 2))
            dy = (y2 - y1) * 110.57
            total += math.hypot(dx, dy)
    return total


def nation_finder(countries_path: str):
    polys = [(f["properties"]["CTRY23NM"], shape(f["geometry"])) for f in json.load(open(countries_path))["features"]]

    def find(lon: float, lat: float) -> str:
        pt = Point(lon, lat)
        for name, poly in polys:
            if poly.contains(pt):
                return name
        if -4.9 < lon < -4.25 and 54.0 < lat < 54.45:
            return "Isle of Man"
        if lat < 49.8:
            return "Channel Islands"
        if lon < -5.4 and lat < 55.45:
            return "Ireland"
        return min(polys, key=lambda np: np[1].distance(pt))[0]
    return find


def main(jsonl: str, countries: str) -> int:
    nation_of = nation_finder(countries)
    groups: dict[tuple[str, str, str], list[LineString]] = defaultdict(list)
    names: dict[tuple[str, str, str], dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for line in open(jsonl, encoding="utf-8"):
        rec = json.loads(line)
        t = rec["tags"]
        ref = (t.get("ref") or "").split(";")[0].strip()
        name = t.get("name", "").strip()
        mid = rec["coords"][len(rec["coords"]) // 2]
        key = (ref or name or "unnamed", t["highway"], nation_of(*mid))
        if key[0] == "unnamed":
            continue
        groups[key].append(LineString(rec["coords"]))
        if name:
            names[key][name] += len(rec["coords"])
    feats = []
    for (ref, highway, nation), lines in groups.items():
        merged = simplify(line_merge(MultiLineString(lines)), TOLERANCE, preserve_topology=False)
        parts = [g for g in (merged.geoms if hasattr(merged, "geoms") else [merged]) if g.length > 0]
        if not parts:
            continue
        geom = parts[0] if len(parts) == 1 else MultiLineString(parts)
        km = length_km(geom)
        if km < 0.3 or (not ref and km < 2):
            continue
        coords = mapping(geom)["coordinates"]
        rnd = (lambda c: [[round(x, 5), round(y, 5)] for x, y in c])
        geometry = {"type": "LineString", "coordinates": rnd(coords)} if geom.geom_type == "LineString" else \
            {"type": "MultiLineString", "coordinates": [rnd(c) for c in coords]}
        common = max(names[(ref, highway, nation)].items(), key=lambda kv: kv[1])[0] if names[(ref, highway, nation)] else ""
        props = {"name": ref if ref != common else common, "ref": ref if ref != common else None,
                 "road_class": "Motorway" if highway == "motorway" else "Trunk road",
                 "nation": nation}
        feats.append({"type": "Feature", "geometry": geometry, "properties": {k: v for k, v in props.items() if v is not None}})
    feats.sort(key=lambda f: (f["properties"]["road_class"], f["properties"]["name"]))
    (REPO / "public/data/roads.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False, separators=(",", ":")) + "\n")
    meta_path = REPO / "public/data/extract-meta.json"
    meta = json.loads(meta_path.read_text())
    meta["roads"] = {"layer": "roads", "count": len(feats), "license": "ODbL 1.0", "source": "OpenStreetMap via Geofabrik extracts",
                     "url": "https://download.geofabrik.de/europe.html", "filter": "highway=motorway|trunk, merged per ref, simplified ~25 m"}
    meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
    print(len(feats), sum(1 for f in feats if f["properties"]["road_class"] == "Motorway"))
    return 0


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:3]))
