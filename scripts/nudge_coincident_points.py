#!/usr/bin/env python3
"""Separate exactly coincident points across all point layers (t254u).

Some OSM objects carry several tags and land in two layers at the same coordinate
(a community centre that is also a memorial, a ruined church). Drawn on top of each
other, one dot hides the other. This moves every coincident point except the first
by 2 m, each at its own golden-angle bearing, so both dots show at street zoom. The
order is deterministic: densest layer first (it stays put), then layer id, then osm_id.
The original coordinate is kept in `true_lon` / `true_lat`, and the place card uses it.

Idempotent: positions are always rebuilt from `true_lon` / `true_lat` when present.
Run after any extract:  python3 scripts/nudge_coincident_points.py
"""
from __future__ import annotations

import json
import math
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public/data"
NUDGE_M = 2.0
GOLDEN = math.radians(137.50776)


def main() -> None:
    layers: dict[str, dict] = {}
    for path in sorted(DATA.glob("*.geojson")):
        data = json.loads(path.read_text(encoding="utf-8"))
        feats = data.get("features", [])
        if feats and all((f.get("geometry") or {}).get("type") == "Point" for f in feats):
            layers[path.stem] = data
    groups: dict[tuple[float, float], list[tuple[str, dict]]] = defaultdict(list)
    for layer, data in layers.items():
        for f in data["features"]:
            p = f["properties"]
            if "true_lon" in p:
                f["geometry"]["coordinates"] = [p.pop("true_lon"), p.pop("true_lat")]
            lon, lat = f["geometry"]["coordinates"][:2]
            groups[(lon, lat)].append((layer, f))
    counts = {layer: len(data["features"]) for layer, data in layers.items()}
    moved = 0
    for (lon, lat), members in groups.items():
        if len(members) < 2:
            continue
        members.sort(key=lambda m: (-counts[m[0]], m[0], str(m[1]["properties"].get("osm_id", ""))))
        for k, (_, f) in enumerate(members[1:], start=1):
            bearing = k * GOLDEN
            dlat = NUDGE_M * math.cos(bearing) / 111_320
            dlon = NUDGE_M * math.sin(bearing) / (111_320 * math.cos(math.radians(lat)))
            f["geometry"]["coordinates"] = [round(lon + dlon, 7), round(lat + dlat, 7)]
            f["properties"]["true_lon"], f["properties"]["true_lat"] = lon, lat
            moved += 1
    for layer, data in layers.items():
        (DATA / f"{layer}.geojson").write_text(
            json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{sum(1 for m in groups.values() if len(m) > 1)} coincident positions, {moved} points nudged by {NUDGE_M} m")


if __name__ == "__main__":
    main()
