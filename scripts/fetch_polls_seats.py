#!/usr/bin/env python3
"""Fetch seat-level MRP-style projections from public tables.

Providers:
  - Electoral Calculus: public electdata_pred.txt (vote shares + chances)
  - More in Common: published Sep 2026 MRP XLSX (includes Restore Britain)

If a source cannot be fetched under its terms / is unavailable, keep the last
good provider block (status=stale) when one exists; otherwise write link-out with
empty seats. Never invent numbers. Never blank a previously loaded provider on a
transient fetch failure.
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
MIC_PUBLISHED = "2026-09-26"  # history point date for MIC_XLSX (MiC publication date)
MIC_FIELDWORK = "21 Aug 2026 – 21 Sep 2026"
UA = "BritishIslesAtlas/fetch_polls_seats (https://github.com/giiyms/BritishIslesAtlas)"


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_previous_providers() -> dict:
    """Return previously written provider blocks (may be empty)."""
    if not OUT.exists():
        return {}
    try:
        prev = json.loads(OUT.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    providers = prev.get("providers") or {}
    return providers if isinstance(providers, dict) else {}


def keep_stale_or_link_out(
    previous: dict | None,
    *,
    provider_name: str,
    url: str,
    data_url: str | None,
    error: str,
    extra_notes: list[str] | None = None,
    faq_url: str | None = None,
) -> dict:
    """On fetch failure: keep last good seats and flag stale; else link_out."""
    notes = list(extra_notes or [])
    if previous and previous.get("status") in {"loaded", "stale"} and previous.get("seats"):
        kept = dict(previous)
        kept["status"] = "stale"
        kept["stale"] = True
        kept["stale_error"] = error
        kept["stale_retrieved_at"] = now_iso()
        kept["provider"] = provider_name
        kept["url"] = url
        if data_url:
            kept["data_url"] = data_url
        if faq_url:
            kept["faq_url"] = faq_url
        stale_note = (
            f"Fetch failed ({error}); kept last good seat block and flagged stale. "
            "Never blank previously loaded projections."
        )
        prev_notes = list(kept.get("notes") or [])
        if stale_note not in prev_notes:
            prev_notes.append(stale_note)
        kept["notes"] = prev_notes
        # Preserve seat_count from seats if missing
        if "seat_count" not in kept:
            kept["seat_count"] = len(kept.get("seats") or {})
        return kept

    out = {
        "status": "link_out",
        "provider": provider_name,
        "url": url,
        "error": error,
        "notes": notes
        + [
            "Could not fetch; no prior good block to keep. Link-out only. Never invent numbers.",
        ],
        "seats": {},
        "fieldwork": None,
        "retrieved_at": now_iso(),
    }
    if data_url:
        out["data_url"] = data_url
    if faq_url:
        out["faq_url"] = faq_url
    return out



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


def load_electoral_calculus(by_norm: dict[str, str], previous: dict | None = None) -> dict:
    """Parse public electdata_pred.txt. EC does not break out Restore Britain."""
    try:
        raw = fetch_bytes(EC_URL)
    except (urllib.error.URLError, urllib.error.HTTPError) as exc:
        return keep_stale_or_link_out(
            previous,
            provider_name="Electoral Calculus",
            url=EC_PAGE,
            data_url=EC_URL,
            faq_url=EC_FAQ,
            error=str(exc),
            extra_notes=[
                "EC FAQ restricts republication of seat Overview extracts with attribution + date.",
            ],
        )

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
        page_seats = ec_page_pred_seats(page)
    except Exception:
        updated = None
        page_seats = {}

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
            unmatched.append(name)
            continue
        if code.startswith("N"):
            ni = ni_row(code, name, row)
            if ni:
                seats[code] = ni
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
            "Northern Ireland: EC reuses GB column headers for NI parties (CON=UUP, LAB=SDLP, LIB=DUP, "
            "Reform=Alliance, Green=TUV, NAT=Sinn Féin, MIN=Independent, OTH=Other); NI rows carry ni_shares "
            "and null GB-party shares. Mapping inferred from EC's MP column and its NI headline seat totals. "
            "EC's NI figures were identical in every archived edition checked (April 2025 to October 2026).",
            "Projections are projections, not results. Attribution: Electoral Calculus.",
            "EC FAQ: Overview extracts may be republished with attribution + retrieval date.",
        ],
        "seats": seats,
        "_page_seats": page_seats,  # internal: headline seat totals, used to date the history point
    }


# In Northern Ireland rows EC reuses the GB column headers for NI parties.
# Inferred from the 2024 MPs in its MP column (e.g. Belfast East / Gavin Robinson
# DUP is LIB, Belfast South and Mid Down / Claire Hanna SDLP is LAB, North Antrim /
# Jim Allister TUV is Green, North Down / Alex Easton Ind is MIN) and checked against
# the headline NI seat totals on prediction_main.html (SF 7, DUP 5, SDLP 2, UUP 1,
# Alliance 1, TUV 1, NI Other 1). EC does not model Conservatives, Labour, Green NI,
# Reform or Restore in NI, so those shares are null, not zero.
EC_NI_COLUMNS = {
    "CON": ("uup", "UUP"),
    "LAB": ("sdlp", "SDLP"),
    "LIB": ("dup", "DUP"),
    "Reform": ("alliance", "Alliance"),
    "Green": ("tuv", "TUV"),
    "NAT": ("sf", "Sinn Féin"),
    "MIN": ("ind", "Independent"),
    "OTH": ("oth", "Other"),
}


def ni_row(code: str, name: str, row: dict) -> dict | None:
    try:
        votes = {key: float(row.get(col) or 0) for col, (key, _) in EC_NI_COLUMNS.items()}
        chances = {key: float(row.get(f"{col} chance") or 0) for col, (key, _) in EC_NI_COLUMNS.items()}
    except ValueError:
        return None
    shares = pct_from_votes(votes)
    labels = {key: label for key, label in EC_NI_COLUMNS.values()}
    winner_key = max(shares, key=lambda k: shares[k])
    return {
        "pcon24cd": code,
        "name": name,
        "region": "NI",
        "con_share": None,
        "lab_share": None,
        "ld_share": None,
        "reform_share": None,
        "green_share": None,
        "nat_share": None,
        "restore_share": None,
        "oth_share": shares["oth"],
        "ni_shares": {k: v for k, v in shares.items() if k != "oth"},
        "projected_winner": labels[winner_key],
        "chances": chances,
    }


def ec_page_pred_seats(page: str) -> dict[str, int]:
    """Headline 'Pred Seats' per party from prediction_main.html (CON/LAB/Reform)."""
    import html as _html
    text = re.sub(r"\s+", " ", _html.unescape(re.sub(r"<[^>]+>", " ", page)))
    out = {}
    for party in ("CON", "LAB", "Reform"):
        m = re.search(rf"\b{party} [\d.]+% \d+ [\d.]+% \d+ (\d+) \d+", text)
        if m:
            out[party] = int(m.group(1))
    return out


def load_more_in_common(by_norm: dict[str, str], previous: dict | None = None) -> dict:
    try:
        raw = fetch_bytes(MIC_XLSX)
    except (urllib.error.URLError, urllib.error.HTTPError) as exc:
        return keep_stale_or_link_out(
            previous,
            provider_name="More in Common",
            url=MIC_PAGE,
            data_url=MIC_XLSX,
            error=str(exc),
        )

    try:
        import openpyxl
    except ImportError:
        return keep_stale_or_link_out(
            previous,
            provider_name="More in Common",
            url=MIC_PAGE,
            data_url=MIC_XLSX,
            error="openpyxl not installed",
            extra_notes=[
                "XLSX available but openpyxl missing in this environment.",
            ],
        )

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
            return keep_stale_or_link_out(
                previous,
                provider_name="More in Common",
                url=MIC_PAGE,
                data_url=MIC_XLSX,
                error="No constituency sheet found",
            )

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
            return keep_stale_or_link_out(
                previous,
                provider_name="More in Common",
                url=MIC_PAGE,
                data_url=MIC_XLSX,
                error=f"Unexpected headers: {header}",
            )

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
    assert len(by_code) == 650
    retrieved_at = now_iso()
    previous = load_previous_providers()
    ec = load_electoral_calculus(by_norm, previous.get("electoral_calculus"))
    mic = load_more_in_common(by_norm, previous.get("more_in_common"))
    page_seats = ec.pop("_page_seats", {})
    try:
        from build_seat_history import append_live
        print(append_live(ec, mic, page_seats, mic_date=MIC_PUBLISHED, mic_fieldwork=MIC_FIELDWORK))
    except Exception as exc:  # history is additive; never block the seat refresh
        print(f"Seat history not updated: {exc}", file=sys.stderr)
    out = {
        "retrieved_at": retrieved_at,
        "notes": [
            "Seat-level projections from publicly published tables only.",
            "Never invent numbers. On fetch failure, keep last good provider block (status=stale) when available; else link-out.",
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
        f"EC={ec['status']}:{ec.get('seat_count', len(ec.get('seats') or {}))} "
        f"MIC={mic['status']}:{mic.get('seat_count', len(mic.get('seats') or {}))} "
        f"retrieved_at={retrieved_at}"
    )
    # Exit 0 even when stale — cron may still run, but blanking is avoided.
    # Orchestrator / workflow skip commit when content is timestamp-only.
    return 0


if __name__ == "__main__":
    sys.exit(main())
