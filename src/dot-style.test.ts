import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LAYERS } from "./layers";
import { POINT_MAX_OPACITY, POINT_OPACITY_STOPS, POINT_RADIUS_STOPS, pointDrawOrder } from "./point-style";

const at = (stops: [number, number][], z: number) => {
  if (z <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [z0, v0] = stops[i - 1], [z1, v1] = stops[i];
    if (z <= z1) return v0 + (v1 - v0) * (z - z0) / (z1 - z0);
  }
  return stops[stops.length - 1][1];
};

describe("t254u: one small, translucent dot for every point layer", () => {
  it("uses one radius ramp: ~2.5px at z6 to ~5.5px at z16, growing smoothly", () => {
    expect(at(POINT_RADIUS_STOPS, 6)).toBeCloseTo(2.5, 1);
    expect(at(POINT_RADIUS_STOPS, 16)).toBeGreaterThanOrEqual(5);
    expect(at(POINT_RADIUS_STOPS, 16)).toBeLessThanOrEqual(6);
    let prev = 0;
    for (let z = 3; z <= 18; z += 0.25) { expect(at(POINT_RADIUS_STOPS, z)).toBeGreaterThanOrEqual(prev); prev = at(POINT_RADIUS_STOPS, z); }
  });
  it("caps every point at 80% opacity", () => {
    expect(POINT_MAX_OPACITY).toBe(0.8);
    for (let z = 0; z <= 22; z += 0.5) expect(at(POINT_OPACITY_STOPS, z)).toBeLessThanOrEqual(0.8);
  });
  it("has no per-layer size knob left", () => {
    for (const layer of LAYERS) expect(layer).not.toHaveProperty("pointScale");
    const src = readFileSync(new URL("./map.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/pointRadius\([^)]/);
  });
  it("draws rare layers above dense ones, deterministically", () => {
    const order = pointDrawOrder(["lighthouses", "pubs", "places-of-worship", "aquariums"]);
    expect(order.indexOf("pubs")).toBeLessThan(order.indexOf("places-of-worship"));
    expect(order.indexOf("places-of-worship")).toBeLessThan(order.indexOf("lighthouses"));
    expect(order.at(-1)).toBe("aquariums");
    expect(pointDrawOrder(["aquariums", "pubs", "lighthouses", "places-of-worship"])).toEqual(order);
  });
  it("leaves no two points from any layers at exactly the same spot", () => {
    const dir = new URL("../public/data/", import.meta.url);
    const seen = new Map<string, string>();
    let nudged = 0;
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".geojson"))) {
      const data = JSON.parse(readFileSync(new URL(file, dir), "utf8"));
      const feats = data.features ?? [];
      if (!feats.length || !feats.every((f: { geometry?: { type?: string } }) => f.geometry?.type === "Point")) continue;
      for (const f of feats) {
        const key = f.geometry.coordinates.slice(0, 2).join(",");
        expect(seen.get(key), `${file} ${f.properties.osm_id} sits exactly on ${seen.get(key)}`).toBeUndefined();
        seen.set(key, `${file} ${f.properties.osm_id}`);
        if (typeof f.properties.true_lon === "number") nudged++;
      }
    }
    expect(nudged).toBeGreaterThan(0);
  });
});
