#!/usr/bin/env python3
"""Audit point counts and prebuild compact density styles. No network access required."""
import argparse
import json
import math
from pathlib import Path
import numpy as np
from scipy.ndimage import gaussian_filter
from shapely import set_precision
from shapely.geometry import shape, Point, Polygon, MultiPolygon, LinearRing, mapping
from shapely.ops import transform, unary_union
from shapely.strtree import STRtree
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from build_density_bins import build_for_layer, RAMP

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public/data"
OUT = DATA / "density"

def write(name, data):
    path = OUT / name
    path.write_text(json.dumps(data, separators=(",", ":")) + "\n")

def rounded(value):
    if isinstance(value, (float, np.floating)): return round(float(value), 4)
    if isinstance(value, (tuple, list)): return [rounded(v) for v in value]
    if isinstance(value, dict): return {k: rounded(v) for k, v in value.items()}
    return value

def feature(geom, properties):
    return {"type": "Feature", "properties": properties, "geometry": rounded(mapping(geom))}

def collection(features):
    return {"type": "FeatureCollection", "features": features}

# Spherical Lambert azimuthal equal-area centred on GB, metres: areas are km².
# No pyproj dependency. Boundary data is WGS84; projection preserves area.
def equal_area(lon, lat, z=None):
    lon, lat = np.radians(lon), np.radians(lat)
    lon0, lat0 = math.radians(-2), math.radians(54)
    k = np.sqrt(2 / (1 + np.sin(lat0)*np.sin(lat) + np.cos(lat0)*np.cos(lat)*np.cos(lon-lon0)))
    return 6371008.8*k*np.cos(lat)*np.sin(lon-lon0), 6371008.8*k*(np.cos(lat0)*np.sin(lat)-np.sin(lat0)*np.cos(lat)*np.cos(lon-lon0))

def contours(layer, points, band, step, sigma):
    xs = np.arange(-11.5, 2.6 + step, step)
    ys = np.arange(49, 61.6 + step, step)
    hist, _, _ = np.histogram2d(points[:,1], points[:,0], bins=[ys, xs])
    smooth = gaussian_filter(hist, sigma=sigma)
    positive = smooth[smooth > 0.15]
    if not len(positive):
        write(f"{layer}-contours-{band}.geojson", collection([])); return
    levels = np.unique(np.r_[0.15, np.quantile(positive, [.4, .7, .9, .98]), smooth.max()+1])
    fig, ax = plt.subplots()
    cs = ax.contourf((xs[:-1]+xs[1:])/2, (ys[:-1]+ys[1:])/2, smooth, levels=levels)
    features = []
    # Matplotlib >= 3.10 removed allsegs/allkinds; one Path per filled band.
    # contourpy emits each outer ring followed by its holes, with opposite winding.
    for i, path in enumerate(cs.get_paths()):
        if i >= len(levels) - 1: break
        polys, outer, holes, outer_ccw = [], None, [], None
        for ring in path.to_polygons(closed_only=True):
            if len(ring) < 4: continue
            ccw = LinearRing(ring).is_ccw
            if outer_ccw is None: outer_ccw = ccw
            if ccw == outer_ccw:
                if outer is not None: polys.append(Polygon(outer, holes))
                outer, holes = ring, []
            else:
                holes.append(ring)
        if outer is not None: polys.append(Polygon(outer, holes))
        geom = unary_union([p.buffer(0) for p in polys]) if polys else None
        if geom is None or geom.is_empty: continue
        geom = set_precision(geom.simplify(step*.25, preserve_topology=True), 0.0001)
        if not geom.is_empty:
            features.append(feature(geom, {"value": round(float(levels[i]), 4), "intensity": round(i / (len(levels)-2), 3)}))
    plt.close(fig)
    write(f"{layer}-contours-{band}.geojson", collection(features))

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--layer", action="append", help="Build only this dense layer (repeatable)")
    ap.add_argument("--counts-only", action="store_true")
    args = ap.parse_args()
    counts = {}
    for path in sorted(DATA.glob("*.geojson")):
        fs = json.loads(path.read_text()).get("features", [])
        n = sum(f.get("geometry", {}).get("type") == "Point" for f in fs)
        if n: counts[path.stem] = n
    dense = [layer for layer,n in counts.items() if layer in ("pubs", "places-of-worship")]
    for layer in dense: print(f"{layer}: {counts[layer]}", flush=True)
    if args.counts_only: return
    OUT.mkdir(exist_ok=True)
    seats = json.loads((DATA / "constituencies-gb-2024.geojson").read_text())["features"]
    geoms = [shape(f["geometry"]) for f in seats]
    tree = STRtree(geoms)
    areas = [transform(equal_area, g).area/1e6 for g in geoms]
    for layer in args.layer or dense:
        if layer not in dense: raise SystemExit(f"Not a dense point layer: {layer}")
        fs = json.loads((DATA / f"{layer}.geojson").read_text())["features"]
        points = np.array([f["geometry"]["coordinates"][:2] for f in fs if f["geometry"]["type"] == "Point"])
        build_for_layer(layer, DATA / f"{layer}.geojson", OUT, compact=True)
        seat_counts = [0]*len(seats)
        for x,y in points:
            hits = tree.query(Point(x,y), predicate="intersects")
            if len(hits): seat_counts[int(hits[0])] += 1
        write(f"{layer}-constituency.json", {f["properties"]["PCON24CD"]: {"count": n, "per_km2": round(n/a, 5)} for f,n,a in zip(seats,seat_counts,areas)})
        for band,step,sigma in [("national", .09, 1.6), ("regional", .035, 1.2), ("local", .006, 1.1)]:
            contours(layer, points, band, step, sigma)
        total = sum(p.stat().st_size for p in OUT.glob(f"{layer}-*"))
        print(f"{layer}: all artifacts {total/1e6:.2f} MB", flush=True)

if __name__ == "__main__": main()
