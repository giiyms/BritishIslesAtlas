#!/usr/bin/env python3
"""Build the British Isles land slab used by the Snapchat theme.

Source: Natural Earth 10m admin-0 countries (public domain).
  curl -sL -o /tmp/ne10.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson
  python3 scripts/build_isles_mask.py /tmp/ne10.geojson
Writes to public/data/:
  isles-land.geojson    land incl. tiny islands (outline layer draws every islet)
  isles-outside.geojson everything else in the map's bounds (painted cream)
  isles-edge.geojson    smoothed coast for the crisp white edge
  isles-halo.geojson    banded sea glow + drop shadow polygons (land removed), so
                        the shadow is real geometry: no line-offset spikes in fjords.
"""
import json, sys
from pathlib import Path
from shapely.geometry import shape, mapping, box
from shapely.geometry.polygon import orient
from shapely.affinity import translate
from shapely.ops import unary_union

KEEP = {"GBR", "IRL", "IMN", "GGY", "JEY"}
src = json.load(open(sys.argv[1] if len(sys.argv) > 1 else "/tmp/ne10.geojson"))
geoms = [shape(f["geometry"]) for f in src["features"] if f["properties"].get("ADM0_A3") in KEEP]
raw = unary_union(geoms).intersection(box(-11.5, 49.0, 2.5, 61.5))
# Keep islets down to ~0.1 km² (Fair Isle, Scillies, St Kilda); the old 0.0004 cut dropped them.
land = unary_union([p for p in getattr(raw, "geoms", [raw]) if p.area > 0.00001]).simplify(0.003, preserve_topology=True)
polys = [orient(p, 1.0) for p in getattr(land, "geoms", [land]) if not p.is_empty]
land = unary_union(polys)
out = Path(__file__).resolve().parents[1] / "public" / "data"

def r(g, nd=4):
    return json.loads(json.dumps(mapping(g)), parse_float=lambda x: round(float(x), nd))

def fc(features):
    return json.dumps({"type": "FeatureCollection", "features": features}, separators=(",", ":"))

def parts(g):
    return [p for p in getattr(g, "geoms", [g]) if not p.is_empty]

(out / "isles-land.geojson").write_text(fc([{"type": "Feature", "properties": {}, "geometry": r(p)} for p in parts(land)]))
outside = box(-30, 35, 30, 72).difference(land)
(out / "isles-outside.geojson").write_text(fc([{"type": "Feature", "properties": {}, "geometry": r(outside)}]))
edge = land.buffer(0.02, join_style=1).buffer(-0.02, join_style=1).simplify(0.006, preserve_topology=True)
(out / "isles-edge.geojson").write_text(fc([{"type": "Feature", "properties": {}, "geometry": r(p)} for p in parts(edge) if p.area > 0.002]))
# Banded halo. Each band is ring(land buffered by d) − land; shadow bands are also
# shifted south-east (light from the north-west, like the reference).
smooth = land.buffer(0.04, join_style=1).buffer(-0.04, join_style=1)
# Subtract a lightly-simplified land so the bands stay small; the crisp edge hides the seam.
land_cut = land.buffer(0.004).simplify(0.006, preserve_topology=True)
# Cumulative bands so each layer is a thin ring (smaller files).
feats = []
prev = land_cut
for i, d in enumerate([0.04, 0.09, 0.16, 0.26]):  # glow
    ring = smooth.buffer(d, join_style=1, resolution=4).difference(prev).simplify(0.02, preserve_topology=True)
    feats.append({"type": "Feature", "properties": {"kind": "glow", "i": i}, "geometry": r(ring, 3)})
    prev = smooth.buffer(d, join_style=1, resolution=4)
prev = land_cut
for i, d in enumerate([0.03, 0.07, 0.12, 0.18]):  # shadow core → soft
    buffered = translate(smooth.buffer(d, join_style=1, resolution=4), 0.08, -0.06)
    ring = buffered.difference(prev).simplify(0.02, preserve_topology=True)
    feats.append({"type": "Feature", "properties": {"kind": "shadow", "i": i}, "geometry": r(ring, 3)})
    prev = buffered
(out / "isles-halo.geojson").write_text(fc(feats))
print(len(parts(land)), "land polygons")
