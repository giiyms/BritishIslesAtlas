import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { joinSeats, partyColour } from './election';
const read = (name: string) => JSON.parse(readFileSync(new URL(`../public/data/${name}`, import.meta.url), 'utf8'));
describe('election data joins', () => {
  it('joins every boundary to results, candidates and both projection tables by ONS code', () => {
    const geo = read('constituencies-gb-2024.geojson');
    const results = read('results-2024-gb.json');
    const candidates = read('candidates-gb.json');
    const projections = read('polls-seats.json');
    const seats = joinSeats(geo, results, candidates, projections);
    expect(seats).toHaveLength(632);
    expect(new Set(seats.map(s => s.code)).size).toBe(632);
    expect(seats.every(s => s.result && s.candidates && s.projections.length === 2)).toBe(true);
    expect(seats.find(s => s.code === 'E14001063')?.result?.name).toBe('Aldershot');
  });
  it('does not assign a party colour to missing data', () => {
    expect(partyColour('')).toBe('#b9bec4');
    expect(partyColour('Labour')).not.toBe(partyColour('Conservative'));
  });
});
