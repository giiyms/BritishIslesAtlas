// National voting-intention trend: every poll as a faint dot, plus a smoothed line per party.
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

export function trendHtml(polls: TrendPoll[]): string {
  const series = buildSeries(polls);
  const all = series.flatMap(s => s.raw);
  if (all.length < 3) return '<p>Not enough dated polls for a trend.</p>';
  const t0 = Math.min(...all.map(p => p.t)), t1 = Math.max(...all.map(p => p.t));
  const [lo, hi] = niceBounds(Math.min(...all.map(p => p.v)), Math.max(...all.map(p => p.v)));
  const x = (t: number) => L + (t - t0) / Math.max(1, t1 - t0) * (W - L - R);
  const y = (v: number) => T + (hi - v) / (hi - lo) * (H - T - B);
  const grid = Array.from({ length: (hi - lo) / 5 + 1 }, (_, i) => lo + i * 5)
    .map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="tr-grid"/><text x="${L - 4}" y="${(y(v) + 3).toFixed(1)}" class="tr-tick" text-anchor="end">${v}</text>`).join('');
  const months: string[] = [];
  const cursor = new Date(t0); cursor.setUTCDate(1); cursor.setUTCHours(12);
  for (cursor.setUTCMonth(cursor.getUTCMonth() + 1); cursor.getTime() <= t1; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) {
    const t = cursor.getTime();
    months.push(`<text x="${x(t).toFixed(1)}" y="${H - 6}" class="tr-tick" text-anchor="middle">${MONTH[cursor.getUTCMonth()]}</text>`);
  }
  const dots = series.map(s => `<g fill="${partyColour(s.name)}" class="tr-dots">${s.raw.map(p => `<circle cx="${x(p.t).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="1.4"/>`).join('')}</g>`).join('');
  const lines = series.filter(s => s.smooth.length > 1).map(s => `<polyline fill="none" stroke="${partyColour(s.name)}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${s.smooth.map(p => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')}"/>`).join('');
  const legend = series.map(s => {
    const last = s.smooth[s.smooth.length - 1];
    const before = last ? valueAt(s, last.t - 28 * DAY) : null;
    const delta = last && before !== null ? last.v - before : null;
    const dtxt = delta === null ? '' : ` <small>${Math.abs(delta) < 0.05 ? 'no change' : `${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)}`} in 4 wks</small>`;
    return `<li><i class="swatch" style="background:${partyColour(s.name)}"></i>${escapeHtml(s.name)} <b>${last ? fmt1(last.v) : '–'}%</b>${dtxt}</li>`;
  }).join('');
  const data = escapeHtml(JSON.stringify({ t0, t1, lo, hi, series: series.map(s => ({ name: s.name, colour: partyColour(s.name), smooth: s.smooth })) }));
  return `<div class="poll-trend" data-trend="${data}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Voting intention over time, one line per party" class="tr-svg">${grid}${months.join('')}${dots}${lines}<line class="tr-cursor" y1="${T}" y2="${H - B}" x1="0" x2="0" hidden/></svg>` +
    `<p class="tr-read" aria-live="polite">Latest ${escapeHtml(fmtDate(t1))}. Touch or hover the chart to read a date.</p><ul class="tr-legend">${legend}</ul></div>`;
}

/** Hover/touch readout: finds the nearest date and lists each party's smoothed value. */
export function attachTrend(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('.poll-trend').forEach(el => {
    if (el.dataset.bound) return; el.dataset.bound = '1';
    const d = JSON.parse(el.dataset.trend ?? '{}') as { t0: number; t1: number; series: { name: string; colour: string; smooth: Pt[] }[] };
    const svg = el.querySelector('svg')!, cursor = el.querySelector<SVGLineElement>('.tr-cursor')!, read = el.querySelector('.tr-read')!;
    const show = (clientX: number) => {
      const r = svg.getBoundingClientRect();
      const px = (clientX - r.left) / r.width * W;
      const t = d.t0 + Math.min(1, Math.max(0, (px - L) / (W - L - R))) * (d.t1 - d.t0);
      const cx = L + (t - d.t0) / Math.max(1, d.t1 - d.t0) * (W - L - R);
      cursor.setAttribute('x1', String(cx)); cursor.setAttribute('x2', String(cx)); cursor.removeAttribute('hidden');
      const parts = d.series.map(s => { const v = valueAt({ key: '', name: s.name, raw: [], smooth: s.smooth }, t); return v === null ? null : { name: s.name, v, c: s.colour }; })
        .filter((p): p is { name: string; v: number; c: string } => p !== null).sort((a, b) => b.v - a.v);
      read.innerHTML = `<strong>${escapeHtml(fmtDate(t))}</strong> ` + parts.map(p => `<span style="color:${p.c}">${escapeHtml(p.name)} ${fmt1(p.v)}%</span>`).join(' · ');
    };
    svg.addEventListener('pointermove', e => show(e.clientX));
    svg.addEventListener('pointerdown', e => show(e.clientX));
    svg.style.touchAction = 'pan-y';
  });
}
