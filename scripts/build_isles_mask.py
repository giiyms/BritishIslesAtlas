#!/usr/bin/env python3
"""Build the British Isles land slab used by the Snapchat theme.

Source: Natural Earth 10m admin-0 countries (public domain).
  curl -sL -o /tmp/ne10.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson
  python3 scripts/build_isles_mask.py /tmp/ne10.geojson
Writes public/data/isles-land.geojson (CCW-oriented land) and
public/data/isles-outside.geojson (everything else in the map's bounds).
"""
import json, sys
from pathlib import Path
from shapely.geometry import shape, mapping, box
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

KEEP = {"GBR", "IRL", "IMN", "GGY", "JEY"}
src = json.load(open(sys.argv[1] if len(sys.argv) > 1 else "/tmp/ne10.geojson"))
geoms = [shape(f["geometry"]) for f in src["features"] if f["properties"].get("ADM0_A3") in KEEP]
land = unary_union(geoms).intersection(box(-11.5, 49.0, 2.5, 61.5)).simplify(0.004, preserve_topology=True)
polys = [orient(p, 1.0) for p in getattr(land, "geoms", [land]) if p.area > 0.0004]
land = unary_union(polys)
polys = [orient(p, 1.0) for p in getattr(land, "geoms", [land])]
out = Path(__file__).resolve().parents[1] / "public" / "data"
def r(g):
    return json.loads(json.dumps(mapping(g)), parse_float=lambda x: round(float(x), 4))
(out / "isles-land.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": [
    {"type": "Feature", "properties": {}, "geometry": r(p)} for p in polys]}, separators=(",", ":")))
outside = box(-30, 35, 30, 72).difference(land)
(out / "isles-outside.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": [
    {"type": "Feature", "properties": {}, "geometry": r(outside)}]}, separators=(",", ":")))
print(len(polys), "polygons")
