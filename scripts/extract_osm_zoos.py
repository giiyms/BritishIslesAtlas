#!/usr/bin/env python3
"""Extract zoos (OSM tourism=zoo) as static GeoJSON for British Isles.

Same admin-area pipeline as extract_osm_aerodromes.py / ferry terminals /
marinas: per-region Overpass bbox tiles clipped to OSM admin polygons
(ENG/SCT/WLS/NIR/IE/IM/GG/JE).

Tight scope: tourism=zoo only (nodes, ways, and relations;
relations use Overpass centre points like ways). Does NOT include
tourism=aquarium, tourism=wildlife_park, leisure=animal_boarding,
amenity=animal_shelter, tourism=theme_park, or safari / farm parks
without tourism=zoo. Disused zoos retaining tourism=zoo ARE included.
Large zoos mapped as multipolygon relations are included via out center
(Heathrow lesson).
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

REPO = Path(__file__).resolve().parents[1]
CACHE = Path(__file__).resolve().parent / "cache"
ENDPOINT_DEFAULT = "https://overpass.openstreetmap.fr/api/interpreter"
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

LAYERS = {
    "zoos": {
        "tag_key": "tourism",
        "tag_value": "zoo",
        "generic_name": "Zoo",
        "layer": "zoos",
    },
}


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


def fetch_bbox(
    endpoint: str,
    tag_key: str,
    tag_value: str,
    south: float,
    west: float,
    north: float,
    east: float,
    timeout: int,
    retries: int,
    pause: float,
    label: str,
) -> list[dict[str, Any]]:
    query = f"""[out:json][timeout:{timeout}];
(
  node["{tag_key}"="{tag_value}"]({south},{west},{north},{east});
  way["{tag_key}"="{tag_value}"]({south},{west},{north},{east});
  relation["{tag_key}"="{tag_value}"]({south},{west},{north},{east});
);
out center tags;
"""
    last_err: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            print(
                f"  [{label}] {tag_key}={tag_value} "
                f"({south:.3f},{west:.3f},{north:.3f},{east:.3f}) "
                f"attempt {attempt}/{retries} …",
                flush=True,
            )
            payload = post_overpass(endpoint, query, timeout)
            elements = payload.get("elements") or []
            print(f"  [{label}] got {len(elements)} elements", flush=True)
            time.sleep(pause)
            return elements
        except Exception as e:  # noqa: BLE001
            last_err = e
            wait = max(pause, 8.0) * attempt
            print(f"  [{label}] error {e!r} — retry in {wait:.0f}s", flush=True)
            time.sleep(wait)
    raise RuntimeError(f"Failed {label} after {retries} retries: {last_err}")


def element_point(el: dict[str, Any]) -> tuple[str, str, float, float, dict[str, str]] | None:
    etype = el.get("type")
    eid = el.get("id")
    if etype not in ("node", "way", "relation") or eid is None:
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


def to_feature(etype: str, eid: str, lon: float, lat: float, tags: dict[str, str], layer_cfg: dict[str, str]) -> dict[str, Any]:
    brand = tags.get("brand") or tags.get("operator") or ""
    name = tags.get("name") or layer_cfg["generic_name"]
    note = brand if brand else "OpenStreetMap"
    osm_id = f"{etype}/{eid}"
    props: dict[str, Any] = {
        "name": name,
        "layer": layer_cfg["layer"],
        "note": note,
        "osm_id": osm_id,
        "osm_url": f"https://www.openstreetmap.org/{osm_id}",
        "source": "OpenStreetMap",
    }
    if brand:
        props["brand"] = brand
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
    layer_name: str,
    endpoint: str,
    timeout: int,
    retries: int,
    pause: float,
    max_span: float,
) -> tuple[dict[str, Any], dict[str, Any]]:
    cfg = LAYERS[layer_name]
    by_id: dict[str, dict[str, Any]] = {}
    region_counts: dict[str, int] = {}

    for label in REGIONS:
        poly, _props = load_region_polygon(label)
        tiles = bbox_tiles(poly.bounds, max_span=max_span)
        print(f"=== region {label}: {len(tiles)} tile(s) ===", flush=True)
        before = len(by_id)
        for south, west, north, east in tiles:
            elements = fetch_bbox(
                endpoint,
                cfg["tag_key"],
                cfg["tag_value"],
                south,
                west,
                north,
                east,
                timeout,
                retries,
                pause,
                label,
            )
            for el in elements:
                parsed = element_point(el)
                if parsed is None:
                    continue
                etype, eid, lon, lat, tags = parsed
                osm_id = f"{etype}/{eid}"
                if osm_id in by_id:
                    continue
                if not poly.contains(Point(lon, lat)):
                    continue
                by_id[osm_id] = to_feature(etype, eid, lon, lat, tags, cfg)
        region_counts[label] = len(by_id) - before
        print(
            f"  [{label}] kept {region_counts[label]} after clip "
            f"(running total {len(by_id)})",
            flush=True,
        )

    features: list[dict[str, Any]] = []
    ways = relations = generic = france = iom = gg = je = 0
    for feat in by_id.values():
        etype = feat.pop("_etype")
        if etype == "way":
            ways += 1
        elif etype == "relation":
            relations += 1
        props = feat["properties"]
        if props["name"] == cfg["generic_name"]:
            generic += 1
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
    meta = {
        "layer": layer_name,
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
        "tag": f'{cfg["tag_key"]}={cfg["tag_value"]}',
    }
    return fc, meta


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


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out-dir", type=Path, default=REPO / "public" / "data")
    ap.add_argument("--endpoint", default=ENDPOINT_DEFAULT)
    ap.add_argument("--timeout", type=int, default=180)
    ap.add_argument("--retries", type=int, default=6)
    ap.add_argument("--pause", type=float, default=6.0)
    ap.add_argument(
        "--max-span",
        type=float,
        default=2.5,
        help="Max bbox tile span in degrees (lon/lat).",
    )
    ap.add_argument("--refresh-polygons", action="store_true")
    ap.add_argument("--layers", nargs="+", default=["zoos"], choices=list(LAYERS))
    args = ap.parse_args()

    if args.refresh_polygons or any(not (CACHE / f"{r}.geojson").exists() for r in REGIONS):
        refresh_polygons()

    args.out_dir.mkdir(parents=True, exist_ok=True)
    extracted_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    all_meta: dict[str, Any] = {}

    for layer_name in args.layers:
        print(f"##### Extracting {layer_name} #####", flush=True)
        fc, stats = extract_layer(
            layer_name,
            args.endpoint,
            args.timeout,
            args.retries,
            args.pause,
            args.max_span,
        )
        out_path = args.out_dir / f"{layer_name}.geojson"
        with out_path.open("w", encoding="utf-8") as f:
            json.dump(fc, f, ensure_ascii=False, separators=(",", ":"))
            f.write("\n")
        print(f"Wrote {out_path} ({stats['count']} features)", flush=True)

        limitations: dict[str, Any] = {
            "isle_of_man": stats["isle_of_man_bbox_count"],
            "channel_islands": stats["channel_islands_bbox_count"],
            "guernsey": stats["guernsey_bbox_count"],
            "jersey": stats["jersey_bbox_count"],
            "northern_france_approx": stats["northern_france_bleed_approx"],
            "ways_as_centre_points": stats["ways_as_centre_points"],
            "relations_as_centre_points": stats["relations_as_centre_points"],
            "pipeline_generic_names": stats["pipeline_generic_names"],
            "pipeline_note_repeats_brand": stats["pipeline_note_brand_or_osm"],
            "note_semantics": "pipeline field (brand/operator or 'OpenStreetMap'), not OSM note=*",
            "clip_note": "features clipped to OSM admin polygons (+~200m buffer)",
        }
        if layer_name == "zoos":
            limitations["counting_caveat"] = (
                "tourism=zoo only; aquariums, wildlife parks, animal "
                "shelters/boarding, theme parks, and safari/farm parks "
                "without tourism=zoo are omitted; feature counts are OSM "
                "objects not distinct zoos (a complex may be several "
                "nodes/ways/relations); disused sites still tagged "
                "tourism=zoo are included; multipolygon relations use "
                "Overpass centre points (not footprints), and a site may "
                "appear both as a relation and as member ways if both carry "
                "tourism=zoo"
            )

        all_meta[layer_name] = {
            "extracted_at": extracted_at,
            "method": (
                "Overpass per-nation/territory bbox tiles clipped to OSM admin "
                "polygons (Nominatim); endpoint overpass.openstreetmap.fr"
            ),
            "license": "ODbL 1.0",
            "endpoint": args.endpoint,
            "layer": layer_name,
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

    meta_path = args.out_dir / "extract-meta.json"
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
        count = meta["count"]
        france = meta["limitations"]["northern_france_approx"]
        if count < 50:
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
