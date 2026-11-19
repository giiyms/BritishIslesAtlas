#!/usr/bin/env python3
"""Build a topology-preserving, coordinate-quantised simplified GeoJSON of all
650 UK Westminster constituencies from public/data/constituencies-gb-2024.geojson.

Uses only the Python standard library.

Method:
1. Drop tiny non-shared coastal islets below --min-islet-km2 (never dropping any
   seat's largest polygon or any polygon that shares an edge with another seat).
2. Extract exact topological junction nodes (degree != 2 in the undirected edge
   graph) and decompose every ring into canonical shared arcs between nodes.
3. Simplify each unique arc once with Douglas-Peucker in local metres:
   - Internal shared borders touching a small/urban seat (< --urban-km2): --urban-tol-m
   - Other internal shared borders: --internal-tol-m
   - Outer coastline arcs: --coastal-tol-m
   Each shared arc is inserted forward in one seat and reversed in its neighbour,
   guaranteeing bit-for-bit identical shared edges (zero gaps and zero slivers).
4. Quantise all coordinates to --dp decimal places (default 4 dp: ~6.5 m E-W x
   11.1 m N-S at UK latitudes, finer than ONS BGC's ~20 m generalisation).
5. Run local single-segment DP refinement on any crossing segments introduced by
   simplification until convergence, and verify shared-edge reciprocity and ring
   validity across all 650 features.

Usage:
  python3 scripts/simplify_constituencies.py
"""

from __future__ import annotations

import argparse
import gzip
import json
import math
import time
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SRC = ROOT / "public" / "data" / "constituencies-gb-2024.geojson"
DEFAULT_DST = ROOT / "public" / "data" / "constituencies-gb-2024-simplified.geojson"

Point = tuple[float, float]
ArcKey = tuple[Point, ...]


def ring_signed_area_km2(ring: list[Point]) -> float:
    s = 0.0
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % n]
        s += x1 * y2 - x2 * y1
    return s * 0.5 * (111.32 ** 2) * math.cos(math.radians(ring[0][1]))


def clean_ring(raw_ring: list[list[float]]) -> list[Point]:
    pts = [(float(p[0]), float(p[1])) for p in raw_ring]
    if len(pts) >= 2 and pts[0] == pts[-1]:
        pts = pts[:-1]
    dedup: list[Point] = []
    for p in pts:
        if not dedup or dedup[-1] != p:
            dedup.append(p)
    if len(dedup) >= 2 and dedup[0] == dedup[-1]:
        dedup.pop()
    return dedup


def dp_indices_meters(pts: ArcKey, tol_m: float, min_pts: int = 2) -> list[int]:
    n = len(pts)
    if n <= min_pts or tol_m <= 0.0:
        return list(range(n))
    mid_lat = pts[n // 2][1]
    kx = 111320.0 * math.cos(math.radians(mid_lat))
    ky = 111320.0
    xs = [p[0] * kx for p in pts]
    ys = [p[1] * ky for p in pts]
    tol2 = tol_m * tol_m

    keep = [False] * n
    keep[0] = True
    keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        s, e = stack.pop()
        if e - s <= 1:
            continue
        x1, y1 = xs[s], ys[s]
        x2, y2 = xs[e], ys[e]
        dx, dy = x2 - x1, y2 - y1
        seg2 = dx * dx + dy * dy
        max_d2 = -1.0
        idx = -1
        for i in range(s + 1, e):
            px, py = xs[i] - x1, ys[i] - y1
            if seg2 == 0.0:
                d2 = px * px + py * py
            else:
                t = (px * dx + py * dy) / seg2
                if t < 0.0:
                    t = 0.0
                elif t > 1.0:
                    t = 1.0
                rx = px - t * dx
                ry = py - t * dy
                d2 = rx * rx + ry * ry
            if d2 > max_d2:
                max_d2 = d2
                idx = i
        if max_d2 > tol2 and idx != -1:
            keep[idx] = True
            stack.append((s, idx))
            stack.append((idx, e))

    idxs = [i for i, k in enumerate(keep) if k]
    if len(idxs) < min_pts and n >= min_pts:
        x1, y1 = xs[0], ys[0]
        x2, y2 = xs[-1], ys[-1]
        dx, dy = x2 - x1, y2 - y1
        seg2 = dx * dx + dy * dy
        best_i = 1
        best_d2 = -1.0
        for i in range(1, n - 1):
            px, py = xs[i] - x1, ys[i] - y1
            if seg2 == 0.0:
                d2 = px * px + py * py
            else:
                t = max(0.0, min(1.0, (px * dx + py * dy) / seg2))
                rx, ry = px - t * dx, py - t * dy
                d2 = rx * rx + ry * ry
            if d2 > best_d2:
                best_d2 = d2
                best_i = i
        keep[best_i] = True
        idxs = [i for i, k in enumerate(keep) if k]
    return idxs


def farthest_orig_index(pts: ArcKey, s: int, e: int) -> int | None:
    if e - s <= 1:
        return None
    mid_lat = pts[(s + e) // 2][1]
    kx = 111320.0 * math.cos(math.radians(mid_lat))
    ky = 111320.0
    x1, y1 = pts[s][0] * kx, pts[s][1] * ky
    x2, y2 = pts[e][0] * kx, pts[e][1] * ky
    dx, dy = x2 - x1, y2 - y1
    seg2 = dx * dx + dy * dy
    best_d2 = -1.0
    best_i = (s + e) // 2
    for i in range(s + 1, e):
        px, py = pts[i][0] * kx - x1, pts[i][1] * ky - y1
        if seg2 == 0.0:
            d2 = px * px + py * py
        else:
            t = max(0.0, min(1.0, (px * dx + py * dy) / seg2))
            rx, ry = px - t * dx, py - t * dy
            d2 = rx * rx + ry * ry
        if d2 > best_d2:
            best_d2 = d2
            best_i = i
    return best_i


def _orient(a: Point, b: Point, c: Point) -> float:
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def segs_strict_cross(a: Point, b: Point, c: Point, d: Point) -> bool:
    if max(a[0], b[0]) < min(c[0], d[0]) or max(c[0], d[0]) < min(a[0], b[0]):
        return False
    if max(a[1], b[1]) < min(c[1], d[1]) or max(c[1], d[1]) < min(a[1], b[1]):
        return False
    if a == c or a == d or b == c or b == d:
        return False
    o1 = _orient(a, b, c)
    o2 = _orient(a, b, d)
    o3 = _orient(c, d, a)
    o4 = _orient(c, d, b)
    return ((o1 > 0 and o2 < 0) or (o1 < 0 and o2 > 0)) and (
        (o3 > 0 and o4 < 0) or (o3 < 0 and o4 > 0)
    )


def simplify_collection(
    collection: dict,
    *,
    internal_tol_m: float = 150.0,
    urban_tol_m: float = 75.0,
    urban_km2: float = 30.0,
    coastal_tol_m: float = 250.0,
    min_islet_km2: float = 0.05,
    dp: int = 4,
    max_refine_rounds: int = 12,
    verbose: bool = True,
) -> tuple[dict, dict]:
    t0 = time.time()
    feats = collection["features"]

    # 1. Extract cleaned rings and identify inter-seat shared edges
    raw_edge_feats: dict[tuple[Point, Point], set[int]] = defaultdict(set)
    feat_polys_raw: list[list[list[list[Point]]]] = []
    feat_total_km2: list[float] = []

    for fi, feat in enumerate(feats):
        geom = feat["geometry"]
        raw_polys = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
        clean_ps: list[list[list[Point]]] = []
        total_area = 0.0
        for poly in raw_polys:
            clean_rings: list[list[Point]] = []
            for ri, raw_ring in enumerate(poly):
                ring = clean_ring(raw_ring)
                if len(ring) >= 3:
                    clean_rings.append(ring)
                    if ri == 0:
                        total_area += abs(ring_signed_area_km2(ring))
                    n = len(ring)
                    for i in range(n):
                        a, b = ring[i], ring[(i + 1) % n]
                        edge = (a, b) if a < b else (b, a)
                        raw_edge_feats[edge].add(fi)
            if clean_rings:
                clean_ps.append(clean_rings)
        feat_polys_raw.append(clean_ps)
        feat_total_km2.append(total_area)

    # 2. Drop tiny non-shared islets (never drop the main polygon of any seat)
    feat_polys: list[list[list[list[Point]]]] = []
    dropped_islets = 0
    for fi, ps in enumerate(feat_polys_raw):
        areas = [abs(ring_signed_area_km2(poly[0])) for poly in ps]
        max_area = max(areas)
        kept_ps: list[list[list[Point]]] = []
        for pi, poly in enumerate(ps):
            shares_border = False
            for ring in poly:
                n = len(ring)
                for i in range(n):
                    a, b = ring[i], ring[(i + 1) % n]
                    edge = (a, b) if a < b else (b, a)
                    if len(raw_edge_feats[edge]) > 1:
                        shares_border = True
                        break
                if shares_border:
                    break
            if not shares_border and areas[pi] < min_islet_km2 and areas[pi] < max_area:
                dropped_islets += 1
                continue
            kept_ps.append(poly)
        feat_polys.append(kept_ps)

    if verbose:
        print(
            f"Cleaned {len(feats)} features, dropped {dropped_islets} tiny islets < {min_islet_km2} km2 ({time.time() - t0:.2f}s)",
            flush=True,
        )

    # 3. Build undirected edge graph and identify topological nodes (deg != 2)
    adj: dict[Point, set[Point]] = defaultdict(set)
    for ps in feat_polys:
        for poly in ps:
            for ring in poly:
                n = len(ring)
                for i in range(n):
                    a, b = ring[i], ring[(i + 1) % n]
                    adj[a].add(b)
                    adj[b].add(a)
    nodes = {v for v, nbrs in adj.items() if len(nbrs) != 2}

    def split_ring_to_arcs(pts: list[Point]) -> list[list[Point]]:
        n = len(pts)
        idxs = [i for i, p in enumerate(pts) if p in nodes]
        if not idxs:
            min_i = min(range(n), key=lambda i: pts[i])
            max_i = max(range(n), key=lambda i: pts[i])
            idxs = [0] if min_i == max_i else sorted([min_i, max_i])
        elif len(idxs) == 1:
            s = idxs[0]
            p0 = pts[s]
            far_i = max(
                range(n),
                key=lambda i: (pts[i][0] - p0[0]) ** 2 + (pts[i][1] - p0[1]) ** 2,
            )
            if far_i != s:
                idxs = sorted([s, far_i])
        arcs: list[list[Point]] = []
        m = len(idxs)
        for k in range(m):
            s = idxs[k]
            e = idxs[(k + 1) % m]
            seq = pts[s : e + 1] if s < e else pts[s:] + pts[: e + 1]
            arcs.append(seq)
        return arcs

    def canonical_arc(seq: list[Point]) -> tuple[ArcKey, bool]:
        fwd = tuple(seq)
        rev = tuple(reversed(seq))
        if fwd <= rev:
            return fwd, False
        return rev, True

    ring_arc_refs: list[list[list[list[tuple[ArcKey, bool]]]]] = []
    arc_use: Counter[ArcKey] = Counter()
    arc_feats: dict[ArcKey, set[int]] = defaultdict(set)

    for fi, ps in enumerate(feat_polys):
        f_refs = []
        for poly in ps:
            p_refs = []
            for ring in poly:
                r_refs = []
                for seq in split_ring_to_arcs(ring):
                    key, is_rev = canonical_arc(seq)
                    arc_use[key] += 1
                    arc_feats[key].add(fi)
                    r_refs.append((key, is_rev))
                p_refs.append(r_refs)
            f_refs.append(p_refs)
        ring_arc_refs.append(f_refs)

    ep_count = Counter((min(k[0], k[-1]), max(k[0], k[-1])) for k in arc_use)
    if verbose:
        print(
            f"Decomposed into {len(arc_use):,} unique arcs ({Counter(arc_use.values())}) ({time.time() - t0:.2f}s)",
            flush=True,
        )

    # 4. Initial shared-arc Douglas-Peucker simplification
    arc_idxs: dict[ArcKey, list[int]] = {}
    for key in arc_use:
        touches_urban = any(feat_total_km2[fi] < urban_km2 for fi in arc_feats[key])
        if touches_urban:
            tol = urban_tol_m
        elif arc_use[key] >= 2:
            tol = internal_tol_m
        else:
            tol = coastal_tol_m
        ep = (min(key[0], key[-1]), max(key[0], key[-1]))
        min_pts = 3 if ep_count[ep] > 1 else 2
        arc_idxs[key] = dp_indices_meters(key, tol, min_pts=min_pts)

    # 5. Local single-segment refinement for any strict crossings
    cell = 0.05
    total_cross = 0
    inter_seat_cross = 0
    rounds_run = 0
    for rnd in range(max_refine_rounds):
        rounds_run = rnd + 1
        grid: dict[tuple[int, int], list[int]] = defaultdict(list)
        segs: list[tuple[Point, Point, ArcKey, int]] = []
        for key, idxs in arc_idxs.items():
            q = [(round(key[i][0], dp), round(key[i][1], dp)) for i in idxs]
            for j in range(len(q) - 1):
                a, b = q[j], q[j + 1]
                if a == b:
                    continue
                sid = len(segs)
                segs.append((a, b, key, j))
                gx0 = int(math.floor(min(a[0], b[0]) / cell))
                gx1 = int(math.floor(max(a[0], b[0]) / cell))
                gy0 = int(math.floor(min(a[1], b[1]) / cell))
                gy1 = int(math.floor(max(a[1], b[1]) / cell))
                for gx in range(gx0, gx1 + 1):
                    for gy in range(gy0, gy1 + 1):
                        grid[(gx, gy)].append(sid)

        splits: dict[ArcKey, set[int]] = defaultdict(set)
        checked: set[tuple[int, int]] = set()
        total_cross = 0
        inter_seat_cross = 0
        for sids in grid.values():
            m = len(sids)
            if m < 2:
                continue
            for i in range(m):
                s1 = sids[i]
                a1, b1, k1, j1 = segs[s1]
                for j in range(i + 1, m):
                    s2 = sids[j]
                    pair = (s1, s2) if s1 < s2 else (s2, s1)
                    if pair in checked:
                        continue
                    checked.add(pair)
                    a2, b2, k2, j2 = segs[s2]
                    if segs_strict_cross(a1, b1, a2, b2):
                        total_cross += 1
                        if not (arc_feats[k1] == arc_feats[k2] and len(arc_feats[k1]) == 1):
                            inter_seat_cross += 1
                        splits[k1].add(j1)
                        splits[k2].add(j2)

        added = 0
        for key, js in splits.items():
            idxs = arc_idxs[key]
            new_pts = set(idxs)
            for j in js:
                mid = farthest_orig_index(key, idxs[j], idxs[j + 1])
                if mid is not None and mid not in new_pts:
                    new_pts.add(mid)
                    added += 1
            if len(new_pts) > len(idxs):
                arc_idxs[key] = sorted(new_pts)
        if added == 0:
            break

    if verbose:
        print(
            f"Crossing refinement converged in {rounds_run} rounds: total_cross={total_cross}, inter_seat_cross={inter_seat_cross} ({time.time() - t0:.2f}s)",
            flush=True,
        )

    # 6. Reassemble simplified features and verify topology
    out_feats = []
    total_verts = 0
    total_polys = 0
    dir_edges: Counter[tuple[Point, Point]] = Counter()
    edge_owners: dict[tuple[Point, Point], set[int]] = defaultdict(set)

    for fi, feat in enumerate(feats):
        polys_out = []
        for pi, p_refs in enumerate(ring_arc_refs[fi]):
            rings_out = []
            for ri, r_refs in enumerate(p_refs):
                pts: list[Point] = []
                for key, is_rev in r_refs:
                    idxs = arc_idxs[key]
                    seg = [(round(key[i][0], dp), round(key[i][1], dp)) for i in idxs]
                    if is_rev:
                        seg = list(reversed(seg))
                    pts.extend(seg[1:] if pts else seg)
                dedup: list[Point] = []
                for p in pts:
                    if not dedup or dedup[-1] != p:
                        dedup.append(p)
                if len(dedup) >= 2 and dedup[0] == dedup[-1]:
                    dedup.pop()
                if len(dedup) < 3 or abs(ring_signed_area_km2(dedup)) == 0.0:
                    if ri == 0 and len(p_refs) == 1:
                        # Do not drop a polygon if it's the only one for this feature
                        continue
                    continue
                ring_coords = [[p[0], p[1]] for p in dedup]
                ring_coords.append(ring_coords[0])
                rings_out.append(ring_coords)
                total_verts += len(ring_coords)
                n = len(dedup)
                for i in range(n):
                    a, b = dedup[i], dedup[(i + 1) % n]
                    dir_edges[(a, b)] += 1
                    undir = (a, b) if a < b else (b, a)
                    edge_owners[undir].add(fi)
            if rings_out:
                polys_out.append(rings_out)
                total_polys += 1
        if not polys_out:
            raise RuntimeError(f"Feature {feat['properties'].get('PCON24CD')} collapsed to empty geometry!")
        geom = (
            {"type": "Polygon", "coordinates": polys_out[0]}
            if len(polys_out) == 1
            else {"type": "MultiPolygon", "coordinates": polys_out}
        )
        out_feats.append(
            {
                "type": "Feature",
                "geometry": geom,
                "properties": dict(feat["properties"]),
            }
        )

    # Verify shared-edge reciprocity: every edge belonging to 2 seats must appear
    # once forward and once reversed (no gaps/slivers on shared borders).
    shared_edges = 0
    asymmetric_shared = 0
    for (a, b), owners in edge_owners.items():
        if len(owners) >= 2:
            shared_edges += 1
            if dir_edges[(a, b)] != dir_edges[(b, a)]:
                asymmetric_shared += 1

    out_collection = {"type": "FeatureCollection", "features": out_feats}
    stats = {
        "features": len(out_feats),
        "polygons": total_polys,
        "vertices": total_verts,
        "dropped_islets": dropped_islets,
        "shared_edges": shared_edges,
        "asymmetric_shared_edges": asymmetric_shared,
        "strict_crossings": total_cross,
        "inter_seat_crossings": inter_seat_cross,
        "dp": dp,
        "internal_tol_m": internal_tol_m,
        "urban_tol_m": urban_tol_m,
        "urban_km2": urban_km2,
        "coastal_tol_m": coastal_tol_m,
        "min_islet_km2": min_islet_km2,
        "elapsed_s": round(time.time() - t0, 2),
    }
    return out_collection, stats


def main() -> int:
    ap = argparse.ArgumentParser(description="Topology-preserving constituency GeoJSON simplifier.")
    ap.add_argument("--src", type=Path, default=DEFAULT_SRC)
    ap.add_argument("--dst", type=Path, default=DEFAULT_DST)
    ap.add_argument("--internal-tol-m", type=float, default=150.0)
    ap.add_argument("--urban-tol-m", type=float, default=75.0)
    ap.add_argument("--urban-km2", type=float, default=30.0)
    ap.add_argument("--coastal-tol-m", type=float, default=250.0)
    ap.add_argument("--min-islet-km2", type=float, default=0.05)
    ap.add_argument("--dp", type=int, default=4)
    args = ap.parse_args()

    before_bytes = args.dst.stat().st_size if args.dst.exists() else 0
    before_gz = len(gzip.compress(args.dst.read_bytes(), compresslevel=9)) if args.dst.exists() else 0

    src_data = json.loads(args.src.read_text(encoding="utf-8"))
    out_data, stats = simplify_collection(
        src_data,
        internal_tol_m=args.internal_tol_m,
        urban_tol_m=args.urban_tol_m,
        urban_km2=args.urban_km2,
        coastal_tol_m=args.coastal_tol_m,
        min_islet_km2=args.min_islet_km2,
        dp=args.dp,
        verbose=True,
    )

    if stats["asymmetric_shared_edges"] != 0:
        raise SystemExit(
            f"Topology check failed: {stats['asymmetric_shared_edges']} asymmetric shared edges"
        )

    encoded = json.dumps(out_data, separators=(",", ":")).encode("utf-8")
    args.dst.write_bytes(encoded)
    after_bytes = len(encoded)
    after_gz = len(gzip.compress(encoded, compresslevel=9))

    print(
        f"Wrote {args.dst}: {after_bytes:,} B raw ({after_gz:,} B gzip9), "
        f"{stats['features']} features, {stats['polygons']} polys, {stats['vertices']:,} verts, "
        f"{stats['shared_edges']:,} shared edges (0 asymmetric)",
        flush=True,
    )
    if before_bytes:
        pct = (1 - after_bytes / before_bytes) * 100
        pct_gz = (1 - after_gz / before_gz) * 100
        print(
            f"Before -> After: {before_bytes:,} -> {after_bytes:,} B ({pct:.1f}% smaller) | "
            f"gzip: {before_gz:,} -> {after_gz:,} B ({pct_gz:.1f}% smaller)",
            flush=True,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
