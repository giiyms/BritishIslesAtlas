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
    expect(seats).toHaveLength(650);
    expect(new Set(seats.map(s => s.code)).size).toBe(650);
    expect(seats.filter(s => s.code.startsWith('N'))).toHaveLength(18);
    // Northern Ireland: Electoral Calculus only (More in Common's MRP is GB-only).
    expect(seats.every(s => s.result && s.candidates && s.projections.length === (s.code.startsWith('N') ? 1 : 2))).toBe(true);
    const codes = new Set(seats.map(s => s.code));
    const gb = new Set([...codes].filter(c => !c.startsWith('N')));
    for (const table of [results.seats, candidates.seats, projections.providers.electoral_calculus.seats]) {
      expect(new Set(Object.keys(table))).toEqual(codes);
    }
    expect(new Set(Object.keys(projections.providers.more_in_common.seats))).toEqual(gb);
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
    const seat = { code: 'E14001063', candidates: { reform: { standing: 'yes', name: 'A Candidate' } } } as unknown as ElectionSeat;
    expect(candidateFor(seat, 'Reform UK')?.name).toBe('A Candidate');
    expect(candidateFor(seat, 'Conservative')).toBeNull();
    expect(candidateFor(seat, 'Restore Britain')).toBeNull();
  });
  it('renders a Northern Ireland card: projected winner, no stop-Labour pick, no Reform/Restore, MiC GB-only', () => {
    const data = { geo: read('constituencies-gb-2024-simplified.geojson'), results: read('results-2024-gb.json'), candidates: read('candidates-gb.json'), projections: read('polls-seats.json'), national: read('polls-national.json'), overrides: read('overrides.json') };
    const seats = joinSeats(data.geo, data.results, data.candidates, data.projections, data.overrides);
    const seat = seats.find(s => s.code === 'N05000001')!;
    expect(seat.name).toBe('Belfast East');
    const html = seatHtml(seat, { ...data, seats });
    expect(html).toContain('Projected winner · no stop-Labour pick: Labour does not stand in Northern Ireland');
    expect(html).not.toContain('Who to back to stop Labour');
    expect(html).toContain('<strong>DUP</strong>');
    expect(html).toContain('More in Common’s MRP covers Great Britain only');
    expect(html).toContain('Democracy Club lists no candidates here for the next general election yet.');
    expect(html).not.toMatch(/Reform UK|Restore Britain/);
    expect(html).toContain('Win probability: DUP');
    expect(partyColour('DUP')).not.toBe(partyColour('Other'));
    for (const p of ['Sinn Féin', 'SDLP', 'UUP', 'Alliance', 'TUV']) expect(partyColour(p)).not.toBe(partyColour('Other'));
  });
  it('maps Northern Ireland party labels without catching other Alliances', () => {
    expect(canonicalParty('APNI')).toBe('Alliance');
    expect(canonicalParty('Sinn Fein')).toBe('Sinn Féin');
    expect(canonicalParty('Democratic Unionist Party - D.U.P.')).toBe('DUP');
    expect(canonicalParty('Alliance for Democracy and Freedom')).toBe('Alliance for Democracy and Freedom');
    expect(canonicalParty('PBPA')).toBe('People Before Profit');
  });
  it('does not assign a party colour to missing data', () => {
    expect(partyColour('')).toBe('#b9bec4');
    expect(partyColour('Labour')).not.toBe(partyColour('Conservative'));
  });
});
