#!/usr/bin/env python3
"""Build precomputed hex density bins for point GeoJSON layers.

Generic: any point FeatureCollection can be binned. This PR enables pubs only.
Outputs small GeoJSON polygon FeatureCollections under public/data/density/
plus a manifest for lazy zoom-band loading.

Bands (MapLibre maxzoom exclusive) — thin NYC-style spikes:
  coarse  — national  (z 0–7),   ~3.5 km hex pitch
  medium  — regional  (z 7–9.5), ~1.5 km
  fine    — city      (z 9.5–12), ~400 m

Only non-empty cells (count ≥ 1) are written — bins come from real points, so
nothing is drawn over empty sea. Drawn hexes use ~75% of pitch radius so gaps
show basemap between columns. Past ~z12 the map fades to individual points.
"""

from __future__ import annotations

import argparse
import json
import math
from collections import defaultdict
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[1]

# Flat-top hexagon axial coords. `size_deg` is the *pitch* radius (vertex
# distance) in degrees; drawn polygons use DRAW_SCALE × that so columns are
# thinner than the cell pitch.
DRAW_SCALE = 0.68

# ~1° lat ≈ 111 km; at 54°N 1° lon ≈ 65 km. size_deg is a compromise angular
# radius so pitch ≈ listed km at mid-BI latitudes.
BANDS = [
    {
        "id": "coarse",
        "file": "pubs-coarse.geojson",
        "minzoom": 0,
        "maxzoom": 7.0,
        "size_deg": 0.020,  # ~3.5 km pitch
        "label": "national",
        "peak_m": 3200,
    },
    {
        "id": "medium",
        "file": "pubs-medium.geojson",
        "minzoom": 7.0,
        "maxzoom": 9.5,
        "size_deg": 0.009,  # ~1.5 km pitch
        "label": "regional",
        "peak_m": 1800,
    },
    {
        "id": "fine",
        "file": "pubs-fine.geojson",
        "minzoom": 9.5,
        "maxzoom": 12.0,
        "size_deg": 0.0024,  # ~400 m pitch
        "label": "city",
        "peak_m": 900,
    },
]


def axial_round(q: float, r: float) -> tuple[int, int]:
    s = -q - r
    rq, rr, rs = round(q), round(r), round(s)
    q_diff, r_diff, s_diff = abs(rq - q), abs(rr - r), abs(rs - s)
    if q_diff > r_diff and q_diff > s_diff:
        rq = -rr - rs
    elif r_diff > s_diff:
        rr = -rq - rs
    return int(rq), int(rr)


def lonlat_to_axial(lon: float, lat: float, size: float) -> tuple[int, int]:
    q = (2.0 / 3.0 * lon) / size
    r = (-1.0 / 3.0 * lon + math.sqrt(3) / 3.0 * lat) / size
    return axial_round(q, r)


def axial_to_lonlat(q: int, r: int, size: float) -> tuple[float, float]:
    lon = size * (3.0 / 2.0 * q)
    lat = size * (math.sqrt(3) / 2.0 * q + math.sqrt(3) * r)
    return lon, lat


def hex_polygon(q: int, r: int, pitch: float, draw: float) -> list[list[float]]:
    """Polygon centred on the pitch cell, drawn at `draw` radius (< pitch)."""
    cx, cy = axial_to_lonlat(q, r, pitch)
    ring: list[list[float]] = []
    for i in range(6):
        angle = math.radians(60 * i)
        ring.append([
            round(cx + draw * math.cos(angle), 5),
            round(cy + draw * math.sin(angle), 5),
        ])
    ring.append(ring[0])
    return ring


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
        # sqrt intensity precomputed for clients that want a baked stop
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


def build_for_layer(layer: str, points_path: Path, out_dir: Path) -> dict[str, Any]:
    fc = json.loads(points_path.read_text(encoding="utf-8"))
    features = fc.get("features") or []
    out_dir.mkdir(parents=True, exist_ok=True)
    band_meta: list[dict[str, Any]] = []
    for band in BANDS:
        pitch = float(band["size_deg"])
        draw = pitch * DRAW_SCALE
        cells, max_count = bin_points(features, pitch, draw)
        counts = sorted(c["properties"]["count"] for c in cells)
        # Colour/height scale on p98: most cells stay low/pale; only top ~2% spike.
        p98 = counts[min(len(counts) - 1, int(len(counts) * 0.98))] if counts else 1
        # Push scale_max up so only true hotspots hit deep red / full height
        # (p98 alone is too low for dense 3–5 km cells — half of England would read "High").
        scale_max = max(p98, int(max_count * 0.22), 8)
        intensity_max = math.sqrt(scale_max)
        path = out_dir / band["file"].replace("pubs-", f"{layer}-")
        payload = {"type": "FeatureCollection", "features": cells}
        with path.open("w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
            f.write("\n")
        size_kb = path.stat().st_size / 1024
        print(
            f"  {band['id']}: {len(cells)} cells, max={max_count}, "
            f"scale_max={scale_max} (p98), pitch={pitch}°, draw={draw:.5f}°, "
            f"{size_kb:.1f} KB → {path.name}",
            flush=True,
        )
        band_meta.append(
            {
                "id": band["id"],
                "file": path.name,
                "url": f"/data/density/{path.name}",
                "minzoom": band["minzoom"],
                "maxzoom": band["maxzoom"],
                "size_deg": pitch,
                "draw_scale": DRAW_SCALE,
                "cell_count": len(cells),
                "max_count": max_count,
                "scale_max": scale_max,
                "intensity_max": round(intensity_max, 4),
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
        "ramp": ["#fff3b0", "#f4a261", "#9b2226"],
        "legend": ["Low", "Medium", "High"],
        "pitch": 40,
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
    args = ap.parse_args()
    points = args.points or (REPO / "public" / "data" / f"{args.layer}.geojson")
    if not points.exists():
        raise SystemExit(f"Missing points file: {points}")
    print(f"Binning {points} …", flush=True)
    build_for_layer(args.layer, points, args.out_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
