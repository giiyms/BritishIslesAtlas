/**
 * Pure anti-split endorsement decision tree for GB Westminster seats.
 * Locked rules (Daniel 2026-10-02): never Lab/Con; Daniel overrides win;
 * Restore only when confirmed standing AND trusted seat poll shows it the
 * stronger Lab/Con-beater; otherwise Reform (including presumed Reform).
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

function normParty(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function isLabOrCon(value: string | null | undefined): boolean {
  // Any word token, so "Scottish Labour" / "The Conservative Party" / "other:Tories" are caught.
  return normParty(value).split(/[^a-z]+/).some((token) => LAB_CON.has(token));
}

function scoreParty(poll: SeatPollRow, party: "reform" | "restore"): number {
  const share = party === "reform" ? poll.reformShare : poll.restoreShare;
  if (typeof share === "number" && Number.isFinite(share)) return share;
  const winner = normParty(poll.projectedWinner);
  if (!winner) return 0;
  if (party === "reform" && (winner === "reform" || winner.includes("reform"))) return 1;
  if (party === "restore" && (winner === "restore" || winner.includes("restore"))) return 1;
  return 0;
}

function maxLabCon(poll: SeatPollRow): number {
  const lab = typeof poll.labShare === "number" ? poll.labShare : 0;
  const con = typeof poll.conShare === "number" ? poll.conShare : 0;
  return Math.max(lab, con);
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

function preferRestoreFromPolls(polls: SeatPollRow[]): boolean {
  if (polls.length === 0) return false;
  let restoreBetter = 0;
  let reformBetter = 0;
  let anyCompetitiveRestore = false;

  for (const poll of polls) {
    const sRestore = scoreParty(poll, "restore");
    const sReform = scoreParty(poll, "reform");
    if (sRestore <= 0 && sReform <= 0) continue;
    if (sRestore > sReform) {
      restoreBetter += 1;
      const bestAnti = Math.max(sRestore, sReform);
      const labCon = maxLabCon(poll);
      const winner = normParty(poll.projectedWinner);
      const restoreWins = winner.includes("restore");
      if (restoreWins || (labCon > 0 && bestAnti + 5 >= labCon) || sRestore >= sReform) {
        anyCompetitiveRestore = true;
      }
    } else if (sReform > sRestore) {
      reformBetter += 1;
    }
  }

  // Unique better Lab/Con-beater: restore ahead on at least one trusted poll,
  // and not clearly behind Reform on every scored poll.
  if (restoreBetter > 0 && restoreBetter > reformBetter && anyCompetitiveRestore) {
    return true;
  }
  return false;
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

  const { reform, restore } = input.standing;

  // 2. Explicitly neither standing
  if (reform === "no" && restore === "no") {
    return {
      ...base,
      endorse: "none",
      reason: "No Reform/Restore candidate confirmed",
      isOverride: false,
      presumedReform: false,
    };
  }

  // 3. Restore not standing / unknown → Reform (presumed if Reform unknown)
  if (restore === "no" || restore === "unknown") {
    if (reform === "yes" || reform === "unknown") {
      const presumed = reform === "unknown";
      return {
        ...base,
        endorse: "reform",
        reason: presumed
          ? "Restore not confirmed; presumed Reform — confirm nearer nomination"
          : "Restore not standing; default Reform",
        isOverride: false,
        presumedReform: presumed,
      };
    }
  }

  // 4. Only Restore among target parties
  if (reform === "no" && restore === "yes") {
    return {
      ...base,
      endorse: "restore",
      reason: "Only Restore standing among target parties",
      isOverride: false,
      presumedReform: false,
    };
  }

  // 5. Both standing
  if (reform === "yes" && restore === "yes") {
    if (preferRestoreFromPolls(polls)) {
      return {
        ...base,
        endorse: "restore",
        reason: "Both standing; seat poll shows Restore the stronger Lab/Con-beater",
        isOverride: false,
        presumedReform: false,
      };
    }
    const missing = polls.length === 0;
    return {
      ...base,
      endorse: "reform",
      reason: missing
        ? "Both standing; no seat poll loaded — default Reform (anti-split)"
        : "Both standing; polls inconclusive — default Reform (anti-split)",
      isOverride: false,
      presumedReform: false,
    };
  }

  // Fallback (should be unreachable): presumed Reform
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

/** Map colour tokens — distinct, non Lab-red / Con-blue. */
export const ENDORSE_COLORS = {
  reform: { fill: "#c4922a", accent: "#a6791c", label: "VOTE REFORM" },
  restore: { fill: "#6b4c9a", accent: "#563c7c", label: "VOTE RESTORE" },
  none: { fill: "#8b939e", accent: "#6f7884", label: "NO ENDORSE" },
  override: { fill: "#c45c8a", accent: "#a34870", label: "OVERRIDE" },
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
