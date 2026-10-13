import { describe, expect, it } from "vitest";
import { MAX_POINTS, decodeState, defaultState, encodeState } from "./state";

describe("URL state", () => {
  it("uses Auto and Recommended as the backwards-compatible defaults", () => {
    expect(defaultState().basemap).toBe("auto");
    expect(defaultState().preset).toBe("recommended");
    expect(encodeState(defaultState())).toBe("");
  });

  it("round-trips a manual style preset and basemap override", () => {
    const s = { ...defaultState(), preset: "night" as const, basemap: "mono" as const };
    expect(decodeState(`#${encodeState(s)}`)).toMatchObject({ preset: "night", basemap: "mono" });
  });

  it("round-trips the optional England-only crop overlay", () => {
    const encoded = encodeState({ ...defaultState(), crops: true });
    expect(encoded).toContain("c=1");
    expect(decodeState(`#${encoded}`).crops).toBe(true);
    expect(decodeState("#c=0").crops).toBe(false);
  });

  it("round-trips per-layer point treatments and ignores malformed choices", () => {
    const s = { ...defaultState(), pointTreatments: { hospitals: "dots", castles: "symbols" } as const };
    expect(decodeState(`#${encodeState(s)}`).pointTreatments).toEqual({ hospitals: "dots", castles: "symbols" });
    expect(decodeState("#q=hospitals:bogus,not-a-layer:dots,castles:symbols").pointTreatments).toEqual({ castles: "symbols" });
  });

  it("persists continuous treatment only for supported areal layers", () => {
    const s = { ...defaultState(), surfaceTreatments: { pharmacies: "continuous" } as const };
    expect(decodeState(`#${encodeState(s)}`).surfaceTreatments).toEqual({ pharmacies: "continuous" });
    expect(decodeState("#u=pharmacies:bogus,hospitals:continuous").surfaceTreatments).toEqual({ hospitals: "continuous" });
  });

  it("encodes the default as an empty hash", () => {
    expect(encodeState(defaultState())).toBe("");
  });

  it("round-trips a full state", () => {
    const s = { ...defaultState(), mode: "election" as const, basemap: "dark" as const, roads: false,
      surface: { kind: "hex" as const, dataset: "pubs-not-real" as never }, electionView: "reform" as const,
      electionLayout: "hex" as const, points: ["pharmacies", "castles"] as never };
    const back = decodeState(`#${encodeState({ ...s, surface: { kind: "seat", dataset: "pharmacies" } })}`);
    expect(back).toEqual({ ...s, surface: { kind: "seat", dataset: "pharmacies" } });
  });

  it("drops unknown layers, caps points and fixes distance datasets", () => {
    const s = decodeState("#p=castles,nope,museums,zoos,piers,ruins,golf-courses&s=distance:castles");
    expect(s.points).toEqual(["castles", "museums", "zoos", "piers", "ruins"]);
    expect(s.points.length).toBeLessThanOrEqual(MAX_POINTS);
    expect(s.surface).toEqual({ kind: "distance", dataset: "hospitals" });
  });

  it("keeps an explicitly empty point list", () => {
    expect(decodeState("#p=").points).toEqual([]);
  });
});
