#!/usr/bin/env python3
"""Fetch GB Westminster Reform/Restore candidates from Democracy Club (CC-BY-SA).

Writes public/data/candidates-gb.json keyed by PCON24CD.
Never invents names — only records candidacies present in the DC export.
Idempotent; always refreshes retrieved_at.
"""

from __future__ import annotations

import csv
import io
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "data" / "candidates-gb.json"
GEOJSON = ROOT / "public" / "data" / "constituencies-gb-2024.geojson"

DC_EXPORT = "https://candidates.democracyclub.org.uk/data/export_csv/"
REFORM_EC = "PP7931"
RESTORE_EC = "PP18382"
UA = "BritishIslesAtlas/fetch_candidates (https://github.com/giiyms/BritishIslesAtlas)"


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def normalize_name(name: str) -> str:
    s = name.casefold().strip()
    s = s.replace("&", " and ")
    s = s.replace("’", "'").replace("‘", "'")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    # Common DC vs ONS aliases
    aliases = {
        "cities of london and westminster": "cities of london and westminster",
        "bethnal green and stepney": "bethnal green and stepney",
    }
    return aliases.get(s, s)


def load_pcon_index() -> tuple[dict[str, str], dict[str, str]]:
    data = json.loads(GEOJSON.read_text(encoding="utf-8"))
    by_norm: dict[str, str] = {}
    by_code: dict[str, str] = {}
    for feat in data["features"]:
        props = feat["properties"]
        code = props["PCON24CD"]
        nm = props["PCON24NM"]
        by_code[code] = nm
        by_norm[normalize_name(nm)] = code
    if len(by_code) != 632:
        raise SystemExit(f"Expected 632 GB seats in geojson, got {len(by_code)}")
    return by_norm, by_code


def fetch_party_csv(party_id: str) -> list[dict[str, str]]:
    params = {
        "party_id": party_id,
        "election_id": "^parl.*",
        "field_group": "person_profiles",
    }
    url = f"{DC_EXPORT}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/csv"})
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as exc:
        raise SystemExit(f"HTTP error fetching DC CSV for {party_id}: {exc}") from exc
    except urllib.error.URLError as exc:
        raise SystemExit(f"URL error fetching DC CSV for {party_id}: {exc}") from exc

    text = raw.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    return list(reader)


def is_relevant_candidacy(row: dict[str, str], today: str) -> bool:
    """Keep current or future parliamentary candidacies, plus 2024 GE onwards history for join QA only when current."""
    election_id = (row.get("election_id") or "").strip()
    if not election_id.startswith("parl."):
        return False
    # Drop NI (ballot ids often contain northern-ireland names; filter via post match later)
    date = (row.get("election_date") or "").strip()
    current = (row.get("election_current") or "").strip().lower() in {"t", "true", "1", "yes"}
    if current:
        return True
    # Future dated (by-election / early slate)
    if date and date >= today:
        return True
    # Recent by-elections in 2026 still useful as "stood here" signal for standing=yes
    # only when election is on/after 2026-01-01 (Restore founded 2026-03).
    if date and date >= "2026-01-01":
        return True
    return False


def standing_record(row: dict[str, str]) -> dict:
    return {
        "standing": "yes",
        "name": (row.get("person_name") or "").strip() or None,
        "person_id": (row.get("person_id") or "").strip() or None,
        "party_id": (row.get("party_id") or "").strip() or None,
        "party_name": (row.get("party_name") or "").strip() or None,
        "ballot_paper_id": (row.get("ballot_paper_id") or "").strip() or None,
        "election_id": (row.get("election_id") or "").strip() or None,
        "election_date": (row.get("election_date") or "").strip() or None,
        "election_current": (row.get("election_current") or "").strip().lower()
        in {"t", "true", "1", "yes"},
        "wcivf_url": (
            f"https://whocanivotefor.co.uk/elections/{row.get('ballot_paper_id')}/"
            if row.get("ballot_paper_id")
            else None
        ),
        "dc_person_url": (
            f"https://candidates.democracyclub.org.uk/person/{row.get('person_id')}/"
            if row.get("person_id")
            else None
        ),
    }


def pick_best_row(rows: list[dict[str, str]]) -> dict[str, str]:
    """Prefer current, then latest election_date."""

    def key(r: dict[str, str]):
        current = 1 if (r.get("election_current") or "").lower() in {"t", "true", "1"} else 0
        return (current, r.get("election_date") or "")

    return sorted(rows, key=key, reverse=True)[0]


def main() -> int:
    by_norm, by_code = load_pcon_index()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    retrieved_at = now_iso()

    seats: dict[str, dict] = {
        code: {
            "pcon24cd": code,
            "pcon24nm": name,
            "reform": {"standing": "unknown"},
            "restore": {"standing": "unknown"},
        }
        for code, name in by_code.items()
    }

    unmatched: list[dict] = []
    counts = {"reform_matched": 0, "restore_matched": 0, "reform_rows": 0, "restore_rows": 0}

    for party_key, party_id in (("reform", REFORM_EC), ("restore", RESTORE_EC)):
        rows = fetch_party_csv(party_id)
        relevant = [r for r in rows if is_relevant_candidacy(r, today)]
        counts[f"{party_key}_rows"] = len(relevant)
        by_seat: dict[str, list[dict[str, str]]] = {}
        for row in relevant:
            label = (row.get("post_label") or "").strip()
            code = by_norm.get(normalize_name(label))
            if not code:
                unmatched.append(
                    {
                        "party": party_key,
                        "post_label": label,
                        "person_name": row.get("person_name"),
                        "election_id": row.get("election_id"),
                        "election_date": row.get("election_date"),
                    }
                )
                continue
            by_seat.setdefault(code, []).append(row)
        for code, seat_rows in by_seat.items():
            best = pick_best_row(seat_rows)
            name = (best.get("person_name") or "").strip()
            if not name:
                continue  # never invent
            seats[code][party_key] = standing_record(best)
            counts[f"{party_key}_matched"] += 1

    # Seats with no Restore confirmation stay "unknown" (→ Reform per locked rules).
    # Do not mark Restore as "no" nationally — nominations not closed.

    out = {
        "retrieved_at": retrieved_at,
        "source": "Democracy Club Candidates",
        "license": "CC-BY-SA",
        "source_url": "https://candidates.democracyclub.org.uk/",
        "about": "https://candidates.democracyclub.org.uk/help/about",
        "notes": [
            "Names only when present in Democracy Club; never invented.",
            "standing=unknown means no confirmed Westminster candidacy in DC for that party in scope.",
            "Restore Britain coverage is sparse; most seats default to presumed Reform under locked anti-split rules.",
            "GB Westminster only (632 PCON24 seats).",
        ],
        "counts": counts,
        "unmatched": unmatched,
        "seats": seats,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        f"Wrote {OUT.relative_to(ROOT)} seats={len(seats)} "
        f"reform={counts['reform_matched']} restore={counts['restore_matched']} "
        f"unmatched={len(unmatched)} retrieved_at={retrieved_at}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
