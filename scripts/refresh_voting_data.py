#!/usr/bin/env python3
"""Idempotent daily refresh: candidates + national polls + seat polls + endorsements index."""

from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = [
    ROOT / "scripts" / "fetch_candidates.py",
    ROOT / "scripts" / "fetch_polls_national.py",
    ROOT / "scripts" / "fetch_polls_seats.py",
]
OUT_META = ROOT / "public" / "data" / "voting-meta.json"


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def main() -> int:
    py = sys.executable
    results = []
    for script in SCRIPTS:
        print(f"==> {script.name}", flush=True)
        proc = subprocess.run([py, str(script)], cwd=str(ROOT))
        results.append({"script": script.name, "ok": proc.returncode == 0, "code": proc.returncode})
        if proc.returncode != 0:
            print(f"FAILED {script.name} exit={proc.returncode}", file=sys.stderr)
            # Continue others so partial refresh still updates what it can
    # Build endorsements index via a small inline pass (mirrors src/endorse.ts rules)
    try:
        subprocess.run([py, str(ROOT / "scripts" / "build_endorsements.py")], cwd=str(ROOT), check=False)
    except FileNotFoundError:
        pass

    meta = {
        "retrieved_at": now_iso(),
        "scripts": results,
    }
    # Prefer newest retrieved_at from child files
    for path in (
        ROOT / "public" / "data" / "candidates-gb.json",
        ROOT / "public" / "data" / "polls-national.json",
        ROOT / "public" / "data" / "polls-seats.json",
        ROOT / "public" / "data" / "endorsements-gb.json",
    ):
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                meta[path.stem] = {"retrieved_at": data.get("retrieved_at"), "path": f"/data/{path.name}"}
            except json.JSONDecodeError:
                meta[path.stem] = {"error": "invalid json"}

    OUT_META.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    failed = [r for r in results if not r["ok"]]
    print(f"Refresh complete. failed={len(failed)} meta={OUT_META}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
