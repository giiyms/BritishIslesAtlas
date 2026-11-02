import { canonicalParty, partyColour } from './parties';
import { decideTacticalPick, projectedShare, projectedShares, projectedWinner, type OverrideInput, type TacticalPick } from './tactical';
export { canonicalParty, partyColour } from './parties';

export type Result = { name: string; country: string; winner_party: string; winner_name: string; majority: number; majority_pct: number; shares: [string, number][] };
type Candidate = { standing?: string; name?: string; wcivf_url?: string; dc_person_url?: string };
type Candidates = { reform?: Candidate; restore?: Candidate };
type Projection = { projected_winner?: string; chances?: Record<string, number>; [key: string]: unknown };
export type Provider = { provider: string; status: string; url: string; data_url?: string; fieldwork?: string; updated?: string; retrieved_at: string; seats: Record<string, Projection> };
export type SeatProjection = { key: string; provider: Provider; row: Projection };
export type ElectionSeat = { code: string; name: string; result?: Result; candidates?: Candidates; projections: SeatProjection[]; pick: TacticalPick };
export type ElectionData = { geo: Geo; seats: ElectionSeat[]; results: Results; candidates: CandidateFile; projections: ProjectionFile; national: National; overrides: OverridesFile };
type Results = { retrieved_at: string; source_url?: string; parties: Record<string, string>; seats: Record<string, Result> };
type CandidateFile = { retrieved_at: string; source_url?: string; seats: Record<string, Candidates> };
type ProjectionFile = { retrieved_at: string; providers: Record<string, Provider> };
export type NationalPoll = { fieldwork: string; pollster: string; client?: string; area?: string; sample?: number | null; url?: string; [party: string]: unknown };
export type National = { retrieved_at: string; source?: string; source_url: string; polls?: NationalPoll[]; rolling_average?: { n: number; method: string; pollsters?: string[]; fieldwork_span?: { newest?: string; oldest?: string }; [key: string]: unknown } };
export type OverridesFile = { overrides?: (OverrideInput & { pcon24cd: string })[] };
type Geo = { type?: string; features: { type?: string; properties?: Record<string, unknown> | null; geometry?: unknown }[] };

export const RESULTS_URL = 'https://electionresults.parliament.uk/general-elections/6';

export function resultParties(results: Pick<Results, 'parties'>, result: Result): [string, number][] {
  return result.shares.map(([p, v]) => [canonicalParty(results.parties[p] ?? p), v]);
}

export function joinSeats(geo: Geo, results: Results, candidates: CandidateFile, projections: ProjectionFile, overrides: OverridesFile = {}): ElectionSeat[] {
  const byCode = new Map((overrides.overrides ?? []).map(o => [o.pcon24cd, o]));
  return geo.features.map(f => {
    const code = String(f.properties?.PCON24CD ?? '');
    const result = results.seats[code];
    const seatProjections = Object.entries(projections.providers).flatMap(([key, provider]) => provider.seats?.[code] ? [{ key, provider, row: provider.seats[code] }] : []);
    const pick = decideTacticalPick({
      code,
      projections: seatProjections.map(({ provider, row }) => ({ provider: provider.provider, url: provider.url, fieldwork: provider.fieldwork, retrievedAt: provider.retrieved_at, row })),
      result2024: result ? { winner: canonicalParty(results.parties[result.winner_party] ?? result.winner_party), shares: resultParties(results, result), url: results.source_url ?? RESULTS_URL } : undefined,
      override: byCode.get(code) ?? null,
    });
    return { code, name: String(f.properties?.PCON24NM ?? ''), result, candidates: candidates.seats[code], projections: seatProjections, pick };
  });
}

let cached: Promise<ElectionData> | undefined;
const getJson = (n: string) => fetch(`/data/${n}`).then(r => { if (!r.ok) throw new Error(n); return r.json(); });
/** Lazy: nothing election-related is fetched until the constituency layer or a seat needs it. */
export function loadElection(): Promise<ElectionData> {
  return cached ??= Promise.all([
    ...['constituencies-gb-2024-simplified.geojson', 'results-2024-gb.json', 'candidates-gb.json', 'polls-seats.json', 'polls-national.json'].map(getJson),
    getJson('overrides.json').catch(() => ({ overrides: [] })),
  ]).then(([geo, results, candidates, projections, national, overrides]) => ({ geo, seats: joinSeats(geo, results, candidates, projections, overrides), results, candidates, projections, national, overrides }));
}
let seatHistory: Promise<import('./poll-trend').SeatHistory> | undefined;
/** Per-seat projection history: fetched only when a seat panel first opens. A failed fetch can be retried. */
export function loadSeatHistory(): Promise<import('./poll-trend').SeatHistory> {
  return seatHistory ??= getJson('polls-seats-history.json').catch((err: unknown) => { seatHistory = undefined; throw err; });
}
let resultsHistory: Promise<import('./poll-trend').ResultsHistory> | undefined;
/** Past general elections on today's boundaries (2019 notional + 2024): fetched when a seat panel first opens. */
export function loadResultsHistory(): Promise<import('./poll-trend').ResultsHistory> {
  return resultsHistory ??= getJson('results-history-gb.json').catch((err: unknown) => { resultsHistory = undefined; throw err; });
}
export function escapeHtml(value: unknown): string { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] ?? c)); }
export function partyName(data: Pick<ElectionData, 'results'>, code: string): string { return canonicalParty(data.results.parties[code] ?? code); }

/** Map colourings. `proj:<provider key>` colours by that provider's projected winner. */
export type Measure = 'tactical' | 'winner' | 'majority' | `proj:${string}`;
export const DEFAULT_MEASURE: Measure = 'tactical';
export const CONFIDENCE_OPACITY = { high: 0.88, medium: 0.62, low: 0.36 } as const;
export const MAJORITY_BANDS: [number, string, string][] = [[5, '#f7e3ac', 'Under 5%'], [10, '#e8b65d', '5–10%'], [20, '#d37d3f', '10–20%'], [Infinity, '#9f462c', '20% and over']];
const NO_DATA = '#b9bec4';

export function seatProjectedWinner(seat: ElectionSeat, key: string): string {
  const p = seat.projections.find(x => x.key === key);
  return p ? projectedWinner(p.row, seat.code) : '';
}

export function seatColour(seat: ElectionSeat | undefined, data: Pick<ElectionData, 'results'>, measure: Measure): { color: string; opacity: number; label: string } {
  if (!seat) return { color: NO_DATA, opacity: 0.5, label: 'Unavailable' };
  if (measure === 'tactical') {
    const party = seat.pick.party;
    return party ? { color: partyColour(party), opacity: CONFIDENCE_OPACITY[seat.pick.confidence], label: party } : { color: NO_DATA, opacity: 0.5, label: 'No pick' };
  }
  if (measure === 'majority') {
    const band = seat.result ? MAJORITY_BANDS.find(([max]) => seat.result!.majority_pct < max) : undefined;
    return band ? { color: band[1], opacity: 0.78, label: band[2] } : { color: NO_DATA, opacity: 0.5, label: 'Unavailable' };
  }
  const party = measure === 'winner' ? (seat.result ? partyName(data, seat.result.winner_party) : '') : seatProjectedWinner(seat, measure.slice(5));
  return { color: partyColour(party), opacity: 0.78, label: party || 'Unavailable' };
}

/** Confirmed candidate for the picked party. Only Reform UK and Restore Britain are covered by candidates-gb.json. */
export function candidateFor(seat: ElectionSeat, party: string | null): { name: string; url?: string } | null {
  const row = party === 'Reform UK' ? seat.candidates?.reform : party === 'Restore Britain' ? seat.candidates?.restore : undefined;
  return row?.standing === 'yes' && row.name ? { name: row.name, url: row.wcivf_url || row.dc_person_url } : null;
}

export const CONFIDENCE_LABEL = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' } as const;
const EXT = ' target="_blank" rel="noopener noreferrer"';
const link = (href: string | undefined, text: string) => href ? `<a href="${escapeHtml(href)}"${EXT}>${escapeHtml(text)}</a>` : escapeHtml(text);
const fmt = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)}%`;
const CHANCE_LABEL: Record<string, string> = { con: 'Conservative', lab: 'Labour', ld: 'Liberal Democrat', reform: 'Reform UK', green: 'Green', nat: 'Nationalist', restore: 'Restore Britain' };

export const OWNER_NOTE = 'Picks reflect this site owner’s tactical goal: stopping Labour winning seats. Check the evidence and make your own choice; you decide how to vote.';

/** Plain text values (latest shares), shown until the time-series chart loads or when no history exists. */
function shareList(shares: [string, number][], pick: string | null): string {
  return `<p class="share-list">${shares.map(([p, v]) => `<span${p === pick ? ' class="is-pick"' : ''}><i class="swatch" style="background:${partyColour(p)}"></i>${escapeHtml(p)} <b>${fmt(v)}</b></span>`).join(' ')}</p>`;
}

function projectionHtml(seat: ElectionSeat, { key, provider, row }: SeatProjection): string {
  const winner = projectedWinner(row, seat.code) || 'Unavailable';
  const shares = projectedShares(row, seat.code).filter(([, v]) => v > 0);
  const other = projectedShare(row, 'Other', seat.code);
  if (other !== null && other > 0) shares.push(['Other', other]);
  const chances = row.chances && typeof row.chances === 'object'
    ? Object.entries(row.chances).filter(([, v]) => typeof v === 'number').sort((a, b) => b[1] - a[1]).map(([k, v]) => `${escapeHtml(canonicalParty(CHANCE_LABEL[k] ?? k, seat.code))} ${Math.round(v * 100)}%`).join(' · ')
    : '';
  return `<div class="proj-card"><div class="proj-head">${link(provider.url, provider.provider)} projects <strong style="--party:${partyColour(winner)}">${escapeHtml(winner)}</strong></div>` +
    `<div class="proj-shares" data-provider="${escapeHtml(key)}">${shareList(shares, seat.pick.party)}</div>` +
    (chances ? `<p class="proj-chances">Win probability: ${chances}</p>` : '') +
    `<p class="proj-meta">Fieldwork ${escapeHtml(provider.fieldwork ?? 'not stated')} · retrieved ${escapeHtml(provider.retrieved_at.slice(0, 10))}${provider.status !== 'loaded' ? ` · ${escapeHtml(provider.status)}` : ''}</p></div>`;
}

export function seatHtml(seat: ElectionSeat, data: ElectionData): string {
  const r = seat.result; const pick = seat.pick;
  const candidate = candidateFor(seat, pick.party);
  const candidateLine = !pick.party ? '' : candidate ? `Candidate: <strong>${link(candidate.url, candidate.name)}</strong>` : `${escapeHtml(pick.party)} candidate not yet confirmed`;
  const sourceLinks = [
    ...seat.projections.map(p => link(p.provider.url, `${p.provider.provider} seat projection`)),
    link(data.results.source_url ?? RESULTS_URL, '2024 results (House of Commons Library)'),
    link(data.candidates.source_url ?? 'https://candidates.democracyclub.org.uk/', 'Candidates (Democracy Club)'),
    link('https://whocanivotefor.co.uk/', 'Who can I vote for?'),
  ];
  const pickBox = `<section class="pick-box" style="--pick:${pick.party ? partyColour(pick.party) : NO_DATA}">` +
    `<div class="pick-label">Who to back to stop Labour</div>` +
    `<div class="pick-party"><i></i><strong>${escapeHtml(pick.party ?? 'No pick')}</strong><span class="conf conf-${pick.confidence}">${CONFIDENCE_LABEL[pick.confidence]}</span></div>` +
    (candidateLine ? `<p class="pick-candidate">${candidateLine}</p>` : '') +
    `<p class="pick-why"><strong>Why:</strong> ${escapeHtml(pick.reason)}</p>` +
    (pick.source === 'override' ? `<p class="pick-flag">Site owner override</p>` : '') +
    `<p class="pick-note">${escapeHtml(OWNER_NOTE)}</p></section>`;
  const projections = seat.projections.length ? `<div class="proj-grid">${seat.projections.map(p => projectionHtml(seat, p)).join('')}</div>` : '<p>No seat projection available.</p>';
  const result = r ? `<p><strong>${escapeHtml(partyName(data, r.winner_party))}</strong> won (${escapeHtml(r.winner_name)}) · majority ${r.majority.toLocaleString()} (${r.majority_pct}%)</p><div class="result-history" data-seat="${escapeHtml(seat.code)}">${shareList(resultParties(data.results, r), pick.party)}</div>` : '<p>Result unavailable</p>';
  return `<article class="election-seat"><h2>${escapeHtml(seat.name)}</h2><p class="seat-meta">${escapeHtml(r?.country ?? 'Nation unavailable')} · ${escapeHtml(seat.code)}</p>` +
    pickBox +
    `<h3>Seat projections</h3>${projections}` +
    `<h3>Past results</h3>${result}` +
    `<h3>Sources</h3><p class="seat-sources">${sourceLinks.join(' · ')}</p>` +
    `<p class="seat-small">Candidate data covers Reform UK and Restore Britain only (Democracy Club, retrieved ${escapeHtml(data.candidates.retrieved_at.slice(0, 10))}). 2024 results retrieved ${escapeHtml(data.results.retrieved_at.slice(0, 10))}, Open Parliament Licence v3.0. Projections are estimates, not results.</p>` +
    `<button type="button" class="copy-seat" data-seat="${escapeHtml(seat.code)}">Copy seat link</button></article>`;
}
