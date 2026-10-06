#!/usr/bin/env python3
"""Build precomputed hex density bins for point GeoJSON layers.

Generic: any point FeatureCollection can be binned. This PR enables pubs only.
Outputs small GeoJSON polygon FeatureCollections under public/data/density/
plus a manifest for lazy zoom-band loading.

Bands (zoom ranges inclusive on the low side; MapLibre maxzoom is exclusive):
  coarse  — national (z 3.5–6.5),  ~0.45° hex
  medium  — regional (z 6.5–9.0),  ~0.18° hex
  fine    — city     (z 9.0–12.0), ~0.07° hex

Past ~z12 the map fades to individual points (see src/density.ts).
"""

from __future__ import annotations

import argparse
import json
import math
from collections import defaultdict
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[1]

# Flat-top hexagon axial coords. Size is "radius" to vertex in degrees of longitude
# at the reference latitude; northing uses the same angular size (good enough for
# density visualisation; not equal-area).
BANDS = [
    {
        "id": "coarse",
        "file": "pubs-coarse.geojson",
        "minzoom": 0,
        "maxzoom": 6.5,
        "size_deg": 0.42,
        "label": "national",
    },
    {
        "id": "medium",
        "file": "pubs-medium.geojson",
        "minzoom": 6.5,
        "maxzoom": 9.0,
        "size_deg": 0.16,
        "label": "regional",
    },
    {
        "id": "fine",
        "file": "pubs-fine.geojson",
        "minzoom": 9.0,
        "maxzoom": 12.0,
        "size_deg": 0.055,
        "label": "city",
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
    # Flat-top axial conversion
    q = (2.0 / 3.0 * lon) / size
    r = (-1.0 / 3.0 * lon + math.sqrt(3) / 3.0 * lat) / size
    return axial_round(q, r)


def axial_to_lonlat(q: int, r: int, size: float) -> tuple[float, float]:
    lon = size * (3.0 / 2.0 * q)
    lat = size * (math.sqrt(3) / 2.0 * q + math.sqrt(3) * r)
    return lon, lat


def hex_polygon(q: int, r: int, size: float) -> list[list[float]]:
    cx, cy = axial_to_lonlat(q, r, size)
    ring: list[list[float]] = []
    for i in range(6):
        angle = math.radians(60 * i)  # flat-top: vertices at 0°, 60°, …
        ring.append([cx + size * math.cos(angle), cy + size * math.sin(angle)])
    ring.append(ring[0])
    return ring


def bin_points(
    features: list[dict[str, Any]], size: float
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
        key = lonlat_to_axial(lon, lat, size)
        buckets[key] += 1
    out: list[dict[str, Any]] = []
    max_count = 0
    for (q, r), count in buckets.items():
        max_count = max(max_count, count)
        out.append(
            {
                "type": "Feature",
                "properties": {
                    "count": count,
                    "q": q,
                    "r": r,
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [hex_polygon(q, r, size)],
                },
            }
        )
    out.sort(key=lambda f: (-f["properties"]["count"], f["properties"]["q"], f["properties"]["r"]))
    return out, max_count


def build_for_layer(layer: str, points_path: Path, out_dir: Path) -> dict[str, Any]:
    fc = json.loads(points_path.read_text(encoding="utf-8"))
    features = fc.get("features") or []
    out_dir.mkdir(parents=True, exist_ok=True)
    band_meta: list[dict[str, Any]] = []
    for band in BANDS:
        cells, max_count = bin_points(features, band["size_deg"])
        # Cap extreme outliers for colour/height scaling (p99-ish via sorted)
        counts = sorted(c["properties"]["count"] for c in cells)
        p95 = counts[int(len(counts) * 0.95)] if counts else 1
        scale_max = max(p95, 1)
        path = out_dir / band["file"].replace("pubs-", f"{layer}-")
        payload = {
            "type": "FeatureCollection",
            "features": cells,
        }
        with path.open("w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
            f.write("\n")
        size_kb = path.stat().st_size / 1024
        print(
            f"  {band['id']}: {len(cells)} cells, max={max_count}, "
            f"scale_max={scale_max}, {size_kb:.1f} KB → {path.name}",
            flush=True,
        )
        band_meta.append(
            {
                "id": band["id"],
                "file": path.name,
                "url": f"/data/density/{path.name}",
                "minzoom": band["minzoom"],
                "maxzoom": band["maxzoom"],
                "size_deg": band["size_deg"],
                "cell_count": len(cells),
                "max_count": max_count,
                "scale_max": scale_max,
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
        "pitch": 45,
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
    ap.add_argument(
        "--points",
        type=Path,
        default=None,
        help="Point GeoJSON (default public/data/<layer>.geojson)",
    )
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
