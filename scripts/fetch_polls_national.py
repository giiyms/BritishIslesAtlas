#!/usr/bin/env python3
"""Fetch latest UK next-GE national VI polls from Wikipedia.

Writes public/data/polls-national.json with recent poll rows + a simple
documented rolling average. Breaks out Restore Britain (RB) only where the
pollster does. Never invents figures.
"""

from __future__ import annotations

import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "data" / "polls-national.json"
WIKI_URL = (
    "https://en.wikipedia.org/wiki/Opinion_polling_for_the_next_United_Kingdom_general_election"
)
UA = "BritishIslesAtlas/fetch_polls_national (https://github.com/giiyms/BritishIslesAtlas)"
ROLLING_N = 7  # latest N GB polls with numeric Lab/Con/Ref


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def strip_tags(html: str) -> str:
    text = re.sub(r"<br\s*/?>", " ", html, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("\xa0", " ").replace("&nbsp;", " ")
    text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def parse_pct(cell: str) -> float | None:
    cell = cell.strip()
    if not cell or cell in {"—", "–", "-", "N/A", "n/a"}:
        return None
    m = re.search(r"(\d+(?:\.\d+)?)\s*%?", cell)
    if not m:
        return None
    return float(m.group(1))


def fetch_html() -> str:
    req = urllib.request.Request(WIKI_URL, headers={"User-Agent": UA, "Accept": "text/html"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read().decode("utf-8", errors="replace")


def extract_main_table(html: str) -> list[list[str]]:
    """Return rows (list of cell texts) for the first GB VI wikitable with Lab/Con/Ref/RB headers."""
    tables = re.findall(
        r'<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>(.*?)</table>',
        html,
        flags=re.I | re.S,
    )
    for table in tables:
        rows_html = re.findall(r"<tr[^>]*>(.*?)</tr>", table, flags=re.I | re.S)
        parsed: list[list[str]] = []
        for row in rows_html:
            cells = re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", row, flags=re.I | re.S)
            if not cells:
                continue
            parsed.append([strip_tags(c) for c in cells])
        if len(parsed) < 5:
            continue
        header = [c.casefold() for c in parsed[0]]
        header_flat = " ".join(header)
        # Skip colour-swatch pseudo-header rows; find real header
        header_idx = 0
        for i, row in enumerate(parsed[:4]):
            joined = " ".join(c.casefold() for c in row)
            if "pollster" in joined and ("lab" in joined or "labour" in joined):
                header_idx = i
                header = [c.casefold() for c in row]
                header_flat = joined
                break
        if "pollster" not in header_flat:
            continue
        if not any(x in header_flat for x in ("ref", "reform")):
            continue
        # Build column map from header
        cols = parsed[header_idx]
        col_index = {strip_tags(c).casefold(): i for i, c in enumerate(cols)}

        def find_col(*names: str) -> int | None:
            # Exact header first: substring "con" would otherwise hit "date(s)conducted".
            for name in names:
                if name in col_index:
                    return col_index[name]
            for name in names:
                for key, idx in col_index.items():
                    if name in key:
                        return idx
            return None

        idx_date = find_col("date")
        idx_pollster = find_col("pollster")
        idx_client = find_col("client")
        idx_area = find_col("area")
        idx_sample = find_col("sample")
        idx_lab = find_col("lab")
        idx_con = find_col("con")
        idx_ref = find_col("ref", "reform")
        idx_ld = find_col("ld", "lib dem")
        idx_grn = find_col("grn", "green")
        idx_snp = find_col("snp")
        idx_pc = find_col("pc", "plaid")
        idx_rb = find_col("rb", "restore")
        idx_oth = find_col("other")
        if idx_pollster is None or idx_lab is None or idx_ref is None:
            continue

        data_rows = []
        for row in parsed[header_idx + 1 :]:
            if len(row) < 5:
                continue
            pollster = row[idx_pollster] if idx_pollster < len(row) else ""
            if not pollster or pollster.casefold().startswith("date"):
                continue
            # Skip average / footnote rows
            if any(k in pollster.casefold() for k in ("average", "result", "election")):
                continue

            def cell(idx: int | None) -> str:
                if idx is None or idx >= len(row):
                    return ""
                return row[idx]

            area = cell(idx_area)
            if area and area.upper() not in {"GB", "UK", ""}:
                # Prefer GB; allow UK
                if area.upper() not in {"GB", "UK"}:
                    continue

            entry = {
                "fieldwork": cell(idx_date),
                # Strip Wikipedia footnote marks ([1], [a], [b], …) from pollster names.
                "pollster": re.sub(r"\[[A-Za-z0-9]+\]", "", pollster).strip(),
                "client": cell(idx_client) or None,
                "area": area or "GB",
                "sample": parse_pct(cell(idx_sample).replace(",", ""))  # may fail
                if False
                else None,
                "sample_raw": cell(idx_sample) or None,
                "lab": parse_pct(cell(idx_lab)),
                "con": parse_pct(cell(idx_con)),
                "ref": parse_pct(cell(idx_ref)),
                "ld": parse_pct(cell(idx_ld)),
                "grn": parse_pct(cell(idx_grn)),
                "snp": parse_pct(cell(idx_snp)),
                "pc": parse_pct(cell(idx_pc)),
                "rb": parse_pct(cell(idx_rb)),  # None when pollster does not break out Restore
                "others": parse_pct(cell(idx_oth)),
                "url": WIKI_URL,
            }
            # sample as int if possible
            sample_raw = cell(idx_sample)
            sm = re.search(r"([\d,]+)", sample_raw or "")
            if sm:
                try:
                    entry["sample"] = int(sm.group(1).replace(",", ""))
                except ValueError:
                    entry["sample"] = None
            if entry["lab"] is None and entry["ref"] is None:
                continue
            data_rows.append(entry)
        if data_rows:
            return data_rows  # type: ignore[return-value]
    raise SystemExit("Could not find Wikipedia next-GE polling table")


def rolling_average(polls: list[dict], n: int = ROLLING_N) -> dict:
    """Simple arithmetic mean of the latest N polls with Lab+Con+Ref present.

    Restore (rb) is averaged only over polls that break it out; if fewer than
    3 such polls exist in the window, rb is null (do not invent).
    """
    usable = [p for p in polls if p.get("lab") is not None and p.get("con") is not None and p.get("ref") is not None]
    window = usable[:n]
    if not window:
        return {
            "method": f"Arithmetic mean of latest {n} GB polls with Lab/Con/Ref; RB only where broken out (min 3).",
            "n": 0,
            "pollsters": [],
            "lab": None,
            "con": None,
            "ref": None,
            "ld": None,
            "grn": None,
            "rb": None,
        }

    def mean(key: str, require: bool = False) -> float | None:
        vals = [p[key] for p in window if isinstance(p.get(key), (int, float))]
        if require and len(vals) < len(window):
            return None
        if not vals:
            return None
        return round(sum(vals) / len(vals), 1)

    rb_vals = [p["rb"] for p in window if isinstance(p.get("rb"), (int, float))]
    rb_avg = round(sum(rb_vals) / len(rb_vals), 1) if len(rb_vals) >= 3 else None

    return {
        "method": (
            f"Arithmetic mean of latest {len(window)} GB polls with numeric Lab/Con/Ref "
            f"(window target {n}). Restore Britain (rb) averaged only over polls that "
            f"break it out (need ≥3 in window; else null). Not a MRP; national VI only."
        ),
        "n": len(window),
        "pollsters": [p["pollster"] for p in window],
        "fieldwork_span": {
            "newest": window[0].get("fieldwork"),
            "oldest": window[-1].get("fieldwork"),
        },
        "lab": mean("lab"),
        "con": mean("con"),
        "ref": mean("ref"),
        "ld": mean("ld"),
        "grn": mean("grn"),
        "snp": mean("snp"),
        "pc": mean("pc"),
        "rb": rb_avg,
        "rb_polls_in_window": len(rb_vals),
    }


def main() -> int:
    html = fetch_html()
    rows = extract_main_table(html)
    # Keep a generous recent slice for the file; UI uses rolling avg + latest few
    polls = rows[:40]
    retrieved_at = now_iso()
    out = {
        "retrieved_at": retrieved_at,
        "source": "Wikipedia — Opinion polling for the next United Kingdom general election",
        "source_url": WIKI_URL,
        "secondary": {
            "name": "Mark Pack voting intention scorecard",
            "url": "https://www.markpack.org.uk/155623/voting-intention-opinion-poll-scorecard/",
        },
        "notes": [
            "Figures transcribed from the public Wikipedia table; not affiliated with any pollster.",
            "Restore Britain (rb) is null when the pollster did not break it out.",
            "National VI must not flip seat endorsements alone.",
        ],
        "polls": polls,
        "rolling_average": rolling_average(polls, ROLLING_N),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    avg = out["rolling_average"]
    print(
        f"Wrote {OUT.relative_to(ROOT)} polls={len(polls)} "
        f"avg_n={avg['n']} ref={avg.get('ref')} rb={avg.get('rb')} "
        f"retrieved_at={retrieved_at}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
