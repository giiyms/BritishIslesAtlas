import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { joinSeats } from './election';
import { decideTacticalPick, isLabour, overrideParty, type ProjectionInput, type SeatProjectionRow } from './tactical';

const ec = (row: SeatProjectionRow): ProjectionInput => ({ provider: 'Electoral Calculus', url: 'https://www.electoralcalculus.co.uk/prediction_main.html', row });
const mic = (row: SeatProjectionRow): ProjectionInput => ({ provider: 'More in Common', url: 'https://www.moreincommon.org.uk/', row });
const E = 'E14000001';

describe('decideTacticalPick', () => {
  it('lets an owner override win over the projections', () => {
    const pick = decideTacticalPick({
      code: E,
      projections: [ec({ projected_winner: 'Reform', reform_share: 35, lab_share: 30 }), mic({ projected_winner: 'Reform UK', reform_share: 33, lab_share: 30 })],
      override: { party: 'Green', note: 'Local campaign' },
    });
    expect(pick.party).toBe('Green');
    expect(pick.source).toBe('override');
    expect(pick.confidence).toBe('low');
    expect(pick.reason).toContain('Site owner override: Local campaign');
    expect(pick.reason).toContain('would pick Reform UK');
  });

  it('accepts the legacy endorse field in overrides', () => {
    expect(overrideParty({ endorse: 'restore' })).toBe('Restore Britain');
    expect(overrideParty({ endorse: 'other:Lib Dem' })).toBe('Lib Dem');
    expect(overrideParty({ endorse: 'none' })).toBeNull();
  });

  it('ignores an override naming Labour', () => {
    const pick = decideTacticalPick({ code: E, projections: [ec({ projected_winner: 'Conservative', con_share: 40, lab_share: 30 })], override: { party: 'Labour' } });
    expect(pick.party).toBe('Conservative');
    expect(pick.source).toBe('projection');
    expect(pick.reason).toContain('override naming Labour was ignored');
  });

  it('is high confidence when both providers agree', () => {
    const pick = decideTacticalPick({
      code: E,
      projections: [ec({ projected_winner: 'Liberal Democrat', ld_share: 38, con_share: 30, lab_share: 15 }), mic({ projected_winner: 'Liberal Democrat', ld_share: 36, con_share: 31, lab_share: 14 })],
    });
    expect(pick).toMatchObject({ party: 'Liberal Democrat', confidence: 'high', source: 'projection' });
    expect(pick.sources.map(s => s.label)).toEqual(['Electoral Calculus', 'More in Common']);
  });

  it('picks the strongest challenger when Labour is projected to win', () => {
    const pick = decideTacticalPick({
      code: E,
      projections: [
        ec({ projected_winner: 'Labour', lab_share: 40, con_share: 18, reform_share: 25, green_share: 10, oth_share: 7 }),
        mic({ projected_winner: 'Labour', lab_share: 38, con_share: 20, reform_share: 24, restore_share: 4, oth_share: 2 }),
      ],
    });
    expect(pick).toMatchObject({ party: 'Reform UK', confidence: 'high' });
    expect(pick.providerPicks.every(p => p.basis === 'challenger')).toBe(true);
    expect(pick.reason).toContain('strongest challenger');
  });

  it('is low confidence when providers disagree, choosing the higher mean share', () => {
    const pick = decideTacticalPick({
      code: E,
      projections: [
        ec({ projected_winner: 'Reform', reform_share: 31, lab_share: 30, con_share: 24 }),
        mic({ projected_winner: 'Labour', lab_share: 34, con_share: 29, reform_share: 22 }),
      ],
    });
    // Conservative (24+29)/2 and Reform (31+22)/2 both average 26.5: a tie breaks alphabetically.
    expect(pick.confidence).toBe('low');
    expect(pick.party).toBe('Conservative');
    const clear = decideTacticalPick({
      code: E,
      projections: [
        ec({ projected_winner: 'Reform', reform_share: 33, lab_share: 30, con_share: 20 }),
        mic({ projected_winner: 'Labour', lab_share: 34, con_share: 25, reform_share: 24 }),
      ],
    });
    expect(clear).toMatchObject({ party: 'Reform UK', confidence: 'low' });
    expect(clear.reason).toContain('disagree');
  });

  it('is medium confidence with one provider', () => {
    expect(decideTacticalPick({ code: E, projections: [mic({ projected_winner: 'Green', green_share: 40, lab_share: 35 })] })).toMatchObject({ party: 'Green', confidence: 'medium' });
  });

  it('maps the Nationalist column by nation', () => {
    const pick = decideTacticalPick({ code: 'S14000060', projections: [ec({ projected_winner: 'Nationalist', nat_share: 38, lab_share: 11 }), mic({ projected_winner: 'Scottish National Party (SNP)', snp_share: 32, lab_share: 23 })] });
    expect(pick).toMatchObject({ party: 'SNP', confidence: 'high' });
  });

  it('lowers confidence when combined others outpoll the named challenger', () => {
    const pick = decideTacticalPick({ code: E, projections: [ec({ projected_winner: 'Labour', lab_share: 40, green_share: 12, oth_share: 30 }), mic({ projected_winner: 'Labour', lab_share: 42, green_share: 11, oth_share: 28 })] });
    expect(pick).toMatchObject({ party: 'Green', confidence: 'low' });
  });

  it('falls back to the strongest non-Labour 2024 party without projections', () => {
    const clear = decideTacticalPick({ code: E, projections: [], result2024: { winner: 'Labour', shares: [['Labour', 45], ['Conservative', 30], ['Reform UK', 15], ['Other', 10]] } });
    expect(clear).toMatchObject({ party: 'Conservative', confidence: 'medium', source: 'results-2024' });
    const close = decideTacticalPick({ code: E, projections: [], result2024: { winner: 'Labour', shares: [['Labour', 40], ['Reform UK', 22], ['Conservative', 20]] } });
    expect(close).toMatchObject({ party: 'Reform UK', confidence: 'low', source: 'results-2024' });
  });

  it('never picks Labour', () => {
    expect(isLabour('Labour')).toBe(true);
    expect(isLabour('Labour and Co-operative Party')).toBe(true);
    expect(isLabour('Socialist Labour Party')).toBe(false);
    const onlyLabour = decideTacticalPick({ code: E, projections: [ec({ projected_winner: 'Labour', lab_share: 90 })], result2024: { winner: 'Labour', shares: [['Labour', 90], ['Other', 10]] } });
    expect(onlyLabour.party).toBeNull();
    expect(onlyLabour.source).toBe('none');
  });
});

describe('tactical picks on the shipped data', () => {
  const read = (name: string) => JSON.parse(readFileSync(new URL(`../public/data/${name}`, import.meta.url), 'utf8'));
  const seats = joinSeats(read('constituencies-gb-2024-simplified.geojson'), read('results-2024-gb.json'), read('candidates-gb.json'), read('polls-seats.json'), read('overrides.json'));

  it('gives every GB seat a non-Labour pick with a reason and sources', () => {
    expect(seats).toHaveLength(632);
    for (const seat of seats) {
      expect(seat.pick.party, seat.name).toBeTruthy();
      expect(isLabour(seat.pick.party), seat.name).toBe(false);
      expect(['high', 'medium', 'low']).toContain(seat.pick.confidence);
      expect(seat.pick.reason.length).toBeGreaterThan(20);
      expect(seat.pick.sources.length).toBeGreaterThan(0);
    }
  });

  it('picks more than one party (no default party)', () => {
    expect(new Set(seats.map(s => s.pick.party)).size).toBeGreaterThan(3);
  });
});
