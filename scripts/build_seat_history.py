#!/usr/bin/env python3
"""Build public/data/polls-seats-history.json: per-seat projected vote share over time.

Sources (public, real data only; never invent numbers):
  - Electoral Calculus: archived copies of electdata_pred.txt on the Wayback Machine
    (post-2024-boundary files only), plus the live file appended by fetch_polls_seats.py.
  - More in Common: every published MRP seat table on moreincommon.org.uk since the
    July 2024 election (XLSX/CSV).

Each point is dated by the provider's published/update date. For Electoral Calculus
the update date of an archived file is taken from the archived prediction page and
checked against the file itself (projected seat totals must agree); see EC_EDITIONS.

Output (compact):
  parties: ordered share keys
  providers.<key>.editions: [{date, fieldwork, source_url, date_basis}]
  seats.<PCON24CD>.<provider>: [[date, share per party key (0.1 rounded or null)], ...]

Running this again merges with the existing file: points are keyed by (provider, date),
a re-run replaces the same date and never drops older dates.
"""

from __future__ import annotations

import csv
import io
import json
import re
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_polls_seats import (  # noqa: E402
    ec_name_variants,
    fetch_bytes,
    load_pcon_index,
    normalize_name,
)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "data" / "polls-seats-history.json"
PARTIES = ["con", "lab", "ld", "ref", "grn", "snp", "pc", "rb", "oth"]
PROVIDER_NAMES = {"electoral_calculus": "Electoral Calculus", "more_in_common": "More in Common"}
WAYBACK = "https://web.archive.org/web/{ts}id_/https://www.electoralcalculus.co.uk/electdata_pred.txt"

# Archived EC seat files on 2024 boundaries. Update date and fieldwork come from the
# archived prediction_main.html; each was checked by comparing projected seat totals
# in the file against that page's headline table (all within a few seats).
EC_EDITIONS = [
    {"capture": "20250430093221", "date": "2025-04-26", "fieldwork": "11 Apr 2025 – 25 Apr 2025", "page_capture": "20250501000904"},
    {"capture": "20250907072755", "date": "2025-08-23", "fieldwork": "01 Aug 2025 – 22 Aug 2025", "page_capture": "20250902163106"},
    {"capture": "20251211233627", "date": "2025-11-29", "fieldwork": "30 Oct 2025 – 28 Nov 2025", "page_capture": "20251209115631"},
    {"capture": "20260208070017", "date": "2026-01-24", "fieldwork": "09 Jan 2026 – 23 Jan 2026", "page_capture": "20260211034811"},
    {"capture": "20260307052212", "date": "2026-02-24", "fieldwork": "04 Feb 2026 – 23 Feb 2026", "page_capture": "20260303061313"},
    {"capture": "20261013025847", "date": "2026-09-30", "fieldwork": "04 Sep 2026 – 29 Sep 2026", "page_capture": "20261005030502"},
]
EC_SKIPPED = [
    "Wayback captures 2013 to 2024-06 (latest 20240619160241): old 2019 boundaries (only 421 of 632 names match; electorates are 2019 figures), so they are not used.",
    "20251218045818: byte-identical seat data to 20251211233627 (same 29 Nov 2025 update).",
    "polls-seats.json snapshot retrieved 2026-10-28: an interim EC file that EC replaced on 30 Oct 2026 within the same 27 Oct 2026 update, so the replacement is used.",
]

MIC_BASE = "https://www.moreincommon.org.uk/wp-content/uploads/"
MIC_EDITIONS = [
    {"date": "2024-12-28", "fieldwork": "31 Oct 2024 – 16 Dec 2024", "file": "2026/04/december-2024-mrp-data-tables.xlsx", "page": "research/more-in-common-have-released-their-first-mrp-of-the-new-parliament/"},
    {"date": "2025-04-20", "fieldwork": "14 Mar 2025 – 1 Apr 2025", "file": "2026/06/mic-mrp-april2025.xlsx", "page": "research/more-in-commons-april-mrp/"},
    {"date": "2025-07-05", "fieldwork": "13 Jun 2025 – 30 Jun 2025", "file": "2026/06/mic_julymrp_data.csv", "page": "research/more-in-commons-july-mrp/"},
    {"date": "2025-09-28", "fieldwork": "8 Aug 2025 – 15 Sep 2025", "file": "2026/06/sept_mrp_datatable.xlsx", "page": "research/more-in-commons-september-mrp/"},
    {"date": "2026-01-04", "fieldwork": "27 Nov 2025 – 16 Dec 2025", "file": "2026/06/jan2026_mrp_tables.xlsx", "page": "research/more-in-commons-january-mrp/"},
    {"date": "2026-04-12", "fieldwork": "1 Mar 2026 – 30 Mar 2026", "file": "2026/05/apr26-mrp-datatables-final.xlsx", "page": "research/more-in-commons-april-mrp-2/"},
    {"date": "2026-07-19", "fieldwork": "5 Jun 2026 – 28 Jun 2026", "file": "2026/07/jul26-mrp-datatables-final-3.xlsx", "page": "research/the-final-mrp-of-keir-starmers-premiership/"},
    {"date": "2026-09-26", "fieldwork": "21 Aug 2026 – 21 Sep 2026", "file": "2026/09/Sep26-MRP.xlsx", "page": "research/more-in-commons-september-2026-mrp/"},
]
MIC_SKIPPED = [
    "Prosper UK 'missing Conservative voters' MRP (Jan 2026): not a vote-share projection.",
    "Starmer MRP tables (Jun 2026): leader ratings, not seat vote shares.",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def r1(v: float | None) -> float | None:
    return None if v is None else round(float(v) + 0.0, 1)


def ec_point(row: dict, code: str) -> list[float | None]:
    """EC vote counts -> % shares in PARTIES order. NAT is SNP in Scotland, Plaid in Wales."""
    keys = ["CON", "LAB", "LIB", "Reform", "Green", "NAT", "MIN", "OTH"]
    v = {k: float(row.get(k) or 0) for k in keys}
    total = sum(v.values())
    if total <= 0:
        raise ValueError("zero votes")
    pct = {k: 100.0 * x / total for k, x in v.items()}
    nat = pct["NAT"]
    return [r1(pct["CON"]), r1(pct["LAB"]), r1(pct["LIB"]), r1(pct["Reform"]), r1(pct["Green"]),
            r1(nat) if code.startswith("S") else None, r1(nat) if code.startswith("W") else None,
            None, r1(pct["OTH"] + pct["MIN"])]


def parse_ec_text(text: str, by_norm: dict[str, str]) -> dict[str, list]:
    out: dict[str, list] = {}
    for row in csv.DictReader(io.StringIO(text), delimiter=";"):
        name = (row.get("Name") or "").strip()
        code = next((by_norm[v] for v in ec_name_variants(name) if v in by_norm), None)
        if code and code not in out:
            out[code] = ec_point(row, code)
    return out


def decode_ec(raw: bytes) -> str:
    if raw[:2] == b"\x1f\x8b":
        import gzip
        raw = gzip.decompress(raw)
    return raw.decode("cp1252", errors="replace")


MIC_COLS = {
    "con": ("conservative",), "lab": ("labour",), "ld": ("liberal",), "ref": ("reform",),
    "grn": ("green",), "snp": ("scottish national", "snp"), "pc": ("plaid",), "rb": ("restore",), "oth": ("other",),
}


def _num(v) -> float | None:
    if v is None or v == "":
        return None
    if isinstance(v, str):
        v = v.strip().rstrip("%")
        if not v:
            return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def parse_mic_rows(rows: list[list], by_norm: dict[str, str]) -> dict[str, list]:
    """Find the seat table (header with 'Constituency' + party columns) and return shares in %."""
    for i, row in enumerate(rows):
        header = [str(c).strip().casefold().replace(".", " ") if c is not None else "" for c in row]
        if "constituency" not in header or not any("labour" in h for h in header):
            continue
        idx = {}
        for key, names in MIC_COLS.items():
            # first column whose header contains the name and is not a code/winner column
            idx[key] = next((j for j, h in enumerate(header) if any(n in h for n in names) and "winner" not in h), None)
        i_name = header.index("constituency")
        body = [r for r in rows[i + 1:] if r and r[i_name]]
        nums = [_num(r[j]) for r in body for j in idx.values() if j is not None and j < len(r)]
        scale = 100.0 if max(x for x in nums if x is not None) <= 1.0 else 1.0
        out: dict[str, list] = {}
        for r in body:
            name = str(r[i_name]).strip()
            code = next((by_norm[v] for v in ec_name_variants(name) if v in by_norm), None) or by_norm.get(normalize_name(name))
            if not code:
                continue
            vals = []
            for key in PARTIES:
                j = idx[key]
                x = _num(r[j]) if j is not None and j < len(r) else None
                vals.append(r1(x * scale) if x is not None else None)
            out[code] = vals
        return out
    return {}


def load_mic_file(raw: bytes, name: str, by_norm: dict[str, str]) -> dict[str, list]:
    if name.endswith(".csv"):
        return parse_mic_rows(list(csv.reader(io.StringIO(raw.decode("utf-8-sig", errors="replace")))), by_norm)
    import openpyxl
    with tempfile.NamedTemporaryFile(suffix=".xlsx") as tmp:
        tmp.write(raw)
        tmp.flush()
        wb = openpyxl.load_workbook(tmp.name, read_only=True, data_only=True)
        best: dict[str, list] = {}
        for sheet in wb.sheetnames:
            got = parse_mic_rows([list(r) for r in wb[sheet].iter_rows(values_only=True)], by_norm)
            if len(got) > len(best):
                best = got
        return best


def load_history() -> dict:
    if OUT.exists():
        try:
            data = json.loads(OUT.read_text(encoding="utf-8"))
            if data.get("parties") == PARTIES:
                return data
        except (OSError, json.JSONDecodeError):
            pass
    return {"parties": PARTIES, "providers": {}, "seats": {}}


def add_edition(history: dict, provider: str, edition: dict, seats: dict[str, list]) -> int:
    """Insert or replace one dated point per seat for `provider`. Never removes other dates."""
    date = edition["date"]
    block = history["providers"].setdefault(provider, {"provider": PROVIDER_NAMES.get(provider, provider), "editions": []})
    block["editions"] = sorted([e for e in block["editions"] if e["date"] != date] + [edition], key=lambda e: e["date"])
    for code, vals in seats.items():
        pts = history["seats"].setdefault(code, {}).setdefault(provider, [])
        pts[:] = sorted([p for p in pts if p[0] != date] + [[date, *vals]], key=lambda p: p[0])
    return len(seats)


def write_history(history: dict) -> None:
    history["generated_at"] = now_iso()
    history["notes"] = [
        "Per-seat projected vote share (%) over time, one point per provider edition, dated by the provider's published/update date.",
        "Real published data only; null means the provider did not model that party for that seat.",
        "EC NAT is shown as SNP (Scotland) or Plaid Cymru (Wales); EC Other includes MIN.",
    ]
    ordered = {k: history[k] for k in ["generated_at", "notes", "parties", "providers"]}
    ordered["seats"] = {code: history["seats"][code] for code in sorted(history["seats"])}
    OUT.write_text(json.dumps(ordered, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def _iso_date(text: str | None) -> str | None:
    for fmt in ("%d %B %Y", "%d %b %Y"):
        try:
            return datetime.strptime((text or "").strip(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return None


def ec_row_point(row: dict, code: str) -> list[float | None]:
    nat = row.get("nat_share")
    return [row.get("con_share"), row.get("lab_share"), row.get("ld_share"), row.get("reform_share"), row.get("green_share"),
            nat if code.startswith("S") else None, nat if code.startswith("W") else None, None, row.get("oth_share")]


def mic_row_point(row: dict) -> list[float | None]:
    return [row.get(f"{k}_share") for k in ("con", "lab", "ld", "reform", "green", "snp", "pc", "restore", "oth")]


def append_live(ec: dict, mic: dict, page_seats: dict[str, int], *, mic_date: str, mic_fieldwork: str) -> str:
    """Called by fetch_polls_seats.py on each refresh: add (or refresh) today's editions.

    Only freshly loaded blocks are added; stale/link-out blocks never touch history.
    EC is dated by its page's update date only when the page's headline seat totals
    agree with the file (EC can swap the file before the page); otherwise by retrieval date.
    """
    history = load_history()
    done = []
    if ec.get("status") == "loaded" and ec.get("seats"):
        winners = [r.get("projected_winner") for r in ec["seats"].values()]
        counts = {"CON": winners.count("Conservative"), "LAB": winners.count("Labour"), "Reform": winners.count("Reform")}
        updated = _iso_date(ec.get("updated"))
        agrees = bool(page_seats) and all(abs(counts[k] - page_seats.get(k, -99)) <= 8 for k in counts)
        date = updated if updated and agrees else ec["retrieved_at"][:10]
        basis = "EC update date (live prediction page)" if updated and agrees else "retrieval date (EC page date did not match the file)"
        add_edition(history, "electoral_calculus", {
            "date": date, "fieldwork": ec.get("fieldwork"), "date_basis": basis, "source_url": ec.get("data_url"),
        }, {code: ec_row_point(row, code) for code, row in ec["seats"].items()})
        done.append(f"EC {date}")
    if mic.get("status") == "loaded" and mic.get("seats"):
        add_edition(history, "more_in_common", {
            "date": mic_date, "fieldwork": mic_fieldwork, "date_basis": "MiC publication date",
            "source_url": mic.get("data_url"), "page_url": mic.get("url"),
        }, {code: mic_row_point(row) for code, row in mic["seats"].items()})
        done.append(f"MiC {mic_date}")
    if not done:
        return "Seat history unchanged (no freshly loaded provider)"
    write_history(history)
    return "Seat history: " + ", ".join(done)


def main() -> int:
    by_norm, by_code = load_pcon_index()
    history = load_history()
    for ed in EC_EDITIONS:
        text = decode_ec(fetch_bytes(WAYBACK.format(ts=ed["capture"])))
        seats = parse_ec_text(text, by_norm)
        if len(seats) != len(by_code):
            print(f"EC {ed['capture']}: matched {len(seats)}/632 seats, skipped", file=sys.stderr)
            continue
        add_edition(history, "electoral_calculus", {
            "date": ed["date"], "fieldwork": ed["fieldwork"], "date_basis": "EC update date (archived prediction page)",
            "source_url": f"https://web.archive.org/web/{ed['capture']}/https://www.electoralcalculus.co.uk/electdata_pred.txt",
        }, seats)
        print(f"EC {ed['date']}: {len(seats)} seats")
    for ed in MIC_EDITIONS:
        url = MIC_BASE + ed["file"]
        seats = load_mic_file(fetch_bytes(url), ed["file"], by_norm)
        if len(seats) < 600:
            print(f"MiC {ed['date']}: only {len(seats)} seats parsed, skipped", file=sys.stderr)
            continue
        add_edition(history, "more_in_common", {
            "date": ed["date"], "fieldwork": ed["fieldwork"], "date_basis": "MiC publication date",
            "source_url": url, "page_url": "https://www.moreincommon.org.uk/" + ed["page"],
        }, seats)
        print(f"MiC {ed['date']}: {len(seats)} seats")
    history["providers"].setdefault("electoral_calculus", {})["skipped"] = EC_SKIPPED
    history["providers"].setdefault("more_in_common", {})["skipped"] = MIC_SKIPPED
    write_history(history)
    print(f"Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
