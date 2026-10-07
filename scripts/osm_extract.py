#!/usr/bin/env python3
"""Generic OSM point-layer extractor for the British Isles atlas.

One pipeline for every OpenStreetMap-derived point layer: per-region Overpass
bbox tiles (``out center tags``), clipped to OSM admin polygons
(ENG/SCT/WLS/NIR/IE/IM/GG/JE, Nominatim-cached under ``scripts/cache/``),
written as static GeoJSON to ``data/osm/<layer>.geojson`` and merged into
``public/data/extract-meta.json``.

Per-layer differences (tags, require_name, relations, tile cache, sanity
thresholds, meta caveats, rationale notes) live in ``scripts/osm_layers.py``.

    python3 scripts/osm_extract.py castles museums
    python3 scripts/osm_extract.py --all
    python3 scripts/osm_extract.py --list

Requires ``shapely`` and ``curl``.
"""

from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from shapely.geometry import Point, shape
from shapely.ops import unary_union
from shapely.validation import make_valid

from osm_layers import LAYERS, LayerSpec, Stat

REPO = Path(__file__).resolve().parents[1]
CACHE = Path(__file__).resolve().parent / "cache"
OUT_DIR_DEFAULT = REPO / "data" / "osm"
META_PATH_DEFAULT = REPO / "public" / "data" / "extract-meta.json"
ENDPOINT_DEFAULT = "https://overpass.openstreetmap.fr/api/interpreter"
ENDPOINT_FALLBACKS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter",
]
USER_AGENT = (
    "BritishIslesAtlas-extractor/1.0 "
    "(static GeoJSON; polite; https://github.com/giiyms/BritishIslesAtlas)"
)

REGIONS = [
    "england",
    "scotland",
    "wales",
    "northern-ireland",
    "ireland",
    "isle-of-man",
    "guernsey",
    "jersey",
]


def load_region_polygon(label: str):
    path = CACHE / f"{label}.geojson"
    if not path.exists():
        raise FileNotFoundError(
            f"Missing {path}; run Nominatim cache step first "
            "(see scripts/README or re-run extractor with --refresh-polygons)."
        )
    feat = json.loads(path.read_text(encoding="utf-8"))
    geom = make_valid(shape(feat["geometry"]))
    if geom.geom_type == "GeometryCollection":
        geoms = [g for g in geom.geoms if g.geom_type in ("Polygon", "MultiPolygon")]
        geom = unary_union(geoms)
    # Buffer slightly (~200m) so coastline features aren't clipped by polygon
    # precision / tidal quirks. 0.002 deg ≈ 220m.
    return make_valid(geom.buffer(0.002)), feat.get("properties") or {}


def bbox_tiles(bounds: tuple[float, float, float, float], max_span: float) -> list[tuple[float, float, float, float]]:
    minx, miny, maxx, maxy = bounds
    width = maxx - minx
    height = maxy - miny
    nx = max(1, math.ceil(width / max_span))
    ny = max(1, math.ceil(height / max_span))
    tiles = []
    for ix in range(nx):
        for iy in range(ny):
            x0 = minx + ix * width / nx
            x1 = minx + (ix + 1) * width / nx
            y0 = miny + iy * height / ny
            y1 = miny + (iy + 1) * height / ny
            tiles.append((y0, x0, y1, x1))  # south, west, north, east for Overpass
    return tiles


def post_overpass(endpoint: str, query: str, timeout: int) -> dict[str, Any]:
    curl_timeout = timeout + 90
    cmd = [
        "curl",
        "-sS",
        "--http1.1",
        "-m",
        str(curl_timeout),
        "-A",
        USER_AGENT,
        "--data-urlencode",
        f"data={query}",
        endpoint,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"curl exit {proc.returncode}: {proc.stderr.strip()[:400]}")
    raw = proc.stdout
    if not raw.strip():
        raise RuntimeError("empty Overpass response")
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"non-JSON Overpass response: {raw[:300]}") from e
    remark = payload.get("remark")
    if remark and "error" in str(remark).lower():
        raise RuntimeError(f"Overpass remark: {remark}")
    return payload


def build_query(spec: LayerSpec, south: float, west: float, north: float, east: float, timeout: int) -> str:
    name_filter = '["name"]' if spec.require_name else ""
    bbox = f"({south},{west},{north},{east})"
    kinds = ("node", "way", "relation") if spec.include_relations else ("node", "way")
    body = "".join(
        f'  {kind}["{spec.tag_key}"="{spec.tag_value}"]{name_filter}{bbox};\n' for kind in kinds
    )
    return f"[out:json][timeout:{timeout}];\n(\n{body});\nout center tags;\n"


def tile_cache_path(spec: LayerSpec, south: float, west: float, north: float, east: float) -> Path:
    flag = "named" if spec.require_name else "all"
    name = f"{flag}_{south:.5f}_{west:.5f}_{north:.5f}_{east:.5f}.json"
    return CACHE / spec.tile_cache_dir / name


def fetch_bbox(
    spec: LayerSpec,
    endpoint: str,
    south: float,
    west: float,
    north: float,
    east: float,
    timeout: int,
    retries: int,
    pause: float,
    label: str,
) -> list[dict[str, Any]]:
    tag = f"{spec.tag_key}={spec.tag_value}"
    box = f"({south:.3f},{west:.3f},{north:.3f},{east:.3f})"
    query = build_query(spec, south, west, north, east, timeout)

    cache_path: Path | None = None
    endpoints = [endpoint]
    if spec.resilient:
        # Tile cache (re-runs skip finished tiles) + endpoint rotation.
        cache_path = tile_cache_path(spec, south, west, north, east)
        if cache_path.exists():
            cached = json.loads(cache_path.read_text(encoding="utf-8"))
            elements = cached.get("elements") or []
            print(f"  [{label}] cache hit {tag} {box} {len(elements)} elements", flush=True)
            return elements
        endpoints = []
        for ep in [endpoint, *ENDPOINT_FALLBACKS]:
            if ep not in endpoints:
                endpoints.append(ep)

    last_err: Exception | None = None
    for attempt in range(1, retries + 1):
        ep = endpoints[(attempt - 1) % len(endpoints)]
        try:
            via = f" via {ep}" if spec.resilient else ""
            print(f"  [{label}] {tag} {box} attempt {attempt}/{retries}{via} …", flush=True)
            payload = post_overpass(ep, query, timeout)
            elements = payload.get("elements") or []
            print(f"  [{label}] got {len(elements)} elements", flush=True)
            if cache_path is not None:
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                cache_path.write_text(
                    json.dumps({"elements": elements}, ensure_ascii=False),
                    encoding="utf-8",
                )
            time.sleep(pause)
            return elements
        except Exception as e:  # noqa: BLE001
            last_err = e
            if spec.resilient:
                wait = min(20.0, max(pause, 4.0) * attempt)
            else:
                wait = max(pause, 8.0) * attempt
            print(f"  [{label}] error {e!r} — retry in {wait:.0f}s", flush=True)
            time.sleep(wait)
    raise RuntimeError(f"Failed {label} after {retries} retries: {last_err}")


def element_point(el: dict[str, Any], include_relations: bool) -> tuple[str, str, float, float, dict[str, str]] | None:
    etype = el.get("type")
    eid = el.get("id")
    allowed = ("node", "way", "relation") if include_relations else ("node", "way")
    if etype not in allowed or eid is None:
        return None
    tags = el.get("tags") or {}
    if etype == "node":
        lon, lat = el.get("lon"), el.get("lat")
    else:
        # Ways and relations: Overpass `out center` supplies a centroid.
        center = el.get("center") or {}
        lon, lat = center.get("lon"), center.get("lat")
    if lon is None or lat is None:
        return None
    return etype, str(eid), float(lon), float(lat), tags


def to_feature(etype: str, eid: str, lon: float, lat: float, tags: dict[str, str], spec: LayerSpec) -> dict[str, Any]:
    brand = tags.get("brand") or tags.get("operator") or ""
    name = tags.get("name") or spec.generic_name
    note = brand if brand else "OpenStreetMap"
    osm_id = f"{etype}/{eid}"
    props: dict[str, Any] = {
        "name": name,
        "layer": spec.layer,
        "note": note,
        "osm_id": osm_id,
        "osm_url": f"https://www.openstreetmap.org/{osm_id}",
        "source": "OpenStreetMap",
    }
    if brand:
        props["brand"] = brand
    if spec.religion_prop:
        religion = (tags.get("religion") or "").strip()
        if religion:
            props["religion"] = religion
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "properties": props,
        "_etype": etype,
    }


def in_france_bleed(lon: float, lat: float) -> bool:
    if 49.1 <= lat <= 49.55 and -2.75 <= lon <= -1.95:
        return False
    if lat < 49.9 and lon > -2.0:
        return True
    if lon > 1.55 and lat < 50.95:
        return True
    if 49.9 <= lat < 50.05 and -1.5 <= lon <= 0.5:
        return True
    return False


def in_iom(lon: float, lat: float) -> bool:
    return 54.0 <= lat <= 54.45 and -4.85 <= lon <= -4.25


def in_guernsey(lon: float, lat: float) -> bool:
    return 49.35 <= lat <= 49.52 and -2.75 <= lon <= -2.40


def in_jersey(lon: float, lat: float) -> bool:
    return 49.10 <= lat <= 49.30 and -2.30 <= lon <= -1.95


def extract_layer(
    spec: LayerSpec,
    endpoint: str,
    timeout: int,
    retries: int,
    pause: float,
    max_span: float,
) -> tuple[dict[str, Any], dict[str, Any]]:
    by_id: dict[str, dict[str, Any]] = {}
    region_counts: dict[str, int] = {}

    for label in REGIONS:
        poly, _props = load_region_polygon(label)
        tiles = bbox_tiles(poly.bounds, max_span=max_span)
        print(f"=== region {label}: {len(tiles)} tile(s) ===", flush=True)
        before = len(by_id)
        for south, west, north, east in tiles:
            elements = fetch_bbox(spec, endpoint, south, west, north, east, timeout, retries, pause, label)
            for el in elements:
                parsed = element_point(el, spec.include_relations)
                if parsed is None:
                    continue
                etype, eid, lon, lat, tags = parsed
                if spec.require_name and not (tags.get("name") or "").strip():
                    continue
                osm_id = f"{etype}/{eid}"
                if osm_id in by_id:
                    continue
                if not poly.contains(Point(lon, lat)):
                    continue
                by_id[osm_id] = to_feature(etype, eid, lon, lat, tags, spec)
        region_counts[label] = len(by_id) - before
        print(
            f"  [{label}] kept {region_counts[label]} after clip "
            f"(running total {len(by_id)})",
            flush=True,
        )

    features: list[dict[str, Any]] = []
    ways = relations = generic = france = iom = gg = je = with_religion = 0
    for feat in by_id.values():
        etype = feat.pop("_etype")
        if etype == "way":
            ways += 1
        elif etype == "relation":
            relations += 1
        props = feat["properties"]
        if props["name"] == spec.generic_name:
            generic += 1
        if props.get("religion"):
            with_religion += 1
        lon, lat = feat["geometry"]["coordinates"]
        if in_france_bleed(lon, lat):
            france += 1
        if in_iom(lon, lat):
            iom += 1
        if in_guernsey(lon, lat):
            gg += 1
        if in_jersey(lon, lat):
            je += 1
        features.append(feat)

    features.sort(key=lambda f: f["properties"]["osm_id"])
    # Count only when a brand/operator was present and note copies it (not the
    # OpenStreetMap fallback), matching SOURCES.md semantics.
    note_brand = sum(
        1
        for f in features
        if f["properties"].get("brand") and f["properties"]["note"] == f["properties"]["brand"]
    )

    fc = {"type": "FeatureCollection", "features": features}
    stats = {
        "layer": spec.layer,
        "count": len(features),
        "region_counts": region_counts,
        "ways_as_centre_points": ways,
        "relations_as_centre_points": relations,
        "pipeline_generic_names": generic,
        "pipeline_note_brand_or_osm": note_brand,
        "isle_of_man_bbox_count": iom,
        "guernsey_bbox_count": gg,
        "jersey_bbox_count": je,
        "channel_islands_bbox_count": gg + je,
        "northern_france_bleed_approx": france,
        "with_religion_tag": with_religion,
        "tag": f"{spec.tag_key}={spec.tag_value}" + (" + name=*" if spec.require_name else ""),
    }
    return fc, stats


def build_meta(spec: LayerSpec, stats: dict[str, Any], endpoint: str, extracted_at: str) -> dict[str, Any]:
    limitations: dict[str, Any] = {
        "isle_of_man": stats["isle_of_man_bbox_count"],
        "channel_islands": stats["channel_islands_bbox_count"],
        "guernsey": stats["guernsey_bbox_count"],
        "jersey": stats["jersey_bbox_count"],
        "northern_france_approx": stats["northern_france_bleed_approx"],
        "ways_as_centre_points": stats["ways_as_centre_points"],
    }
    if spec.include_relations:
        limitations["relations_as_centre_points"] = stats["relations_as_centre_points"]
    limitations["pipeline_generic_names"] = stats["pipeline_generic_names"]
    limitations["pipeline_note_repeats_brand"] = stats["pipeline_note_brand_or_osm"]
    limitations["note_semantics"] = "pipeline field (brand/operator or 'OpenStreetMap'), not OSM note=*"
    limitations["clip_note"] = "features clipped to OSM admin polygons (+~200m buffer)"
    for key, value in spec.limitations.items():
        limitations[key] = stats[value.key] if isinstance(value, Stat) else value
    return {
        "extracted_at": extracted_at,
        "method": (
            "Overpass per-nation/territory bbox tiles clipped to OSM admin "
            "polygons (Nominatim); endpoint overpass.openstreetmap.fr"
        ),
        "license": "ODbL 1.0",
        "endpoint": endpoint,
        "layer": spec.layer,
        "count": stats["count"],
        "coverage": (
            "Admin-area extract (ENG/SCT/WLS/NIR/IE/IM/GG/JE); "
            f"IoM≈{stats['isle_of_man_bbox_count']}; "
            f"GG≈{stats['guernsey_bbox_count']}; "
            f"JE≈{stats['jersey_bbox_count']}; "
            f"northern France bleed≈{stats['northern_france_bleed_approx']}"
        ),
        "region_counts": stats["region_counts"],
        "limitations": limitations,
    }


def refresh_polygons() -> None:
    import urllib.parse
    import urllib.request

    CACHE.mkdir(parents=True, exist_ok=True)
    regions = [
        ("england", {"country": "gb", "state": "England"}),
        ("scotland", {"country": "gb", "state": "Scotland"}),
        ("wales", {"country": "gb", "state": "Wales"}),
        ("northern-ireland", {"country": "gb", "state": "Northern Ireland"}),
        ("ireland", {"country": "ie"}),
        ("isle-of-man", {"country": "im"}),
        ("guernsey", {"country": "gg"}),
        ("jersey", {"country": "je"}),
    ]

    def get(url: str):
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode())

    for label, params in regions:
        out = CACHE / f"{label}.geojson"
        q = {"polygon_geojson": "1", "format": "json", "limit": "1", **params}
        url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(q)
        print(f"Nominatim {label} …", flush=True)
        data = get(url)
        time.sleep(1.2)
        if not data or "geojson" not in data[0]:
            raise RuntimeError(f"Nominatim miss for {label}")
        hit = data[0]
        feat = {
            "type": "Feature",
            "properties": {
                "label": label,
                "display_name": hit.get("display_name"),
                "osm_id": f"{hit.get('osm_type')}/{hit.get('osm_id')}",
            },
            "geometry": hit["geojson"],
        }
        out.write_text(json.dumps(feat), encoding="utf-8")
        print(f"  wrote {out}", flush=True)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("layers", nargs="*", metavar="layer-id", help="Layer id(s) from scripts/osm_layers.py.")
    ap.add_argument("--all", action="store_true", help="Extract every layer in osm_layers.LAYERS.")
    ap.add_argument("--list", action="store_true", help="List layer ids and tags, then exit.")
    ap.add_argument("--out-dir", type=Path, default=OUT_DIR_DEFAULT, help="GeoJSON output dir.")
    ap.add_argument("--meta-path", type=Path, default=META_PATH_DEFAULT, help="extract-meta.json to merge-update.")
    ap.add_argument("--endpoint", default=ENDPOINT_DEFAULT)
    ap.add_argument("--timeout", type=int, default=None, help="Overpass timeout s (default: per layer, 180).")
    ap.add_argument("--retries", type=int, default=None, help="Attempts per tile (default: per layer, 6).")
    ap.add_argument("--pause", type=float, default=None, help="Pause between tiles s (default: per layer, 6.0).")
    ap.add_argument(
        "--max-span",
        type=float,
        default=None,
        help="Max bbox tile span in degrees (lon/lat) (default: per layer, 1.5-2.5).",
    )
    ap.add_argument("--refresh-polygons", action="store_true")
    args = ap.parse_args(argv)
    if args.list:
        for lid, spec in LAYERS.items():
            print(f"{lid:20s} {spec.tag_key}={spec.tag_value}")
        raise SystemExit(0)
    if args.all:
        args.layers = list(LAYERS)
    if not args.layers:
        ap.error("give at least one layer id (or --all / --list)")
    unknown = [lid for lid in args.layers if lid not in LAYERS]
    if unknown:
        ap.error(f"unknown layer(s): {', '.join(unknown)} (see --list)")
    return args


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    if args.refresh_polygons or any(not (CACHE / f"{r}.geojson").exists() for r in REGIONS):
        refresh_polygons()

    args.out_dir.mkdir(parents=True, exist_ok=True)
    extracted_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    all_meta: dict[str, Any] = {}

    for layer_name in args.layers:
        spec = LAYERS[layer_name]
        print(f"##### Extracting {layer_name} #####", flush=True)
        fc, stats = extract_layer(
            spec,
            args.endpoint,
            args.timeout if args.timeout is not None else spec.timeout,
            args.retries if args.retries is not None else spec.retries,
            args.pause if args.pause is not None else spec.pause,
            args.max_span if args.max_span is not None else spec.max_span,
        )
        out_path = args.out_dir / f"{layer_name}.geojson"
        with out_path.open("w", encoding="utf-8") as f:
            json.dump(fc, f, ensure_ascii=False, separators=(",", ":"))
            f.write("\n")
        print(f"Wrote {out_path} ({stats['count']} features)", flush=True)
        all_meta[layer_name] = build_meta(spec, stats, args.endpoint, extracted_at)

    meta_path = args.meta_path
    meta_path.parent.mkdir(parents=True, exist_ok=True)
    merged = {}
    if meta_path.exists():
        try:
            merged = json.loads(meta_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            merged = {}
    merged.update(all_meta)
    with meta_path.open("w", encoding="utf-8") as f:
        json.dump(merged, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Wrote {meta_path}", flush=True)
    print(json.dumps({k: v["count"] for k, v in all_meta.items()}, indent=2))
    for name, meta in all_meta.items():
        if LAYERS[name].min_count is None:
            continue  # layer has no count sanity gate (power, petrol, ev)
        count = meta["count"]
        france = meta["limitations"]["northern_france_approx"]
        if count < LAYERS[name].min_count:
            raise SystemExit(f"REFUSE: {name} count {count} suspiciously low")
        if count % 1000 == 0:
            raise SystemExit(f"REFUSE: {name} count {count} suspiciously round (x1000)")
        if count % 100 == 0 and count >= 500:
            print(f"WARNING: {name} count {count} ends in 00 — verify not capped", flush=True)
        if france > 5:
            raise SystemExit(f"REFUSE: {name} northern France bleed {france} too high")
        print(
            f"OK {name}: count={count} france_bleed={france} "
            f"regions={meta['region_counts']}",
            flush=True,
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
