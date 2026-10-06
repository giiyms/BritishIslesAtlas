import { describe, expect, it } from "vitest";
import {
  assertNeverLabCon,
  colorForEndorse,
  decideEndorsement,
  preferRestoreFromPolls,
  restoreAheadFromPolls,
  type EndorseResult,
} from "./endorse";

function expectNeverLabCon(result: EndorseResult) {
  assertNeverLabCon(result);
  const pick = String(result.endorse).toLowerCase();
  expect(pick).not.toMatch(/labour|conservative|^lab$|^con$/);
  expect(["reform", "restore", "none"].includes(pick) || pick.startsWith("other:")).toBe(true);
}

describe("decideEndorsement", () => {
  it("honours Daniel override", () => {
    const result = decideEndorsement({
      standing: { reform: "yes", restore: "yes" },
      polls: [{ provider: "mic", reformShare: 30, restoreShare: 5, labShare: 25, conShare: 20 }],
      override: {
        pcon24cd: "E14000001",
        endorse: "restore",
        note: "Local deal",
        by: "Daniel",
      },
    });
    expect(result.endorse).toBe("restore");
    expect(result.isOverride).toBe(true);
    expect(result.reason).toContain("Daniel override");
    expectNeverLabCon(result);
  });

  it("override still wins over Restore-ahead polls", () => {
    const result = decideEndorsement({
      standing: { reform: "unknown", restore: "unknown" },
      polls: [
        {
          provider: "more_in_common",
          reformShare: 26.9,
          restoreShare: 28.2,
          labShare: 15.4,
          conShare: 17.8,
          projectedWinner: "Restore Britain",
        },
      ],
      override: { pcon24cd: "E14001256", endorse: "reform", note: "Hold Restore for now" },
    });
    expect(result.endorse).toBe("reform");
    expect(result.isOverride).toBe(true);
    expect(result.reason).toContain("Daniel override");
    expectNeverLabCon(result);
  });

  it("rejects Lab/Con override values", () => {
    const result = decideEndorsement({
      standing: { reform: "unknown", restore: "unknown" },
      override: { pcon24cd: "E14000001", endorse: "other:Labour" },
    });
    expect(result.endorse).toBe("none");
    expect(result.isOverride).toBe(true);
    expectNeverLabCon(result);
  });

  it("rejects Lab/Con override labels in any wording", () => {
    for (const endorse of [
      "other:Scottish Labour",
      "other:Welsh Labour",
      "other:The Conservative Party",
      "other:Scottish Conservatives",
      "other:Tories",
      "other:Labour Co-operative",
    ] as const) {
      const result = decideEndorsement({
        standing: { reform: "yes", restore: "yes" },
        override: { pcon24cd: "E14000001", endorse },
      });
      expect(result.endorse).toBe("none");
      expect(result.reason).toMatch(/Override rejected/);
      expectNeverLabCon(result);
    }
    expect(() =>
      assertNeverLabCon({
        ...decideEndorsement({ standing: { reform: "yes", restore: "no" } }),
        endorse: "other:Scottish Labour",
      }),
    ).toThrow();
  });

  it("picks Restore when ahead on poll even if Reform unconfirmed and Restore confirmed", () => {
    // Previously fell through to presumed Reform; Restore-ahead now wins.
    const result = decideEndorsement({
      standing: { reform: "unknown", restore: "yes" },
      polls: [{ provider: "mic", reformShare: 10, restoreShare: 30, labShare: 40, conShare: 10 }],
    });
    expect(result.endorse).toBe("restore");
    expect(result.presumedReform).toBe(false);
    expect(result.reason).toMatch(/Restore ahead of Reform/);
    expectNeverLabCon(result);
  });

  it("presumes Reform on fallback when Restore confirmed but no Restore-ahead poll", () => {
    const result = decideEndorsement({
      standing: { reform: "unknown", restore: "yes" },
      polls: [{ provider: "mic", reformShare: 30, restoreShare: 5, labShare: 40, conShare: 10 }],
    });
    expect(result.endorse).toBe("reform");
    expect(result.presumedReform).toBe(true);
    expectNeverLabCon(result);
  });

  it("returns none when neither standing", () => {
    const result = decideEndorsement({
      standing: { reform: "no", restore: "no" },
    });
    expect(result.endorse).toBe("none");
    expect(result.reason).toMatch(/No Reform\/Restore/);
    expectNeverLabCon(result);
  });

  it("defaults Reform when Restore not standing", () => {
    const result = decideEndorsement({
      standing: { reform: "yes", restore: "no" },
    });
    expect(result.endorse).toBe("reform");
    expect(result.presumedReform).toBe(false);
    expect(result.reason).toMatch(/Restore not standing/);
    expectNeverLabCon(result);
  });

  it("presumes Reform when Restore unknown and Reform unknown", () => {
    const result = decideEndorsement({
      standing: { reform: "unknown", restore: "unknown" },
    });
    expect(result.endorse).toBe("reform");
    expect(result.presumedReform).toBe(true);
    expect(result.reason).toMatch(/presumed Reform/);
    expect(result.reason).not.toMatch(/Restore not standing/);
    expectNeverLabCon(result);
  });

  it("defaults Reform when Restore unknown and Reform confirmed (not 'not standing')", () => {
    const result = decideEndorsement({
      standing: { reform: "yes", restore: "unknown" },
    });
    expect(result.endorse).toBe("reform");
    expect(result.presumedReform).toBe(false);
    expect(result.reason).toMatch(/Restore not confirmed/);
    expect(result.reason).not.toMatch(/Restore not standing/);
    expectNeverLabCon(result);
  });

  it("endorses Restore-only when Reform not standing", () => {
    const result = decideEndorsement({
      standing: { reform: "no", restore: "yes" },
    });
    expect(result.endorse).toBe("restore");
    expect(result.reason).toMatch(/Only Restore/);
    expectNeverLabCon(result);
  });

  it("defaults Reform when both standing and no polls", () => {
    const result = decideEndorsement({
      standing: { reform: "yes", restore: "yes" },
      polls: [],
    });
    expect(result.endorse).toBe("reform");
    expect(result.reason).toMatch(/no seat poll loaded/);
    expectNeverLabCon(result);
  });

  it("defaults Reform on poll tie", () => {
    const result = decideEndorsement({
      standing: { reform: "yes", restore: "yes" },
      polls: [
        {
          provider: "mic",
          reformShare: 22,
          restoreShare: 22,
          labShare: 28,
          conShare: 18,
          projectedWinner: "Labour",
        },
      ],
    });
    expect(result.endorse).toBe("reform");
    expect(result.reason).not.toMatch(/inconclusive/);
    expect(result.reason).toMatch(/default Reform/);
    expectNeverLabCon(result);
  });

  it("says seat polls favour Reform when both standing and Reform ahead (not inconclusive)", () => {
    // Holborn / Makerfield style
    const result = decideEndorsement({
      standing: { reform: "yes", restore: "yes" },
      polls: [
        {
          provider: "electoral_calculus",
          reformShare: 14.6,
          restoreShare: null,
          labShare: 40.0,
          conShare: 7.1,
          projectedWinner: "Labour",
        },
        {
          provider: "more_in_common",
          reformShare: 13.7,
          restoreShare: 2.1,
          labShare: 40.8,
          conShare: 8.8,
          projectedWinner: "Labour",
        },
      ],
    });
    expect(result.endorse).toBe("reform");
    expect(result.reason).toMatch(/favour Reform/);
    expect(result.reason).not.toMatch(/inconclusive/);
    expectNeverLabCon(result);
  });

  it("prefers Restore when both standing and polls show Restore stronger", () => {
    const result = decideEndorsement({
      standing: { reform: "yes", restore: "yes" },
      polls: [
        {
          provider: "mic",
          reformShare: 12,
          restoreShare: 28,
          labShare: 30,
          conShare: 15,
          projectedWinner: "Labour",
        },
      ],
    });
    expect(result.endorse).toBe("restore");
    expect(result.reason).toMatch(/Restore ahead of Reform/);
    expectNeverLabCon(result);
  });

  it("picks Restore ahead without DC Restore candidate (Great Yarmouth-style MIC)", () => {
    const result = decideEndorsement({
      standing: { reform: "unknown", restore: "unknown" },
      polls: [
        {
          provider: "electoral_calculus",
          reformShare: 17.9,
          restoreShare: null,
          labShare: 22.9,
          conShare: 18.2,
          projectedWinner: "Minor",
        },
        {
          provider: "more_in_common",
          reformShare: 26.9,
          restoreShare: 28.2,
          labShare: 15.4,
          conShare: 17.8,
          projectedWinner: "Restore Britain",
        },
      ],
    });
    expect(result.endorse).toBe("restore");
    expect(result.isOverride).toBe(false);
    expect(result.presumedReform).toBe(false);
    expect(result.reason).toMatch(/More in Common projects Restore ahead of Reform here \(28\.2% vs 26\.9%\)/);
    expect(result.reason).toMatch(/Vote Restore to avoid splitting/);
    // EC has null Restore — not a numeric Reform-ahead disagreement
    expect(result.reason).not.toMatch(/disagree/);
    expectNeverLabCon(result);
  });

  it("picks Restore when providers disagree (Restore still wins)", () => {
    const result = decideEndorsement({
      standing: { reform: "yes", restore: "unknown" },
      polls: [
        {
          provider: "electoral_calculus",
          reformShare: 30,
          restoreShare: 20,
          labShare: 25,
          conShare: 15,
          projectedWinner: "Reform",
        },
        {
          provider: "more_in_common",
          reformShare: 22,
          restoreShare: 27,
          labShare: 25,
          conShare: 15,
          projectedWinner: "Restore Britain",
        },
      ],
    });
    expect(result.endorse).toBe("restore");
    expect(result.reason).toMatch(/disagree/);
    expect(result.reason).toMatch(/Restore ahead/);
    expectNeverLabCon(result);
  });

  it("never picks Lab/Con even when they lead every poll", () => {
    const result = decideEndorsement({
      standing: { reform: "yes", restore: "no" },
      polls: [
        {
          provider: "ec",
          reformShare: 8,
          restoreShare: 1,
          labShare: 45,
          conShare: 30,
          projectedWinner: "Labour",
        },
        {
          provider: "mic",
          reformShare: 7,
          restoreShare: 1,
          labShare: 48,
          conShare: 28,
          projectedWinner: "Conservative",
        },
      ],
    });
    expect(result.endorse).toBe("reform");
    expect(result.longShot).toBe(true);
    expectNeverLabCon(result);
  });

  it("still endorses Reform/Restore when third party leads", () => {
    const result = decideEndorsement({
      standing: { reform: "yes", restore: "unknown" },
      polls: [
        {
          provider: "mic",
          reformShare: 15,
          restoreShare: 2,
          labShare: 20,
          conShare: 18,
          projectedWinner: "Liberal Democrat",
        },
      ],
    });
    expect(result.endorse).toBe("reform");
    expect(result.thirdPartyLead).toMatch(/Liberal Democrat/i);
    expectNeverLabCon(result);
  });

  it("override to none works", () => {
    const result = decideEndorsement({
      standing: { reform: "yes", restore: "yes" },
      override: { pcon24cd: "E14000001", endorse: "none", note: "Hold" },
    });
    expect(result.endorse).toBe("none");
    expect(result.isOverride).toBe(true);
    expectNeverLabCon(result);
  });

  it("Reform remains default when no Restore-ahead poll", () => {
    const result = decideEndorsement({
      standing: { reform: "unknown", restore: "unknown" },
      polls: [
        {
          provider: "more_in_common",
          reformShare: 38.7,
          restoreShare: 10.9,
          labShare: 13.0,
          conShare: 26.2,
          projectedWinner: "Reform UK",
        },
      ],
    });
    expect(result.endorse).toBe("reform");
    expect(result.presumedReform).toBe(true);
    expectNeverLabCon(result);
  });
});

describe("restoreAheadFromPolls / preferRestoreFromPolls", () => {
  it("flips on any trusted provider with restore_share > reform_share", () => {
    expect(
      preferRestoreFromPolls([
        { provider: "more_in_common", reformShare: 26.9, restoreShare: 28.2 },
        { provider: "electoral_calculus", reformShare: 17.9, restoreShare: null },
      ]),
    ).toBe(true);
  });

  it("does not flip on ties or Reform ahead", () => {
    expect(preferRestoreFromPolls([{ provider: "mic", reformShare: 22, restoreShare: 22 }])).toBe(false);
    expect(preferRestoreFromPolls([{ provider: "mic", reformShare: 30, restoreShare: 10 }])).toBe(false);
  });

  it("marks disagree when one trusted provider each way", () => {
    const detail = restoreAheadFromPolls([
      { provider: "ec", reformShare: 30, restoreShare: 10 },
      { provider: "mic", reformShare: 20, restoreShare: 25 },
    ]);
    expect(detail.ahead).toBe(true);
    expect(detail.disagree).toBe(true);
  });

  it("ignores untrusted providers", () => {
    expect(
      preferRestoreFromPolls([{ provider: "made_up_pollster", reformShare: 10, restoreShare: 40 }]),
    ).toBe(false);
  });
});

describe("colorForEndorse", () => {
  it("uses distinct non-red/blue colours", () => {
    const reform = colorForEndorse("reform", false);
    const restore = colorForEndorse("restore", false);
    const none = colorForEndorse("none", false);
    const override = colorForEndorse("reform", true);
    const forbidden = [/#e41c3e/i, /#0087dc/i, /#e4003b/i, /#00a6d6/i];
    for (const c of [reform, restore, none, override]) {
      for (const bad of forbidden) {
        expect(c.fill).not.toMatch(bad);
        expect(c.accent).not.toMatch(bad);
      }
    }
    expect(reform.fill).not.toBe(restore.fill);
    expect(override.fill).not.toBe(reform.fill);
  });
});
