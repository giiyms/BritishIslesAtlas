import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { factRows } from "./fact-rows";

type Props = { name: string; ref?: string; road_class: string; nation: string };
type Geometry = { type: "LineString"; coordinates: [number, number][] } | { type: "MultiLineString"; coordinates: [number, number][][] };
const features: Array<{ properties: Props; geometry: Geometry }> = JSON.parse(
  readFileSync(new URL("../public/data/roads.geojson", import.meta.url), "utf8"),
).features;
const lines = (g: Geometry) => (g.type === "LineString" ? [g.coordinates] : g.coordinates);
const road = (name: string, nation: string) => features.find((f) => f.properties.name === name && f.properties.nation === nation);

describe("roads layer", () => {
  it("has the real motorway and trunk network in every nation", () => {
    expect(features.length).toBeGreaterThan(800);
    for (const nation of ["England", "Wales", "Scotland", "Northern Ireland", "Ireland", "Isle of Man"]) {
      expect(features.some((f) => f.properties.nation === nation), nation).toBe(true);
    }
    for (const [name, nation] of [["M1", "England"], ["M25", "England"], ["M8", "Scotland"], ["M4", "Wales"], ["M1", "Northern Ireland"], ["M50", "Ireland"], ["N7", "Ireland"], ["A1", "Scotland"]]) {
      expect(road(name, nation), `${name} ${nation}`).toBeDefined();
    }
    expect(new Set(features.map((f) => f.properties.road_class))).toEqual(new Set(["Motorway", "Trunk road"]));
  });
  it("follows the surveyed road, not a straight corridor", () => {
    const m25 = road("M25", "England")!;
    const vertices = lines(m25.geometry).reduce((n, line) => n + line.length, 0);
    expect(vertices).toBeGreaterThan(300);
    for (const line of lines(m25.geometry)) {
      for (const [lon, lat] of line) {
        expect(lon).toBeGreaterThan(-0.6);
        expect(lon).toBeLessThan(0.35);
        expect(lat).toBeGreaterThan(51.2);
        expect(lat).toBeLessThan(51.75);
      }
    }
  });
  it("cards the class and nation with an OSM source", () => {
    const html = factRows("roads", road("M8", "Scotland")!.properties);
    expect(html).toContain("Motorway");
    expect(html).toContain("Scotland");
    expect(html).toContain("https://www.openstreetmap.org/search?query=M8%20Scotland");
  });
});
