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
      override: { party: 'Liberal Democrat', note: 'Local campaign' },
    });
    expect(pick.party).toBe('Liberal Democrat');
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
    expect(decideTacticalPick({ code: E, projections: [mic({ projected_winner: 'Conservative', con_share: 40, lab_share: 35 })] })).toMatchObject({ party: 'Conservative', confidence: 'medium' });
  });

  it('maps the Nationalist column by nation', () => {
    const pick = decideTacticalPick({ code: 'S14000060', projections: [ec({ projected_winner: 'Nationalist', nat_share: 38, lab_share: 11 }), mic({ projected_winner: 'Scottish National Party (SNP)', snp_share: 32, lab_share: 23 })] });
    expect(pick).toMatchObject({ party: 'SNP', confidence: 'high' });
  });

  it('lowers confidence when combined others outpoll the named challenger', () => {
    const pick = decideTacticalPick({ code: E, projections: [ec({ projected_winner: 'Labour', lab_share: 40, con_share: 12, oth_share: 30 }), mic({ projected_winner: 'Labour', lab_share: 42, con_share: 11, oth_share: 28 })] });
    expect(pick).toMatchObject({ party: 'Conservative', confidence: 'low' });
  });

  it('falls back to the strongest non-Labour 2024 party without projections', () => {
    const clear = decideTacticalPick({ code: E, projections: [], result2024: { winner: 'Labour', shares: [['Labour', 45], ['Conservative', 30], ['Reform UK', 15], ['Other', 10]] } });
    expect(clear).toMatchObject({ party: 'Conservative', confidence: 'medium', source: 'results-2024' });
    const close = decideTacticalPick({ code: E, projections: [], result2024: { winner: 'Labour', shares: [['Labour', 40], ['Reform UK', 22], ['Conservative', 20]] } });
    expect(close).toMatchObject({ party: 'Reform UK', confidence: 'low', source: 'results-2024' });
  });

  it('skips Green: a projected Green winner gives the strongest other challenger, and a Green override is ignored', () => {
    const pick = decideTacticalPick({ code: E, projections: [ec({ projected_winner: 'Green', green_share: 40, lab_share: 30, con_share: 15, reform_share: 10 })], override: { party: 'Green' } });
    expect(pick.party).toBe('Conservative');
    expect(pick.reason).toContain('override naming Green was ignored');
    const fallback = decideTacticalPick({ code: E, projections: [], result2024: { winner: 'Green', shares: [['Green', 50], ['Labour', 30], ['Reform UK', 12]] } });
    expect(fallback.party).toBe('Reform UK');
  });

  it('never picks Labour or Green', () => {
    expect(isLabour('Labour')).toBe(true);
    expect(isLabour('Labour and Co-operative Party')).toBe(true);
    expect(isLabour('Socialist Labour Party')).toBe(false);
    const onlyLabour = decideTacticalPick({ code: E, projections: [ec({ projected_winner: 'Labour', lab_share: 90 })], result2024: { winner: 'Labour', shares: [['Labour', 90], ['Other', 10]] } });
    expect(onlyLabour.party).toBeNull();
    expect(onlyLabour.source).toBe('none');
  });
});

describe('Northern Ireland (no Labour candidates)', () => {
  const N = 'N05000012';
  const niRow = (ni_shares: Record<string, number>, chances: Record<string, number>, projected_winner: string): SeatProjectionRow =>
    ({ projected_winner, ni_shares, chances, oth_share: 1.5, lab_share: null, con_share: null });
  const result2024 = { winner: 'TUV', shares: [['TUV', 28.3], ['DUP', 27.2], ['Sinn Féin', 18.7]] as [string, number][] };

  it('shows the projected winner with its win probability and the 2024 result, at low confidence when close', () => {
    const pick = decideTacticalPick({ code: N, projections: [ec(niRow({ tuv: 28.2, dup: 27.2, sf: 18.7 }, { tuv: 0.446, dup: 0.42 }, 'TUV'))], result2024 });
    expect(pick.party).toBe('TUV');
    expect(pick.noLabour).toBe(true);
    expect(pick.confidence).toBe('low');
    expect(pick.reason).toContain('Labour does not stand in Northern Ireland, so the stop-Labour rule does not apply here.');
    expect(pick.reason).toContain('Electoral Calculus projects TUV to win (28.2%), win probability 45%');
    expect(pick.reason).toContain('In 2024 TUV won on 28.3%, ahead of DUP on 27.2%.');
  });
  it('is medium confidence when the projection is clear, and falls back to the 2024 winner without one', () => {
    expect(decideTacticalPick({ code: N, projections: [ec(niRow({ dup: 46.6, alliance: 40.3 }, { dup: 0.7 }, 'DUP'))] }).confidence).toBe('medium');
    const fallback = decideTacticalPick({ code: N, projections: [], result2024 });
    expect(fallback.party).toBe('TUV');
    expect(fallback.noLabour).toBe(true);
    expect(fallback.source).toBe('results-2024');
    expect(fallback.reason).toContain('No seat projection is available');
  });
  it('still lets an owner override win, and never picks Green', () => {
    const over = decideTacticalPick({ code: N, projections: [ec(niRow({ tuv: 28.2, dup: 27.2 }, {}, 'TUV'))], override: { party: 'DUP', note: 'test' } });
    expect(over.party).toBe('DUP');
    expect(over.source).toBe('override');
    expect(over.noLabour).toBe(true);
    const green = decideTacticalPick({ code: N, projections: [], result2024: { winner: 'Green', shares: [['Green', 40], ['Alliance', 35]] } });
    expect(green.party).toBe('Alliance');
  });
  it('uses the normal stop-Labour rule if Labour ever appears in a Northern Ireland seat', () => {
    const pick = decideTacticalPick({ code: N, projections: [], result2024: { winner: 'Labour', shares: [['Labour', 40], ['DUP', 30]] } });
    expect(pick.noLabour).toBeUndefined();
    expect(pick.party).toBe('DUP');
  });
});

describe('tactical picks on the shipped data', () => {
  const read = (name: string) => JSON.parse(readFileSync(new URL(`../public/data/${name}`, import.meta.url), 'utf8'));
  const seats = joinSeats(read('constituencies-gb-2024-simplified.geojson'), read('results-2024-gb.json'), read('candidates-gb.json'), read('polls-seats.json'), read('overrides.json'));

  it('gives every UK seat a non-Labour pick with a reason and sources', () => {
    expect(seats).toHaveLength(650);
    for (const seat of seats) {
      expect(seat.pick.party, seat.name).toBeTruthy();
      expect(isLabour(seat.pick.party), seat.name).toBe(false);
      expect(seat.pick.party, seat.name).not.toMatch(/green/i);
      expect(['high', 'medium', 'low']).toContain(seat.pick.confidence);
      expect(seat.pick.reason.length).toBeGreaterThan(20);
      expect(seat.pick.sources.length).toBeGreaterThan(0);
    }
  });

  it('shows the projected winner in all 18 Northern Ireland seats and says the stop-Labour rule does not apply', () => {
    const ni = seats.filter(s => s.code.startsWith('N'));
    expect(ni).toHaveLength(18);
    for (const seat of ni) {
      expect(seat.pick.noLabour, seat.name).toBe(true);
      expect(seat.pick.reason).toContain('Labour does not stand in Northern Ireland');
      expect(seat.pick.reason).toContain('In 2024');
      expect(['Reform UK', 'Restore Britain']).not.toContain(seat.pick.party);
    }
    expect(seats.filter(s => !s.code.startsWith('N')).every(s => !s.pick.noLabour)).toBe(true);
    expect(seats.find(s => s.code === 'N05000001')!.pick.party).toBe('DUP'); // Belfast East
    expect(seats.find(s => s.code === 'N05000013')!.pick.party).toBe('Independent'); // North Down
  });

  it('picks more than one party (no default party)', () => {
    expect(new Set(seats.map(s => s.pick.party)).size).toBeGreaterThan(3);
  });
});
