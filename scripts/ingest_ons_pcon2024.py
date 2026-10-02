#!/usr/bin/env python3
"""Ingest ONS July 2024 Westminster PCON BGC boundaries (GB-only, 632 seats).

Downloads WGS84 GeoJSON from the ONS ArcGIS FeatureServer, drops Northern
Ireland (18 seats), writes public/data/constituencies-gb-2024.geojson, and
merges metadata into public/data/extract-meta.json.

Usage:
  python3 scripts/ingest_ons_pcon2024.py
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_GEOJSON = ROOT / "public" / "data" / "constituencies-gb-2024.geojson"
META_PATH = ROOT / "public" / "data" / "extract-meta.json"

FEATURE_SERVER = (
    "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/"
    "Westminster_Parliamentary_Constituencies_July_2024_Boundaries_UK_BGC/"
    "FeatureServer/0/query"
)
PAGE_SIZE = 2000
EXPECTED_UK = 650
EXPECTED_GB = 632
EXPECTED_NI = 18
LICENSE = "OGL v3.0"
LAYER_ID = "constituencies"


def fetch_page(offset: int, page_size: int = PAGE_SIZE) -> dict:
    params = {
        "where": "1=1",
        "outFields": "*",
        "outSR": "4326",
        "f": "geojson",
        "resultOffset": str(offset),
        "resultRecordCount": str(page_size),
    }
    url = f"{FEATURE_SERVER}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": "BritishIslesAtlas/ingest_ons_pcon2024"})
    with urllib.request.urlopen(req, timeout=180) as resp:
        return json.loads(resp.read().decode("utf-8"))


def download_all() -> list[dict]:
    features: list[dict] = []
    offset = 0
    while True:
        print(f"Fetching offset={offset} …", flush=True)
        try:
            page = fetch_page(offset)
        except urllib.error.HTTPError as exc:
            raise SystemExit(f"HTTP error fetching FeatureServer: {exc}") from exc
        except urllib.error.URLError as exc:
            raise SystemExit(f"URL error fetching FeatureServer: {exc}") from exc
        batch = page.get("features") or []
        features.extend(batch)
        # ArcGIS may set exceededTransferLimit when more pages remain
        exceeded = page.get("exceededTransferLimit") or page.get("properties", {}).get(
            "exceededTransferLimit"
        )
        if not batch:
            break
        if exceeded or len(batch) >= PAGE_SIZE:
            offset += len(batch)
            continue
        break
    return features


def is_northern_ireland(props: dict) -> bool:
    """NI PCON24CD codes start with 'N' (e.g. N06000001). Also check CTRY/RGN fields."""
    code = str(props.get("PCON24CD") or props.get("pcon24cd") or "").strip().upper()
    if code.startswith("N"):
        return True
    for key in ("CTRY24CD", "CTRY24NM", "CTRY23CD", "CTRY23NM", "RGN24CD", "RGN24NM"):
        val = str(props.get(key) or "").strip().lower()
        if not val:
            continue
        if val in {"n92000002", "northern ireland", "northern ireland (statistical)"}:
            return True
        if "northern ireland" in val:
            return True
    return False


def slim_feature(feat: dict) -> dict:
    props = feat.get("properties") or {}
    code = str(props.get("PCON24CD") or "").strip()
    name = str(props.get("PCON24NM") or "").strip()
    return {
        "type": "Feature",
        "geometry": feat.get("geometry"),
        "properties": {
            "name": name,
            "PCON24CD": code,
            "PCON24NM": name,
            "layer": LAYER_ID,
            "source": "ONS",
        },
    }


def main() -> int:
    raw = download_all()
    print(f"Downloaded {len(raw)} features (expect {EXPECTED_UK} UK)", flush=True)
    if len(raw) != EXPECTED_UK:
        print(
            f"WARNING: expected {EXPECTED_UK} UK features, got {len(raw)}",
            file=sys.stderr,
        )

    gb: list[dict] = []
    ni: list[dict] = []
    missing_fields: list[str] = []
    for feat in raw:
        props = feat.get("properties") or {}
        code = str(props.get("PCON24CD") or "").strip()
        name = str(props.get("PCON24NM") or "").strip()
        if not code or not name:
            missing_fields.append(repr(props.get("PCON24CD")))
            continue
        if is_northern_ireland(props):
            ni.append(feat)
        else:
            gb.append(slim_feature(feat))

    if missing_fields:
        raise SystemExit(f"Features missing PCON24CD/PCON24NM: {len(missing_fields)}")
    if len(ni) != EXPECTED_NI:
        raise SystemExit(f"Expected {EXPECTED_NI} NI features dropped, got {len(ni)}")
    if len(gb) != EXPECTED_GB:
        raise SystemExit(f"Expected {EXPECTED_GB} GB features, got {len(gb)}")

    # Fixture asserts
    for feat in gb:
        props = feat["properties"]
        code = props["PCON24CD"]
        assert code and props["PCON24NM"], "missing code/name"
        assert not code.upper().startswith("N"), f"NI code leaked: {code}"
        assert feat.get("geometry"), f"missing geometry for {code}"

    collection = {"type": "FeatureCollection", "features": gb}
    OUT_GEOJSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_GEOJSON.write_text(json.dumps(collection, separators=(",", ":")), encoding="utf-8")
    size_bytes = OUT_GEOJSON.stat().st_size
    print(f"Wrote {OUT_GEOJSON} ({size_bytes:,} bytes, {len(gb)} features)", flush=True)

    extracted_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    meta_entry = {
        "extracted_at": extracted_at,
        "method": (
            "ONS ArcGIS FeatureServer GeoJSON (WGS84 outSR=4326); "
            "filter GB-only by dropping NI PCON24CD (N*); paginated resultOffset"
        ),
        "license": LICENSE,
        "endpoint": FEATURE_SERVER,
        "source_url": FEATURE_SERVER + "?where=1%3D1&outFields=*&outSR=4326&f=geojson",
        "dataset": "Westminster Parliamentary Constituencies July 2024 Boundaries UK BGC",
        "publisher": "Office for National Statistics (Open Geography Portal)",
        "as_of": "2024-07-04",
        "generalisation": "BGC ~20 m, clipped to Mean High Water",
        "layer": LAYER_ID,
        "file": "constituencies-gb-2024.geojson",
        "count": len(gb),
        "uk_count_downloaded": len(raw),
        "ni_dropped": len(ni),
        "coverage": (
            f"GB Westminster only: England+Scotland+Wales = {len(gb)}; "
            f"Northern Ireland {len(ni)} deferred; Ireland/IoM/CI have no Westminster seats"
        ),
        "attribution": (
            "Contains Ordnance Survey data © Crown copyright and database right 2024. "
            "Contains National Statistics data © Crown copyright and database right 2024."
        ),
        "size_bytes": size_bytes,
    }

    meta: dict = {}
    if META_PATH.exists():
        meta = json.loads(META_PATH.read_text(encoding="utf-8"))
    meta[LAYER_ID] = meta_entry
    META_PATH.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Updated {META_PATH} key '{LAYER_ID}'", flush=True)
    print(
        f"OK: GB={len(gb)} NI_dropped={len(ni)} size={size_bytes:,}B extracted_at={extracted_at}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
