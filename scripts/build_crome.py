#!/usr/bin/env python3
"""Build the optional England-only CROME 2024 vector layer.

The web app always uses Defra's CROME WMS for the toggleable raster view.  The
crop-area ranking and popup need a small vector companion, so this script turns
the 5.1 GB GPKG archive into dissolved county/crop polygons and a PMTiles
artifact.  It is intentionally a build step: the archive, intermediate
GeoJSON, and generated PMTiles are not checked into the repository.

Requirements:
  curl, GDAL (ogrinfo/ogr2ogr with SQLite + GEOS), and tippecanoe >= 2.17.

Examples:
  python3 scripts/build_crome.py
  python3 scripts/build_crome.py --archive /Volumes/data/CROME.gpkg.zip
  python3 scripts/build_crome.py --dry-run
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from zipfile import ZipFile


REPO = Path(__file__).resolve().parents[1]
DEFAULT_ARCHIVE = REPO / "data" / "crome" / "Crop_Map_of_England_CROME_2024.gpkg.zip"
DEFAULT_LOOKUP = REPO / "data" / "crome" / "CROME_LUCODE_LOOKUP.XLSX"
DEFAULT_OUTPUT = REPO / "public" / "tiles" / "crome.pmtiles"
DEFAULT_META = REPO / "public" / "data" / "crome-meta.json"

# This is the 5,087,988,639-byte GPKG ZIP listed in the Defra dataset's files.
# Keep the requested Defra file URL as the primary source so a fresh build has
# a reproducible provenance record even when the archive is not present locally.
CROME_ARCHIVE_URL = "https://environment.data.gov.uk/api/file/download?fileDataSetId=2c6afc6a-ece4-4656-ac30-0ebaeb0459a3&fileName=Crop_Map_of_England_CROME_2024.gpkg.zip"
# The upstream storage host remains a documented fallback if Defra's endpoint
# is temporarily unavailable.
AGRIMETRICS_ARCHIVE_URL = (
    "https://api.agrimetrics.co.uk/file-management/data-sets/"
    "2c6afc6a-ece4-4656-ac30-0ebaeb0459a3/files/"
    "Crop_Map_of_England_CROME_2024.gpkg.zip"
)
LOOKUP_URL = (
    "https://environment.data.gov.uk/api/file/download?"
    "fileDataSetId=2c6afc6a-ece4-4656-ac30-0ebaeb0459a3&"
    "fileName=CROME_LUCODE_LOOKUP.XLSX"
)
CROME_DATASET_PAGE = "https://environment.data.gov.uk/dataset/0903079b-35a2-47de-b805-77a0cc0c57bf"
CROME_WMS_URL = "https://environment.data.gov.uk/spatialdata/crop-map-of-england-2024/wms"
CROME_WMS_LAYER = "Crop_Map_of_England_2024"
CROME_ATTRIBUTION = "Contains data © Rural Payments Agency copyright and/or database right 2024"
EXPECTED_ARCHIVE_BYTES = 5_087_988_639
EXPECTED_ARCHIVE_SHA256_BASE64 = "71rfxrvow0demxetnedkxj4dpzf+3qvhuhzd3isz/wc="

# Keep in lockstep with src/crops.ts and docs/theme-spec.md.
CROP_PALETTE = {
    "greens": "#7CD97C",
    "brassica": "#5BBDF4",
    "berries": "#FF6E91",
    "grain": "#FFD369",
    "flowers": "#C8A6FF",
    "nuts": "#FF6EA7",
}


def run(command: list[str], *, capture: bool = False) -> subprocess.CompletedProcess[str]:
    print("+", " ".join(command))
    return subprocess.run(command, check=True, text=True, capture_output=capture)


def require_tools() -> None:
    missing = [tool for tool in ("curl", "unzip", "ogrinfo", "ogr2ogr", "tippecanoe") if shutil.which(tool) is None]
    if missing:
        raise SystemExit("Missing required tools: " + ", ".join(missing))


def download(url: str, destination: Path, *, expected_size: int | None = None) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and destination.stat().st_size > 0:
        if expected_size is None or destination.stat().st_size == expected_size:
            print(f"using existing {destination} ({destination.stat().st_size:,} bytes)")
            return
        print(f"resuming partial {destination} ({destination.stat().st_size:,} bytes)")
    run([
        "curl", "--fail", "--location", "--retry", "5", "--retry-delay", "2",
        "--continue-at", "-", "--output", str(destination), url,
    ])
    if expected_size is not None and destination.stat().st_size != expected_size:
        raise RuntimeError(f"expected {expected_size:,} bytes, got {destination.stat().st_size:,}")


def verify_archive(path: Path) -> None:
    """Verify the published byte count and SHA-256 before unpacking 5.1 GB."""
    if path.stat().st_size != EXPECTED_ARCHIVE_BYTES:
        raise RuntimeError(f"expected {EXPECTED_ARCHIVE_BYTES:,} bytes, got {path.stat().st_size:,}")
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    actual = base64.b64encode(digest.digest()).decode("ascii")
    if actual != EXPECTED_ARCHIVE_SHA256_BASE64:
        raise RuntimeError(f"archive SHA-256 mismatch: expected {EXPECTED_ARCHIVE_SHA256_BASE64}, got {actual}")


def lookup_from_xlsx(path: Path) -> dict[str, str]:
    """Read the tiny lookup workbook without adding an openpyxl dependency."""
    with ZipFile(path) as archive:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            import xml.etree.ElementTree as ET

            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
            shared = ["".join(item.itertext()) for item in root.findall("m:si", ns)]
        import xml.etree.ElementTree as ET

        root = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
        ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
        out: dict[str, str] = {}
        for row in root.findall(".//m:row", ns):
            cells: list[str] = []
            for cell in row.findall("m:c", ns):
                value = cell.find("m:v", ns)
                raw = value.text if value is not None and value.text else ""
                if cell.attrib.get("t") == "s" and raw:
                    raw = shared[int(raw)]
                cells.append(raw.strip())
            if len(cells) >= 3 and re.fullmatch(r"[A-Z]{2}\d{2,3}", cells[1]):
                out[cells[1]] = cells[2]
        return out


def palette_key(code: str, label: str) -> str:
    value = f"{code} {label}".lower()
    if re.search(r"strawber|raspber|blackber|gooseber|berry", value):
        return "berries"
    if re.search(r"daffodil|borage|chamomile|phacelia|poppy|sunflower|gladiol|sweet william|flower", value):
        return "flowers"
    if re.search(r"tree|orchard|perennial|nut|nursery|woody|hedgerow", value):
        return "nuts"
    if re.search(r"cabbage|turnip|mustard|oilseed|radish|beet|brassica", value):
        return "brassica"
    if re.search(r"barley|wheat|oat|rye|triticale|linseed|maize|millet|sorghum|cereal|spelt", value):
        return "grain"
    if re.search(r"grass|clover|lucerne|sainfoin|pea|bean|chickpea|fenugreek|lupin|soya|cowpea|lettuce|spinach|celery|carrot|parsley|parsnip|leek|hemp|fallow|vegetable|crop", value):
        return "greens"
    if code.upper().startswith("LG") or code.upper().startswith("FA"):
        return "greens"
    if code.upper().startswith("AC"):
        return "grain"
    return "greens"


def describe_gpkg(gpkg: Path) -> tuple[str, str]:
    result = run(["ogrinfo", "-ro", "-so", "-al", "-json", str(gpkg)], capture=True)
    payload = json.loads(result.stdout)
    layers = payload.get("layers", [])
    if not layers:
        raise RuntimeError(f"No layers found in {gpkg}")
    layer = next((x for x in layers if x.get("name") == CROME_WMS_LAYER), layers[0])
    geometry_fields = layer.get("geometryFields", [])
    geometry = geometry_fields[0].get("name", "geom") if geometry_fields else "geom"
    return str(layer["name"]), geometry


def dissolve(gpkg: Path, output: Path, lookup: dict[str, str], *, dry_run: bool = False) -> None:
    layer, geometry = (CROME_WMS_LAYER, "geom") if dry_run else describe_gpkg(gpkg)
    sql = (
        f'SELECT county, lucode AS crop_code, '
        f'SUM(shape_area) / 10000.0 AS area_ha, '
        f'ST_Union("{geometry}") AS geometry '
        f'FROM "{layer}" WHERE lucode IS NOT NULL '
        f'GROUP BY county, lucode'
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    if not dry_run:
        run([
            "ogr2ogr", "-f", "GeoJSON", str(output), str(gpkg),
            "-dialect", "SQLITE", "-sql", sql, "-t_srs", "EPSG:4326",
            "-nln", "crome", "-lco", "RFC7946=YES", "-lco", "COORDINATE_PRECISION=6",
        ])
        payload = json.loads(output.read_text(encoding="utf-8"))
        for index, feature in enumerate(payload.get("features", [])):
            properties = feature.setdefault("properties", {})
            code = str(properties.get("crop_code") or "unknown").strip()
            county = str(properties.get("county") or "unknown").strip()
            label = lookup.get(code, code)
            properties["crop_code"] = code
            properties["crop_name"] = label
            properties["crop_color"] = CROP_PALETTE[palette_key(code, label)]
            properties["feature_id"] = f"{county}:{code}"
            properties["area_ha"] = round(float(properties.get("area_ha") or 0), 3)
            feature["id"] = properties["feature_id"]
        output.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(f"dissolved {layer} by county/lucode -> {output}")


def build_pmtiles(geojson: Path, output: Path, *, dry_run: bool = False) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    command = [
        "tippecanoe", "--quiet", "--force", "-o", str(output), "-l", "crome",
        "-Z3", "-z13", "--read-parallel", "--preserve-input-ids",
        "--detect-shared-borders", "--no-feature-limit", "--no-tile-size-limit",
        "--no-tiny-polygon-reduction", "--coalesce-densest-as-needed", str(geojson),
    ]
    if not dry_run:
        run(command)
    else:
        print("+", " ".join(command))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, default=DEFAULT_ARCHIVE, help="5.1 GB CROME GPKG ZIP")
    parser.add_argument("--url", default=CROME_ARCHIVE_URL, help="archive URL; default is the Defra file endpoint")
    parser.add_argument("--fallback-url", default=AGRIMETRICS_ARCHIVE_URL, help="optional fallback URL when the primary archive host fails")
    parser.add_argument("--lookup", type=Path, default=DEFAULT_LOOKUP, help="CROME_LUCODE_LOOKUP.XLSX")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="output PMTiles path")
    parser.add_argument("--metadata", type=Path, default=DEFAULT_META, help="output provenance JSON path")
    parser.add_argument("--keep-work", action="store_true", help="keep the temporary dissolved GeoJSON directory")
    parser.add_argument("--skip-download", action="store_true", help="require existing archive and lookup files")
    parser.add_argument("--dry-run", action="store_true", help="print commands without downloading or building")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    archive_url = args.url
    if args.dry_run:
        pass
    elif not args.skip_download:
        require_tools()
        try:
            download(args.url, args.archive, expected_size=EXPECTED_ARCHIVE_BYTES)
        except (subprocess.CalledProcessError, RuntimeError):
            if not args.fallback_url or args.fallback_url == args.url:
                raise
            print(f"primary archive failed; trying fallback {args.fallback_url}")
            download(args.fallback_url, args.archive, expected_size=EXPECTED_ARCHIVE_BYTES)
            archive_url = args.fallback_url
        if not args.lookup.exists():
            download(LOOKUP_URL, args.lookup)
    elif not args.archive.exists() or not args.lookup.exists():
        raise SystemExit("--skip-download requires both --archive and --lookup")

    if args.dry_run:
        archive = args.archive
        lookup = {}
    else:
        archive = args.archive
        lookup = lookup_from_xlsx(args.lookup)

    if not args.dry_run and archive.suffix.lower() != ".zip":
        raise SystemExit(f"Expected a .zip archive, got {archive}")
    if not args.dry_run:
        verify_archive(archive)

    with tempfile.TemporaryDirectory(prefix="crome-build-") as temporary:
        work = Path(temporary)
        if args.dry_run:
            gpkg = work / "Crop_Map_of_England_CROME_2024.gpkg"
        else:
            unpacked = work / "unpacked"
            unpacked.mkdir()
            run(["unzip", "-q", str(archive), "-d", str(unpacked)])
            candidates = sorted(unpacked.rglob("*.gpkg"))
            if not candidates:
                raise SystemExit(f"No .gpkg found after extracting {archive}")
            gpkg = candidates[0]
        dissolved = work / "crome-dissolved.geojson"
        dissolve(gpkg, dissolved, lookup, dry_run=args.dry_run)
        build_pmtiles(dissolved, args.output, dry_run=args.dry_run)

        metadata = {
            "dataset": CROME_DATASET_PAGE,
            "wms": {"url": CROME_WMS_URL, "layer": CROME_WMS_LAYER},
            "vector": {"path": "/tiles/crome.pmtiles", "source_layer": "crome"},
            "attribution": CROME_ATTRIBUTION,
            "archive": {"url": archive_url, "expected_bytes": EXPECTED_ARCHIVE_BYTES,
                        "sha256_base64": EXPECTED_ARCHIVE_SHA256_BASE64},
            "palette": CROP_PALETTE,
        }
        if not args.dry_run:
            args.metadata.parent.mkdir(parents=True, exist_ok=True)
            args.metadata.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
        else:
            print(json.dumps(metadata, indent=2))
        if args.keep_work:
            retained = REPO / "data" / "crome" / "build-work"
            if retained.exists():
                shutil.rmtree(retained)
            shutil.copytree(work, retained)
            print(f"kept intermediate files at {retained}")


if __name__ == "__main__":
    main()
