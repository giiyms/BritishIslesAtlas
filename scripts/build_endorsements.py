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

TRUSTED_PROVIDER_RE = re.compile(
    r"electoral[_\s-]?calculus|^ec$|more[_\s-]?in[_\s-]?common|^mic$",
    re.I,
)


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def is_lab_con(value: str | None) -> bool:
    # Any word token, so "Scottish Labour" / "The Conservative Party" / "other:Tories" are caught.
    tokens = re.split(r"[^a-z]+", (value or "").strip().lower())
    return any(
        t in {"labour", "lab", "conservative", "con", "tory", "conservatives", "tories"}
        for t in tokens
    )


def is_trusted_provider(provider: str | None) -> bool:
    return bool(TRUSTED_PROVIDER_RE.search((provider or "").strip()))


def numeric_share(value) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    return None


def restore_strictly_ahead(poll: dict) -> bool:
    restore = numeric_share(poll.get("restore_share"))
    reform = numeric_share(poll.get("reform_share"))
    if restore is None or reform is None:
        return False
    return restore > reform


def reform_strictly_ahead(poll: dict) -> bool:
    restore = numeric_share(poll.get("restore_share"))
    reform = numeric_share(poll.get("reform_share"))
    if restore is None or reform is None:
        return False
    return reform > restore


def provider_label(provider: str) -> str:
    p = (provider or "").strip()
    if re.search(r"more[_\s-]?in[_\s-]?common|^mic$", p, re.I):
        return "More in Common"
    if re.search(r"electoral[_\s-]?calculus|^ec$", p, re.I):
        return "Electoral Calculus"
    return p or "Seat poll"


def format_pct(n: float) -> str:
    if float(n).is_integer():
        return str(int(n))
    s = f"{n:.1f}"
    return s[:-2] if s.endswith(".0") else s


def restore_ahead_from_polls(polls: list[dict]) -> dict:
    trusted = [p for p in polls if is_trusted_provider(p.get("provider"))]
    lead = None
    any_restore = False
    any_reform = False
    for poll in trusted:
        if restore_strictly_ahead(poll):
            any_restore = True
            if lead is None:
                lead = {
                    "provider": provider_label(str(poll.get("provider") or "")),
                    "restore": numeric_share(poll.get("restore_share")),
                    "reform": numeric_share(poll.get("reform_share")),
                }
        elif reform_strictly_ahead(poll):
            any_reform = True
    return {
        "ahead": any_restore,
        "disagree": any_restore and any_reform,
        "lead": lead,
    }


def restore_ahead_reason(detail: dict) -> str:
    lead = detail.get("lead")
    if not lead:
        return (
            "Trusted seat poll projects Restore ahead of Reform; "
            "Vote Restore to avoid splitting."
        )
    core = (
        f"{lead['provider']} projects Restore ahead of Reform here "
        f"({format_pct(lead['restore'])}% vs {format_pct(lead['reform'])}%); "
        f"Vote Restore to avoid splitting."
    )
    if detail.get("disagree"):
        return (
            f"{core} Trusted seat-poll sources disagree — "
            f"Restore still wins on the Restore-ahead rule."
        )
    return core


def polls_favour_reform(polls: list[dict]) -> bool:
    trusted = [p for p in polls if is_trusted_provider(p.get("provider"))]
    if not trusted:
        return False
    any_reform = False
    for poll in trusted:
        if restore_strictly_ahead(poll):
            return False
        if reform_strictly_ahead(poll):
            any_reform = True
        restore = numeric_share(poll.get("restore_share"))
        reform = numeric_share(poll.get("reform_share"))
        if restore is None and reform is not None and reform > 0:
            any_reform = True
    return any_reform


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
        if isinstance(pick, str) and (
            pick.lower() in {"labour", "conservative"}
            or is_lab_con(pick)
            or pick.lower().startswith("other:lab")
            or pick.lower().startswith("other:con")
        ):
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

    # Restore-ahead poll rule (no DC standing prerequisite)
    ahead = restore_ahead_from_polls(polls)
    if ahead["ahead"]:
        return {
            "endorse": "restore",
            "reason": restore_ahead_reason(ahead),
            "isOverride": False,
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
        restore_unknown = restore == "unknown"
        if restore_unknown:
            reason = (
                "Restore not confirmed; presumed Reform — confirm nearer nomination"
                if presumed
                else "Restore not confirmed; default Reform"
            )
        else:
            reason = (
                "Restore not standing; presumed Reform — confirm nearer nomination"
                if presumed
                else "Restore not standing; default Reform"
            )
        return {
            "endorse": "reform",
            "reason": reason,
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
        missing = len(polls) == 0
        favour = polls_favour_reform(polls)
        if missing:
            reason = "Both standing; no seat poll loaded — default Reform (anti-split)"
        elif favour:
            reason = "Both standing; seat polls favour Reform — default Reform (anti-split)"
        else:
            reason = "Both standing; no Restore-ahead seat poll — default Reform (anti-split)"
        return {
            "endorse": "reform",
            "reason": reason,
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
        # Include loaded and stale (kept-last-good) provider blocks
        if prov.get("status") not in {"loaded", "stale"}:
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
            "Restore-ahead rule: any trusted seat poll (EC/MIC) with Restore share > Reform share → Restore.",
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
