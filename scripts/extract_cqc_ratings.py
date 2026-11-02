#!/usr/bin/env python3
"""Join CQC overall ratings onto the OSM hospitals, clinics and dentists layers.

Inputs (downloaded into --cache):
  ratings-Locations.csv  CQC "Latest ratings" ODS, Locations sheet, converted to CSV
  postcodes.json         postcode -> [lon, lat] cache, filled from postcodes.io
Output: public/data/ratings-cqc.json  {osm_id: [rating, publication date, CQC location id, CQC name]}

A CQC location is attached to an OSM point only when it is within 400 m of the
location's postcode centroid and the names agree (token overlap), so unmatched
points show no rating rather than a guessed one.
"""
import argparse, csv, json, math, re, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LAYERS = ["hospitals", "clinics", "dentists"]
STOP = set("the and of at for in on ltd limited llp plc nhs trust foundation centre center services service "
           "practice surgery dental dentist dentistry clinic clinics care health healthcare hospital hospitals "
           "medical group house uk st saint".split())

def tokens(s):
    return {t for t in re.findall(r"[a-z0-9]+", s.lower().replace("&", " and ")) if t not in STOP and len(t) > 1}

def sim(a, b):
    ta, tb = tokens(a), tokens(b)
    if not ta or not tb:
        return 0.0
    shared = len(ta & tb)
    # A single shared place word ("Hanford", "Northwick Park") is not enough: either most of both
    # names agree, or at least two words agree and one name is wholly contained in the other.
    if shared / max(len(ta), len(tb)) >= 0.6 or (shared >= 2 and shared == min(len(ta), len(tb))):
        return shared / max(len(ta), len(tb)) + 0.5
    return 0.0

def dist_m(a, b):
    dx = (a[0] - b[0]) * 111320 * math.cos(math.radians(a[1]))
    dy = (a[1] - b[1]) * 110540
    return math.hypot(dx, dy)

def norm_pc(pc):
    return re.sub(r"\s+", "", pc.upper())

def geocode(pcs, cache_file):
    cache = json.loads(cache_file.read_text()) if cache_file.exists() else {}
    todo = [p for p in pcs if p not in cache]
    for i in range(0, len(todo), 100):
        chunk = todo[i:i + 100]
        req = urllib.request.Request("https://api.postcodes.io/postcodes", data=json.dumps({"postcodes": chunk}).encode(),
                                     headers={"Content-Type": "application/json"})
        res = json.load(urllib.request.urlopen(req, timeout=60))
        for item in res["result"]:
            r = item["result"]
            cache[norm_pc(item["query"])] = [r["longitude"], r["latitude"]] if r and r.get("longitude") is not None else None
        time.sleep(0.2)
    cache_file.write_text(json.dumps(cache))
    return cache

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", required=True)
    args = ap.parse_args()
    cache = Path(args.cache)
    locs = {}
    for r in csv.DictReader(open(cache / "ratings-Locations.csv", encoding="utf-8", errors="replace")):
        if r["Service / Population Group"] != "Overall" or r["Domain"] != "Overall":
            continue
        if r["Location Type"] == "Social Care Org" or r["Latest Rating"] not in ("Outstanding", "Good", "Requires improvement", "Inadequate"):
            continue
        parts = r["Publication Date"].split("/")
        if len(parts) != 3:
            continue
        m, d, y = parts
        locs[r["Location ID"]] = {"name": r["Location Name"], "pc": norm_pc(r["Location Post Code"]),
                                  "rating": r["Latest Rating"], "date": f"{y}-{m}-{d}", "cat": r["Location Primary Inspection Category"]}
    pcs = sorted({l["pc"] for l in locs.values() if l["pc"]})
    coords = geocode(pcs, cache / "postcodes.json")
    grid = {}
    for lid, l in locs.items():
        c = coords.get(l["pc"])
        if not c:
            continue
        l["xy"] = c
        grid.setdefault((round(c[0], 1), round(c[1], 1)), []).append(lid)
    out, stats = {}, {}
    for layer in LAYERS:
        feats = json.loads((ROOT / "public/data" / f"{layer}.geojson").read_text())["features"]
        hit = 0
        for f in feats:
            p = f["properties"]; xy = f["geometry"]["coordinates"]
            names = [p.get("name", "")]
            if layer == "hospitals" and "hospital" in str(p.get("brand", "")).lower():
                names.append(p["brand"])
            best, best_score = None, 0.0
            for gx in (-0.1, 0, 0.1):
                for gy in (-0.1, 0, 0.1):
                    for lid in grid.get((round(round(xy[0], 1) + gx, 1), round(round(xy[1], 1) + gy, 1)), []):
                        l = locs[lid]
                        if (layer == "dentists") != (l["cat"] == "Dentists"):
                            continue
                        d = dist_m(xy, l["xy"])
                        if d > 400:
                            continue
                        s = max(sim(n, l["name"]) for n in names if n)
                        if s >= 0.5 and s - d / 4000 > best_score:
                            best, best_score = lid, s - d / 4000
            if best:
                l = locs[best]
                out[p["osm_id"]] = [l["rating"], l["date"], best, l["name"]]
                hit += 1
        stats[layer] = {"features": len(feats), "rated": hit}
    (ROOT / "public/data/ratings-cqc.json").write_text(json.dumps(out, separators=(",", ":")))
    meta_file = ROOT / "public/data/extract-meta.json"
    meta = json.loads(meta_file.read_text())
    meta["ratings-cqc"] = {"source": "CQC Latest ratings (Locations), 1 October 2026", "licence": "OGL v3.0",
                           "cqc_locations": len(locs), "layers": stats}
    meta_file.write_text(json.dumps(meta, indent=2) + "\n")
    print(json.dumps(stats))

if __name__ == "__main__":
    main()
