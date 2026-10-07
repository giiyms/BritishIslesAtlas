import type { ExpressionSpecification } from "maplibre-gl";
import config from "./surfaces.json";
import { classes, legendHtml, stepExpression, swatchLegendHtml, type Classes } from "./classify";
import { ENDORSE_COLORS } from "./endorse";
import { canonicalParty, type VotingSeat } from "./voting";

/**
 * Election mode: one seat layer, three readings of it. Values ride on feature-state
 * (keyed by PCON24CD), so switching view never refetches geometry.
 */
export type ElectionView = "winner" | "reform" | "pick";
export type ElectionLayout = "map" | "hex";

export const ELECTION_VIEWS: ReadonlyArray<{ view: ElectionView; label: string; hint: string }> = [
  { view: "winner", label: "Projected winner", hint: "Faded = marginal, solid = safe" },
  { view: "reform", label: "Reform vote share", hint: "Projected % per seat" },
  { view: "pick", label: "Our pick", hint: "Editorial Reform / Restore guide" },
];

/** Display colours for projected winners (data view only; never used for the editorial pick). */
export const PARTY_COLORS: Record<string, string> = {
  Labour: "#E4003B",
  Conservative: "#0087DC",
  "Reform UK": "#12B6CF",
  "Liberal Democrat": "#FAA61A",
  SNP: "#F2D43D",
  "Plaid Cymru": "#005B54",
  Green: "#02A95B",
  "Restore Britain": "#051D3F",
  Other: "#9aa0a6",
};

export interface SeatProjection {
  winner: string;
  margin: number | null;
  reform: number | null;
}

interface PollsSeatsFile {
  providers: Record<string, { status?: string; seats?: Record<string, Record<string, unknown>> }>;
}

const SHARE_KEYS = ["con_share", "lab_share", "ld_share", "reform_share", "green_share", "nat_share", "snp_share",
  "pc_share", "restore_share", "oth_share"];

export function projectionFromRow(code: string, row: Record<string, unknown>): SeatProjection {
  const shares = SHARE_KEYS.map((k) => row[k]).filter((v): v is number => typeof v === "number").sort((a, b) => b - a);
  const party = canonicalParty(String(row.projected_winner ?? ""), code) || "Other";
  return {
    winner: PARTY_COLORS[party] ? party : "Other",
    margin: shares.length > 1 ? Math.round((shares[0] - shares[1]) * 10) / 10 : null,
    reform: typeof row.reform_share === "number" ? row.reform_share : null,
  };
}

let projections: Promise<Map<string, SeatProjection>> | null = null;

/** Electoral Calculus first, More in Common for any seat EC lacks. */
export function loadProjections(): Promise<Map<string, SeatProjection>> {
  projections ??= fetch("/data/polls-seats.json")
    .then((r) => r.json() as Promise<PollsSeatsFile>)
    .then((file) => {
      const out = new Map<string, SeatProjection>();
      for (const provider of ["electoral_calculus", "more_in_common"]) {
        for (const [code, row] of Object.entries(file.providers[provider]?.seats ?? {})) {
          if (!out.has(code) && row.projected_winner) out.set(code, projectionFromRow(code, row));
        }
      }
      return out;
    });
  return projections;
}

export function pickKey(seat: VotingSeat | undefined): keyof typeof ENDORSE_COLORS {
  if (!seat) return "reform";
  if (seat.isOverride) return "override";
  if (seat.endorse === "restore") return "restore";
  if (seat.endorse === "none" || seat.endorse.startsWith("other:")) return "none";
  return "reform";
}

export const REFORM_CLASSES: Classes = classes(config.reformShare, config.palettes.reform, {
  unit: "Reform UK projected vote share, %", integer: false,
  source: "Electoral Calculus seat projection",
});

const state = (key: string, fallback: unknown): ExpressionSpecification =>
  ["coalesce", ["feature-state", key], fallback] as ExpressionSpecification;

export function fillColor(view: ElectionView): ExpressionSpecification {
  if (view === "reform") return stepExpression(state("ref", -1), { ...REFORM_CLASSES, colors: ["#e5e7eb", ...REFORM_CLASSES.colors], breaks: [0, ...REFORM_CLASSES.breaks] });
  if (view === "pick") {
    return ["match", state("pick", "reform"),
      ...Object.entries(ENDORSE_COLORS).flatMap(([k, v]) => [k, v.fill]), ENDORSE_COLORS.reform.fill] as ExpressionSpecification;
  }
  return ["match", state("w", "Other"),
    ...Object.entries(PARTY_COLORS).flatMap(([k, v]) => [k, v]), PARTY_COLORS.Other] as ExpressionSpecification;
}

/** Value-by-alpha for winners: 0-pt margin → 0.15, ≥20 pts → 0.92. */
export function fillOpacity(view: ElectionView): ExpressionSpecification | number {
  if (view === "pick") {
    return ["match", state("pick", "reform"),
      ...Object.entries(ENDORSE_COLORS).flatMap(([k, v]) => [k, v.fillOpacity]), ENDORSE_COLORS.reform.fillOpacity] as ExpressionSpecification;
  }
  if (view === "reform") return 0.85;
  return ["interpolate", ["linear"], state("m", 0), 0, 0.15, 20, 0.92] as ExpressionSpecification;
}

export function electionLegendHtml(view: ElectionView, tally: Map<string, number>, pickCounts?: Record<string, number>): string {
  if (view === "reform") return legendHtml(REFORM_CLASSES);
  if (view === "pick") {
    return swatchLegendHtml("Editorial pick", [
      [ENDORSE_COLORS.reform.fill, `Reform ${pickCounts?.reform ?? "–"}`],
      [ENDORSE_COLORS.restore.fill, `Restore ${pickCounts?.restore ?? "–"}`],
    ], "Partisan guide · never Labour or Conservative · not Electoral Commission advice");
  }
  const items = [...tally.entries()].sort((a, b) => b[1] - a[1])
    .map(([party, n]): [string, string] => [PARTY_COLORS[party] ?? PARTY_COLORS.Other, `${party.replace("Liberal Democrat", "Lib Dem")} ${n}`]);
  return swatchLegendHtml("Projected winner · opacity = margin", items, "Electoral Calculus (More in Common where missing)") +
    `<div class="legend-alpha"><span>marginal</span><i></i><span>safe (20+ pts)</span></div>`;
}
