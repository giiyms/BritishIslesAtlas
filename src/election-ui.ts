import {
  CONFIDENCE_LABEL, CONFIDENCE_OPACITY, DEFAULT_MEASURE, MAJORITY_BANDS, OWNER_NOTE,
  candidateFor, escapeHtml, loadElection, partyColour, partyName, seatColour, seatProjectedWinner,
  type ElectionData, type ElectionSeat, type Measure, type NationalPoll,
} from './election';
import { attachTrend, trendHtml } from './poll-trend';
import { CLEAR_2024_MARGIN, CONFIDENCE_RANK } from './tactical';

const NATIONAL_PARTIES: [string, string][] = [['lab', 'Labour'], ['con', 'Conservative'], ['ref', 'Reform UK'], ['ld', 'Liberal Democrat'], ['grn', 'Green'], ['rb', 'Restore Britain'], ['snp', 'SNP'], ['pc', 'Plaid Cymru']];
const SHORT: Record<string, string> = { lab: 'Lab', con: 'Con', ref: 'Ref', ld: 'LD', grn: 'Grn', rb: 'RB', snp: 'SNP', pc: 'PC' };
const EXT = ' target="_blank" rel="noopener noreferrer"';
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : null;

export function countBy(values: string[]): [string, number][] {
  return Object.entries(values.reduce<Record<string, number>>((acc, p) => { acc[p] = (acc[p] ?? 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function nationalHtml(d: ElectionData): string {
  const avg = d.national.rolling_average;
  const span = avg?.fieldwork_span;
  const trend = trendHtml(d.national.polls ?? []);
  const polls: NationalPoll[] = (d.national.polls ?? []).slice(0, avg?.n ?? 7);
  const table = polls.length ? `<div class="mini-scroll"><table class="mini-table"><thead><tr><th>Pollster</th><th>Fieldwork</th>${NATIONAL_PARTIES.slice(0, 6).map(([k]) => `<th>${SHORT[k]}</th>`).join('')}</tr></thead><tbody>${polls.map(p => `<tr><td>${escapeHtml(p.pollster)}</td><td>${escapeHtml(p.fieldwork)}</td>${NATIONAL_PARTIES.slice(0, 6).map(([k]) => { const v = num(p[k]); return `<td>${v === null ? '–' : v}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>` : '';
  return `<p class="summary-head">Voting intention over time (GB, %)</p>${trend}` +
    `<p class="summary-head">Latest polls (GB, %), plus the ${avg?.n ?? 0}-poll average ${escapeHtml(span?.oldest ?? '?')} to ${escapeHtml(span?.newest ?? '?')}: ${NATIONAL_PARTIES.slice(0, 6).map(([k]) => `${SHORT[k]} ${num(avg?.[k]) ?? '–'}`).join(', ')}</p>${table}` +
    `<p class="seat-small">${escapeHtml(avg?.method ?? '')} Source: <a href="${escapeHtml(d.national.source_url)}"${EXT}>${escapeHtml(d.national.source ?? 'opinion polling table')}</a> · retrieved ${escapeHtml(d.national.retrieved_at.slice(0, 10))}. National polls are shown for context and do not change seat picks.</p>`;
}

function seatCountsHtml(d: ElectionData): string {
  const providers = Object.entries(d.projections.providers);
  const columns: [string, Map<string, number>][] = [
    ['2024', new Map(countBy(d.seats.map(s => s.result ? partyName(d, s.result.winner_party) : 'Unavailable')))],
    ...providers.map(([key, p]) => [p.provider, new Map(countBy(d.seats.map(s => seatProjectedWinner(s, key) || 'Unavailable')))] as [string, Map<string, number>]),
    ['Tactical picks', new Map(countBy(d.seats.map(s => s.pick.party ?? 'No pick')))],
  ];
  const parties = [...new Set(columns.flatMap(([, m]) => [...m.keys()]))].sort((a, b) => Math.max(...columns.map(([, m]) => m.get(b) ?? 0)) - Math.max(...columns.map(([, m]) => m.get(a) ?? 0)));
  return `<div class="mini-scroll"><table class="mini-table counts"><thead><tr><th>Party</th>${columns.map(([h]) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${parties.map(p => `<tr><td><i class="swatch" style="background:${partyColour(p)}"></i>${escapeHtml(p)}</td>${columns.map(([, m]) => `<td>${m.get(p) ?? '–'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` +
    `<p class="seat-small">Seats each provider projects each party to win, from ${providers.map(([, p]) => `<a href="${escapeHtml(p.url)}"${EXT}>${escapeHtml(p.provider)}</a> (fieldwork ${escapeHtml(p.fieldwork ?? 'not stated')})`).join(' and ')}. Tactical picks never include Labour or Green. In Northern Ireland (18 seats, no Labour candidates) the pick column counts the projected winner; More in Common covers Great Britain only.</p>`;
}

const HOW_IT_WORKS = `<ol class="how">
<li><strong>Owner override.</strong> If the site owner has set a pick for a seat in <code>overrides.json</code>, that pick is used, and the panel still shows what the data says.</li>
<li><strong>Seat projections.</strong> For each provider (Electoral Calculus and More in Common): if it projects a winner other than Labour or Green, that party is its pick. If it projects Labour or Green to win, its pick is the other party (not Labour, not Green) with the highest projected share (the challenger).</li>
<li><strong>Agreement.</strong> Both providers name the same party: <em>high</em> confidence. Only one provider: <em>medium</em>. They disagree: the party with the higher average projected share across providers, at <em>low</em> confidence. Confidence also drops to low if the combined others/independents vote is bigger than the named challenger.</li>
<li><strong>No projection.</strong> Use the 2024 result: the strongest party other than Labour and Green. That is <em>medium</em> confidence with a lead of ${CLEAR_2024_MARGIN}+ points over the next eligible party, otherwise <em>low</em>.</li>
<li><strong>Northern Ireland.</strong> Labour does not stand in Northern Ireland, so the stop-Labour rule has nothing to act on in its 18 seats. The map and seat card show Electoral Calculus’s projected winner instead (medium confidence, low when its win probability is under 60%), or the 2024 winner if there is no projection, and say so in the card. More in Common’s MRP covers Great Britain only. Owner overrides still win.</li>
</ol><p>Any party can be the pick, including Conservative, Reform UK, Restore Britain, Liberal Democrat, SNP, Plaid Cymru or an independent, except Labour and Green, which the site owner excludes. There is no default party. Labour and Green are never picked. On the map, a stronger fill means higher confidence.</p>
<p>Projections are model estimates, not results. Candidate names are confirmed only for Reform UK and Restore Britain in Great Britain, and for any party Democracy Club lists in Northern Ireland. For other parties check <a href="https://whocanivotefor.co.uk/"${EXT}>Who can I vote for?</a>. ${escapeHtml(OWNER_NOTE)} This is civic information, not Electoral Commission advice.</p>`;

type Column = { key: string; label: string; value: (s: ElectionSeat) => string; sort?: (s: ElectionSeat) => number };

export function mountElectionUI(openSeat: (code: string) => void): void {
  const root = document.createElement('section'); root.className = 'election-controls';
  const wide = window.matchMedia('(min-width: 861px)').matches;
  root.id = 'info-panel';
  root.setAttribute('aria-labelledby', 'info-panel-title');
  root.innerHTML = `<button type="button" class="info-close" aria-label="Hide info panel" aria-controls="info-panel">×</button><h1 id="info-panel-title">Stop Labour: UK tactical vote atlas</h1><p class="lede">Who is best placed to beat Labour in each of 632 GB seats, with the evidence shown. Labour does not stand in Northern Ireland’s 18 seats, so there the map shows the projected winner instead.</p>` +
    `<p class="owner-note">${escapeHtml(OWNER_NOTE)}</p>` +
    `<label>Map colour <select aria-label="Map colour"><option value="tactical">Who to back to stop Labour</option><option value="winner">2024 winning party</option><option value="majority">2024 majority size</option><option value="proj:electoral_calculus">Projected winner (Electoral Calculus)</option><option value="proj:more_in_common">Projected winner (More in Common)</option></select></label>` +
    `<div class="election-legend" aria-live="polite">Loading election data…</div>` +
    `<button type="button" class="open-table">Table of all 650 seats</button>` +
    `<details${wide ? ' open' : ''}><summary>National polls</summary><div class="national-summary"></div></details>` +
    `<details><summary>Seat counts by provider</summary><div class="seat-counts"></div></details>` +
    `<details><summary>How this works</summary>${HOW_IT_WORKS}</details>`;
  document.body.append(root);
  mountInfoToggle(root, wide);
  const select = root.querySelector('select')!;
  select.value = DEFAULT_MEASURE;
  const legend = root.querySelector<HTMLElement>('.election-legend')!;
  let data: ElectionData | undefined;
  select.addEventListener('change', () => { window.dispatchEvent(new CustomEvent('atlas:measure', { detail: select.value })); if (data) updateLegend(data); });

  function updateLegend(d: ElectionData) {
    const measure = select.value as Measure;
    if (measure === 'majority') {
      legend.innerHTML = MAJORITY_BANDS.map(([, c, l]) => `<span><i style="background:${c}"></i>${l}</span>`).join('');
      return;
    }
    const entries = countBy(d.seats.map(s => seatColour(s, d, measure).label));
    legend.innerHTML = entries.map(([p, n]) => `<span><i style="background:${partyColour(p === 'No pick' || p === 'Unavailable' ? '' : p)}"></i>${escapeHtml(p)} ${n}</span>`).join('') +
      (measure === 'tactical' ? `<div class="conf-key">${(['high', 'medium', 'low'] as const).map(c => `<span><i style="opacity:${CONFIDENCE_OPACITY[c]}"></i>${CONFIDENCE_LABEL[c]} ${d.seats.filter(s => s.pick.confidence === c).length}</span>`).join('')}</div>` : '');
  }

  // Table view.
  const dialog = document.createElement('dialog'); dialog.className = 'election-table';
  dialog.innerHTML = `<header><h2>All 650 UK constituencies</h2><button type="button" class="close-table" aria-label="Close seat table">×</button></header>` +
    `<div class="table-tools"><input type="search" placeholder="Search seats or parties" aria-label="Search seats or parties"><select class="f-party" aria-label="Filter by tactical pick"><option value="">Any pick</option></select><select class="f-conf" aria-label="Filter by confidence"><option value="">Any confidence</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><button class="csv">Export CSV</button></div>` +
    `<p class="table-count"></p><div class="table-scroll"><table><thead></thead><tbody></tbody></table></div>`;
  document.body.append(dialog);
  const input = dialog.querySelector<HTMLInputElement>('input')!;
  const partyFilter = dialog.querySelector<HTMLSelectElement>('.f-party')!;
  const confFilter = dialog.querySelector<HTMLSelectElement>('.f-conf')!;
  let columns: Column[] = [];
  let sort = 'name', ascending = true;
  const candidateText = (s: ElectionSeat) => candidateFor(s, s.pick.party)?.name ?? (s.pick.party ? 'Not yet confirmed' : '');

  function buildColumns(d: ElectionData) {
    columns = [
      { key: 'name', label: 'Seat', value: s => s.name },
      { key: 'winner', label: '2024 winner', value: s => s.result ? partyName(d, s.result.winner_party) : 'Unavailable' },
      ...Object.entries(d.projections.providers).map(([key, p]) => ({ key, label: `Projected (${p.provider})`, value: (s: ElectionSeat) => seatProjectedWinner(s, key) || 'Unavailable' })),
      { key: 'pick', label: 'Tactical pick', value: s => s.pick.party ?? 'No pick' },
      { key: 'confidence', label: 'Confidence', value: s => s.pick.confidence, sort: s => CONFIDENCE_RANK[s.pick.confidence] },
      { key: 'candidate', label: 'Candidate', value: candidateText },
    ];
    dialog.querySelector('thead')!.innerHTML = `<tr>${columns.map(c => `<th><button data-sort="${c.key}">${escapeHtml(c.label)}</button></th>`).join('')}</tr>`;
    partyFilter.innerHTML = `<option value="">Any pick</option>${countBy(d.seats.map(s => s.pick.party ?? 'No pick')).map(([p, n]) => `<option value="${escapeHtml(p)}">${escapeHtml(p)} (${n})</option>`).join('')}`;
  }
  function filtered(d: ElectionData) {
    const q = input.value.trim().toLowerCase();
    const col = columns.find(c => c.key === sort) ?? columns[0];
    return d.seats
      .filter(s => (!partyFilter.value || (s.pick.party ?? 'No pick') === partyFilter.value) && (!confFilter.value || s.pick.confidence === confFilter.value))
      .filter(s => !q || columns.some(c => c.value(s).toLowerCase().includes(q)))
      .sort((a, b) => (col.sort ? col.sort(a) - col.sort(b) : col.value(a).localeCompare(col.value(b))) * (ascending ? 1 : -1) || a.name.localeCompare(b.name));
  }
  function render() {
    if (!data) return;
    const rows = filtered(data);
    dialog.querySelector('.table-count')!.textContent = `${rows.length} of ${data.seats.length} seats`;
    dialog.querySelector('tbody')!.innerHTML = rows.map(s => `<tr><td><button data-seat="${escapeHtml(s.code)}">${escapeHtml(s.name)}</button></td>${columns.slice(1).map(c => {
      const v = c.value(s);
      return c.key === 'pick' ? `<td><i class="swatch" style="background:${partyColour(s.pick.party ?? '')}"></i>${escapeHtml(v)}</td>` : c.key === 'confidence' ? `<td><span class="conf conf-${v}">${escapeHtml(v)}</span></td>` : `<td>${escapeHtml(v)}</td>`;
    }).join('')}</tr>`).join('');
  }
  for (const el of [input, partyFilter, confFilter]) el.addEventListener('input', render);
  dialog.querySelector('thead')!.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-sort]');
    if (!b?.dataset.sort) return;
    ascending = sort === b.dataset.sort ? !ascending : true; sort = b.dataset.sort; render();
  });
  dialog.querySelector('tbody')!.addEventListener('click', e => { const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-seat]'); if (button?.dataset.seat) { dialog.close(); openSeat(button.dataset.seat); } });
  dialog.querySelector('.close-table')!.addEventListener('click', () => dialog.close());
  root.querySelector('.open-table')!.addEventListener('click', () => { if (data) { render(); dialog.showModal(); } });
  dialog.querySelector('.csv')!.addEventListener('click', () => {
    if (!data) return;
    const rows = [['Code', ...columns.map(c => c.label), 'Reason', 'Sources'], ...filtered(data).map(s => [s.code, ...columns.map(c => c.value(s)), s.pick.reason, s.pick.sources.map(x => x.url).join(' ')])];
    const csv = rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'uk-tactical-picks.csv'; a.click(); URL.revokeObjectURL(a.href);
  });

  void loadElection().then(d => {
    data = d;
    // Only offer provider colourings that exist in the data.
    for (const option of [...select.options]) if (option.value.startsWith('proj:') && !d.projections.providers[option.value.slice(5)]) option.remove();
    buildColumns(d);
    updateLegend(d);
    root.querySelector('.national-summary')!.innerHTML = nationalHtml(d);
    attachTrend(root);
    root.querySelector('.seat-counts')!.innerHTML = seatCountsHtml(d);
  }).catch(() => { legend.textContent = 'Election data unavailable'; });
}

const INFO_KEY = 'atlas:info-panel';
/** Info panel can be hidden; a chip among the map controls brings it back. Choice persists. */
function mountInfoToggle(root: HTMLElement, wide: boolean): void {
  const reopen = document.createElement('button');
  reopen.type = 'button';
  reopen.className = 'info-reopen';
  reopen.setAttribute('aria-controls', 'info-panel');
  reopen.innerHTML = '<span aria-hidden="true">ⓘ</span> Stop Labour guide';
  document.body.append(reopen);
  let saved: string | null = null;
  try { saved = localStorage.getItem(INFO_KEY); } catch { /* private mode */ }
  let open = saved ? saved === 'open' : wide;
  // The guide belongs to the Constituencies layer: it and its chip go when that layer is off.
  let voting = true;
  const render = () => {
    root.hidden = !(voting && open);
    reopen.hidden = !(voting && !open);
    reopen.setAttribute('aria-expanded', String(!root.hidden));
  };
  const set = (next: boolean, focus: boolean) => {
    open = next;
    try { localStorage.setItem(INFO_KEY, open ? 'open' : 'closed'); } catch { /* ignore */ }
    render();
    if (focus) (open ? root.querySelector<HTMLElement>('.info-close') : reopen)?.focus();
  };
  window.addEventListener('atlas:voting-mode', (event) => {
    voting = Boolean((event as CustomEvent<{ on: boolean }>).detail?.on);
    render();
  });
  render();
  root.querySelector('.info-close')?.addEventListener('click', () => set(false, true));
  reopen.addEventListener('click', () => set(true, true));
}
