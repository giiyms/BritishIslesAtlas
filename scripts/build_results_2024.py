#!/usr/bin/env python3
"""Build public/data/results-2024-gb.json from the 2024 general election results.

Source: House of Commons Library / UK Parliament election results service
(electionresults.parliament.uk), general election 6 = 4 July 2024, candidacies CSV.
Licence: Open Parliament Licence v3.0.

The raw CSV (~3.5 MB) is cached under data-raw/ (gitignored) and downloaded only
when missing; pass --refresh to re-download. All 650 UK seats, including the 18
in Northern Ireland, join 1:1 to public/data/constituencies-gb-2024.geojson (PCON24CD).
Never invents numbers: every figure comes straight from the CSV.
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
RAW = ROOT / "data-raw" / "ge2024-candidacies.csv"
OUT = ROOT / "public" / "data" / "results-2024-gb.json"
GEOJSON = ROOT / "public" / "data" / "constituencies-gb-2024.geojson"
SRC_URL = "https://electionresults.parliament.uk/general-elections/6/candidacies.csv"
SRC_PAGE = "https://electionresults.parliament.uk/general-elections/6"
LICENCE = "Open Parliament Licence v3.0"
LICENCE_URL = "https://www.parliament.uk/site-information/copyright-parliament/open-parliament-licence/"
UA = "BritishIslesAtlas/build_results_2024 (https://github.com/giiyms/BritishIslesAtlas)"
TOP_N = 6


def download() -> None:
    RAW.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(SRC_URL, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = resp.read()
    if b"Parliament number" not in data[:32]:
        raise SystemExit(f"Unexpected response from {SRC_URL}")
    RAW.write_bytes(data)
    print(f"Downloaded {SRC_URL} -> {RAW.relative_to(ROOT)} ({len(data)} bytes)")


def party_code(row: dict) -> str:
    if row["Candidate is standing as Commons Speaker"] == "true":
        return "Spk"
    abbr = row["Main party abbreviation"].strip()
    if abbr:
        return abbr
    if row["Candidate is standing as independent"] == "true":
        return "Ind"
    return "Oth"


def main() -> int:
    if "--refresh" in sys.argv or not RAW.exists():
        download()
    with RAW.open(encoding="utf-8-sig", newline="") as fh:
        rows = list(csv.DictReader(fh))

    by_seat: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        by_seat[r["Constituency geographic code"]].append(r)

    parties: dict[str, str] = {}
    seats: dict[str, dict] = {}
    for code, cands in sorted(by_seat.items()):
        cands.sort(key=lambda r: int(r["Candidate result position"]))
        first = cands[0]
        valid = int(first["Election valid vote count"])
        electorate = int(first["Electorate"])
        for r in cands:
            pc = party_code(r)
            name = r["Main party name"].strip() or {"Spk": "Speaker", "Ind": "Independent"}.get(pc, "Other")
            parties.setdefault(pc, name)
        winner = cands[0]
        majority = int(winner["Majority"]) if winner["Majority"] else int(winner["Candidate vote count"]) - int(cands[1]["Candidate vote count"])
        shares = [[party_code(r), round(int(r["Candidate vote count"]) * 100 / valid, 1)] for r in cands[:TOP_N]]
        other_votes = sum(int(r["Candidate vote count"]) for r in cands[TOP_N:])
        if other_votes:
            shares.append(["Other", round(other_votes * 100 / valid, 1)])
        seats[code] = {
            "name": first["Constituency name"],
            "country": first["Country name"],
            "winner_party": party_code(winner),
            "winner_name": f'{winner["Candidate given name"]} {winner["Candidate family name"]}'.strip(),
            "result": first["Election result summary"],
            "majority": majority,
            "majority_pct": round(majority * 100 / valid, 1),
            "turnout_pct": round(valid * 100 / electorate, 1),
            "electorate": electorate,
            "valid_votes": valid,
            "shares": shares,
        }

    geo = json.loads(GEOJSON.read_text(encoding="utf-8"))
    geo_codes = {f["properties"]["PCON24CD"] for f in geo["features"]}
    missing_in_results = sorted(geo_codes - seats.keys())
    missing_in_geo = sorted(seats.keys() - geo_codes)

    out = {
        "election": "UK general election, 4 July 2024",
        "source": "House of Commons Library / UK Parliament election results",
        "source_url": SRC_PAGE,
        "data_url": SRC_URL,
        "license": LICENCE,
        "license_url": LICENCE_URL,
        "retrieved_at": datetime.fromtimestamp(RAW.stat().st_mtime, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "notes": [
            "All 650 UK seats (632 GB + 18 Northern Ireland). Keyed by ONS PCON24CD.",
            "turnout_pct = valid votes / electorate (House of Commons Library convention).",
            f"shares: top {TOP_N} candidates by vote as [party, % of valid votes], remaining candidates summed as Other.",
            "Party codes: see parties. Ind = independent, Spk = Speaker, Oth = unlabelled minor candidate.",
        ],
        "parties": dict(sorted(parties.items())),
        "seat_count": len(seats),
        "seats": seats,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)} seats={len(seats)} joined={len(geo_codes & seats.keys())}/{len(geo_codes)} "
          f"missing_in_results={missing_in_results} missing_in_geo={missing_in_geo}")
    return 1 if (missing_in_results or missing_in_geo) else 0


if __name__ == "__main__":
    raise SystemExit(main())
