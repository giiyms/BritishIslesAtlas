/**
 * Tactical pick: "who to back to stop Labour" for one UK seat. Pure, no DOM, no fetch.
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
 * Labour and Green are never returned (owner rule).
 *
 * Northern Ireland (PCON24CD N*): Labour does not stand, so there is nothing to stop.
 * When no input shows a Labour vote, the pick is the projected winner (else the 2024
 * winner), flagged `noLabour` so the card says so plainly. Overrides still win.
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
  /** Northern Ireland seat with no Labour candidate: the stop-Labour rule does not apply. */
  noLabour?: boolean;
}

export const isNorthernIreland = (code: string): boolean => code.startsWith("N");

/** Electoral Calculus Northern Ireland share keys (`ni_shares`, `chances`) → canonical party. */
export const NI_SHARE_KEYS: Record<string, string> = {
  DUP: "dup", "Sinn Féin": "sf", SDLP: "sdlp", UUP: "uup", Alliance: "alliance", TUV: "tuv", Independent: "ind",
};

export const CONFIDENCE_RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1 };
/** 2024 lead (points) over the next non-Labour party that counts as "clear". */
export const CLEAR_2024_MARGIN = 10;

const LABOUR_RE = /^(?:(?:scottish|welsh) )?(?:labour|lab)(?: party| co-?op| and co-operative(?: party)?)?$/i;
export function isLabour(party: string | null | undefined): boolean {
  return LABOUR_RE.test((party ?? "").trim());
}

const GREEN_RE = /^(?:(?:scottish|welsh) )?green(?: party)?$/i;
export function isGreen(party: string | null | undefined): boolean {
  return GREEN_RE.test((party ?? "").trim());
}

/** Parties the site owner never wants picked: Labour and Green (owner rule, 2026-10-31). */
export function isExcluded(party: string | null | undefined): boolean {
  return isLabour(party) || isGreen(party);
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
  if (isNorthernIreland(code)) {
    if (party === "Other") return num(row.oth_share);
    const ni = row.ni_shares as Record<string, unknown> | undefined;
    const k = NI_SHARE_KEYS[party];
    return k && ni ? num(ni[k]) : null;
  }
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
  const parties = isNorthernIreland(code) ? Object.keys(NI_SHARE_KEYS) : ["Conservative", "Labour", "Liberal Democrat", "Reform UK", "Green", "Restore Britain",
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
  if (winner && !isExcluded(winner)) {
    return { provider: projection.provider, party: winner, basis: "winner", share: winnerShare, winner, winnerShare };
  }
  const challenger = projectedShares(projection.row, code).find(([p, v]) => !isExcluded(p) && v > 0);
  if (!challenger) return null;
  return { provider: projection.provider, party: challenger[0], basis: "challenger", share: challenger[1], winner, winnerShare };
}

const pct = (n: number | null) => n === null ? "n/a" : `${Number.isInteger(n) ? n : n.toFixed(1)}%`;

function explain(p: ProviderPick): string {
  return p.basis === "winner"
    ? `${p.provider} projects ${p.party} to win (${pct(p.share)})`
    : `${p.provider} projects ${p.winner || "Labour"} to win (${pct(p.winnerShare)}), with ${p.party} the strongest challenger (${pct(p.share)})`;
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
  const ranked = result.shares.filter(([p]) => !isExcluded(p) && p !== "Other").sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return null;
  const [[party, share], next] = ranked;
  const margin = next ? share - next[1] : share;
  const confidence: Confidence = margin >= CLEAR_2024_MARGIN ? "medium" : "low";
  const reason = `No seat projection is available, so this uses the 2024 result: ${party} was the strongest party other than Labour and Green on ${pct(share)}` +
    (next ? `, ${pct(Math.round(margin * 10) / 10)} ahead of ${next[0]}.` : ".");
  return { party, confidence, source: "results-2024", reason, sources: result.url ? [{ label: "2024 results (House of Commons Library)", url: result.url }] : [], providerPicks: [] };
}

/** Win probability EC gives `party` in an NI row (0..1), if published. */
function niChance(row: SeatProjectionRow, party: string): number | null {
  const chances = row.chances as Record<string, unknown> | undefined;
  const k = party === "Other" ? "oth" : NI_SHARE_KEYS[party];
  return k && chances ? num(chances[k]) : null;
}

const NO_LABOUR = "Labour does not stand in Northern Ireland, so the stop-Labour rule does not apply here.";

function result2024Text(result: Result2024Input | undefined): string {
  if (!result) return "";
  const ranked = [...result.shares].filter(([p]) => p !== "Other").sort((a, b) => b[1] - a[1]);
  const won = ranked.find(([p]) => p === result.winner) ?? ranked[0];
  const second = ranked.find(([p]) => p !== won?.[0]);
  return won ? ` In 2024 ${won[0]} won on ${pct(won[1])}${second ? `, ahead of ${second[0]} on ${pct(second[1])}` : ""}.` : "";
}

/** A Labour vote anywhere in the inputs means the normal stop-Labour rule applies. */
function labourStands(input: TacticalInput): boolean {
  return input.projections.some((p) => (projectedShare(p.row, "Labour", input.code) ?? 0) > 0) ||
    (input.result2024?.shares ?? []).some(([p, v]) => isLabour(p) && v > 0);
}

function fromNorthernIreland(input: TacticalInput): TacticalPick | null {
  const resultLinks = input.result2024?.url ? [{ label: "2024 results (House of Commons Library)", url: input.result2024.url }] : [];
  const r2024 = result2024Text(input.result2024);
  const picks = input.projections.flatMap((p) => { const pick = providerPick(p, input.code); return pick ? [pick] : []; });
  if (picks.length) {
    const pick = picks[0];
    const chance = niChance(input.projections[0].row, pick.party);
    const confidence: Confidence = chance !== null && chance < 0.6 ? "low" : "medium";
    return {
      party: pick.party, confidence, source: "projection", noLabour: true,
      reason: `${NO_LABOUR} Shown instead: the projected winner. ${explain(pick)}${chance !== null ? `, win probability ${Math.round(chance * 100)}%` : ""}.${r2024}`,
      sources: [...linksFor(input.projections), ...resultLinks], providerPicks: picks,
    };
  }
  const fallback = input.result2024 ? fromResults(input.result2024) : null;
  if (!fallback) return null;
  return {
    ...fallback, noLabour: true,
    reason: `${NO_LABOUR} No seat projection is available, so this shows the 2024 result.${r2024}`,
  };
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
  const ni = isNorthernIreland(input.code) && !labourStands(input) ? fromNorthernIreland(input) : null;
  const automatic: TacticalPick = ni ?? fromProjections(input) ?? (input.result2024 ? fromResults(input.result2024) : null) ?? {
    party: null, confidence: "low", source: "none",
    reason: "No projection or 2024 result data names a party other than Labour or Green here.", sources: [], providerPicks: [],
  };
  const override = input.override;
  if (!override) return automatic;
  const party = overrideParty(override);
  if (!party) return automatic;
  if (isExcluded(party)) {
    return { ...automatic, reason: `${automatic.reason} (An override naming ${isGreen(party) ? "Green" : "Labour"} was ignored.)` };
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
