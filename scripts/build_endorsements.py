#!/usr/bin/env python3
"""Build public/data/endorsements-gb.json from candidates + seat polls + overrides.

Mirrors src/endorse.ts locked decision tree so the map can colour seats without
re-running the tree for every feature at paint time. Client still uses endorse.ts
for popup reasons when recomputing.
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAND = ROOT / "public" / "data" / "candidates-gb.json"
POLLS = ROOT / "public" / "data" / "polls-seats.json"
OVERRIDES = ROOT / "public" / "data" / "overrides.json"
GEOJSON = ROOT / "public" / "data" / "constituencies-gb-2024.geojson"
OUT = ROOT / "public" / "data" / "endorsements-gb.json"


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def is_lab_con(value: str | None) -> bool:
    # Any word token, so "Scottish Labour" / "The Conservative Party" / "other:Tories" are caught.
    tokens = re.split(r"[^a-z]+", (value or "").strip().lower())
    return any(t in {"labour", "lab", "conservative", "con", "tory", "conservatives", "tories"} for t in tokens)


def score_party(poll: dict, party: str) -> float:
    key = "reform_share" if party == "reform" else "restore_share"
    share = poll.get(key)
    if isinstance(share, (int, float)):
        return float(share)
    winner = (poll.get("projected_winner") or "").lower()
    if party == "reform" and "reform" in winner:
        return 1.0
    if party == "restore" and "restore" in winner:
        return 1.0
    return 0.0


def prefer_restore(polls: list[dict]) -> bool:
    if not polls:
        return False
    restore_better = reform_better = 0
    any_competitive = False
    for poll in polls:
        s_res = score_party(poll, "restore")
        s_ref = score_party(poll, "reform")
        if s_res <= 0 and s_ref <= 0:
            continue
        if s_res > s_ref:
            restore_better += 1
            lab = poll.get("lab_share") or 0
            con = poll.get("con_share") or 0
            lab_con = max(float(lab), float(con))
            winner = (poll.get("projected_winner") or "").lower()
            if "restore" in winner or (lab_con > 0 and max(s_res, s_ref) + 5 >= lab_con) or s_res >= s_ref:
                any_competitive = True
        elif s_ref > s_res:
            reform_better += 1
    return restore_better > 0 and restore_better > reform_better and any_competitive


def third_party_lead(polls: list[dict]) -> str | None:
    for poll in polls:
        winner = (poll.get("projected_winner") or "").strip()
        if not winner:
            continue
        w = winner.lower()
        if "reform" in w or "restore" in w or is_lab_con(winner):
            continue
        return winner
    return None


def decide(standing: dict, polls: list[dict], override: dict | None) -> dict:
    third = third_party_lead(polls)
    if override:
        pick = override.get("endorse")
        if isinstance(pick, str) and (pick.lower() in {"labour", "conservative"} or is_lab_con(pick) or pick.lower().startswith("other:lab") or pick.lower().startswith("other:con")):
            return {
                "endorse": "none",
                "reason": "Override rejected — never endorse Labour or Conservatives",
                "isOverride": True,
                "presumedReform": False,
                "thirdPartyLead": third,
            }
        note = (override.get("note") or "").strip()
        return {
            "endorse": pick,
            "reason": f"Daniel override: {note}" if note else "Daniel override",
            "isOverride": True,
            "presumedReform": False,
            "thirdPartyLead": third,
        }

    reform = standing.get("reform", {}).get("standing", "unknown")
    restore = standing.get("restore", {}).get("standing", "unknown")

    if reform == "no" and restore == "no":
        return {
            "endorse": "none",
            "reason": "No Reform/Restore candidate confirmed",
            "isOverride": False,
            "presumedReform": False,
            "thirdPartyLead": third,
        }

    if restore in {"no", "unknown"} and reform in {"yes", "unknown"}:
        presumed = reform == "unknown"
        return {
            "endorse": "reform",
            "reason": (
                "Restore not confirmed; presumed Reform — confirm nearer nomination"
                if presumed
                else "Restore not standing; default Reform"
            ),
            "isOverride": False,
            "presumedReform": presumed,
            "thirdPartyLead": third,
        }

    if reform == "no" and restore == "yes":
        return {
            "endorse": "restore",
            "reason": "Only Restore standing among target parties",
            "isOverride": False,
            "presumedReform": False,
            "thirdPartyLead": third,
        }

    if reform == "yes" and restore == "yes":
        if prefer_restore(polls):
            return {
                "endorse": "restore",
                "reason": "Both standing; seat poll shows Restore the stronger Lab/Con-beater",
                "isOverride": False,
                "presumedReform": False,
                "thirdPartyLead": third,
            }
        missing = len(polls) == 0
        return {
            "endorse": "reform",
            "reason": (
                "Both standing; no seat poll loaded — default Reform (anti-split)"
                if missing
                else "Both standing; polls inconclusive — default Reform (anti-split)"
            ),
            "isOverride": False,
            "presumedReform": False,
            "thirdPartyLead": third,
        }

    return {
        "endorse": "reform",
        "reason": "Default Reform (anti-split)",
        "isOverride": False,
        "presumedReform": True,
        "thirdPartyLead": third,
    }


def collect_polls(providers: dict, code: str) -> list[dict]:
    rows = []
    for key, prov in providers.items():
        if prov.get("status") != "loaded":
            continue
        seat = (prov.get("seats") or {}).get(code)
        if not seat:
            continue
        rows.append(
            {
                "provider": key,
                "provider_label": prov.get("provider"),
                "reform_share": seat.get("reform_share"),
                "restore_share": seat.get("restore_share"),
                "lab_share": seat.get("lab_share"),
                "con_share": seat.get("con_share"),
                "projected_winner": seat.get("projected_winner"),
                "fieldwork": prov.get("fieldwork"),
                "url": prov.get("url"),
            }
        )
    return rows


def main() -> int:
    geo = json.loads(GEOJSON.read_text(encoding="utf-8"))
    cand = json.loads(CAND.read_text(encoding="utf-8")) if CAND.exists() else {"seats": {}}
    polls = json.loads(POLLS.read_text(encoding="utf-8")) if POLLS.exists() else {"providers": {}}
    overrides_doc = json.loads(OVERRIDES.read_text(encoding="utf-8")) if OVERRIDES.exists() else {}
    override_list = overrides_doc.get("overrides") or []
    override_by = {o["pcon24cd"]: o for o in override_list if o.get("pcon24cd")}

    providers = polls.get("providers") or {}
    seats_out = {}
    counts = {"reform": 0, "restore": 0, "none": 0, "override": 0, "other": 0}

    for feat in geo["features"]:
        code = feat["properties"]["PCON24CD"]
        name = feat["properties"]["PCON24NM"]
        standing = cand.get("seats", {}).get(code) or {
            "reform": {"standing": "unknown"},
            "restore": {"standing": "unknown"},
        }
        seat_polls = collect_polls(providers, code)
        ov = override_by.get(code)
        result = decide(standing, seat_polls, ov)
        pick = result["endorse"]
        if result["isOverride"]:
            counts["override"] += 1
        elif pick == "reform":
            counts["reform"] += 1
        elif pick == "restore":
            counts["restore"] += 1
        elif pick == "none":
            counts["none"] += 1
        else:
            counts["other"] += 1

        if pick in {"labour", "conservative"} or is_lab_con(str(pick)):
            raise SystemExit(f"Forbidden endorsement for {code}: {pick}")

        seats_out[code] = {
            "pcon24cd": code,
            "pcon24nm": name,
            "endorse": pick,
            "reason": result["reason"],
            "isOverride": result["isOverride"],
            "presumedReform": result["presumedReform"],
            "thirdPartyLead": result["thirdPartyLead"],
            "reform": standing.get("reform"),
            "restore": standing.get("restore"),
            "polls": seat_polls,
            "winner2024": None,  # Commons Library CBP-10009 join deferred (Cloudflare)
            "links": {
                "wcivf_search": f"https://whocanivotefor.co.uk/?postcode=",
                "dc": "https://candidates.democracyclub.org.uk/",
            },
        }

    assert len(seats_out) == 632
    out = {
        "retrieved_at": now_iso(),
        "counts": counts,
        "notes": [
            "Editorial endorsement map — not Electoral Commission advice.",
            "Never endorses Labour or Conservatives.",
            "2024 winner join from Commons Library CBP-10009 deferred (source blocked); follow-up.",
        ],
        "seats": seats_out,
        "sources": {
            "candidates_retrieved_at": cand.get("retrieved_at"),
            "polls_retrieved_at": polls.get("retrieved_at"),
        },
    }
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)} counts={counts}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
