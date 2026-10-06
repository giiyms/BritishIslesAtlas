/**
 * Pure anti-split endorsement decision tree for GB Westminster seats.
 * Locked rules (Daniel 2026-10-05): never Lab/Con; Daniel overrides win first;
 * if ANY trusted seat poll (Electoral Calculus / More in Common) has Restore
 * share strictly ahead of Reform → Restore (even without a DC-confirmed Restore
 * candidate); otherwise Reform default/presumed.
 */

export type Standing = "yes" | "no" | "unknown";
export type EndorsePick = "reform" | "restore" | "none";

export interface SeatCandidateStanding {
  reform: Standing;
  restore: Standing;
  reformName?: string | null;
  restoreName?: string | null;
}

export interface SeatPollRow {
  provider: string;
  reformShare?: number | null;
  restoreShare?: number | null;
  labShare?: number | null;
  conShare?: number | null;
  projectedWinner?: string | null;
  fieldwork?: string | null;
  url?: string | null;
}

export interface SeatOverride {
  pcon24cd: string;
  endorse: EndorsePick | `other:${string}`;
  note?: string;
  by?: string;
  at?: string;
}

export interface EndorseInput {
  standing: SeatCandidateStanding;
  polls?: SeatPollRow[];
  override?: SeatOverride | null;
}

export interface EndorseResult {
  endorse: EndorsePick | `other:${string}`;
  reason: string;
  isOverride: boolean;
  presumedReform: boolean;
  longShot: boolean;
  thirdPartyLead: string | null;
  neverLabCon: true;
}

const LAB_CON = new Set(["labour", "lab", "conservative", "con", "tory", "conservatives", "tories"]);

/** Trusted seat-poll providers (EC + MIC). Unknown providers are ignored for the Restore-ahead gate. */
const TRUSTED_PROVIDER_RE =
  /electoral[_\s-]?calculus|^ec$|more[_\s-]?in[_\s-]?common|^mic$/i;

function normParty(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function isLabOrCon(value: string | null | undefined): boolean {
  // Any word token, so "Scottish Labour" / "The Conservative Party" / "other:Tories" are caught.
  return normParty(value).split(/[^a-z]+/).some((token) => LAB_CON.has(token));
}

function isTrustedProvider(provider: string | null | undefined): boolean {
  return TRUSTED_PROVIDER_RE.test((provider ?? "").trim());
}

function numericShare(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Restore strictly ahead of Reform on this poll (both shares must be numeric). */
function restoreStrictlyAhead(poll: SeatPollRow): boolean {
  const restore = numericShare(poll.restoreShare);
  const reform = numericShare(poll.reformShare);
  if (restore === null || reform === null) return false;
  return restore > reform;
}

/** Reform strictly ahead of Restore on this poll (both shares must be numeric). */
function reformStrictlyAhead(poll: SeatPollRow): boolean {
  const restore = numericShare(poll.restoreShare);
  const reform = numericShare(poll.reformShare);
  if (restore === null || reform === null) return false;
  return reform > restore;
}

function providerLabel(provider: string): string {
  const p = provider.trim();
  if (/more[_\s-]?in[_\s-]?common|^mic$/i.test(p)) return "More in Common";
  if (/electoral[_\s-]?calculus|^ec$/i.test(p)) return "Electoral Calculus";
  return p || "Seat poll";
}

export interface RestoreAheadDetail {
  ahead: boolean;
  disagree: boolean;
  /** First trusted poll where Restore > Reform (for reason copy). */
  lead?: { provider: string; restore: number; reform: number };
}

/**
 * New locked rule: ANY trusted provider with restore_share > reform_share
 * flips to Restore. No standing prerequisite. Sources that disagree still
 * resolve to Restore ("a trusted seat poll").
 */
export function restoreAheadFromPolls(polls: SeatPollRow[]): RestoreAheadDetail {
  const trusted = polls.filter((p) => isTrustedProvider(p.provider));
  let lead: RestoreAheadDetail["lead"];
  let anyRestoreAhead = false;
  let anyReformAhead = false;

  for (const poll of trusted) {
    if (restoreStrictlyAhead(poll)) {
      anyRestoreAhead = true;
      if (!lead) {
        lead = {
          provider: providerLabel(poll.provider),
          restore: numericShare(poll.restoreShare) as number,
          reform: numericShare(poll.reformShare) as number,
        };
      }
    } else if (reformStrictlyAhead(poll)) {
      anyReformAhead = true;
    }
  }

  return {
    ahead: anyRestoreAhead,
    disagree: anyRestoreAhead && anyReformAhead,
    lead,
  };
}

/** @deprecated alias kept for call-site clarity in tests; same as restoreAheadFromPolls(...).ahead */
export function preferRestoreFromPolls(polls: SeatPollRow[]): boolean {
  return restoreAheadFromPolls(polls).ahead;
}

function formatPct(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
}

function restoreAheadReason(detail: RestoreAheadDetail): string {
  const lead = detail.lead;
  if (!lead) {
    return "Trusted seat poll projects Restore ahead of Reform; Vote Restore to avoid splitting.";
  }
  const core = `${lead.provider} projects Restore ahead of Reform here (${formatPct(lead.restore)}% vs ${formatPct(lead.reform)}%); Vote Restore to avoid splitting.`;
  if (detail.disagree) {
    return `${core} Trusted seat-poll sources disagree — Restore still wins on the Restore-ahead rule.`;
  }
  return core;
}

function pollsFavourReform(polls: SeatPollRow[]): boolean {
  const trusted = polls.filter((p) => isTrustedProvider(p.provider));
  if (trusted.length === 0) return false;
  let anyReform = false;
  for (const poll of trusted) {
    if (restoreStrictlyAhead(poll)) return false;
    if (reformStrictlyAhead(poll)) anyReform = true;
    // Provider with only reform share (EC: restore null) and positive reform also counts as favouring Reform
    const restore = numericShare(poll.restoreShare);
    const reform = numericShare(poll.reformShare);
    if (restore === null && reform !== null && reform > 0) anyReform = true;
  }
  return anyReform;
}


function projectedThirdParty(polls: SeatPollRow[]): string | null {
  for (const poll of polls) {
    const winner = poll.projectedWinner?.trim();
    if (!winner) continue;
    const n = normParty(winner);
    if (n.includes("reform") || n.includes("restore")) continue;
    if (isLabOrCon(winner)) continue;
    return winner;
  }
  return null;
}

function allSafeLabOrCon(polls: SeatPollRow[]): boolean {
  if (polls.length === 0) return false;
  return polls.every((poll) => {
    const winner = normParty(poll.projectedWinner);
    if (winner && isLabOrCon(winner)) return true;
    const lab = poll.labShare ?? 0;
    const con = poll.conShare ?? 0;
    const ref = poll.reformShare ?? 0;
    const res = poll.restoreShare ?? 0;
    const lead = Math.max(lab, con);
    return lead > 0 && lead >= ref + 15 && lead >= res + 15;
  });
}

/**
 * Decide who to endorse for a single seat. Never returns Labour or Conservatives.
 */
export function decideEndorsement(input: EndorseInput): EndorseResult {
  const polls = input.polls ?? [];
  const thirdPartyLead = projectedThirdParty(polls);
  const longShot = allSafeLabOrCon(polls);

  const base = {
    neverLabCon: true as const,
    thirdPartyLead,
    longShot,
  };

  // 1. Daniel override always wins
  if (input.override) {
    const pick = input.override.endorse;
    const pickCore = typeof pick === "string" && pick.startsWith("other:")
      ? pick.slice("other:".length)
      : pick;
    const pickText = String(pick);
    if (
      pickText === "labour" ||
      pickText === "conservative" ||
      isLabOrCon(pickText) ||
      isLabOrCon(String(pickCore))
    ) {
      // Hard safety: never honour a Lab/Con override value
      return {
        ...base,
        endorse: "none",
        reason: "Override rejected — never endorse Labour or Conservatives",
        isOverride: true,
        presumedReform: false,
      };
    }
    const note = input.override.note?.trim();
    return {
      ...base,
      endorse: pick,
      reason: note
        ? `Daniel override: ${note}`
        : "Daniel override",
      isOverride: true,
      presumedReform: false,
    };
  }

  // 2. Restore-ahead poll rule (no DC standing prerequisite)
  const restoreAhead = restoreAheadFromPolls(polls);
  if (restoreAhead.ahead) {
    return {
      ...base,
      endorse: "restore",
      reason: restoreAheadReason(restoreAhead),
      isOverride: false,
      presumedReform: false,
    };
  }

  const { reform, restore } = input.standing;

  // 3. Explicitly neither standing
  if (reform === "no" && restore === "no") {
    return {
      ...base,
      endorse: "none",
      reason: "No Reform/Restore candidate confirmed",
      isOverride: false,
      presumedReform: false,
    };
  }

  // 4. Restore not standing / unknown → Reform (presumed if Reform unknown)
  if (restore === "no" || restore === "unknown") {
    if (reform === "yes" || reform === "unknown") {
      const presumed = reform === "unknown";
      const restoreUnknown = restore === "unknown";
      let reason: string;
      if (restoreUnknown) {
        reason = presumed
          ? "Restore not confirmed; presumed Reform — confirm nearer nomination"
          : "Restore not confirmed; default Reform";
      } else {
        reason = presumed
          ? "Restore not standing; presumed Reform — confirm nearer nomination"
          : "Restore not standing; default Reform";
      }
      return {
        ...base,
        endorse: "reform",
        reason,
        isOverride: false,
        presumedReform: presumed,
      };
    }
  }

  // 5. Only Restore among target parties
  if (reform === "no" && restore === "yes") {
    return {
      ...base,
      endorse: "restore",
      reason: "Only Restore standing among target parties",
      isOverride: false,
      presumedReform: false,
    };
  }

  // 6. Both standing (Restore-ahead already handled above)
  if (reform === "yes" && restore === "yes") {
    const missing = polls.length === 0;
    const favourReform = pollsFavourReform(polls);
    let reason: string;
    if (missing) {
      reason = "Both standing; no seat poll loaded — default Reform (anti-split)";
    } else if (favourReform) {
      reason = "Both standing; seat polls favour Reform — default Reform (anti-split)";
    } else {
      reason = "Both standing; no Restore-ahead seat poll — default Reform (anti-split)";
    }
    return {
      ...base,
      endorse: "reform",
      reason,
      isOverride: false,
      presumedReform: false,
    };
  }

  // Fallback: presumed Reform
  return {
    ...base,
    endorse: "reform",
    reason: "Default Reform (anti-split)",
    isOverride: false,
    presumedReform: true,
  };
}

export function assertNeverLabCon(result: EndorseResult): void {
  const pick = String(result.endorse).toLowerCase();
  if (isLabOrCon(pick) || pick.startsWith("other:lab") || pick.startsWith("other:con")) {
    throw new Error(`Endorse engine returned forbidden pick: ${result.endorse}`);
  }
  if (!result.neverLabCon) {
    throw new Error("Endorse result missing neverLabCon flag");
  }
}

/**
 * Map colour tokens (style roast 2026-10-05 §2 fix 1). Reform = party turquoise as
 * the light 631-seat default; Restore = party navy as the dark headline exception.
 * `badge` is the WCAG-AA background for white CTA text (never white on #12B6CF).
 * Lab red / Con blue hexes are still forbidden (see endorse.test.ts).
 */
export const ENDORSE_COLORS = {
  reform: { fill: "#12B6CF", accent: "#0B6E7D", badge: "#0B6E7D", fillOpacity: 0.34, label: "VOTE REFORM" },
  restore: { fill: "#051D3F", accent: "#051D3F", badge: "#051D3F", fillOpacity: 0.88, label: "VOTE RESTORE" },
  none: { fill: "#8b939e", accent: "#6f7884", badge: "#5d6572", fillOpacity: 0.45, label: "NO ENDORSE" },
  override: { fill: "#c45c8a", accent: "#a34870", badge: "#a34870", fillOpacity: 0.34, label: "OVERRIDE" },
} as const;

export function colorForEndorse(
  endorse: EndorseResult["endorse"],
  isOverride: boolean,
): (typeof ENDORSE_COLORS)[keyof typeof ENDORSE_COLORS] {
  if (isOverride) return ENDORSE_COLORS.override;
  if (endorse === "restore") return ENDORSE_COLORS.restore;
  if (endorse === "reform") return ENDORSE_COLORS.reform;
  return ENDORSE_COLORS.none;
}

