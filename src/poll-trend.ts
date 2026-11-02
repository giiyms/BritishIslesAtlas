// National voting-intention trend (every poll as a faint dot, plus a smoothed line per party) and
// per-seat projection history (one point per published edition, joined by straight lines).
// Pure functions (tested) plus one DOM hook for the hover readout.
import { escapeHtml, partyColour } from './election';

export const TREND_PARTIES: [key: string, name: string][] = [
  ['lab', 'Labour'], ['con', 'Conservative'], ['ref', 'Reform UK'], ['ld', 'Liberal Democrat'], ['grn', 'Green'], ['rb', 'Restore Britain'],
];
export const SMOOTH_DAYS = 7; // each point averages polls within +/- this many days
export const SMOOTH_MIN_POLLS = 3; // ...and is drawn only when at least this many polls report the party

export type TrendPoll = { date?: string | null; pollster?: string; [party: string]: unknown };
export type Pt = { t: number; v: number };
export type Series = { key: string; name: string; raw: Pt[]; smooth: Pt[] };

const DAY = 86_400_000;
const toTime = (date: string) => Date.parse(`${date}T12:00:00Z`);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function buildSeries(polls: TrendPoll[], parties = TREND_PARTIES): Series[] {
  return parties.map(([key, name]) => {
    const raw = polls
      .flatMap((p): Pt[] => (p.date && finite(p[key]) ? [{ t: toTime(p.date), v: p[key] as number }] : []))
      .sort((a, b) => a.t - b.t);
    const smooth: Pt[] = [];
    let lastT = -Infinity;
    for (const centre of raw) {
      if (centre.t === lastT) continue;
      lastT = centre.t;
      const near = raw.filter(r => Math.abs(r.t - centre.t) <= SMOOTH_DAYS * DAY);
      if (near.length >= SMOOTH_MIN_POLLS) smooth.push({ t: centre.t, v: near.reduce((s, r) => s + r.v, 0) / near.length });
    }
    return { key, name, raw, smooth };
  }).filter(s => s.raw.length > 0);
}

/** Smoothed value at or before `t` (nearest earlier point), or null. */
export function valueAt(series: Series, t: number): number | null {
  let best: Pt | null = null;
  for (const p of series.smooth) { if (p.t <= t && (!best || p.t > best.t)) best = p; }
  return best ? best.v : null;
}

export const niceBounds = (min: number, max: number): [number, number] => [Math.max(0, Math.floor((min - 1) / 5) * 5), Math.ceil((max + 1) / 5) * 5];

const W = 340, H = 196, L = 28, R = 8, T = 8, B = 22;
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (t: number) => { const d = new Date(t); return `${d.getUTCDate()} ${MONTH[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const fmt1 = (v: number) => v.toFixed(1);

type ChartSpec = {
  series: Series[];
  /** Points joined by each party's line. */
  lineOf: (s: Series) => Pt[];
  dotClass: string;
  dotR: number;
  aria: string;
  legend: string;
  read: string;
  /** Seat history: hover snaps to these edition dates; `label` is shown in the readout. */
  snaps?: { t: number; label: string }[];
  note?: string;
};

function chartHtml({ series, lineOf, dotClass, dotR, aria, legend, read, snaps, note }: ChartSpec): string {
  const all = series.flatMap(s => s.raw);
  let t0 = Math.min(...all.map(p => p.t)), t1 = Math.max(...all.map(p => p.t));
  if (t1 - t0 < 30 * DAY) { const mid = (t0 + t1) / 2; t0 = mid - 30 * DAY; t1 = mid + 30 * DAY; } // single edition: centre it
  const [lo, hi] = niceBounds(Math.min(...all.map(p => p.v)), Math.max(...all.map(p => p.v)));
  const x = (t: number) => L + (t - t0) / Math.max(1, t1 - t0) * (W - L - R);
  const y = (v: number) => T + (hi - v) / (hi - lo) * (H - T - B);
  const step = (hi - lo) > 40 ? 10 : 5;
  const grid = Array.from({ length: Math.floor((hi - lo) / step) + 1 }, (_, i) => lo + i * step)
    .map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="tr-grid"/><text x="${L - 4}" y="${(y(v) + 3).toFixed(1)}" class="tr-tick" text-anchor="end">${v}</text>`).join('');
  const months: string[] = [];
  const spanMonths = (t1 - t0) / (30.4 * DAY);
  const every = spanMonths > 30 ? 12 : spanMonths > 12 ? 3 : spanMonths > 6 ? 2 : 1; // keep month labels from colliding on long histories
  const cursor = new Date(t0); cursor.setUTCDate(1); cursor.setUTCHours(12);
  for (cursor.setUTCMonth(cursor.getUTCMonth() + 1); cursor.getTime() <= t1; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) {
    const m = cursor.getUTCMonth();
    if (m % every) continue;
    const label = every === 12 ? String(cursor.getUTCFullYear()) : every > 1 && m === 0 ? `${MONTH[m]} ’${String(cursor.getUTCFullYear()).slice(2)}` : MONTH[m];
    months.push(`<text x="${x(cursor.getTime()).toFixed(1)}" y="${H - 6}" class="tr-tick" text-anchor="middle">${label}</text>`);
  }
  const dots = series.map(s => `<g fill="${partyColour(s.name)}" class="${dotClass}">${s.raw.map(p => `<circle cx="${x(p.t).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="${dotR}"/>`).join('')}</g>`).join('');
  const lines = series.map(s => [s, lineOf(s)] as const).filter(([, pts]) => pts.length > 1).map(([s, pts]) => `<polyline fill="none" stroke="${partyColour(s.name)}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${pts.map(p => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')}"/>`).join('');
  const noteSvg = note ? `<text x="${((L + W - R) / 2).toFixed(1)}" y="${H - B - 6}" class="tr-note" text-anchor="middle">${escapeHtml(note)}</text>` : '';
  const data = escapeHtml(JSON.stringify({ t0, t1, lo, hi, snaps, series: series.map(s => ({ name: s.name, colour: partyColour(s.name), smooth: s.smooth })) }));
  return `<div class="poll-trend" data-trend="${data}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(aria)}" class="tr-svg">${grid}${months.join('')}${dots}${lines}${noteSvg}<line class="tr-cursor" y1="${T}" y2="${H - B}" x1="0" x2="0" hidden/></svg>` +
    `<p class="tr-read" aria-live="polite">${read}</p><ul class="tr-legend">${legend}</ul></div>`;
}

export function trendHtml(polls: TrendPoll[]): string {
  const series = buildSeries(polls);
  const all = series.flatMap(s => s.raw);
  if (all.length < 3) return '<p>Not enough dated polls for a trend.</p>';
  const t1 = Math.max(...all.map(p => p.t));
  const legend = series.map(s => {
    const last = s.smooth[s.smooth.length - 1];
    const before = last ? valueAt(s, last.t - 28 * DAY) : null;
    const delta = last && before !== null ? last.v - before : null;
    const dtxt = delta === null ? '' : ` <small>${Math.abs(delta) < 0.05 ? 'no change' : `${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)}`} in 4 wks</small>`;
    return `<li><i class="swatch" style="background:${partyColour(s.name)}"></i>${escapeHtml(s.name)} <b>${last ? fmt1(last.v) : '–'}%</b>${dtxt}</li>`;
  }).join('');
  return chartHtml({
    series, lineOf: s => s.smooth, dotClass: 'tr-dots', dotR: 1.4, aria: 'Voting intention over time, one line per party', legend,
    read: `Latest ${escapeHtml(fmtDate(t1))}. Touch or hover the chart to read a date.`,
  });
}

/* ---------- Per-seat projection history (public/data/polls-seats-history.json) ---------- */

export type SeatHistoryEdition = { date: string; fieldwork?: string | null; date_basis: string; source_url: string; page_url?: string };
export type SeatHistoryPoint = [date: string, ...values: (number | null)[]];
export type SeatHistory = {
  generated_at: string;
  notes?: string[];
  parties: string[];
  /** Key order for Northern Ireland seats (PCON24CD N*). */
  parties_ni?: string[];
  providers: Record<string, { provider: string; editions: SeatHistoryEdition[]; skipped?: string[] }>;
  seats: Record<string, Record<string, SeatHistoryPoint[]>>;
};
export type ResultsHistory = {
  source: string; license: string; license_url: string; notes?: string[];
  parties: string[];
  parties_ni?: string[];
  elections: { date: string; label: string; notional: boolean; note: string; source_url: string; data_url: string }[];
  seats: Record<string, SeatHistoryPoint[]>;
};
const SEAT_PARTY_NAMES: Record<string, string> = {
  con: 'Conservative', lab: 'Labour', ld: 'Liberal Democrat', ref: 'Reform UK', grn: 'Green', snp: 'SNP', pc: 'Plaid Cymru', rb: 'Restore Britain', spk: 'Speaker', oth: 'Other',
  dup: 'DUP', sf: 'Sinn Féin', sdlp: 'SDLP', uup: 'UUP', alliance: 'Alliance', tuv: 'TUV', aont: 'Aontú', pbp: 'People Before Profit', ind: 'Independent',
};
/** Northern Ireland seats carry their own party key order. */
const keysFor = (code: string, h: { parties: string[]; parties_ni?: string[] }) => code.startsWith('N') ? h.parties_ni ?? h.parties : h.parties;
export const SEAT_MIN_SHARE = 1; // parties never reaching this share in any edition are left off the chart
export const ONE_POINT_NOTE = 'Only one projection published';

/** One series per party, straight from the published editions (no smoothing), oldest first. */
export function buildSeatSeries(points: SeatHistoryPoint[], parties: string[]): Series[] {
  const sorted = [...points].sort((a, b) => a[0].localeCompare(b[0]));
  return parties.map((key, i) => {
    const raw = sorted.flatMap((p): Pt[] => (finite(p[i + 1]) ? [{ t: toTime(p[0]), v: p[i + 1] as number }] : []));
    return { key, name: SEAT_PARTY_NAMES[key] ?? key, raw, smooth: raw };
  }).filter(s => s.raw.length > 0 && Math.max(...s.raw.map(p => p.v)) >= SEAT_MIN_SHARE)
    .sort((a, b) => b.raw[b.raw.length - 1].v - a.raw[a.raw.length - 1].v);
}

export type SeatTrendKind = 'projection' | 'election';
const KIND_TEXT = {
  projection: { noun: 'projections', one: ONE_POINT_NOTE, aria: 'Projected vote share', hint: 'an edition' },
  election: { noun: 'elections', one: 'Only one election on these boundaries', aria: 'Vote share at past general elections', hint: 'an election' },
} as const;

/**
 * Unsmoothed line chart of a seat's vote share across dated points (projection editions or elections).
 * `snaps` labels each date in the hover readout (fieldwork for projections, election name for results).
 */
export function seatTrendHtml(points: SeatHistoryPoint[], parties: string[], snaps: { date: string; label: string }[] = [], kind: SeatTrendKind = 'projection'): string {
  const series = buildSeatSeries(points, parties);
  if (!series.length) return '';
  const k = KIND_TEXT[kind];
  const dates = [...new Set(points.map(p => p[0]))].sort();
  const single = dates.length === 1;
  const prevT = single ? null : toTime(dates[dates.length - 2]);
  const legend = series.map(s => {
    const last = s.raw[s.raw.length - 1];
    const before = prevT === null ? null : s.raw.find(p => p.t === prevT)?.v ?? null;
    const delta = before === null || last.t !== toTime(dates[dates.length - 1]) ? null : last.v - before;
    const dtxt = delta === null ? '' : ` <small>${Math.abs(delta) < 0.05 ? 'no change' : `${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)}`} vs previous</small>`;
    return `<li><i class="swatch" style="background:${partyColour(s.name)}"></i>${escapeHtml(s.name)} <b>${fmt1(last.v)}%</b>${dtxt}</li>`;
  }).join('');
  const byDate = new Map(snaps.map(e => [e.date, e.label]));
  const snapPts = dates.map(d => ({ t: toTime(d), label: byDate.get(d) ?? '' }));
  const latest = escapeHtml(fmtDate(toTime(dates[dates.length - 1])));
  const named = kind === 'election' && dates.every(d => byDate.get(d)) ? dates.map(d => escapeHtml(byDate.get(d)!)).join(' and ') : '';
  const read = single ? `${k.one} (${latest}).`
    : kind === 'election' && named ? `${dates.length} elections on today’s boundaries: ${named}. Touch or hover the chart to read ${k.hint}.`
      : `${dates.length} ${k.noun}, latest ${latest}. Touch or hover the chart to read ${k.hint}.`;
  return chartHtml({
    series, lineOf: s => s.raw, dotClass: 'tr-pts', dotR: single ? 4 : 2.2,
    aria: single ? `${k.aria}, ${k.one.toLowerCase()}` : `${k.aria} across ${dates.length} ${k.noun}, one line per party`,
    legend, snaps: snapPts, note: single ? k.one : undefined, read,
  });
}

/** Swap each provider's latest-share bars for its history chart. Providers without history keep their bars. */
export function attachSeatHistory(root: ParentNode, code: string, history: SeatHistory): void {
  const seat = history.seats[code];
  if (!seat) return;
  root.querySelectorAll<HTMLElement>('.proj-shares[data-provider]').forEach(el => {
    const key = el.dataset.provider ?? '';
    const points = seat[key];
    if (!points?.length || el.dataset.history) return;
    const snaps = (history.providers[key]?.editions ?? []).map(e => ({ date: e.date, label: e.fieldwork ? `fieldwork ${e.fieldwork}` : '' }));
    const html = seatTrendHtml(points, keysFor(code, history), snaps);
    if (!html) return;
    el.dataset.history = '1';
    el.innerHTML = `<p class="proj-hist-cap">Projected vote share (%), one point per published projection</p>${html}`;
  });
  attachTrend(root);
}

/** Hover/touch readout: finds the nearest date and lists each party's smoothed value. */
export function attachTrend(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('.poll-trend').forEach(el => {
    if (el.dataset.bound) return; el.dataset.bound = '1';
    const d = JSON.parse(el.dataset.trend ?? '{}') as { t0: number; t1: number; snaps?: { t: number; label: string }[]; series: { name: string; colour: string; smooth: Pt[] }[] };
    const svg = el.querySelector('svg')!, cursor = el.querySelector<SVGLineElement>('.tr-cursor')!, read = el.querySelector('.tr-read')!;
    const show = (clientX: number) => {
      const r = svg.getBoundingClientRect();
      const px = (clientX - r.left) / r.width * W;
      let t = d.t0 + Math.min(1, Math.max(0, (px - L) / (W - L - R))) * (d.t1 - d.t0);
      const snap = d.snaps?.length ? d.snaps.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a)) : null;
      if (snap) t = snap.t;
      const cx = L + (t - d.t0) / Math.max(1, d.t1 - d.t0) * (W - L - R);
      cursor.setAttribute('x1', String(cx)); cursor.setAttribute('x2', String(cx)); cursor.removeAttribute('hidden');
      const parts = d.series.map(s => { const v = valueAt({ key: '', name: s.name, raw: [], smooth: s.smooth }, t); return v === null ? null : { name: s.name, v, c: s.colour }; })
        .filter((p): p is { name: string; v: number; c: string } => p !== null).sort((a, b) => b.v - a.v);
      read.innerHTML = `<strong>${escapeHtml(fmtDate(t))}</strong>${snap?.label ? ` <small>(${escapeHtml(snap.label)})</small>` : ''} ` + parts.map(p => `<span style="color:${p.c}">${escapeHtml(p.name)} ${fmt1(p.v)}%</span>`).join(' · ');
    };
    svg.addEventListener('pointermove', e => show(e.clientX));
    svg.addEventListener('pointerdown', e => show(e.clientX));
    svg.style.touchAction = 'pan-y';
  });
}

/** Replace the seat's past-result text list with a line chart of every general election on today's boundaries. */
export function attachResultHistory(root: ParentNode, code: string, history: ResultsHistory): void {
  const el = root.querySelector<HTMLElement>('.result-history');
  const points = history.seats[code];
  if (!el || el.dataset.history || !points?.length) return;
  const html = seatTrendHtml(points, keysFor(code, history), history.elections.map(e => ({ date: e.date, label: e.label })), 'election');
  if (!html) return;
  el.dataset.history = '1';
  const notional = history.elections.filter(e => e.notional && points.some(p => p[0] === e.date));
  const notes = [
    ...notional.map(e => e.note),
    ...(notional.length && !code.startsWith('N') ? ['Reform UK in 2019 is the Brexit Party (renamed Reform UK in 2021).'] : []),
  ];
  el.innerHTML = `<p class="proj-hist-cap">Vote share (%) at each general election, on today’s boundaries</p>${html}` +
    (notes.length ? `<p class="proj-meta">${notes.map(escapeHtml).join(' ')}</p>` : '');
  attachTrend(root);
}
