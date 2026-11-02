import { describe, expect, it } from 'vitest';
import { buildSeries, niceBounds, trendHtml, valueAt } from './poll-trend';
import { readFileSync } from 'node:fs';

const polls = [
  { date: '2026-10-10', lab: 30, ref: 20 }, { date: '2026-10-08', lab: 28, ref: 22 }, { date: '2026-10-05', lab: 26, ref: 24 },
  { date: '2026-09-01', lab: 20, ref: null },
];
describe('poll trend', () => {
  it('sorts oldest to newest and drops polls that do not report the party', () => {
    const lab = buildSeries(polls).find(s => s.key === 'lab')!;
    expect(lab.raw.map(p => p.v)).toEqual([20, 26, 28, 30]);
    expect(buildSeries(polls).find(s => s.key === 'ref')!.raw).toHaveLength(3);
  });
  it('smooths only where at least three polls fall inside the window', () => {
    const lab = buildSeries(polls).find(s => s.key === 'lab')!;
    expect(lab.smooth.map(p => p.v)).toEqual([28, 28, 28]);
    expect(valueAt(lab, Date.parse('2026-09-15T00:00:00Z'))).toBeNull();
  });
  it('picks round axis bounds around the data', () => { expect(niceBounds(14.5, 31)).toEqual([10, 35]); });
  it('renders the shipped national history as a chart with every party legend entry', () => {
    const national = JSON.parse(readFileSync('public/data/polls-national.json', 'utf8'));
    expect(national.polls.length).toBeGreaterThan(100);
    expect(national.polls.every((p: { date: string | null }) => /^\d{4}-\d{2}-\d{2}$/.test(p.date ?? ''))).toBe(true);
    const html = trendHtml(national.polls);
    expect(html).toContain('<polyline');
    for (const n of ['Labour', 'Reform UK', 'Conservative']) expect(html).toContain(n);
    expect(html).not.toMatch(/width:\s*[\d.]+%/);
  });
});

import { buildSeatSeries, ONE_POINT_NOTE, seatTrendHtml, type ResultsHistory, type SeatHistory, type SeatHistoryPoint } from './poll-trend';

const PARTIES = ['con', 'lab', 'ld', 'ref', 'grn', 'snp', 'pc', 'rb', 'oth'];
describe('seat projection history', () => {
  const pts: SeatHistoryPoint[] = [
    ['2026-09-30', 23.7, 27.9, 9.2, 23.7, 8.8, null, null, null, 0.4],
    ['2025-04-26', 27.2, 27.3, 10.5, 26.3, 8.0, 0, null, null, 0.7],
  ];
  it('keeps published values unsmoothed, oldest first, and drops parties never reaching 1%', () => {
    const s = buildSeatSeries(pts, PARTIES);
    expect(s.map(x => x.name)).toEqual(['Labour', 'Conservative', 'Reform UK', 'Liberal Democrat', 'Green']);
    const lab = s.find(x => x.key === 'lab')!;
    expect(lab.raw.map(p => p.v)).toEqual([27.3, 27.9]);
    expect(lab.smooth).toEqual(lab.raw);
  });
  it('draws a line per party with the latest value and change since the previous edition', () => {
    const html = seatTrendHtml(pts, PARTIES);
    expect(html).toContain('<polyline');
    expect(html).toContain('Labour <b>27.9%</b> <small>+0.6 vs previous</small>');
    expect(html).toContain('2 projections, latest 30 Sep 2026');
    expect(html).not.toContain(ONE_POINT_NOTE);
  });
  it('shows a single labelled dot when only one projection was published', () => {
    const html = seatTrendHtml([pts[0]], PARTIES);
    expect(html).not.toContain('<polyline');
    expect(html).toContain(ONE_POINT_NOTE);
    expect(html).toContain('r="4"');
  });
  it('ships real history for every seat: dated, sorted, 2024-boundary codes, values in range', () => {
    const h = JSON.parse(readFileSync('public/data/polls-seats-history.json', 'utf8')) as SeatHistory;
    expect(h.parties).toEqual(PARTIES);
    const codes = Object.keys(h.seats);
    expect(codes).toHaveLength(650);
    expect(codes.every(c => /^(E1400|S1400|W0700|N0500)\d{4}$/.test(c))).toBe(true);
    expect(codes.filter(c => c.startsWith('N'))).toHaveLength(18);
    expect(h.parties_ni).toEqual(['dup', 'sf', 'sdlp', 'uup', 'alliance', 'tuv', 'ind', 'oth']);
    for (const [key, p] of Object.entries(h.providers)) {
      expect(p.editions.length).toBeGreaterThan(1);
      const dates = p.editions.map(e => e.date);
      expect([...dates].sort()).toEqual(dates);
      for (const [code, pointsBySeat] of Object.entries(h.seats)) {
        const points = pointsBySeat[key] ?? [];
        if (code.startsWith('N')) expect(key, 'More in Common is GB-only').not.toBe(points.length ? 'more_in_common' : '');
        for (const pt of points) {
          expect(dates).toContain(pt[0]);
          expect(pt).toHaveLength((code.startsWith('N') ? h.parties_ni!.length : PARTIES.length) + 1);
          for (const v of pt.slice(1)) if (v !== null) expect(v as number).toBeGreaterThanOrEqual(0), expect(v as number).toBeLessThanOrEqual(100);
        }
      }
    }
    expect(seatTrendHtml(h.seats.E14001063.electoral_calculus, h.parties)).toContain('<polyline');
  });
  it('ends each provider history on the edition shown as the latest seat projection', () => {
    const h = JSON.parse(readFileSync('public/data/polls-seats-history.json', 'utf8')) as SeatHistory;
    const live = JSON.parse(readFileSync('public/data/polls-seats.json', 'utf8'));
    const ec = live.providers.electoral_calculus.seats.E14001063;
    const last = h.seats.E14001063.electoral_calculus.at(-1)!;
    expect(last.slice(1, 6)).toEqual([ec.con_share, ec.lab_share, ec.ld_share, ec.reform_share, ec.green_share]);
    const mic = live.providers.more_in_common.seats.E14001063;
    expect(h.seats.E14001063.more_in_common.at(-1)!.slice(1, 5)).toEqual([mic.con_share, mic.lab_share, mic.ld_share, mic.reform_share]);
    const ni = live.providers.electoral_calculus.seats.N05000001;
    expect(h.seats.N05000001.electoral_calculus.at(-1)!.slice(1)).toEqual([...['dup', 'sf', 'sdlp', 'uup', 'alliance', 'tuv', 'ind'].map(k => ni.ni_shares[k]), ni.oth_share]);
  });
});

describe('seat past general-election results', () => {
  const h = JSON.parse(readFileSync('public/data/results-history-gb.json', 'utf8')) as ResultsHistory;
  it('ships the 2019 notional and 2024 actual results for all 650 seats', () => {
    expect(h.elections.map(e => [e.date, e.notional])).toEqual([['2019-12-12', true], ['2024-07-04', false]]);
    expect(Object.keys(h.seats)).toHaveLength(650);
    for (const [code, pts] of Object.entries(h.seats)) {
      expect(pts[0]).toHaveLength((code.startsWith('N') ? h.parties_ni!.length : h.parties.length) + 1);
      expect(pts.map(p => p[0])).toEqual(['2019-12-12', '2024-07-04']);
      const total = (pts[1].slice(1) as (number | null)[]).reduce<number>((a, v) => a + (v ?? 0), 0);
      expect(total).toBeGreaterThan(99.4); expect(total).toBeLessThan(100.6);
    }
  });
  it('matches the 2024 results file the seat card uses', () => {
    const r = JSON.parse(readFileSync('public/data/results-2024-gb.json', 'utf8'));
    const lab = r.seats.E14001063.shares.find((s: [string, number]) => s[0] === 'Lab')[1];
    expect(h.seats.E14001063[1][1 + h.parties.indexOf('lab')]).toBe(lab);
  });
  it('keys Northern Ireland seats by NI parties (North Down: independent Alex Easton won in 2024)', () => {
    const nd = h.seats.N05000013;
    expect(nd[1][1 + h.parties_ni!.indexOf('ind')]).toBe(48.6);
    expect(nd[0][1 + h.parties_ni!.indexOf('dup')]).toBe(38.7);
  });
  it('draws two elections as a line with dots and names them', () => {
    const html = seatTrendHtml(h.seats.E14001063, h.parties, h.elections.map(e => ({ date: e.date, label: e.label })), 'election');
    expect(html).toContain('<polyline');
    expect(html).toContain('2 elections on today’s boundaries: 2019 notional and 2024');
    expect(html).toContain('r="2.2"');
  });
});
