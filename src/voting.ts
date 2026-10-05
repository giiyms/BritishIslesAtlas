import {
  colorForEndorse,
  decideEndorsement,
  type EndorsePick,
  type SeatOverride,
  type SeatPollRow,
  ENDORSE_COLORS,
} from "./endorse";

export interface VotingSeat {
  pcon24cd: string;
  pcon24nm: string;
  endorse: EndorsePick | `other:${string}`;
  reason: string;
  isOverride: boolean;
  presumedReform: boolean;
  thirdPartyLead: string | null;
  reform?: { standing?: string; name?: string | null; wcivf_url?: string | null; dc_person_url?: string | null };
  restore?: { standing?: string; name?: string | null; wcivf_url?: string | null; dc_person_url?: string | null };
  polls?: Array<{
    provider: string;
    provider_label?: string;
    reform_share?: number | null;
    restore_share?: number | null;
    lab_share?: number | null;
    con_share?: number | null;
    projected_winner?: string | null;
    fieldwork?: string | null;
    url?: string | null;
  }>;
  winner2024?: string | null;
}

export interface EndorsementsFile {
  retrieved_at: string;
  counts: Record<string, number>;
  seats: Record<string, VotingSeat>;
  notes?: string[];
}

export interface NationalPollsFile {
  retrieved_at: string;
  source_url?: string;
  rolling_average?: {
    n: number;
    lab?: number | null;
    con?: number | null;
    ref?: number | null;
    ld?: number | null;
    grn?: number | null;
    rb?: number | null;
    method?: string;
  };
  polls?: Array<{ pollster: string; fieldwork: string; lab?: number | null; con?: number | null; ref?: number | null; rb?: number | null }>;
}

export interface VotingBundle {
  endorsements: EndorsementsFile;
  national: NationalPollsFile | null;
  overrides: { overrides: SeatOverride[] };
}

let cached: VotingBundle | null = null;

export async function loadVotingBundle(): Promise<VotingBundle> {
  if (cached) return cached;
  const [endorsements, national, overrides] = await Promise.all([
    fetch("/data/endorsements-gb.json").then((r) => r.json() as Promise<EndorsementsFile>),
    fetch("/data/polls-national.json").then((r) => (r.ok ? r.json() : null) as Promise<NationalPollsFile | null>),
    fetch("/data/overrides.json").then((r) => (r.ok ? r.json() : { overrides: [] })),
  ]);
  cached = { endorsements, national, overrides };
  return cached;
}

export function fillColorExpression(): unknown {
  // Data-driven colours from feature properties set at load.
  return [
    "match",
    ["get", "endorseColor"],
    "reform", ENDORSE_COLORS.reform.fill,
    "restore", ENDORSE_COLORS.restore.fill,
    "none", ENDORSE_COLORS.none.fill,
    "override", ENDORSE_COLORS.override.fill,
    ENDORSE_COLORS.reform.fill,
  ];
}

export function outlineColorExpression(): unknown {
  return [
    "match",
    ["get", "endorseColor"],
    "reform", ENDORSE_COLORS.reform.accent,
    "restore", ENDORSE_COLORS.restore.accent,
    "none", ENDORSE_COLORS.none.accent,
    "override", ENDORSE_COLORS.override.accent,
    ENDORSE_COLORS.reform.accent,
  ];
}

type FeatureCollection = {
  type: "FeatureCollection";
  features: Array<{ type: string; properties?: Record<string, unknown> | null; geometry?: unknown }>;
};

export function enrichConstituencies(
  geojson: FeatureCollection,
  seats: Record<string, VotingSeat>,
): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: geojson.features.map((feature) => {
      const props = { ...(feature.properties ?? {}) } as Record<string, unknown>;
      const code = String(props.PCON24CD ?? "");
      const seat = seats[code];
      const colorKey = seat?.isOverride
        ? "override"
        : seat?.endorse === "restore"
          ? "restore"
          : seat?.endorse === "none" || (typeof seat?.endorse === "string" && seat.endorse.startsWith("other:"))
            ? "none"
            : "reform";
      props.endorse = seat?.endorse ?? "reform";
      props.endorseColor = colorKey;
      props.endorseReason = seat?.reason ?? "";
      props.isOverride = seat?.isOverride ? 1 : 0;
      return { ...feature, properties: props };
    }),
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function candidateLine(label: string, row?: VotingSeat["reform"]): string {
  const standing = row?.standing ?? "unknown";
  const name = row?.name?.trim();
  if (standing === "yes" && name) {
    const link = row?.wcivf_url || row?.dc_person_url;
    const nameHtml = link
      ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(name)}</a>`
      : escapeHtml(name);
    return `<div class="popup-cand"><span class="popup-cand-party">${escapeHtml(label)}</span> ${nameHtml}</div>`;
  }
  if (standing === "no") {
    return `<div class="popup-cand"><span class="popup-cand-party">${escapeHtml(label)}</span> not standing</div>`;
  }
  return `<div class="popup-cand"><span class="popup-cand-party">${escapeHtml(label)}</span> not confirmed</div>`;
}

function pollRowsHtml(seat: VotingSeat): string {
  const polls = seat.polls ?? [];
  if (polls.length === 0) {
    return `<div class="popup-note">No seat poll loaded</div>`;
  }
  return polls.slice(0, 3).map((poll) => {
    const label = poll.provider_label ?? poll.provider;
    const winner = poll.projected_winner ?? "—";
    const date = poll.fieldwork ?? "";
    const ref = poll.reform_share != null ? `Ref ${poll.reform_share}%` : "";
    const res = poll.restore_share != null ? `RB ${poll.restore_share}%` : "RB —";
    const bits = [ref, res].filter(Boolean).join(" · ");
    const link = poll.url
      ? `<a href="${escapeHtml(poll.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
      : escapeHtml(label);
    return `<div class="popup-poll">${link}: <strong>${escapeHtml(String(winner))}</strong>${bits ? ` · ${escapeHtml(bits)}` : ""}${date ? `<span class="popup-poll-date">${escapeHtml(date)}</span>` : ""}</div>`;
  }).join("");
}

export function constituencyPopupHtml(seat: VotingSeat, retrievedAt: string): string {
  // Recompute via pure tree for reason consistency (uses baked seat standing/polls)
  const pollInputs: SeatPollRow[] = (seat.polls ?? []).map((p) => ({
    provider: p.provider,
    reformShare: p.reform_share,
    restoreShare: p.restore_share,
    labShare: p.lab_share,
    conShare: p.con_share,
    projectedWinner: p.projected_winner,
    fieldwork: p.fieldwork,
    url: p.url,
  }));
  const result = decideEndorsement({
    standing: {
      reform: (seat.reform?.standing as "yes" | "no" | "unknown") ?? "unknown",
      restore: (seat.restore?.standing as "yes" | "no" | "unknown") ?? "unknown",
      reformName: seat.reform?.name,
      restoreName: seat.restore?.name,
    },
    polls: pollInputs,
    override: seat.isOverride
      ? { pcon24cd: seat.pcon24cd, endorse: seat.endorse, note: seat.reason.replace(/^Daniel override:\s*/, "") }
      : null,
  });
  const colors = colorForEndorse(result.endorse, result.isOverride);
  const voteLabel = result.isOverride
    ? ENDORSE_COLORS.override.label
    : result.endorse === "restore"
      ? ENDORSE_COLORS.restore.label
      : result.endorse === "none" || String(result.endorse).startsWith("other:")
        ? ENDORSE_COLORS.none.label
        : ENDORSE_COLORS.reform.label;

  const third = result.thirdPartyLead
    ? `<div class="popup-note">Polls currently project ${escapeHtml(result.thirdPartyLead)} ahead; endorsement is anti-split among Reform/Restore, not a win-probability maximiser across all parties.</div>`
    : "";

  const winner2024 = seat.winner2024
    ? `<div class="popup-meta">2024 winner: ${escapeHtml(seat.winner2024)}</div>`
    : `<div class="popup-meta">2024 winner: follow-up (Commons Library CBP-10009 join pending)</div>`;

  const date = retrievedAt ? retrievedAt.slice(0, 10) : "";
  const ballot =
    seat.reform?.wcivf_url ||
    seat.restore?.wcivf_url ||
    `https://whocanivotefor.co.uk/`;

  return (
    `<div class="vote-popup">` +
    `<strong>${escapeHtml(seat.pcon24nm)}</strong>` +
    `<div class="popup-meta">${escapeHtml(seat.pcon24cd)}</div>` +
    `<div class="vote-badge" style="--vote:${colors.fill}">${escapeHtml(voteLabel)}</div>` +
    `<div class="popup-reason">${escapeHtml(result.reason)}</div>` +
    (result.isOverride ? `<div class="popup-override">Daniel override</div>` : "") +
    `<div class="popup-section">Candidates</div>` +
    candidateLine("Reform", seat.reform) +
    candidateLine("Restore", seat.restore) +
    winner2024 +
    `<div class="popup-section">Seat polls</div>` +
    pollRowsHtml(seat) +
    third +
    (date ? `<div class="popup-note">Polls updated ${escapeHtml(date)}</div>` : "") +
    `<div class="popup-links">` +
    `<a href="${escapeHtml(ballot)}" target="_blank" rel="noopener noreferrer">WhoCanIVoteFor</a>` +
    ` · <a href="https://candidates.democracyclub.org.uk/" target="_blank" rel="noopener noreferrer">Democracy Club</a>` +
    `</div>` +
    `<div class="popup-disclaimer">Editorial endorsement map — not Electoral Commission advice.</div>` +
    `</div>`
  );
}

export function formatPollsUpdated(iso: string | undefined): string {
  if (!iso) return "";
  const d = iso.slice(0, 10);
  return d ? `Polls updated ${d}` : "";
}
