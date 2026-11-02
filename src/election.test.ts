import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_MEASURE, candidateFor, canonicalParty, joinSeats, partyColour, seatColour, seatHtml, type ElectionSeat } from './election';
const read = (name: string) => JSON.parse(readFileSync(new URL(`../public/data/${name}`, import.meta.url), 'utf8'));
describe('election data joins', () => {
  it('joins every boundary to results, candidates and both projection tables by ONS code', () => {
    const geo = read('constituencies-gb-2024-simplified.geojson');
    const results = read('results-2024-gb.json');
    const candidates = read('candidates-gb.json');
    const projections = read('polls-seats.json');
    const seats = joinSeats(geo, results, candidates, projections);
    expect(seats).toHaveLength(632);
    expect(new Set(seats.map(s => s.code)).size).toBe(632);
    expect(seats.every(s => s.result && s.candidates && s.projections.length === 2)).toBe(true);
    const codes = new Set(seats.map(s => s.code));
    for (const table of [results.seats, candidates.seats, ...Object.values(projections.providers).map((p: any) => p.seats)]) {
      expect(new Set(Object.keys(table))).toEqual(codes);
    }
    expect(seats.find(s => s.code === 'E14001063')?.result?.name).toBe('Aldershot');
  });
  it('resolves projection labels using the seat nation', () => {
    expect(canonicalParty('Nationalist', 'S14000001')).toBe('SNP');
    expect(canonicalParty('Nationalist', 'W07000081')).toBe('Plaid Cymru');
    expect(canonicalParty('Minor')).toBe('Other');
    expect(canonicalParty('Alliance for Green Socialism')).toBe('Alliance for Green Socialism');
  });
  it('colours the default map by tactical pick, never Labour red, and keeps other colourings', () => {
    const results = read('results-2024-gb.json');
    const projections = read('polls-seats.json');
    const seats = joinSeats(read('constituencies-gb-2024-simplified.geojson'), results, read('candidates-gb.json'), projections, read('overrides.json'));
    const data = { results };
    expect(DEFAULT_MEASURE).toBe('tactical');
    for (const seat of seats) expect(seatColour(seat, data, 'tactical').color).not.toBe(partyColour('Labour'));
    const aldershot = seats.find(s => s.code === 'E14001063')!;
    expect(seatColour(aldershot, data, 'winner').label).toBe('Labour');
    expect(seatColour(aldershot, data, 'proj:electoral_calculus').label).toBe('Labour');
    expect(seatColour(aldershot, data, 'majority').label).toBe('10–20%');
    expect(Object.keys(projections.providers)).toEqual(['electoral_calculus', 'more_in_common']);
  });
  it('renders the pick, both providers, the 2024 result and sources in the seat panel', () => {
    const data = { geo: read('constituencies-gb-2024-simplified.geojson'), results: read('results-2024-gb.json'), candidates: read('candidates-gb.json'), projections: read('polls-seats.json'), national: read('polls-national.json'), overrides: read('overrides.json') };
    const seats = joinSeats(data.geo, data.results, data.candidates, data.projections, data.overrides);
    const seat = seats.find(s => s.code === 'E14001063')!;
    const html = seatHtml(seat, { ...data, seats });
    expect(html.indexOf('Who to back to stop Labour')).toBeLessThan(html.indexOf('Seat projections'));
    expect(html).toContain('Electoral Calculus');
    expect(html).toContain('More in Common');
    expect(html).toContain('Past results');
    expect(html).toContain('class="result-history"');
    // No bar charts anywhere in the seat panel: values are text until the time-series charts load.
    expect(html).not.toMatch(/class="[^"]*bar|width:\s*[\d.]+%|<meter|<progress/);
    expect(html).toContain('confidence');
    expect(html).toMatch(/candidate not yet confirmed|Candidate: /);
  });
  it('only names candidates for parties covered by the candidate file', () => {
    const seat = { candidates: { reform: { standing: 'yes', name: 'A Candidate' } } } as unknown as ElectionSeat;
    expect(candidateFor(seat, 'Reform UK')?.name).toBe('A Candidate');
    expect(candidateFor(seat, 'Conservative')).toBeNull();
    expect(candidateFor(seat, 'Restore Britain')).toBeNull();
  });
  it('does not assign a party colour to missing data', () => {
    expect(partyColour('')).toBe('#b9bec4');
    expect(partyColour('Labour')).not.toBe(partyColour('Conservative'));
  });
});
