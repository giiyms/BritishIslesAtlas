#!/usr/bin/env python3
"""Build everything the map serves from the raw extracts in data/.

Inputs (not served):
  data/osm/<layer>.geojson            OSM point extracts (scripts/osm_extract.py)
  data/constituencies-gb-2024.geojson  ONS PCON 2024 BGC (scripts/ingest_ons_pcon2024.py)
  src/surfaces.json                    class breaks + palettes (shared with the app)

Outputs:
  public/tiles/<layer>.pmtiles         one per OSM layer, clustered up to z10
  public/tiles/constituencies.pmtiles  seat polygons (PCON24CD, PCON24NM)
  public/tiles/hex.pmtiles             7 km equal-area hexes, n_<layer> counts
  public/tiles/distance-<layer>.png    distance-to-nearest rasters (Web Mercator)
  public/data/seat-stats.json          per-seat counts per layer + hex class breaks
  public/data/seat-index.json          per-seat name, label point, bbox

Requires tippecanoe >= 2.17 (writes PMTiles directly), numpy, scipy, Pillow.

    python3 scripts/build_tiles.py            # everything
    python3 scripts/build_tiles.py --only distance hex
"""

from __future__ import annotations

import argparse
import json
import math
import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from scipy.spatial import cKDTree

REPO = Path(__file__).resolve().parents[1]
OSM = REPO / "data" / "osm"
SEATS = REPO / "data" / "constituencies-gb-2024.geojson"
TILES = REPO / "public" / "tiles"
PUBLIC_DATA = REPO / "public" / "data"
CONFIG = json.loads((REPO / "src" / "surfaces.json").read_text(encoding="utf-8"))
KEEP_PROPS = ("name", "osm_id", "brand", "religion")
EARTH_KM = 6371.0088


def layer_ids() -> list[str]:
    return sorted(p.stem for p in OSM.glob("*.geojson"))


def load_points(layer: str) -> np.ndarray:
    feats = json.loads((OSM / f"{layer}.geojson").read_text(encoding="utf-8"))["features"]
    return np.array([f["geometry"]["coordinates"][:2] for f in feats], dtype=float).reshape(-1, 2)


def tippecanoe(args: list[str]) -> None:
    subprocess.run(["tippecanoe", "--quiet", "--force", *args], check=True)


# ---------------------------------------------------------------- points

def build_points(tmp: Path) -> None:
    for layer in layer_ids():
        feats = json.loads((OSM / f"{layer}.geojson").read_text(encoding="utf-8"))["features"]
        nd = tmp / f"{layer}.ndjson"
        with nd.open("w", encoding="utf-8") as out:
            for f in feats:
                props = {k: f["properties"][k] for k in KEEP_PROPS if f["properties"].get(k)}
                out.write(json.dumps({"type": "Feature", "geometry": f["geometry"], "properties": props},
                                     separators=(",", ":")) + "\n")
        # Clusters up to z10 (point_count et al.), every point kept from z11.
        tippecanoe(["-o", str(TILES / f"{layer}.pmtiles"), "-l", layer, "-Z3", "-z13", "-r1",
                    "--cluster-distance=28", "--cluster-maxzoom=10", "--no-feature-limit",
                    "--no-tile-size-limit", "-P", str(nd)])
        print(f"points  {layer:20s} {len(feats):6d}")


# ---------------------------------------------------------------- seats

def seat_features() -> list[dict]:
    return json.loads(SEATS.read_text(encoding="utf-8"))["features"]


def rings_of(geom: dict) -> list[list[list[float]]]:
    polys = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
    return [poly[0] for poly in polys]


def build_seat_tiles(tmp: Path) -> None:
    nd = tmp / "constituencies.ndjson"
    with nd.open("w", encoding="utf-8") as out:
        for f in seat_features():
            p = f["properties"]
            out.write(json.dumps({"type": "Feature", "geometry": f["geometry"],
                                  "properties": {"PCON24CD": p["PCON24CD"], "PCON24NM": p["PCON24NM"]}},
                                 separators=(",", ":")) + "\n")
    tippecanoe(["-o", str(TILES / "constituencies.pmtiles"), "-l", "constituencies", "-Z3", "-z12",
                "--detect-shared-borders", "--no-tiny-polygon-reduction", "--no-feature-limit",
                "--no-tile-size-limit", "-P", str(nd)])
    print("seats   constituencies.pmtiles")


class SeatRaster:
    """Seat polygons burned into a ~250 m label grid: O(1) point-in-seat lookups."""

    W0, S0, E0, N0 = -8.8, 49.8, 2.0, 61.0
    DX, DY = 0.004, 0.0025

    def __init__(self, feats: list[dict]):
        self.codes = [f["properties"]["PCON24CD"] for f in feats]
        self.w = int((self.E0 - self.W0) / self.DX) + 1
        self.h = int((self.N0 - self.S0) / self.DY) + 1
        img = Image.new("I", (self.w, self.h), 0)
        draw = ImageDraw.Draw(img)
        # Biggest first, so a seat sitting in another seat's hole is drawn on top of it.
        def extent(f: dict) -> float:
            xs = [x for r in rings_of(f["geometry"]) for x, _ in r]
            ys = [y for r in rings_of(f["geometry"]) for _, y in r]
            return (max(xs) - min(xs)) * (max(ys) - min(ys))
        for i, f in sorted(enumerate(feats, start=1), key=lambda item: -extent(item[1])):
            for ring in rings_of(f["geometry"]):
                draw.polygon([self.px(x, y) for x, y in ring], fill=i)
        self.grid = np.array(img, dtype=np.int32)

    def px(self, lon: float, lat: float) -> tuple[float, float]:
        return ((lon - self.W0) / self.DX, (self.N0 - lat) / self.DY)

    def lookup(self, pts: np.ndarray) -> np.ndarray:
        """1-based seat index per point; 0 = outside GB (one-cell coastal tolerance)."""
        if not len(pts):
            return np.zeros(0, dtype=np.int32)
        c = np.round((pts[:, 0] - self.W0) / self.DX).astype(int)
        r = np.round((self.N0 - pts[:, 1]) / self.DY).astype(int)
        ok = (c >= 1) & (r >= 1) & (c < self.w - 1) & (r < self.h - 1)
        out = np.zeros(len(pts), dtype=np.int32)
        out[ok] = self.grid[r[ok], c[ok]]
        for dr, dc in ((0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            miss = ok & (out == 0)
            out[miss] = self.grid[r[miss] + dr, c[miss] + dc]
        return out

    def label_points(self) -> dict[str, list[float]]:
        """Pole of inaccessibility per seat (grid cell farthest from the seat edge)."""
        out = {}
        objects = ndimage.find_objects(self.grid)
        for i, code in enumerate(self.codes, start=1):
            sl = objects[i - 1]
            if sl is None:
                raise ValueError(f"{code} has no cells in the seat raster")
            mask = np.pad(self.grid[sl] == i, 1)
            d = ndimage.distance_transform_edt(mask)
            r, c = np.unravel_index(np.argmax(d), d.shape)
            lon = self.W0 + (sl[1].start + c - 1) * self.DX
            lat = self.N0 - (sl[0].start + r - 1) * self.DY
            out[code] = [round(lon, 4), round(lat, 4)]
        return out


def build_seat_data() -> None:
    feats = seat_features()
    raster = SeatRaster(feats)
    layers = layer_ids()
    counts = np.zeros((len(feats), len(layers)), dtype=int)
    for j, layer in enumerate(layers):
        idx = raster.lookup(load_points(layer))
        counts[:, j] = np.bincount(idx, minlength=len(feats) + 1)[1:]
    stats = {"layers": layers, "seats": {code: counts[i].tolist() for i, code in enumerate(raster.codes)}}
    labels = raster.label_points()
    index = {}
    for f in feats:
        code = f["properties"]["PCON24CD"]
        xs = [x for ring in rings_of(f["geometry"]) for x, _ in ring]
        ys = [y for ring in rings_of(f["geometry"]) for _, y in ring]
        index[code] = {"name": f["properties"]["PCON24NM"], "label": labels[code],
                       "bbox": [round(min(xs), 4), round(min(ys), 4), round(max(xs), 4), round(max(ys), 4)]}
    merged = json.loads((PUBLIC_DATA / "seat-stats.json").read_text()) if (PUBLIC_DATA / "seat-stats.json").exists() else {}
    merged.update(stats)
    (PUBLIC_DATA / "seat-stats.json").write_text(json.dumps(merged, separators=(",", ":")), encoding="utf-8")
    (PUBLIC_DATA / "seat-index.json").write_text(json.dumps(index, separators=(",", ":")), encoding="utf-8")
    print(f"seats   seat-stats.json ({len(layers)} layers), seat-index.json")


# ---------------------------------------------------------------- hexes (Lambert azimuthal equal-area)

LAT0, LON0 = math.radians(54.5), math.radians(-4.0)


def laea(lon: np.ndarray, lat: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    lam, phi = np.radians(lon) - LON0, np.radians(lat)
    k = np.sqrt(2 / (1 + math.sin(LAT0) * np.sin(phi) + math.cos(LAT0) * np.cos(phi) * np.cos(lam)))
    x = EARTH_KM * k * np.cos(phi) * np.sin(lam)
    y = EARTH_KM * k * (math.cos(LAT0) * np.sin(phi) - math.sin(LAT0) * np.cos(phi) * np.cos(lam))
    return x, y


def laea_inv(x: float, y: float) -> tuple[float, float]:
    rho = math.hypot(x, y)
    if rho == 0:
        return math.degrees(LON0), math.degrees(LAT0)
    c = 2 * math.asin(rho / (2 * EARTH_KM))
    phi = math.asin(math.cos(c) * math.sin(LAT0) + y * math.sin(c) * math.cos(LAT0) / rho)
    lam = LON0 + math.atan2(x * math.sin(c), rho * math.cos(LAT0) * math.cos(c) - y * math.sin(LAT0) * math.sin(c))
    return math.degrees(lam), math.degrees(phi)


def hex_keys(x: np.ndarray, y: np.ndarray, r: float) -> tuple[np.ndarray, np.ndarray]:
    """Pointy-top axial coordinates (cube rounding)."""
    q = (math.sqrt(3) / 3 * x - y / 3) / r
    s_ = (2 / 3 * y) / r
    cx, cz = q, s_
    cy = -cx - cz
    rx, ry, rz = np.round(cx), np.round(cy), np.round(cz)
    dx, dy, dz = np.abs(rx - cx), np.abs(ry - cy), np.abs(rz - cz)
    fx = (dx > dy) & (dx > dz)
    fz = ~fx & (dz >= dy)
    rx = np.where(fx, -ry - rz, rx)
    rz = np.where(fz, -rx - ry, rz)
    return rx.astype(int), rz.astype(int)


def quantile_breaks(values: np.ndarray, n: int = 5) -> list[int]:
    v = np.sort(values[values > 0])
    if not len(v):
        return []
    br = sorted({int(v[int(i / n * len(v))]) for i in range(1, n)})
    return [b for b in br if b > v[0]]


def build_hex(tmp: Path) -> None:
    r = float(CONFIG["hex"]["radiusKm"])
    cells: dict[tuple[int, int], dict[str, int]] = {}
    breaks = {}
    for layer in layer_ids():
        pts = load_points(layer)
        if not len(pts):
            continue
        q, s_ = hex_keys(*laea(pts[:, 0], pts[:, 1]), r)
        keys, n = np.unique(np.stack([q, s_], 1), axis=0, return_counts=True)
        for (kq, ks), c in zip(keys.tolist(), n.tolist()):
            cells.setdefault((kq, ks), {})[f"n_{layer}"] = c
        breaks[layer] = quantile_breaks(n)
    nd = tmp / "hex.ndjson"
    with nd.open("w", encoding="utf-8") as out:
        for (q, s_), props in cells.items():
            cx, cy = r * math.sqrt(3) * (q + s_ / 2), r * 1.5 * s_
            ring = [laea_inv(cx + r * math.cos(math.pi / 6 + i * math.pi / 3), cy + r * math.sin(math.pi / 6 + i * math.pi / 3))
                    for i in range(6)]
            ring = [[round(a, 5), round(b, 5)] for a, b in ring]
            out.write(json.dumps({"type": "Feature", "properties": props,
                                  "geometry": {"type": "Polygon", "coordinates": [ring + [ring[0]]]}},
                                 separators=(",", ":")) + "\n")
    tippecanoe(["-o", str(TILES / "hex.pmtiles"), "-l", "hex", "-Z3", "-z10", "--no-feature-limit",
                "--no-tile-size-limit", "--no-tiny-polygon-reduction",
                "-P", str(nd)])
    merged = json.loads((PUBLIC_DATA / "seat-stats.json").read_text()) if (PUBLIC_DATA / "seat-stats.json").exists() else {}
    merged["hexBreaks"] = breaks
    merged["hexAreaKm2"] = round(1.5 * math.sqrt(3) * r * r, 1)
    (PUBLIC_DATA / "seat-stats.json").write_text(json.dumps(merged, separators=(",", ":")), encoding="utf-8")
    print(f"hex     {len(cells)} cells, r={r} km")


# ---------------------------------------------------------------- distance rasters

def merc_y(lat: float) -> float:
    return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


def france(lon: np.ndarray, lat: np.ndarray) -> np.ndarray:
    """Continental land inside the raster bounds (Normandy, Cotentin, Pas-de-Calais)."""
    return ((lat < 50.4) & (lon > -2.0)) | ((lat < 51.1) & (lon > 1.45))


def unit_xyz(lon: np.ndarray, lat: np.ndarray) -> np.ndarray:
    lam, phi = np.radians(lon), np.radians(lat)
    return np.stack([np.cos(phi) * np.cos(lam), np.cos(phi) * np.sin(lam), np.sin(phi)], 1)


def hex_rgb(c: str) -> tuple[int, int, int]:
    n = int(c[1:], 16)
    return n >> 16, (n >> 8) & 255, n & 255


def build_distance() -> None:
    cfg = CONFIG["distance"]
    w0, s0, e0, n0 = cfg["bounds"]
    mid = math.radians((s0 + n0) / 2)
    width = int(round((e0 - w0) * math.pi / 180 * EARTH_KM * math.cos(mid) / cfg["pixelKm"]))
    height = int(round(width * (merc_y(n0) - merc_y(s0)) / math.radians(e0 - w0)))
    lon = w0 + (np.arange(width) + 0.5) / width * (e0 - w0)
    ys = merc_y(n0) - (np.arange(height) + 0.5) / height * (merc_y(n0) - merc_y(s0))
    lat = np.degrees(2 * np.arctan(np.exp(ys)) - math.pi / 2)
    glon, glat = np.meshgrid(lon, lat)
    query = unit_xyz(glon.ravel(), glat.ravel())
    blocked = france(glon.ravel(), glat.ravel())
    palette = [hex_rgb(c) for c in CONFIG["palettes"]["distance"]]
    for layer, breaks in cfg["layers"].items():
        pts = load_points(layer)
        dist, _ = cKDTree(unit_xyz(pts[:, 0], pts[:, 1])).query(query, workers=-1)
        km = 2 * EARTH_KM * np.arcsin(np.clip(dist / 2, 0, 1))
        cls = np.digitize(km, breaks)  # 0..len(breaks)
        rgba = np.zeros((len(km), 4), dtype=np.uint8)
        rgba[:, :3] = np.array(palette, dtype=np.uint8)[cls]
        rgba[:, 3] = np.where(blocked, 0, 255)
        img = Image.fromarray(rgba.reshape(height, width, 4))
        img = img.quantize(colors=len(palette) + 1, method=Image.Quantize.FASTOCTREE)
        img.save(TILES / f"distance-{layer}.png", optimize=True)
        print(f"distance {layer:18s} {width}x{height}")
    meta = {"bounds": cfg["bounds"], "width": width, "height": height}
    (TILES / "distance-meta.json").write_text(json.dumps(meta), encoding="utf-8")


# ----------------------------------------------------------------

STEPS = {"points": build_points, "seats": build_seat_tiles, "seatdata": lambda _t: build_seat_data(),
         "hex": build_hex, "distance": lambda _t: build_distance()}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", nargs="*", choices=list(STEPS), help="subset of steps")
    args = ap.parse_args()
    if not shutil.which("tippecanoe"):
        raise SystemExit("tippecanoe not found (brew install tippecanoe)")
    TILES.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for name in args.only or list(STEPS):
            STEPS[name](Path(tmp))


if __name__ == "__main__":
    main()
