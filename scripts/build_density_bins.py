#!/usr/bin/env python3
"""Build precomputed hex density bins for point GeoJSON layers.

Generic: any point FeatureCollection can be binned. This PR enables pubs only.
Outputs small GeoJSON polygon FeatureCollections under public/data/density/
plus a manifest for lazy zoom-band loading.

Bands (MapLibre maxzoom exclusive) — thin NYC-style spikes:
  coarse  — national  (z 0–6.5), 16 km Mercator radius (~9 km ground)
  medium  — regional  (z 6.5–9.5), 4 km (~2.4 km ground)
  fine    — city      (z 9.5–12), 1 km (~600 m ground)
Hexes are built in Web Mercator metres so they are regular on screen.

Only non-empty cells (count ≥ 1) are written — bins come from real points, so
nothing is drawn over empty sea. Drawn hexes use ~93% of pitch radius so the
carpet reads solid with hairline seams. Past ~z12 the map fades to individual
points. Column height is further scaled by zoom in src/density.ts so national
view reads as tall screen-constant 3D spikes.
"""

from __future__ import annotations

import argparse
import json
import math
from collections import defaultdict
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[1]

# Flat-top hexagon axial coords in Web Mercator metres. `size_m` is the pitch
# radius (vertex distance); drawn polygons use DRAW_SCALE x that (hairline seams).
DRAW_SCALE = 0.93

# Fixed grid per band (each 4x the next) so levels never regroup mid-band.
BANDS = [
    {
        "id": "coarse",
        "file": "pubs-coarse.geojson",
        "minzoom": 0,
        "maxzoom": 6.5,
        "size_m": 16000,  # Mercator m; ~9.4 km ground radius at 54°N
        "label": "national",
        "peak_m": 7200,
    },
    {
        "id": "medium",
        "file": "pubs-medium.geojson",
        "minzoom": 6.5,
        "maxzoom": 9.5,
        "size_m": 4000,  # ~2.4 km ground
        "label": "regional",
        "peak_m": 1800,
    },
    {
        "id": "fine",
        "file": "pubs-fine.geojson",
        "minzoom": 9.5,
        "maxzoom": 12.0,
        "size_m": 1000,  # ~590 m ground
        "label": "city",
        "peak_m": 900,
    },
]

# Hotter 5-stop ramp (cream → yellow → orange → crimson → deep red).
RAMP = ["#fbf3cf", "#f9d77e", "#f4a24c", "#e0452b", "#a50f15"]
LEGEND = ["Low", "Medium", "High"]


def axial_round(q: float, r: float) -> tuple[int, int]:
    s = -q - r
    rq, rr, rs = round(q), round(r), round(s)
    q_diff, r_diff, s_diff = abs(rq - q), abs(rr - r), abs(rs - s)
    if q_diff > r_diff and q_diff > s_diff:
        rq = -rr - rs
    elif r_diff > s_diff:
        rr = -rq - rs
    return int(rq), int(rr)


R_MERC = 6378137.0


def to_merc(lon: float, lat: float) -> tuple[float, float]:
    """Web Mercator (EPSG:3857) metres — the map's own projection, so hexes
    built here render as true regular hexagons on screen at every latitude."""
    x = R_MERC * math.radians(lon)
    y = R_MERC * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
    return x, y


def from_merc(x: float, y: float) -> tuple[float, float]:
    lon = math.degrees(x / R_MERC)
    lat = math.degrees(2 * math.atan(math.exp(y / R_MERC)) - math.pi / 2)
    return lon, lat


def lonlat_to_axial(lon: float, lat: float, size: float) -> tuple[int, int]:
    x, y = to_merc(lon, lat)
    q = (2.0 / 3.0 * x) / size
    r = (-1.0 / 3.0 * x + math.sqrt(3) / 3.0 * y) / size
    return axial_round(q, r)


def axial_to_merc(q: int, r: int, size: float) -> tuple[float, float]:
    return size * (3.0 / 2.0 * q), size * (math.sqrt(3) / 2.0 * q + math.sqrt(3) * r)


def hex_polygon(q: int, r: int, pitch: float, draw: float) -> list[list[float]]:
    """Flat-top hexagon in Mercator metres, reprojected to lon/lat (5 dp ≈ 1 m)."""
    cx, cy = axial_to_merc(q, r, pitch)
    ring: list[list[float]] = []
    for i in range(6):
        angle = math.radians(60 * i)
        lon, lat = from_merc(cx + draw * math.cos(angle), cy + draw * math.sin(angle))
        ring.append([round(lon, 5), round(lat, 5)])
    ring.append(ring[0])
    return ring


def quantile(sorted_vals: list[float], p: float) -> float:
    if not sorted_vals:
        return 1.0
    i = min(len(sorted_vals) - 1, max(0, int(len(sorted_vals) * p)))
    return float(sorted_vals[i])


def bin_points(
    features: list[dict[str, Any]], pitch: float, draw: float
) -> tuple[list[dict[str, Any]], int]:
    buckets: dict[tuple[int, int], int] = defaultdict(int)
    for feat in features:
        geom = feat.get("geometry") or {}
        if geom.get("type") != "Point":
            continue
        coords = geom.get("coordinates")
        if not coords or len(coords) < 2:
            continue
        lon, lat = float(coords[0]), float(coords[1])
        key = lonlat_to_axial(lon, lat, pitch)
        buckets[key] += 1
    out: list[dict[str, Any]] = []
    max_count = 0
    for (q, r), count in buckets.items():
        if count < 1:
            continue
        max_count = max(max_count, count)
        intensity = math.sqrt(count)
        out.append(
            {
                "type": "Feature",
                "properties": {
                    "count": count,
                    "intensity": round(intensity, 4),
                    "q": q,
                    "r": r,
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [hex_polygon(q, r, pitch, draw)],
                },
            }
        )
    out.sort(
        key=lambda f: (
            -f["properties"]["count"],
            f["properties"]["q"],
            f["properties"]["r"],
        )
    )
    return out, max_count


def build_for_layer(layer: str, points_path: Path, out_dir: Path, compact: bool = False) -> dict[str, Any]:
    fc = json.loads(points_path.read_text(encoding="utf-8"))
    features = fc.get("features") or []
    out_dir.mkdir(parents=True, exist_ok=True)
    band_meta: list[dict[str, Any]] = []
    for band in BANDS:
        pitch = float(band["size_m"])
        draw = pitch * DRAW_SCALE
        cells, max_count = bin_points(features, pitch, draw)
        binned = sum(c["properties"]["count"] for c in cells)
        points = sum(1 for f in features if (f.get("geometry") or {}).get("type") == "Point")
        assert binned == points, f"{layer} {band['id']}: hex total {binned} != points {points}"
        counts = sorted(c["properties"]["count"] for c in cells)
        intensities = sorted(math.sqrt(c) for c in counts)
        # Colour/height scale on p98: most cells stay low/pale; only top ~2% spike.
        p98 = counts[min(len(counts) - 1, int(len(counts) * 0.98))] if counts else 1
        scale_max = max(p98, int(max_count * 0.22), 8)
        intensity_max = math.sqrt(scale_max)
        # Per-band intensity quantiles drive the 5-stop colour ramp so more than
        # a couple of cells reach full red (city cores), not just the absolute max.
        colour_stops = [
            1.0,
            round(quantile(intensities, 0.50), 4),
            round(quantile(intensities, 0.80), 4),
            round(quantile(intensities, 0.95), 4),
            round(quantile(intensities, 0.99), 4),
        ]
        # Ensure strictly increasing stops for MapLibre interpolate.
        for i in range(1, len(colour_stops)):
            if colour_stops[i] <= colour_stops[i - 1]:
                colour_stops[i] = round(colour_stops[i - 1] + 0.05, 4)
        # Compact cells: flat [q, r, count, ...] axial ints. The browser rebuilds
        # exact Mercator hexes (src/density.ts hexCells), ~20x smaller than polygons.
        path = out_dir / band["file"].replace("pubs-", f"{layer}-").replace(".geojson", ".json")
        flat: list[int] = []
        for c in cells:
            flat += [c["properties"]["q"], c["properties"]["r"], c["properties"]["count"]]
        payload = {"size_m": pitch, "draw_scale": DRAW_SCALE, "cells": flat}
        with path.open("w", encoding="utf-8") as f:
            json.dump(payload, f, separators=(",", ":"))
            f.write("\n")
        size_kb = path.stat().st_size / 1024
        print(
            f"  {band['id']}: {len(cells)} cells, max={max_count}, "
            f"scale_max={scale_max} (p98), pitch={pitch:.0f} m (Mercator), draw={draw:.0f} m, "
            f"colour_stops={colour_stops}, {size_kb:.1f} KB → {path.name}",
            flush=True,
        )
        band_meta.append(
            {
                "id": band["id"],
                "file": path.name,
                "url": f"/data/density/{path.name}",
                "minzoom": band["minzoom"],
                "maxzoom": band["maxzoom"],
                "size_m": pitch,
                "projection": "EPSG:3857",
                "draw_scale": DRAW_SCALE,
                "cell_count": len(cells),
                "max_count": max_count,
                "scale_max": scale_max,
                "intensity_max": round(intensity_max, 4),
                "colour_stops": colour_stops,
                "peak_m": band["peak_m"],
                "label": band["label"],
            }
        )
    manifest = {
        "layer": layer,
        "point_count": len(features),
        "point_url": f"/data/{layer}.geojson",
        "dot_minzoom": 12.0,
        "bands": band_meta,
        "ramp": RAMP,
        "legend": LEGEND,
                "scaling": "sqrt",
        "draw_scale": DRAW_SCALE,
    }
    man_path = out_dir / f"{layer}-manifest.json"
    with man_path.open("w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Wrote {man_path}", flush=True)
    return manifest


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--layer", default="pubs")
    ap.add_argument("--points", type=Path, default=None)
    ap.add_argument(
        "--out-dir",
        type=Path,
        default=REPO / "public" / "data" / "density",
    )
    ap.add_argument("--compact", action="store_true", help="Count-only bins with rounded coordinates and sub-km city cells")
    args = ap.parse_args()
    points = args.points or (REPO / "public" / "data" / f"{args.layer}.geojson")
    if not points.exists():
        raise SystemExit(f"Missing points file: {points}")
    print(f"Binning {points} …", flush=True)
    build_for_layer(args.layer, points, args.out_dir, args.compact)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
