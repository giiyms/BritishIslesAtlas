#!/usr/bin/env python3
"""Per-seat general-election vote share over time on the 2024 (current) boundaries.

Writes public/data/results-history-gb.json for the seat panel's "Past results" chart.

Points (real published figures only):
  * 12 Dec 2019: notional results on 2024 boundaries (Rallings & Thrasher, Prof David Denver for
    Scotland), commissioned by BBC, ITV News, Sky News and PA, published by UK Parliament /
    House of Commons Library as general election 5 (is_notional=true).
  * 4 Jul 2024: actual results, general election 6.
No earlier elections have official notional results on the 2024 boundaries, so none are added.

Source: https://electionresults.parliament.uk  (Open Parliament Licence v3.0)

    python3 scripts/build_results_history.py [--refresh]
"""
from __future__ import annotations

import csv
import json
import sys
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "data" / "results-history-gb.json"
GEOJSON = ROOT / "public" / "data" / "constituencies-gb-2024.geojson"
UA = "BritishIslesAtlas/build_results_history (https://github.com/giiyms/BritishIslesAtlas)"
LICENCE = "Open Parliament Licence v3.0"
LICENCE_URL = "https://www.parliament.uk/site-information/copyright-parliament/open-parliament-licence/"
ELECTIONS = [
    {"date": "2019-12-12", "label": "2019 notional", "notional": True, "id": 5,
     "raw": ROOT / "data-raw" / "ge2019-notional-candidacies.csv",
     "note": "2019 is notional: the estimated result on the 2024 boundaries by Rallings & Thrasher (Prof David Denver for Scotland) for BBC, ITV News, Sky News and PA."},
    {"date": "2024-07-04", "label": "2024", "notional": False, "id": 6,
     "raw": ROOT / "data-raw" / "ge2024-candidacies.csv", "note": "Actual result."},
]
PARTIES = ["con", "lab", "ld", "ref", "grn", "snp", "pc", "spk", "oth"]
# Brexit Party (2019) is the same registered party as Reform UK (renamed January 2021).
ABBR = {"Con": "con", "Lab": "lab", "LD": "ld", "RUK": "ref", "BRX": "ref", "Green": "grn", "SNP": "snp", "PC": "pc"}


def page_url(e: dict) -> str:
    return f"https://electionresults.parliament.uk/general-elections/{e['id']}"


def load_rows(e: dict, refresh: bool) -> list[dict]:
    raw: Path = e["raw"]
    if refresh or not raw.exists():
        url = page_url(e) + "/candidacies.csv"
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=120) as resp:
            data = resp.read()
        if b"Parliament number" not in data[:32]:
            raise SystemExit(f"Unexpected response from {url}")
        raw.parent.mkdir(parents=True, exist_ok=True)
        raw.write_bytes(data)
    with raw.open(encoding="utf-8-sig", newline="") as fh:
        rows = list(csv.DictReader(fh))
    want_notional = "true" if e["notional"] else "false"
    bad = {r["General election is notional"] for r in rows} - {want_notional}
    if bad or {r["General election polling date"] for r in rows} != {e["date"]}:
        raise SystemExit(f"{raw.name}: unexpected election date/notional flag")
    return rows


def party_key(r: dict) -> str:
    if r["Candidate is standing as Commons Speaker"] == "true":
        return "spk"
    return ABBR.get(r["Main party abbreviation"].strip(), "oth")


def main() -> int:
    refresh = "--refresh" in sys.argv
    geo = json.loads(GEOJSON.read_text(encoding="utf-8"))
    codes = {f["properties"]["PCON24CD"] for f in geo["features"]}
    seats: dict[str, list] = defaultdict(list)
    for e in ELECTIONS:
        votes: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        valid: dict[str, int] = {}
        for r in load_rows(e, refresh):
            code = r["Constituency geographic code"]
            if code not in codes:
                continue  # Northern Ireland
            votes[code][party_key(r)] += int(r["Candidate vote count"])
            valid[code] = int(r["Election valid vote count"])
        missing = codes - votes.keys()
        if missing:
            raise SystemExit(f"{e['label']}: no result for {sorted(missing)[:5]}")
        for code in sorted(votes):
            v = votes[code]
            seats[code].append([e["date"], *[round(v[p] * 100 / valid[code], 1) if p in v else None for p in PARTIES]])
        print(f"{e['label']}: {len(votes)} seats")
    out = {
        "source": "UK Parliament election results (House of Commons Library)",
        "license": LICENCE, "license_url": LICENCE_URL,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "notes": [
            "Vote share (% of valid votes) on the 2024 constituency boundaries. GB only.",
            "ref in 2019 is the Brexit Party, the same registered party as Reform UK (renamed January 2021).",
            "No official notional results on these boundaries exist for elections before 2019.",
        ],
        "parties": PARTIES,
        "elections": [{"date": e["date"], "label": e["label"], "notional": e["notional"], "note": e["note"],
                       "source_url": page_url(e), "data_url": page_url(e) + "/candidacies.csv"} for e in ELECTIONS],
        "seats": dict(sorted(seats.items())),
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
