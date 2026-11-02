import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { factRows } from "./fact-rows";
import { POINT_COUNTS } from "./point-counts";

type Props = { name: string; pop: number; r: number; nation: string; url: string; source: string };
const features: Array<{ properties: Props; geometry: { coordinates: [number, number] } }> = JSON.parse(
  readFileSync(new URL("../public/data/population.geojson", import.meta.url), "utf8"),
).features;
const place = (name: string) => features.find((f) => f.properties.name === name)!.properties;

describe("population discs from GeoNames", () => {
  it("has every 10,000+ settlement in the isles, and nothing outside them", () => {
    expect(features.length).toBe(POINT_COUNTS.population);
    expect(features.length).toBeGreaterThan(1000);
    for (const { properties: p, geometry } of features) {
      expect(p.pop).toBeGreaterThanOrEqual(10000);
      expect(p.r).toBeGreaterThanOrEqual(5);
      expect(p.url).toMatch(/^https:\/\/www\.geonames\.org\/\d+$/);
      const [lon, lat] = geometry.coordinates;
      expect(lon).toBeGreaterThan(-11);
      expect(lon).toBeLessThan(2);
      expect(lat).toBeGreaterThan(49);
      expect(lat).toBeLessThan(61);
    }
    expect(new Set(features.map((f) => f.properties.nation))).toEqual(
      new Set(["England", "Scotland", "Wales", "Northern Ireland", "Ireland", "Isle of Man", "Jersey", "Guernsey"]),
    );
  });
  it("sizes discs by population", () => {
    expect(place("London").pop).toBeGreaterThan(8_000_000);
    expect(place("London").r).toBeGreaterThan(place("Dublin").r);
    expect(place("Dublin").r).toBeGreaterThan(place("Galway").r);
  });
  it("shows the population and the GeoNames record on the card", () => {
    const html = factRows("population", place("Dublin"));
    expect(html).toMatch(/1,0\d\d,\d{3}/);
    expect(html).toContain("geonames.org");
  });
});
