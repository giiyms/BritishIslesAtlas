import { describe, expect, it } from "vitest";
import {
  assertNeverLabCon,
  colorForEndorse,
  decideEndorsement,
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
    expect(() => assertNeverLabCon({ ...decideEndorsement({ standing: { reform: "yes", restore: "no" } }), endorse: "other:Scottish Labour" })).toThrow();
  });

  it("presumes Reform when Restore confirmed but Reform unconfirmed (fallback branch)", () => {
    const result = decideEndorsement({
      standing: { reform: "unknown", restore: "yes" },
      polls: [{ provider: "mic", reformShare: 10, restoreShare: 30, labShare: 40, conShare: 10 }],
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
    expectNeverLabCon(result);
  });

  it("presumes Reform when Restore unknown and Reform confirmed", () => {
    const result = decideEndorsement({
      standing: { reform: "yes", restore: "unknown" },
    });
    expect(result.endorse).toBe("reform");
    expect(result.presumedReform).toBe(false);
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
    expect(result.reason).toMatch(/inconclusive|default Reform/);
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
    expect(result.reason).toMatch(/stronger Lab\/Con-beater/);
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
