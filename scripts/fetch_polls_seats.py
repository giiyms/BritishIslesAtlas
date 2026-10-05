#!/usr/bin/env python3
"""Fetch seat-level MRP-style projections from public tables.

Providers:
  - Electoral Calculus: public electdata_pred.txt (vote shares + chances)
  - More in Common: published Sep 2026 MRP XLSX (includes Restore Britain)

If a source cannot be fetched under its terms / is unavailable, write an empty
slot with link-out + honest note. Never invent numbers.
"""

from __future__ import annotations

import csv
import io
import json
import re
import sys
import tempfile
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "data" / "polls-seats.json"
GEOJSON = ROOT / "public" / "data" / "constituencies-gb-2024.geojson"

EC_URL = "https://www.electoralcalculus.co.uk/electdata_pred.txt"
EC_PAGE = "https://www.electoralcalculus.co.uk/prediction_main.html"
EC_FAQ = "https://www.electoralcalculus.co.uk/faq.html"
MIC_XLSX = "https://www.moreincommon.org.uk/wp-content/uploads/2026/09/Sep26-MRP.xlsx"
MIC_PAGE = "https://www.moreincommon.org.uk/research/more-in-commons-september-2026-mrp/"
UA = "BritishIslesAtlas/fetch_polls_seats (https://github.com/giiyms/BritishIslesAtlas)"


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def normalize_name(name: str) -> str:
    s = name.casefold().strip()
    s = s.replace("&", " and ")
    s = s.replace("’", "'").replace("‘", "'")
    # Drop parenthetical bilingual aliases: "Ynys Mon (Anglesey)" / "Na h-Eileanan An Iar (Western Isles)"
    s = re.sub(r"\([^)]*\)", " ", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    # "durham, city of" / "durham city of" → "city of durham"
    m = re.match(r"^(.+?)[, ]+city of$", s)
    if m:
        s = f"city of {m.group(1).strip()}"
    return s


_COMPASS = (
    "north east",
    "north west",
    "south east",
    "south west",
    "mid",
    "north",
    "south",
    "east",
    "west",
    "central",
)


def ec_name_variants(name: str) -> list[str]:
    """Electoral Calculus often uses 'Bedfordshire Mid' for ONS 'Mid Bedfordshire'."""
    raw = name.strip()
    base = normalize_name(raw)
    variants = [base]
    # "Wrekin, The" → "The Wrekin"
    m = re.match(r"^(.+?),\s*the$", raw, flags=re.I)
    if m:
        variants.append(normalize_name(f"The {m.group(1)}"))
    for compass in _COMPASS:
        if base.endswith(" " + compass):
            flipped = f"{compass} {base[: -len(compass) - 1].strip()}"
            variants.append(normalize_name(flipped))
            break
    # "Basildon South and East Thurrock" → "South Basildon and East Thurrock"
    m = re.match(
        r"^(.+?)\s+(north east|north west|south east|south west|mid|north|south|east|west|central)\s+and\s+(.+)$",
        base,
    )
    if m:
        variants.append(normalize_name(f"{m.group(2)} {m.group(1)} and {m.group(3)}"))
    # "Pembrokeshire Mid and South" → "Mid and South Pembrokeshire"
    m = re.match(
        r"^(.+?)\s+(mid|north|south|east|west)\s+and\s+(mid|north|south|east|west)$",
        base,
    )
    if m:
        variants.append(normalize_name(f"{m.group(2)} and {m.group(3)} {m.group(1)}"))
    # Hull short forms
    if "hull" in base:
        variants.append(base.replace("kingston upon hull", "hull"))
        variants.append(base.replace("hull", "kingston upon hull"))
    # Welsh / Gaelic known aliases (accent-insensitive via normalize)
    aliases = {
        "ynys mon": ["ynys mon", "ynys m n"],
        "anglesey": ["ynys mon"],
        "na h eileanan an iar": ["na h eileanan an iar"],
        "western isles": ["na h eileanan an iar"],
    }
    for a, targets in aliases.items():
        if base == a or base.startswith(a + " "):
            variants.extend(targets)
    # Accent folding already removed ô from Môn → mon; also try m n if unicode kept oddly
    if "ynys" in base:
        variants.append("ynys mon")
    seen = set()
    out = []
    for v in variants:
        if v and v not in seen:
            seen.add(v)
            out.append(v)
    return out


def load_pcon_index() -> tuple[dict[str, str], dict[str, str]]:
    data = json.loads(GEOJSON.read_text(encoding="utf-8"))
    by_norm: dict[str, str] = {}
    by_code: dict[str, str] = {}
    for feat in data["features"]:
        props = feat["properties"]
        code = props["PCON24CD"]
        nm = props["PCON24NM"]
        by_code[code] = nm
        for variant in ec_name_variants(nm):
            by_norm.setdefault(variant, code)
        # Also index raw normalize
        by_norm.setdefault(normalize_name(nm), code)
    return by_norm, by_code


def fetch_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=180) as resp:
        return resp.read()


def pct_from_votes(parts: dict[str, float]) -> dict[str, float]:
    total = sum(parts.values())
    if total <= 0:
        return {k: 0.0 for k in parts}
    return {k: round(100.0 * v / total, 1) for k, v in parts.items()}


def winner_from_shares(shares: dict[str, float | None]) -> str | None:
    best_name = None
    best_val = -1.0
    for name, val in shares.items():
        if isinstance(val, (int, float)) and val > best_val:
            best_val = float(val)
            best_name = name
    return best_name


def load_electoral_calculus(by_norm: dict[str, str]) -> dict:
    """Parse public electdata_pred.txt. EC does not break out Restore Britain."""
    try:
        raw = fetch_bytes(EC_URL)
    except (urllib.error.URLError, urllib.error.HTTPError) as exc:
        return {
            "status": "link_out",
            "provider": "Electoral Calculus",
            "url": EC_PAGE,
            "data_url": EC_URL,
            "faq_url": EC_FAQ,
            "error": str(exc),
            "notes": [
                "Could not fetch electdata_pred.txt; link-out only.",
                "EC FAQ restricts republication of seat Overview extracts with attribution + date.",
            ],
            "seats": {},
            "fieldwork": None,
            "retrieved_at": now_iso(),
        }

    text = raw.decode("cp1252", errors="replace")
    # Fieldwork hint from prediction page (best-effort)
    fieldwork = None
    try:
        page = fetch_bytes(EC_PAGE).decode("utf-8", errors="replace")
        m = re.search(
            r"opinion polls from\s+([0-9]{1,2}\s+\w+\s+20\d{2})\s+to\s+([0-9]{1,2}\s+\w+\s+20\d{2})",
            page,
            flags=re.I,
        )
        if m:
            fieldwork = f"{m.group(1)} – {m.group(2)}"
        um = re.search(r"Updated\s+([0-9]{1,2}\s+\w+\s+20\d{2})", page, flags=re.I)
        updated = um.group(1) if um else None
    except Exception:
        updated = None

    reader = csv.DictReader(io.StringIO(text), delimiter=";")
    seats: dict[str, dict] = {}
    unmatched: list[str] = []
    for row in reader:
        name = (row.get("Name") or "").strip()
        if not name:
            continue
        code = None
        for variant in ec_name_variants(name):
            code = by_norm.get(variant)
            if code:
                break
        if not code:
            # Drop NI / unmatched
            unmatched.append(name)
            continue
        try:
            votes = {
                "con": float(row.get("CON") or 0),
                "lab": float(row.get("LAB") or 0),
                "ld": float(row.get("LIB") or 0),
                "reform": float(row.get("Reform") or 0),
                "green": float(row.get("Green") or 0),
                "nat": float(row.get("NAT") or 0),
                "min": float(row.get("MIN") or 0),
                "oth": float(row.get("OTH") or 0),
            }
        except ValueError:
            continue
        shares = pct_from_votes(votes)
        # Map NAT to snp/pc loosely via name — keep as nat_share
        projected = winner_from_shares(
            {
                "Conservative": shares["con"],
                "Labour": shares["lab"],
                "Liberal Democrat": shares["ld"],
                "Reform": shares["reform"],
                "Green": shares["green"],
                "Nationalist": shares["nat"],
                "Minor": shares["min"],
                "Other": shares["oth"],
            }
        )
        seats[code] = {
            "pcon24cd": code,
            "name": name,
            "con_share": shares["con"],
            "lab_share": shares["lab"],
            "ld_share": shares["ld"],
            "reform_share": shares["reform"],
            "green_share": shares["green"],
            "nat_share": shares["nat"],
            "restore_share": None,  # EC table does not break out Restore Britain
            "oth_share": round(shares["oth"] + shares["min"], 1),
            "projected_winner": projected,
            "chances": {
                "con": float(row.get("CON chance") or 0),
                "lab": float(row.get("LAB chance") or 0),
                "ld": float(row.get("LIB chance") or 0),
                "reform": float(row.get("Reform chance") or 0),
            },
        }

    return {
        "status": "loaded",
        "provider": "Electoral Calculus",
        "url": EC_PAGE,
        "data_url": EC_URL,
        "faq_url": EC_FAQ,
        "fieldwork": fieldwork,
        "updated": updated,
        "retrieved_at": now_iso(),
        "seat_count": len(seats),
        "unmatched_names": unmatched[:30],
        "notes": [
            "Parsed from the public electdata_pred.txt seat table (vote counts → percentages).",
            "Restore Britain is not broken out by Electoral Calculus in this file (restore_share=null).",
            "Projections are projections, not results. Attribution: Electoral Calculus.",
            "EC FAQ: Overview extracts may be republished with attribution + retrieval date.",
        ],
        "seats": seats,
    }


def load_more_in_common(by_norm: dict[str, str]) -> dict:
    try:
        raw = fetch_bytes(MIC_XLSX)
    except (urllib.error.URLError, urllib.error.HTTPError) as exc:
        return {
            "status": "link_out",
            "provider": "More in Common",
            "url": MIC_PAGE,
            "data_url": MIC_XLSX,
            "error": str(exc),
            "notes": [
                "Could not fetch Sep26-MRP.xlsx; link-out only. Never invent numbers.",
            ],
            "seats": {},
            "fieldwork": None,
            "retrieved_at": now_iso(),
        }

    try:
        import openpyxl
    except ImportError:
        return {
            "status": "link_out",
            "provider": "More in Common",
            "url": MIC_PAGE,
            "data_url": MIC_XLSX,
            "error": "openpyxl not installed",
            "notes": [
                "XLSX available but openpyxl missing in this environment; link-out only.",
            ],
            "seats": {},
            "fieldwork": "September 2026 MRP (see source page)",
            "retrieved_at": now_iso(),
        }

    with tempfile.NamedTemporaryFile(suffix=".xlsx") as tmp:
        tmp.write(raw)
        tmp.flush()
        wb = openpyxl.load_workbook(tmp.name, read_only=True, data_only=True)
        # Prefer sheet with Constituency header
        sheet = None
        for name in wb.sheetnames:
            ws = wb[name]
            rows = list(ws.iter_rows(values_only=True))
            if not rows:
                continue
            header = [str(c).strip() if c is not None else "" for c in rows[0]]
            if any(h.lower() == "constituency" for h in header):
                sheet = rows
                break
        if sheet is None:
            return {
                "status": "link_out",
                "provider": "More in Common",
                "url": MIC_PAGE,
                "data_url": MIC_XLSX,
                "error": "No constituency sheet found",
                "seats": {},
                "retrieved_at": now_iso(),
            }

        header = [str(c).strip() if c is not None else "" for c in sheet[0]]

        def col(*names: str) -> int | None:
            lowered = [h.casefold() for h in header]
            for name in names:
                for i, h in enumerate(lowered):
                    if name in h:
                        return i
            return None

        i_name = col("constituency")
        i_con = col("conservative")
        i_lab = col("labour")
        i_ld = col("liberal")
        i_ref = col("reform")
        i_grn = col("green")
        i_snp = col("scottish national", "snp")
        i_pc = col("plaid")
        i_rb = col("restore")
        i_oth = col("other")
        i_win = col("winner")
        if i_name is None or i_lab is None:
            return {
                "status": "link_out",
                "provider": "More in Common",
                "url": MIC_PAGE,
                "data_url": MIC_XLSX,
                "error": f"Unexpected headers: {header}",
                "seats": {},
                "retrieved_at": now_iso(),
            }

        seats: dict[str, dict] = {}
        unmatched: list[str] = []

        def num(row, idx: int | None) -> float | None:
            if idx is None or idx >= len(row):
                return None
            v = row[idx]
            if v is None or v == "":
                return None
            try:
                return float(v)
            except (TypeError, ValueError):
                return None

        for row in sheet[1:]:
            if not row or row[i_name] is None:
                continue
            name = str(row[i_name]).strip()
            code = by_norm.get(normalize_name(name))
            if not code:
                unmatched.append(name)
                continue
            winner = str(row[i_win]).strip() if i_win is not None and row[i_win] else None
            seats[code] = {
                "pcon24cd": code,
                "name": name,
                "con_share": num(row, i_con),
                "lab_share": num(row, i_lab),
                "ld_share": num(row, i_ld),
                "reform_share": num(row, i_ref),
                "green_share": num(row, i_grn),
                "snp_share": num(row, i_snp),
                "pc_share": num(row, i_pc),
                "restore_share": num(row, i_rb),
                "oth_share": num(row, i_oth),
                "projected_winner": winner,
            }

    return {
        "status": "loaded",
        "provider": "More in Common",
        "url": MIC_PAGE,
        "data_url": MIC_XLSX,
        "fieldwork": "September 2026 MRP (published 26 Sep 2026)",
        "retrieved_at": now_iso(),
        "seat_count": len(seats),
        "unmatched_names": unmatched[:30],
        "notes": [
            "Parsed from the publicly published Sep26-MRP.xlsx download on moreincommon.org.uk.",
            "Includes Restore Britain column where modelled.",
            "Projections are projections, not results. Not affiliated with More in Common.",
        ],
        "seats": seats,
    }


def main() -> int:
    by_norm, by_code = load_pcon_index()
    assert len(by_code) == 632
    retrieved_at = now_iso()
    ec = load_electoral_calculus(by_norm)
    mic = load_more_in_common(by_norm)
    out = {
        "retrieved_at": retrieved_at,
        "notes": [
            "Seat-level projections from publicly published tables only.",
            "Never invent numbers. Empty provider slots use link-out.",
            "National VI is in polls-national.json and must not alone flip seat endorsements.",
        ],
        "providers": {
            "electoral_calculus": ec,
            "more_in_common": mic,
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        f"Wrote {OUT.relative_to(ROOT)} "
        f"EC={ec['status']}:{ec.get('seat_count', 0)} "
        f"MIC={mic['status']}:{mic.get('seat_count', 0)} "
        f"retrieved_at={retrieved_at}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
