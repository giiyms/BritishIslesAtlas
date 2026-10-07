import { describe, expect, it } from "vitest";
import { MAX_POINTS, decodeState, defaultState, encodeState } from "./state";

describe("URL state", () => {
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
