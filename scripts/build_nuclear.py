#!/usr/bin/env python3
"""Nuclear sites: every site the Office for Nuclear Regulation licenses or regulates, plus the
defence berths on its map. Coordinates and reactor facts come from Wikidata (CC0); sites with no
Wikidata coordinate are placed by the postcode in the ONR register (postcodes.io, ONSPD, OGL).

    python3 scripts/build_nuclear.py

Sources (read 2026-11-01):
  ONR register of nuclear site licences  https://www.onr.org.uk/register-of-nuclear-site-licences
  ONR map of regulated sites, March 2026 https://www.onr.org.uk/our-work/map-of-sites-and-facilities
  Wikidata                                https://www.wikidata.org/
Ireland, the Isle of Man and the Channel Islands have no nuclear installations.
"""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
REGISTER = "https://www.onr.org.uk/register-of-nuclear-site-licences"
ONR_MAP = "https://www.onr.org.uk/our-work/map-of-sites-and-facilities"
UA = {"User-Agent": "BritishIslesAtlas/1.0 (open data map)"}

# name, category, status, operator (ONR register / map), licence, granted, wikidata, place
# place: None = Wikidata P625; "PC:<postcode>" = register postcode; "LL:<lon>,<lat>" = source noted inline.
SITES = [
    ("Hartlepool", "Power station", "Generating", "EDF Energy", "59", "1996-03-25", "Q572403", None),
    ("Heysham 1", "Power station", "Generating", "EDF Energy", "60", "1996-03-25", "Q104946799", None),
    ("Heysham 2", "Power station", "Generating", "EDF Energy", "60", "1996-03-25", "Q104946808", None),
    ("Sizewell B", "Power station", "Generating", "EDF Energy", "106", "2024-07-26", "Q104946709", "LL:1.61889,52.21440"),  # OSM way/27625744
    ("Torness", "Power station", "Generating", "EDF Energy", "Sc. 14", "2005-06-27", "Q1466261", None),
    ("Dungeness B", "Power station", "Defuelling", "EDF Energy", "61", "1996-03-25", "Q104946950", None),
    ("Hinkley Point B", "Power station", "Defuelling", "EDF Energy", "62C", "2012-11-25", "Q1536182", None),
    ("Hunterston B", "Power station", "Decommissioning", "Nuclear Restoration Services", "Sc. 13", "2005-06-27", "Q782133", None),
    ("Hinkley Point C", "Power station", "Under construction", "NNB Generation Company (HPC)", "97A", "2024-01-01", "Q5767271", None),
    ("Sizewell C", "Power station", "Under construction", "Sizewell C Ltd", "104", "2024-05-07", "Q55063313", "LL:1.6203,52.2193"),  # enwiki
    ("Berkeley", "Power station", "Decommissioning", "Nuclear Restoration Services", "92", "2010-12-20", "Q1595271", None),
    ("Bradwell", "Power station", "Decommissioning", "Nuclear Restoration Services", "93", "2010-12-20", "Q211150", None),
    ("Chapelcross", "Power station", "Decommissioning", "Nuclear Restoration Services", "Sc.15", "2005-03-18", "Q1739372", None),
    ("Dungeness A", "Power station", "Decommissioning", "Nuclear Restoration Services", "94", "2010-12-20", "Q104946958", None),
    ("Hinkley Point A", "Power station", "Decommissioning", "Nuclear Restoration Services", "95A", "2012-10-26", "Q1765322", None),
    ("Hunterston A", "Power station", "Decommissioning", "Nuclear Restoration Services", "Sc. 16", "2005-03-18", "Q5944807", None),
    ("Oldbury", "Power station", "Decommissioning", "Nuclear Restoration Services", "57A", "1997-11-28", "Q1739449", None),
    ("Sizewell A", "Power station", "Decommissioning", "Nuclear Restoration Services", "105", "2024-07-26", "Q104946710", None),
    ("Trawsfynydd", "Power station", "Decommissioning", "Nuclear Restoration Services", "81", "2005-03-18", "Q525334", None),
    ("Wylfa", "Power station", "Decommissioning", "Nuclear Restoration Services", "58A", "1997-11-28", "Q1739500", None),
    ("Calder Hall", "Power station", "Decommissioning", "Sellafield Ltd", "103", "2017-03-22", "Q1753259", None),
    ("Sellafield", "Reprocessing and waste", "Decommissioning", "Sellafield Ltd", "103", "2017-03-22", "Q1063567", None),
    ("Dounreay", "Research reactors", "Decommissioning", "Nuclear Restoration Services", "Sc.18", "2023-07-03", "Q1739397", None),
    ("Harwell", "Research reactors", "Decommissioning", "Nuclear Restoration Services", "101", "2015-03-30", "Q5677831", None),
    ("Winfrith", "Research reactors", "Decommissioning", "Nuclear Restoration Services", "100A", "1990-01-01", "Q828534", None),
    ("Inutec, Winfrith", "Waste treatment", "Operating", "Inutec Ltd", "102", "2019-01-02", None, "PC:DT28WQ"),
    ("Low Level Waste Repository, Drigg", "Waste repository", "Operating", "Nuclear Waste Services", "82", "2007-07-20", "Q1340500", None),
    ("Metals Recycling Facility, Lillyhall", "Waste treatment", "Operating", "Cyclife UK Ltd", "91", "2008-12-02", None, "PC:CA144JX"),
    ("Springfields", "Fuel manufacture", "Operating", "Springfields Fuels Ltd", "79", "2005-03-18", "Q7581108", None),
    ("Capenhurst", "Uranium enrichment", "Operating", "Urenco UK Ltd", "48E", "2012-11-26", None, "PC:CH16ER"),
    ("GE Healthcare Amersham", "Radioisotopes", "Operating", "GE Healthcare Ltd", "32A", "1990-02-07", None, "PC:HP79LL"),
    ("AWE Aldermaston", "Defence", "Operating", "AWE plc", "77", "2000-03-21", "Q757609", None),
    ("AWE Burghfield", "Defence", "Operating", "AWE plc", "78A", "2009-03-02", "Q105692721", None),
    ("Barrow (Devonshire Dock)", "Defence", "Operating", "BAE Systems Marine", "42C", "2018-09-28", "Q5267856", None),
    ("Devonport Royal Dockyard", "Defence", "Operating", "Devonport Royal Dockyard Ltd", "50B", "2002-10-25", None, "PC:PL14SG"),
    ("Rosyth Royal Dockyard", "Defence", "Operating", "Rosyth Royal Dockyard Ltd", "Sc. 8", "1997-01-23", "Q2956391", None),
    ("Rolls-Royce Raynesway (Neptune reactor and fuel manufacture)", "Defence", "Operating", "Rolls-Royce Submarines Ltd", "13C, 49", "1997-12-12", None, "PC:DE217BE"),
    # MOD-authorised sites on the ONR map (regulated, not licensed)
    ("HMNB Clyde (Faslane)", "Naval base", "Operating", "Ministry of Defence", None, None, "Q628776", None),
    ("RNAD Coulport", "Naval base", "Operating", "Ministry of Defence", None, None, "Q1136990", None),
    ("Loch Goil", "Submarine berth", "Operating", "Ministry of Defence", None, None, "Q2750704", None),
    ("Loch Ewe", "Submarine berth", "Operating", "Ministry of Defence", None, None, "Q4354551", None),
    ("Vulcan Naval Reactor Test Establishment", "Defence", "Decommissioning", "Ministry of Defence", None, None, "Q123468516", None),
    ("HMNB Devonport (naval base)", "Naval base", "Operating", "Ministry of Defence", None, None, "Q1207020", None),
    ("HMNB Portsmouth", "Submarine berth", "Operating", "Ministry of Defence", None, None, "Q1888079", None),
    ("Portland", "Submarine berth", "Operating", "Ministry of Defence", None, None, "Q1585169", None),
    ("Southampton", "Submarine berth", "Operating", "Ministry of Defence", None, None, "Q7231265", None),
]


def wikidata(qids: list[str]) -> dict:
    out = {}
    for i in range(0, len(qids), 40):
        url = "https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode(
            {"action": "wbgetentities", "ids": "|".join(qids[i:i + 40]), "props": "claims|sitelinks", "format": "json"})
        out.update(json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60))["entities"])
    return out


def claim(ent: dict, pid: str):
    for c in ent.get("claims", {}).get(pid, []):
        v = c["mainsnak"].get("datavalue", {}).get("value")
        if v is not None:
            return v
    return None


def postcode(pc: str) -> tuple[float, float]:
    r = json.load(urllib.request.urlopen(urllib.request.Request(f"https://api.postcodes.io/postcodes/{pc}", headers=UA), timeout=60))["result"]
    return r["longitude"], r["latitude"]


def main() -> int:
    ents = wikidata(sorted({s[6] for s in SITES if s[6]}))
    feats = []
    for name, category, status, operator, licence, granted, qid, place in SITES:
        ent = ents.get(qid, {}) if qid else {}
        if place and place.startswith("LL:"):
            lon, lat = map(float, place[3:].split(","))
        elif place and place.startswith("PC:"):
            lon, lat = postcode(place[3:])
        else:
            c = claim(ent, "P625")
            lon, lat = c["longitude"], c["latitude"]
        p = {"name": name, "category": category, "status": status, "operator": operator}
        if licence:
            p["licence"] = licence
            p["licence_granted"] = granted
            p["source"], p["url"] = "ONR register of nuclear site licences", REGISTER
        else:
            p["source"], p["url"] = "ONR map of regulated sites (MOD-authorised)", ONR_MAP
        if qid:
            p["wikidata"] = qid
            cap = claim(ent, "P2109")
            if cap and category == "Power station" and float(cap["amount"]) > 0:
                p["capacity_mw"] = round(float(cap["amount"]) / (1e6 if "Q25269" in cap.get("unit", "") else 1))
            for pids, key in ((("P571",), "established"), (("P1619",), "opened"), (("P730", "P576"), "closed")):
                t = next((claim(ent, pid) for pid in pids if claim(ent, pid)), None)
                if t:
                    p[key] = t["time"][1:5]
            wiki = ent.get("sitelinks", {}).get("enwiki", {}).get("title")
            if wiki:
                p["wikipedia"] = "https://en.wikipedia.org/wiki/" + urllib.parse.quote(wiki.replace(" ", "_"))
        feats.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(lon, 5), round(lat, 5)]}, "properties": p})
    (REPO / "public/data/nuclear.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False, separators=(",", ":")) + "\n")
    meta_path = REPO / "public/data/extract-meta.json"
    meta = json.loads(meta_path.read_text())
    meta["nuclear"] = {"extracted_at": date.today().isoformat(), "layer": "nuclear", "count": len(feats),
                       "method": "ONR register of nuclear site licences and ONR regulated-sites map; Wikidata coordinates and reactor facts",
                       "license": "OGL v3 (ONR); CC0 (Wikidata); OGL v3 (ONSPD postcodes)"}
    meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
    print(len(feats))
    for f in feats:
        print(f["properties"]["name"], f["geometry"]["coordinates"], {k: v for k, v in f["properties"].items() if k in ("capacity_mw", "established", "opened", "closed")})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
