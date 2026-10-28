export type Result = { name: string; country: string; winner_party: string; winner_name: string; majority: number; majority_pct: number; shares: [string, number][] };
type Candidate = { standing?: string; name?: string; wcivf_url?: string; dc_person_url?: string };
type Candidates = { reform?: Candidate; restore?: Candidate };
type Projection = { projected_winner?: string; [key: string]: unknown };
type Provider = { provider: string; status: string; url: string; fieldwork?: string; retrieved_at: string; seats: Record<string, Projection> };
export type ElectionSeat = { code: string; name: string; result?: Result; candidates?: Candidates; projections: { provider: Provider; row: Projection }[] };
export type ElectionData = { seats: ElectionSeat[]; results: Results; candidates: CandidateFile; projections: ProjectionFile; national: National };
type Results = { retrieved_at: string; parties: Record<string, string>; seats: Record<string, Result> };
type CandidateFile = { retrieved_at: string; seats: Record<string, Candidates> };
type ProjectionFile = { retrieved_at: string; providers: Record<string, Provider> };
type National = { retrieved_at: string; source_url: string; rolling_average?: { n: number; method: string; [key: string]: unknown } };
type Geo = { features: { properties?: Record<string, unknown> | null; geometry?: unknown }[] };
export function joinSeats(geo: Geo, results: Results, candidates: CandidateFile, projections: ProjectionFile): ElectionSeat[] {
  return geo.features.map(f => { const code = String(f.properties?.PCON24CD ?? ''); return { code, name: String(f.properties?.PCON24NM ?? ''), result: results.seats[code], candidates: candidates.seats[code], projections: Object.values(projections.providers).flatMap(provider => provider.seats?.[code] ? [{provider, row: provider.seats[code]}] : []) }; });
}
export function canonicalParty(name: string): string {
  if (/^(Lab|Labour)$/i.test(name)) return 'Labour';
  if (/^(Con|Conservative)$/i.test(name)) return 'Conservative';
  if (/^(LD|Liberal Democrat.*)$/i.test(name)) return 'Liberal Democrat';
  if (/^(RUK|Reform.*)$/i.test(name)) return 'Reform UK';
  if (/green/i.test(name)) return 'Green';
  if (/^(SNP|Scottish National.*)$/i.test(name)) return 'SNP';
  if (/plaid/i.test(name)) return 'Plaid Cymru';
  return name;
}
const colours: Record<string,string> = { Labour:'#d83b40', Conservative:'#3478bf', 'Liberal Democrat':'#eea832', 'Reform UK':'#19a8b4', Green:'#4a9a59', SNP:'#e7ca36', 'Plaid Cymru':'#6eae80', Independent:'#9169a6', Speaker:'#806d5d' };
export function partyColour(party: string): string { return colours[canonicalParty(party)] ?? (party ? '#937d9c' : '#b9bec4'); }
let cached: Promise<ElectionData> | undefined;
export function loadElection(): Promise<ElectionData> {
  return cached ??= Promise.all(['constituencies-gb-2024-simplified.geojson','results-2024-gb.json','candidates-gb.json','polls-seats.json','polls-national.json'].map(n => fetch(`/data/${n}`).then(r => { if (!r.ok) throw new Error(n); return r.json(); }))).then(([geo, results, candidates, projections, national]) => ({seats: joinSeats(geo, results, candidates, projections), results, candidates, projections, national}));
}
export function escapeHtml(value: unknown): string { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] ?? c)); }
export function partyName(data: ElectionData, code: string): string { return canonicalParty(data.results.parties[code] ?? code); }
export function seatHtml(seat: ElectionSeat, data: ElectionData): string {
 const r=seat.result; const names = Object.entries(seat.candidates ?? {}).flatMap(([party,c]) => c?.standing === 'yes' && c.name ? [`${party === 'reform' ? 'Reform UK' : 'Restore Britain'}: ${escapeHtml(c.name)}`] : []);
 const proj=seat.projections.map(({provider,row}) => `<li><a href="${escapeHtml(provider.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(provider.provider)}</a>: ${escapeHtml(canonicalParty(row.projected_winner ?? 'Unavailable'))}<br><small>Fieldwork: ${escapeHtml(provider.fieldwork ?? 'not provided')} · Retrieved ${escapeHtml(provider.retrieved_at.slice(0,10))} · ${escapeHtml(provider.status)}</small></li>`).join('');
 return `<article class="election-seat"><h2>${escapeHtml(seat.name)}</h2><p>${escapeHtml(r?.country ?? 'Region unavailable')} · ${escapeHtml(seat.code)}</p><h3>2024 result</h3>${r ? `<p><strong>${escapeHtml(r.winner_name)}</strong> · ${escapeHtml(partyName(data,r.winner_party))}<br>Majority ${r.majority.toLocaleString()} (${r.majority_pct}%)</p><p>${r.shares.map(([p,v])=>`${escapeHtml(partyName(data,p))} ${v}%`).join(' · ')}</p>` : '<p>Result unavailable</p>'}<h3>Seat projections</h3><ul>${proj || '<li>No seat projection available</li>'}</ul><h3>Candidates</h3><p>${names.length ? names.join('<br>') : 'Candidates not yet confirmed in this dataset.'}</p><p>Candidate coverage is limited to Reform UK and Restore Britain; other parties are not covered. <a href="https://candidates.democracyclub.org.uk/" target="_blank" rel="noopener noreferrer">Democracy Club</a> · retrieved ${escapeHtml(data.candidates.retrieved_at.slice(0,10))}</p><p>2024 results: <a href="https://electionresults.parliament.uk/general-elections/6" target="_blank" rel="noopener noreferrer">House of Commons Library</a>, Open Parliament Licence v3.0 · retrieved ${escapeHtml(data.results.retrieved_at.slice(0,10))}</p><button type="button" class="copy-seat" data-seat="${escapeHtml(seat.code)}">Copy seat link</button></article>`;
}
