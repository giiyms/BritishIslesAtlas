#!/usr/bin/env python3
"""Point layers from the Geofabrik OpenStreetMap extracts (ODbL), via scripts/extract_pbf.py output.

    python3 scripts/build_pbf_layers.py OUTDIR layer [layer ...]

OUTDIR holds the <category>.jsonl files extract_pbf.py writes. Each layer below names its category,
a fallback name for unnamed objects, a row filter and the extra properties its card shows. Output
matches the Overpass-era layers: public/data/<layer>.geojson with name, layer, note, osm_id,
osm_url, source, plus the extras.
"""
from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]


def _title(v: str) -> str:
    return v.replace("_", " ").strip().capitalize()


def cemetery(t: dict, rec: dict) -> dict | None:
    kind = "Cemetery" if t.get("landuse") == "cemetery" else "Churchyard or graveyard"
    extra = {"cemetery_kind": kind}
    if rec.get("area_m2"):
        extra["area_ha"] = round(rec["area_m2"] / 10_000, 2)
    return extra


LEGEND_SKIP = re.compile(r"^(pub|bar|restaurant|cafe|fast_food|hotel|guest_house|shop)$")


def legend(t: dict, rec: dict) -> dict | None:
    if any(LEGEND_SKIP.match(t.get(k, "")) for k in ("amenity", "tourism", "shop")) or t.get("shop") or t.get("highway") \
            or t.get("building") in ("house", "residential", "yes") and not t.get("historic"):
        return None
    holy = "holy_well" in (t.get("place_of_worship", ""), t.get("historic", ""), t.get("amenity", ""), t.get("man_made", ""), t.get("natural", ""))
    name = t.get("name", "")
    if holy or (t.get("natural") == "spring" and "well" in name.lower()):
        kind = "Holy well"
    else:
        kind = "Place named in folklore"
    feature = t.get("historic") or t.get("natural") or t.get("man_made") or t.get("tourism") or t.get("leisure") or ""
    out = {"legend_kind": kind}
    if feature and feature not in ("yes", "holy_well"):
        out["feature"] = _title(feature)
    return out


def archaeological(t: dict, rec: dict) -> dict | None:
    out = {}
    site = t.get("archaeological_site") or t.get("site_type")
    if site:
        out["site_type"] = _title(site)
    for src, key in (("fortification_type", "fortification_type"), ("historic:civilization", "civilization")):
        if t.get(src):
            out[key] = _title(t[src])
    return out


def doctors(t: dict, rec: dict) -> dict | None:
    return {}


LAYERS = {
    "cemeteries": {"cat": "cemeteries", "fallback": lambda t: "Cemetery" if t.get("landuse") == "cemetery" else "Churchyard", "extra": cemetery,
                   "filter": "landuse=cemetery or amenity=grave_yard (nodes and areas, area centre points)"},
    "legends": {"cat": "legends", "fallback": lambda t: "Holy well", "extra": legend, "require_name": False,
                "filter": "holy wells (place_of_worship/historic/amenity/man_made/natural=holy_well, or a named holy/saint's spring well) and natural or historic features whose name invokes a legend (fairy, giant's, devil's, King Arthur, Merlin, Fionn, Cú Chulainn, Robin Hood, ...); pubs, shops and houses dropped"},
    "historic": {"cat": "archaeological", "fallback": lambda t: _title(t.get("archaeological_site") or t.get("site_type") or "Archaeological site"),
                 "extra": archaeological, "filter": "historic=archaeological_site (nodes and areas)"},
    "health": {"cat": "doctors", "fallback": lambda t: "GP surgery", "extra": doctors,
               "filter": "amenity=doctors or healthcare=doctor (GP surgeries and doctors' practices)"},
}


def build(outdir: Path, layer: str) -> int:
    cfg = LAYERS[layer]
    feats = []
    for line in open(outdir / f"{cfg['cat']}.jsonl", encoding="utf-8"):
        rec = json.loads(line)
        t = rec["tags"]
        if t.get("disused") == "yes" or t.get("abandoned") == "yes":
            continue
        extra = cfg["extra"](t, rec)
        if extra is None:
            continue
        name = t.get("name") or t.get("name:en") or cfg["fallback"](t)
        props = {"name": name, "layer": layer, "note": "OpenStreetMap", "osm_id": rec["osm_id"],
                 "osm_url": f"https://www.openstreetmap.org/{rec['osm_id']}", "source": "OpenStreetMap", **extra}
        feats.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(rec["lon"], 6), round(rec["lat"], 6)]},
                      "properties": props})
    feats.sort(key=lambda f: f["properties"]["osm_id"])
    (REPO / f"public/data/{layer}.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False, separators=(",", ":")) + "\n")
    meta_path = REPO / "public/data/extract-meta.json"
    meta = json.loads(meta_path.read_text())
    meta[layer] = {"extracted_at": date.today().isoformat(), "method": "Geofabrik PBF extracts (great-britain, ireland-and-northern-ireland, isle-of-man, guernsey-jersey) via scripts/extract_pbf.py",
                   "license": "ODbL 1.0", "layer": layer, "count": len(feats), "filter": cfg["filter"]}
    meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
    return len(feats)


def main(argv: list[str]) -> int:
    outdir = Path(argv[0])
    for layer in argv[1:]:
        print(layer, build(outdir, layer))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
