#!/usr/bin/env python3
"""Build public/data/wind.geojson: individual wind turbines, cross-checked with REPD.

Inputs (fetched once, cached under --cache, which is git-ignored):
  turbines.json  Overpass: node[power=generator][generator:source=wind] in
                 49.8,-11.0,61.2,3.2 with `out body` (ODbL).
  plants.json    Overpass: way/relation[power=plant][plant:source~wind] in the
                 same bbox with `out geom` (farm names, operators, repd:id, membership).
  repd.csv       DESNZ Renewable Energy Planning Database, October 2026 (Q3) extract
                 (OGL v3), https://www.gov.uk/government/publications/
                 renewable-energy-planning-database-quarterly-extract
  ne10.geojson   Natural Earth 10m admin-0 countries (public domain), only to drop
                 turbines standing on foreign land (France, Belgium, ...).

Kept: turbines on land in GB, IE, IM, GG, JE, or offshore in the UK/Irish seas
(an explicit lat/lon fence keeps Belgian, Dutch and French offshore farms out).
Each turbine gets its farm from plant relation membership, else the plant way
polygon it sits in, else the nearest REPD operational wind site within 4 km
(onshore) or 25 km (offshore; REPD gives one point per offshore farm). REPD
records are matched by explicit OSM `repd:id` (on the node or its OSM plant)
first, falling back to nearest REPD site within 4 km / 25 km only when no
`repd:id` is tagged.

Usage: python3 scripts/extract_wind_turbines.py --cache /path/to/cache
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import LineString, Point, Polygon, shape
from shapely.ops import polygonize
from shapely.prepared import prep
from shapely.strtree import STRtree

REPO = Path(__file__).resolve().parents[1]
KEEP_ISO = {"GBR", "IRL", "IMN", "GGY", "JEY"}
NUDGE_M = 2.0
GOLDEN = math.radians(137.50776)


def parse_repd_ids(v: str | None) -> list[str]:
    if not v:
        return []
    return [tok.strip() for tok in re.split(r"[;,/\s]+", v) if tok.strip().isdigit()]


def mw(v: str | None) -> float | None:
    if not v:
        return None
    m = re.match(r"\s*([\d.]+)\s*(kW|MW|W|GW)?", v, re.I)
    if not m:
        return None
    n = float(m.group(1))
    unit = (m.group(2) or "MW").lower()
    return round(n * {"w": 1e-6, "kw": 1e-3, "mw": 1, "gw": 1e3}[unit], 4)


def metres(v: str | None) -> float | None:
    if not v:
        return None
    m = re.match(r"\s*([\d.]+)", v)
    return round(float(m.group(1)), 1) if m else None


def offshore_fence(lon: float, lat: float) -> bool:
    """UK and Irish waters only; excludes French, Belgian and Dutch farms."""
    if lat < 50.1 or lat > 61.2 or lon < -11:
        return False
    if lat < 51.2:
        return lon < 1.3
    if lat < 51.75:
        return lon < 2.2
    return lon < 3.0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", type=Path, required=True)
    ap.add_argument("--out", type=Path, default=REPO / "public/data/wind.geojson")
    args = ap.parse_args()
    c = args.cache

    turbines = json.loads((c / "turbines.json").read_text())
    plants = json.loads((c / "plants.json").read_text())
    osm_base = turbines["osm3s"]["timestamp_osm_base"]

    countries = json.loads((c / "ne10.geojson").read_text())["features"]
    keep_land = [prep(shape(f["geometry"]).buffer(0.01)) for f in countries if f["properties"]["ADM0_A3"] in KEEP_ISO]
    foreign = [(f["properties"]["ADM0_A3"], prep(shape(f["geometry"]))) for f in countries
               if f["properties"]["ADM0_A3"] not in KEEP_ISO and f["properties"].get("CONTINENT") == "Europe"]

    # Farm lookup: relation membership, then plant polygons.
    member_farm: dict[int, dict] = {}
    polys: list[Polygon] = []
    poly_farm: list[dict] = []
    for p in plants["elements"]:
        t = p.get("tags", {})
        farm = {"farm": t.get("name"), "operator": t.get("operator"),
                "farm_capacity_mw": mw(t.get("plant:output:electricity")),
                "repd_ids": parse_repd_ids(t.get("repd:id")),
                "farm_osm": f"{p['type']}/{p['id']}"}
        if p["type"] == "relation":
            open_lines: list[LineString] = []
            for m in p.get("members", []):
                if m["type"] == "node":
                    prev = member_farm.get(m["ref"])
                    # Prefer a plant relation that carries explicit repd:id / name.
                    if not prev or (farm["repd_ids"] and not prev["repd_ids"]) or (farm["farm"] and not prev["farm"]):
                        member_farm[m["ref"]] = farm
                elif m["type"] == "way" and m.get("role") in ("outer", "") and len(m.get("geometry", [])) >= 2:
                    g = m["geometry"]
                    if len(g) >= 4 and g[0] == g[-1]:
                        polys.append(Polygon([(q["lon"], q["lat"]) for q in g]).buffer(0)); poly_farm.append(farm)
                    else:
                        open_lines.append(LineString([(q["lon"], q["lat"]) for q in g]))
            if open_lines:
                for poly in polygonize(open_lines):
                    polys.append(poly.buffer(0)); poly_farm.append(farm)
        elif len(p.get("geometry", [])) >= 4:
            g = p["geometry"]
            polys.append(Polygon([(q["lon"], q["lat"]) for q in g]).buffer(0)); poly_farm.append(farm)
    tree = STRtree(polys)

    # REPD wind sites (OSGB36 / BNG -> WGS84; REPD publishes NI on BNG too; we convert from EPSG:27700).
    tf = Transformer.from_crs("EPSG:27700", "EPSG:4326", always_xy=True)
    repd = []
    repd_by_ref: dict[str, dict] = {}
    with (c / "repd.csv").open(encoding="latin-1") as f:
        for r in csv.DictReader(f):
            if not r["Technology Type"].startswith("Wind"):
                continue
            try:
                x, y = float(r["X-coordinate"]), float(r["Y-coordinate"])
            except ValueError:
                continue
            lon, lat = tf.transform(x, y)
            row = {"ref": r["Ref ID"].strip(), "site": r["Site Name"].strip(),
                   "operator": r["Operator (or Applicant)"].strip(),
                   "status": r["Development Status (short)"].strip(), "tech": r["Technology Type"].strip(),
                   "mw": r["Installed Capacity (MWelec)"].strip(), "turbines": r["No. of Turbines"].strip(),
                   "country": r["Country"].strip(), "lon": lon, "lat": lat}
            repd.append(row)
            repd_by_ref[row["ref"]] = row
    live = [s for s in repd if s["status"] in ("Operational", "Under Construction")]
    cell: dict[tuple[int, int], list[dict]] = {}
    for s in live:
        cell.setdefault((int(s["lon"] * 10), int(s["lat"] * 10)), []).append(s)

    def pick_repd_by_ids(ids: list[str]) -> dict | None:
        matches = [repd_by_ref[rid] for rid in ids if rid in repd_by_ref]
        if not matches:
            return None
        for wanted in ("Operational", "Under Construction"):
            for m in matches:
                if m["status"] == wanted:
                    return m
        return matches[0]

    def nearest_repd(lon: float, lat: float, max_km: float):
        best, bd = None, max_km
        kx, ky = int(lon * 10), int(lat * 10)
        span = math.ceil(max_km / 6) + 1
        for dx in range(-span, span + 1):
            for dy in range(-span, span + 1):
                for s in cell.get((kx + dx, ky + dy), []):
                    d = math.hypot((s["lon"] - lon) * 111.32 * math.cos(math.radians(lat)), (s["lat"] - lat) * 110.57)
                    if d < bd:
                        best, bd = s, d
        return best

    feats, dropped, linked_repd = [], Counter(), set()
    matched_by_id = 0
    for e in turbines["elements"]:
        lon, lat, t = e["lon"], e["lat"], e.get("tags", {})
        pt = Point(lon, lat)
        onshore = any(g.contains(pt) for g in keep_land)
        if not onshore:
            hit = next((iso for iso, g in foreign if g.contains(pt)), None)
            if hit or not offshore_fence(lon, lat):
                dropped[hit or "outside-fence"] += 1
                continue
        farm = member_farm.get(e["id"])
        if not farm:
            for i in tree.query(pt):
                if polys[int(i)].contains(pt):
                    farm = poly_farm[int(i)]; break
        explicit_ids = parse_repd_ids(t.get("repd:id")) + list((farm or {}).get("repd_ids") or [])
        site = pick_repd_by_ids(explicit_ids)
        if site:
            matched_by_id += 1
            for rid in explicit_ids:
                if rid in repd_by_ref:
                    linked_repd.add(rid)
        else:
            site = nearest_repd(lon, lat, 4.0 if onshore else 25.0)
        status = "Operational"
        if any(k.startswith("construction") for k in t) or t.get("construction"):
            status = "Under construction"
        elif any(k.startswith(("disused", "abandoned")) for k in t):
            status = "Disused"
        farm_name = (farm or {}).get("farm") or (site or {}).get("site")
        name = t.get("name") or (f"{farm_name} turbine {t['ref']}" if farm_name and t.get("ref") else
                                 f"{farm_name} turbine" if farm_name else "Wind turbine")
        props = {
            "name": name, "layer": "wind",
            "farm": farm_name,
            # True when the farm name is the nearest REPD site, not OSM plant membership/area.
            "farm_from_repd": True if farm_name and not (farm or {}).get("farm") else None,
            "operator": t.get("operator") or (farm or {}).get("operator") or (site or {}).get("operator") or None,
            "capacity_mw": mw(t.get("generator:output:electricity")),
            "rotor_m": metres(t.get("rotor:diameter")),
            "hub_m": metres(t.get("height:hub")),
            "height_m": metres(t.get("height")),
            "manufacturer": t.get("manufacturer") or t.get("generator:manufacturer"),
            "model": t.get("model") or t.get("generator:model"),
            "status": status, "offshore": not onshore,
            "start_date": t.get("start_date") or t.get("year_of_construction"),
            "ref": t.get("ref"),
            "repd_ref": site["ref"] if site else None,
            "repd_status": site["status"] if site else None,
            "osm_id": f"node/{e['id']}", "osm_url": f"https://www.openstreetmap.org/node/{e['id']}",
            "source": "OpenStreetMap" + (" + REPD" if site else ""),
            "note": (farm_name or "Wind turbine") + (" · offshore" if not onshore else ""),
        }
        feats.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
                      "properties": {k: v for k, v in props.items() if v not in (None, "")}})

    # Separate any coincident coordinates within the wind layer (same rule as scripts/nudge_coincident_points.py).
    groups: dict[tuple[float, float], list[dict]] = defaultdict(list)
    for f in feats:
        lon, lat = f["geometry"]["coordinates"]
        groups[(lon, lat)].append(f)
    for (lon, lat), members in groups.items():
        if len(members) < 2:
            continue
        members.sort(key=lambda f: str(f["properties"].get("osm_id", "")))
        for k, f in enumerate(members[1:], start=1):
            bearing = k * GOLDEN
            dlat = NUDGE_M * math.cos(bearing) / 111_320
            dlon = NUDGE_M * math.sin(bearing) / (111_320 * math.cos(math.radians(lat)))
            f["geometry"]["coordinates"] = [round(lon + dlon, 7), round(lat + dlat, 7)]
            f["properties"]["true_lon"], f["properties"]["true_lat"] = lon, lat

    args.out.write_text(json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False, separators=(",", ":")) + "\n")

    # Coverage report against REPD: a site counts as covered when linked via explicit OSM repd:id
    # on a kept turbine/plant, OR when any kept turbine lies within 4 km (onshore) or 25 km (offshore).
    tcell: dict[tuple[int, int], list[tuple[float, float]]] = {}
    for f in feats:
        p = f["properties"]
        x, y = (p["true_lon"], p["true_lat"]) if "true_lon" in p else tuple(f["geometry"]["coordinates"])
        tcell.setdefault((int(x * 10), int(y * 10)), []).append((x, y))

    def covered(s: dict) -> bool:
        if s["ref"] in linked_repd:
            return True
        r = 25.0 if s["tech"] == "Wind Offshore" else 4.0
        span = math.ceil(r / 6) + 1
        kx, ky = int(s["lon"] * 10), int(s["lat"] * 10)
        for dx in range(-span, span + 1):
            for dy in range(-span, span + 1):
                for x, y in tcell.get((kx + dx, ky + dy), []):
                    if math.hypot((x - s["lon"]) * 111.32 * math.cos(math.radians(y)), (y - s["lat"]) * 110.57) <= r:
                        return True
        return False

    matched_repd = {s["ref"] for s in live if covered(s)}
    by = Counter()
    gaps = []
    for s in live:
        key = (s["tech"], s["status"])
        by[key + ("total",)] += 1
        if s["ref"] in matched_repd:
            by[key + ("with_osm_turbine",)] += 1
        elif s["status"] == "Operational":
            gaps.append(s)
    gaps.sort(key=lambda s: -float(s["mw"] or 0))
    report = {
        "osm_base": osm_base, "turbines": len(feats),
        "offshore": sum(1 for f in feats if f["properties"]["offshore"]),
        "with_farm": sum(1 for f in feats if "farm" in f["properties"]),
        "with_capacity": sum(1 for f in feats if "capacity_mw" in f["properties"]),
        "with_rotor": sum(1 for f in feats if "rotor_m" in f["properties"]),
        "with_hub": sum(1 for f in feats if "hub_m" in f["properties"]),
        "with_repd_match": sum(1 for f in feats if "repd_ref" in f["properties"]),
        "with_repd_id_match": matched_by_id,
        "dropped": dict(dropped),
        "repd": {" / ".join(k): v for k, v in sorted(by.items())},
        "largest_repd_operational_gaps": [f"{s['site']} ({s['tech']}, {s['mw']} MW, {s['country']})" for s in gaps[:15]],
        "repd_operational_gap_count": len(gaps),
    }
    meta_path = args.out.parent / "extract-meta.json"
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    meta["wind"] = {"extracted_at": osm_base, "license": "ODbL 1.0 (OSM) + OGL v3 (REPD October 2026)", "count": len(feats), "report": report}
    meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
