/**
 * Tactical pick: "who to back to stop Labour" for one GB seat. Pure, no DOM, no fetch.
 *
 * Rule (no default party; any non-Labour party can be picked):
 *  1. A site-owner override in overrides.json wins (an override naming Labour is ignored).
 *  2. Trusted seat projections (Electoral Calculus, More in Common), per provider:
 *     projected winner if non-Labour, else the highest-projected non-Labour party
 *     (the challenger). Providers agree → that party, high confidence (medium with
 *     one provider). Providers disagree → the candidate with the highest mean
 *     projected share, low confidence.
 *  3. No projection → 2024 result: strongest non-Labour party. Medium confidence
 *     with a clear (10+ point) lead over the next non-Labour party, else low.
 * Labour is never returned.
 */
import { canonicalParty } from "./parties";

export type Confidence = "high" | "medium" | "low";
export type PickSource = "override" | "projection" | "results-2024" | "none";
export interface SourceLink { label: string; url: string }

export interface SeatProjectionRow { projected_winner?: string | null; [key: string]: unknown }
export interface ProjectionInput {
  provider: string;
  url?: string;
  fieldwork?: string;
  retrievedAt?: string;
  row: SeatProjectionRow;
}
/** 2024 result with canonical party names (largest first is not required). */
export interface Result2024Input { winner: string; shares: [string, number][]; url?: string }
export interface OverrideInput { party?: string; endorse?: string; note?: string; at?: string }
export interface TacticalInput {
  code: string;
  projections: ProjectionInput[];
  result2024?: Result2024Input;
  override?: OverrideInput | null;
}

export interface ProviderPick {
  provider: string;
  party: string;
  basis: "winner" | "challenger";
  share: number | null;
  winner: string;
  winnerShare: number | null;
}

export interface TacticalPick {
  party: string | null;
  confidence: Confidence;
  source: PickSource;
  reason: string;
  sources: SourceLink[];
  providerPicks: ProviderPick[];
}

export const CONFIDENCE_RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1 };
/** 2024 lead (points) over the next non-Labour party that counts as "clear". */
export const CLEAR_2024_MARGIN = 10;

const LABOUR_RE = /^(?:(?:scottish|welsh) )?(?:labour|lab)(?: party| co-?op| and co-operative(?: party)?)?$/i;
export function isLabour(party: string | null | undefined): boolean {
  return LABOUR_RE.test((party ?? "").trim());
}

/** Seat-projection share columns → canonical party. `nat` is SNP in Scotland, Plaid in Wales. */
function shareKey(party: string, code: string): string | null {
  switch (party) {
    case "Conservative": return "con_share";
    case "Labour": return "lab_share";
    case "Liberal Democrat": return "ld_share";
    case "Reform UK": return "reform_share";
    case "Green": return "green_share";
    case "Restore Britain": return "restore_share";
    case "SNP": return code.startsWith("S") ? "snp_share|nat_share" : null;
    case "Plaid Cymru": return code.startsWith("W") ? "pc_share|nat_share" : null;
    default: return "oth_share"; // Other, Independent, Speaker: only the combined column exists.
  }
}

const num = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;

export function projectedShare(row: SeatProjectionRow, party: string, code: string): number | null {
  const key = shareKey(party, code);
  if (!key) return null;
  for (const k of key.split("|")) {
    const value = num(row[k]);
    if (value !== null) return value;
  }
  return null;
}

/** Named parties with a share in this row (the combined "Other" column is excluded). */
export function projectedShares(row: SeatProjectionRow, code: string): [string, number][] {
  const parties = ["Conservative", "Labour", "Liberal Democrat", "Reform UK", "Green", "Restore Britain",
    ...(code.startsWith("S") ? ["SNP"] : code.startsWith("W") ? ["Plaid Cymru"] : [])];
  return parties.flatMap((p) => { const v = projectedShare(row, p, code); return v === null ? [] : [[p, v] as [string, number]]; })
    .sort((a, b) => b[1] - a[1]);
}

export function projectedWinner(row: SeatProjectionRow, code: string): string {
  const named = row.projected_winner ? canonicalParty(row.projected_winner, code) : "";
  return named || projectedShares(row, code)[0]?.[0] || "";
}

export function providerPick(projection: ProjectionInput, code: string): ProviderPick | null {
  const winner = projectedWinner(projection.row, code);
  const winnerShare = winner ? projectedShare(projection.row, winner, code) : null;
  if (winner && !isLabour(winner)) {
    return { provider: projection.provider, party: winner, basis: "winner", share: winnerShare, winner, winnerShare };
  }
  const challenger = projectedShares(projection.row, code).find(([p, v]) => !isLabour(p) && v > 0);
  if (!challenger) return null;
  return { provider: projection.provider, party: challenger[0], basis: "challenger", share: challenger[1], winner, winnerShare };
}

const pct = (n: number | null) => n === null ? "n/a" : `${Number.isInteger(n) ? n : n.toFixed(1)}%`;

function explain(p: ProviderPick): string {
  return p.basis === "winner"
    ? `${p.provider} projects ${p.party} to win (${pct(p.share)})`
    : `${p.provider} projects Labour to win (${pct(p.winnerShare)}), with ${p.party} the strongest challenger (${pct(p.share)})`;
}

function linksFor(projections: ProjectionInput[]): SourceLink[] {
  return projections.flatMap((p) => p.url ? [{ label: p.provider, url: p.url }] : []);
}

function fromProjections(input: TacticalInput): TacticalPick | null {
  const picks = input.projections.flatMap((p) => { const pick = providerPick(p, input.code); return pick ? [pick] : []; });
  if (!picks.length) return null;
  const parties = [...new Set(picks.map((p) => p.party))];
  const sources = linksFor(input.projections);
  let party: string;
  let confidence: Confidence;
  let reason: string;
  if (parties.length === 1) {
    party = parties[0];
    confidence = picks.length >= 2 ? "high" : "medium";
    reason = picks.length >= 2
      ? `Both seat projections point to ${party}. ${picks.map(explain).join("; ")}.`
      : `Only one seat projection is available. ${explain(picks[0])}.`;
  } else {
    // Disagreement: highest mean projected share among the parties the providers named.
    const mean = (p: string) => {
      const values = input.projections.flatMap((proj) => { const v = projectedShare(proj.row, p, input.code); return v === null ? [] : [v]; });
      return values.length ? values.reduce((a, b) => a + b, 0) / values.length : -1;
    };
    party = parties.map((p) => [p, mean(p)] as const).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
    confidence = "low";
    reason = `Seat projections disagree. ${picks.map(explain).join("; ")}. ${party} has the higher average projected share across providers (${pct(Math.round(mean(party) * 10) / 10)}).`;
  }
  // A large combined "Other" vote may hide an independent challenger the columns cannot name.
  if (party !== "Other" && picks.every((p) => p.basis === "challenger")) {
    const others = input.projections.map((p) => [p.provider, num(p.row.oth_share)] as const)
      .filter(([, v]) => v !== null && v > (picks.find((x) => x.party === party)?.share ?? 0));
    if (others.length) {
      confidence = "low";
      reason += ` Note: ${others.map(([p, v]) => `${p} has others/independents combined on ${pct(v)}`).join("; ")}, which may include a stronger local challenger.`;
    }
  }
  if (party === "Speaker") reason += " This is the Speaker's seat; by convention the main parties often do not stand.";
  return { party, confidence, source: "projection", reason, sources, providerPicks: picks };
}

function fromResults(result: Result2024Input): TacticalPick | null {
  const ranked = result.shares.filter(([p]) => !isLabour(p) && p !== "Other").sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return null;
  const [[party, share], next] = ranked;
  const margin = next ? share - next[1] : share;
  const confidence: Confidence = margin >= CLEAR_2024_MARGIN ? "medium" : "low";
  const reason = `No seat projection is available, so this uses the 2024 result: ${party} was the strongest non-Labour party on ${pct(share)}` +
    (next ? `, ${pct(Math.round(margin * 10) / 10)} ahead of ${next[0]}.` : ".");
  return { party, confidence, source: "results-2024", reason, sources: result.url ? [{ label: "2024 results (House of Commons Library)", url: result.url }] : [], providerPicks: [] };
}

/** Canonical party named by an override (supports the legacy `endorse` field). */
export function overrideParty(override: OverrideInput): string | null {
  const raw = (override.party ?? override.endorse ?? "").trim();
  if (!raw || /^none$/i.test(raw)) return null;
  if (/^reform$/i.test(raw)) return "Reform UK";
  if (/^restore$/i.test(raw)) return "Restore Britain";
  return canonicalParty(raw.replace(/^other:/i, ""));
}

export function decideTacticalPick(input: TacticalInput): TacticalPick {
  const automatic: TacticalPick = fromProjections(input) ?? (input.result2024 ? fromResults(input.result2024) : null) ?? {
    party: null, confidence: "low", source: "none",
    reason: "No projection or 2024 result data names a non-Labour party here.", sources: [], providerPicks: [],
  };
  const override = input.override;
  if (!override) return automatic;
  const party = overrideParty(override);
  if (!party) return automatic;
  if (isLabour(party)) {
    return { ...automatic, reason: `${automatic.reason} (An override naming Labour was ignored.)` };
  }
  const agrees = automatic.party === party;
  const note = override.note?.trim();
  return {
    ...automatic,
    party,
    source: "override",
    confidence: agrees ? automatic.confidence : "low",
    reason: `Site owner override${note ? `: ${note}` : ""}${override.at ? ` (${override.at})` : ""}. ` +
      (agrees ? `The data-based rule agrees. ${automatic.reason}` : `The data-based rule would pick ${automatic.party ?? "no party"}. ${automatic.reason}`),
  };
}
