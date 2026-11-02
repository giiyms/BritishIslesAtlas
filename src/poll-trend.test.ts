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
    expect(html).not.toContain('share-bars');
  });
});
