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

export function fillOpacityExpression(): unknown {
  return [
    "match",
    ["get", "endorseColor"],
    "reform", ENDORSE_COLORS.reform.fillOpacity,
    "restore", ENDORSE_COLORS.restore.fillOpacity,
    "none", ENDORSE_COLORS.none.fillOpacity,
    "override", ENDORSE_COLORS.override.fillOpacity,
    ENDORSE_COLORS.reform.fillOpacity,
  ];
}

export type FeatureCollection = {
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

/**
 * Canonical party labels for display only (style roast fix 5). The seat-poll data
 * mixes "Reform UK"/"Reform", "Scottish National Party (SNP)"/"Nationalist",
 * "The Green Party"/"Green" and "Minor"/"Other". Never feeds the pick logic.
 */
export function canonicalParty(label: string | null | undefined, pcon24cd = ""): string {
  const raw = (label ?? "").trim();
  if (!raw) return "";
  const n = raw.toLowerCase();
  if (/^reform( uk)?$/.test(n)) return "Reform UK";
  if (/scottish national party|^snp$/.test(n)) return "SNP";
  if (/^plaid( cymru)?$/.test(n)) return "Plaid Cymru";
  if (n === "nationalist") {
    if (pcon24cd.startsWith("S")) return "SNP";
    if (pcon24cd.startsWith("W")) return "Plaid Cymru";
    return "Other";
  }
  if (/\bgreen\b/.test(n)) return "Green";
  if (n === "minor" || n === "other" || n === "others") return "Other";
  return raw;
}

/** "2026-10-05T08:23:00Z" → "5 Oct" (UTC date, matches the baked retrieval day). */
export function formatShortDate(iso: string | undefined | null): string {
  const d = (iso ?? "").slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[Number(m[2]) - 1];
  return month ? `${Number(m[3])} ${month}` : "";
}

const EXT = ` target="_blank" rel="noopener noreferrer"`;

function extLink(href: string, text: string): string {
  return `<a href="${escapeHtml(href)}"${EXT}>${escapeHtml(text)}<span class="ext" aria-hidden="true">↗</span></a>`;
}

function candidateCell(label: string, row?: VotingSeat["reform"]): string {
  const standing = row?.standing ?? "unknown";
  const name = row?.name?.trim();
  let value: string;
  if (standing === "yes" && name) {
    const link = row?.wcivf_url || row?.dc_person_url;
    value = link ? extLink(link, name) : escapeHtml(name);
  } else if (standing === "no") {
    value = `<span class="vp-muted">not standing</span>`;
  } else {
    value = `<span class="vp-muted" title="Not yet confirmed">–</span>`;
  }
  return `<div class="vp-cand"><span class="vp-cand-party">${escapeHtml(label)}</span> ${value}</div>`;
}

function shareCell(value: number | null | undefined, lead: boolean): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return `<span class="vp-num vp-muted">–</span>`;
  return `<span class="vp-num${lead ? " vp-lead" : ""}">${escapeHtml(String(value))}%</span>`;
}

function pollGridHtml(seat: VotingSeat): string {
  const polls = (seat.polls ?? []).slice(0, 3);
  if (polls.length === 0) {
    return `<p class="vp-note">No seat poll loaded</p>`;
  }
  const rows = polls.map((poll) => {
    const label = poll.provider_label ?? poll.provider;
    const winner = canonicalParty(poll.projected_winner, seat.pcon24cd) || "–";
    const ref = poll.reform_share;
    const rb = poll.restore_share;
    const refNum = typeof ref === "number" && Number.isFinite(ref) ? ref : null;
    const rbNum = typeof rb === "number" && Number.isFinite(rb) ? rb : null;
    const refLead = refNum !== null && (rbNum === null || refNum > rbNum);
    const rbLead = rbNum !== null && (refNum === null || rbNum > refNum);
    const title = poll.fieldwork ? ` title="Fieldwork ${escapeHtml(poll.fieldwork)}"` : "";
    const name = poll.url ? extLink(poll.url, label) : escapeHtml(label);
    return (
      `<div class="vp-row" role="row"${title}>` +
      `<span role="cell" class="vp-pollster">${name}</span>` +
      `<span role="cell" class="vp-winner">${escapeHtml(winner)}</span>` +
      `<span role="cell">${shareCell(refNum, refLead)}</span>` +
      `<span role="cell">${shareCell(rbNum, rbLead)}</span>` +
      `</div>`
    );
  }).join("");
  return (
    `<div class="vp-polls" role="table" aria-label="Seat polls">` +
    `<div class="vp-row vp-row-head" role="row">` +
    `<span role="columnheader">Pollster</span><span role="columnheader">Projected</span>` +
    `<span role="columnheader" class="vp-num">Ref</span><span role="columnheader" class="vp-num">RB</span>` +
    `</div>${rows}</div>`
  );
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

  // Third-party note (display only): name the provider and the canonical party.
  let third = "";
  if (result.thirdPartyLead) {
    const source = (seat.polls ?? []).find((p) => (p.projected_winner ?? "").trim() === result.thirdPartyLead);
    const provider = source ? (source.provider_label ?? source.provider) : "A seat poll";
    const party = canonicalParty(result.thirdPartyLead, seat.pcon24cd);
    const article = /^[aeiou]/i.test(party) ? "an" : "a";
    third = `<p class="vp-note">${escapeHtml(provider)} projects ${article} <em>${escapeHtml(party)}</em> win here.</p>`;
  }

  // 2024 winner row stays hidden until the Commons Library join lands.
  const winner2024 = seat.winner2024
    ? `<p class="vp-note">2024 winner: ${escapeHtml(canonicalParty(seat.winner2024, seat.pcon24cd))}</p>`
    : "";

  const updated = formatShortDate(retrievedAt);
  const ballot =
    seat.reform?.wcivf_url ||
    seat.restore?.wcivf_url ||
    `https://whocanivotefor.co.uk/`;

  return (
    `<div class="vote-popup">` +
    `<div class="vp-head"><strong class="popup-title">${escapeHtml(seat.pcon24nm)}</strong>` +
    `<span class="vp-code">${escapeHtml(seat.pcon24cd)}</span></div>` +
    `<div class="vote-badge" style="--vote:${colors.badge}">${escapeHtml(voteLabel)}</div>` +
    `<p class="vp-reason" title="${escapeHtml(result.reason)}">${escapeHtml(result.reason)}</p>` +
    (result.isOverride ? `<div class="popup-override">Daniel override</div>` : "") +
    pollGridHtml(seat) +
    third +
    `<div class="vp-cands">` +
    candidateCell("Reform", seat.reform) +
    candidateCell("Restore", seat.restore) +
    `</div>` +
    winner2024 +
    `<div class="vp-foot">` +
    `<div>${extLink(ballot, "WhoCanIVoteFor")} · ${extLink("https://candidates.democracyclub.org.uk/", "Democracy Club")}` +
    (updated ? ` · <span class="vp-nowrap">Updated ${escapeHtml(updated)}</span>` : "") +
    `</div>` +
    `<div>Editorial endorsement, not Electoral Commission advice.</div>` +
    `</div>` +
    `</div>`
  );
}

/** Centroid-ish label point for a (Multi)Polygon: area-weighted centroid of its largest ring. */
export function labelPoint(geometry: unknown): [number, number] | null {
  const g = geometry as { type?: string; coordinates?: unknown } | null;
  if (!g?.coordinates) return null;
  const polys = (g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []) as number[][][][];
  let best: { area: number; c: [number, number] } | null = null;
  for (const poly of polys) {
    const ring = poly[0];
    if (!ring || ring.length < 4) continue;
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x0, y0] = ring[j];
      const [x1, y1] = ring[i];
      const f = x0 * y1 - x1 * y0;
      a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
    }
    if (a === 0) continue;
    const area = Math.abs(a / 2);
    const c: [number, number] = [cx / (3 * a), cy / (3 * a)];
    if (!best || area > best.area) best = { area, c };
  }
  return best?.c ?? null;
}

/** Point features (one per Restore seat) for the GB-scale callout. */
export function restoreCallouts(enriched: FeatureCollection): FeatureCollection {
  const features = enriched.features
    .filter((f) => f.properties?.endorseColor === "restore")
    .map((f) => {
      const c = labelPoint(f.geometry);
      return c
        ? {
          type: "Feature",
          properties: {
            pcon24cd: String(f.properties?.PCON24CD ?? ""),
            pcon24nm: String(f.properties?.PCON24NM ?? f.properties?.name ?? ""),
          },
          geometry: { type: "Point", coordinates: c },
        }
        : null;
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);
  return { type: "FeatureCollection", features };
}

export function formatPollsUpdated(iso: string | undefined): string {
  if (!iso) return "";
  const d = iso.slice(0, 10);
  return d ? `Polls updated ${d}` : "";
}
