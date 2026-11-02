import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CROSSFADE, HEAT_MAXZOOM, HEAT_OPACITY_STOPS, POINT_OPACITY_STOPS, heatWeight, heatmapPaint } from "./point-style";

const at = (stops: [number, number][], z: number) => {
  if (z <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [z0, v0] = stops[i - 1], [z1, v1] = stops[i];
    if (z <= z1) return v0 + (v1 - v0) * (z - z0) / (z1 - z0);
  }
  return stops[stops.length - 1][1];
};

describe("point layers: heat and points crossfade, nothing pops", () => {
  it("draws points at every zoom and heat across a wide window, both visible mid-transition", () => {
    for (let z = 0; z <= 22; z += 0.25) expect(at(POINT_OPACITY_STOPS, z)).toBeGreaterThan(0);
    expect(CROSSFADE.end - CROSSFADE.start).toBeGreaterThanOrEqual(5);
    for (const z of [6, 8, 10, 11]) {
      expect(at(HEAT_OPACITY_STOPS, z)).toBeGreaterThan(0);
      expect(at(POINT_OPACITY_STOPS, z)).toBeGreaterThan(0.2);
    }
    expect(at(HEAT_OPACITY_STOPS, CROSSFADE.end)).toBe(0);
    expect(HEAT_MAXZOOM).toBeGreaterThan(CROSSFADE.end);
  });
  it("changes opacity monotonically, heat down and points up", () => {
    let heat = Infinity, pts = -Infinity;
    for (let z = 0; z <= 16; z += 0.25) {
      expect(at(HEAT_OPACITY_STOPS, z)).toBeLessThanOrEqual(heat);
      expect(at(POINT_OPACITY_STOPS, z)).toBeGreaterThanOrEqual(pts);
      heat = at(HEAT_OPACITY_STOPS, z); pts = at(POINT_OPACITY_STOPS, z);
    }
  });
  it("weighs dense layers less so heat reads alike across layers", () => {
    expect(heatWeight("pubs")).toBeLessThan(heatWeight("aquariums"));
    expect(heatWeight("pubs")).toBeGreaterThan(0);
    expect(heatWeight("aquariums")).toBeLessThanOrEqual(1);
    expect(heatmapPaint("pubs", "#d9822b", "#bb7025")["heatmap-weight"]).toBe(heatWeight("pubs"));
  });
  it("keeps the map free of clustering, collision culling and density styles", () => {
    const src = readFileSync(new URL("./map.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/cluster\s*:/);
    expect(src).not.toMatch(/"icon-allow-overlap":\s*false/);
    expect(src).not.toMatch(/minzoom:\s*minZoom|fill-extrusion|density-hex/);
  });
});
