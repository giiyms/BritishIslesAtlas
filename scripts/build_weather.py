#!/usr/bin/env python3
"""Weather layer from the Met Office historic station data (37 long-record UK stations), OGL v3.

Download each station's file from
https://www.metoffice.gov.uk/pub/data/weather/uk/climate/stationdata/<name>data.txt
into one folder, then:

    python3 scripts/build_weather.py path/to/folder

Each station gets its latest month (provisional values flagged) and its 1991-2020 averages
(mean daily max/min, annual rain, annual sunshine) computed from complete years only.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
CURRENT_YEAR = 2026  # data as downloaded; a station whose record stops earlier is shown as closed
BASE = "https://www.metoffice.gov.uk/pub/data/weather/uk/climate/stationdata/"


def num(value: str) -> float | None:
    value = value.strip().rstrip("*#$")
    try:
        return float(value)
    except ValueError:
        return None


def parse(path: Path) -> dict:
    lines = path.read_text(encoding="latin-1").splitlines()
    name = re.split(r"\s{2,}| / ", lines[0].strip())[0]
    locs = re.findall(r"Lat\s*(-?\d+\.\d+)\s*Lon\s*(-?\d+\.\d+)[^\d-]*(\d+)\s*m", " ".join(lines[:8]))
    lat, lon, amsl = locs[-1]  # the station's current site when it has moved
    rows = []
    for line in lines:
        m = re.match(r"\s*(\d{4})\s+(\d{1,2})\s+(.*)", line)
        if not m:
            continue
        cells = m.group(3).split()
        vals = [num(c) for c in cells[:5]] + [None] * (5 - len(cells[:5]))
        rows.append({"y": int(m.group(1)), "m": int(m.group(2)), "tmax": vals[0], "tmin": vals[1],
                     "af": vals[2], "rain": vals[3], "sun": vals[4], "provisional": "Provisional" in line})
    return {"name": name, "lat": float(lat), "lon": float(lon), "amsl": int(amsl), "rows": rows, "file": path.name}


def normals(rows: list[dict]) -> dict:
    out: dict[str, float] = {}
    period = [r for r in rows if 1991 <= r["y"] <= 2020]
    for key in ("tmax", "tmin"):
        vals = [r[key] for r in period if r[key] is not None]
        if len(vals) >= 300:
            out[key] = round(sum(vals) / len(vals), 1)
    for key in ("rain", "sun"):
        years = []
        for y in range(1991, 2021):
            vals = [r[key] for r in period if r["y"] == y and r[key] is not None]
            if len(vals) == 12:
                years.append(sum(vals))
        if len(years) >= 20:
            out[key] = round(sum(years) / len(years))
    return out


def main(folder: str) -> int:
    feats = []
    for path in sorted(Path(folder).glob("*data.txt")):
        st = parse(path)
        last = next(r for r in reversed(st["rows"]) if r["tmax"] is not None or r["rain"] is not None)
        norm = normals(st["rows"])
        props = {
            "name": st["name"], "layer": "weather", "source": "Met Office historic station data",
            "url": BASE + st["file"], "elevation_m": st["amsl"],
            "latest_month": f"{MONTHS[last['m'] - 1]} {last['y']}" + (" (provisional)" if last["provisional"] else ""),
            "since": st["rows"][0]["y"],
        }
        if last["y"] < CURRENT_YEAR:
            props["record_ended"] = f"{MONTHS[last['m'] - 1]} {last['y']}"
        for key in ("tmax", "tmin", "rain", "sun", "af"):
            if last[key] is not None:
                props[f"latest_{key}"] = last[key]
        for key, value in norm.items():
            props[f"avg_{key}"] = value
        feats.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [st["lon"], st["lat"]]}, "properties": props})
    out = REPO / "public/data/weather.geojson"
    out.write_text(json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False, separators=(",", ":")) + "\n")
    meta_path = REPO / "public/data/extract-meta.json"
    meta = json.loads(meta_path.read_text())
    meta["weather"] = {"layer": "weather", "count": len(feats), "license": "OGL v3",
                       "source": "Met Office historic station data", "url": "https://www.metoffice.gov.uk/research/climate/maps-and-data/historic-station-data",
                       "stations_reporting": sum(1 for f in feats if "record_ended" not in f["properties"])}
    meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
    print(len(feats))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
