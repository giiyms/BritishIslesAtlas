import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { factRows } from "./fact-rows";
import { POINT_COUNTS } from "./point-counts";

type Props = {
  name: string; area_code: string; nation: string; census_year: number; residents: number;
  born_outside_uk_pct?: number; born_outside_ie_pct?: number; over65_pct: number; url: string; source: string;
};
const features: Array<{ properties: Props; geometry: { coordinates: [number, number] } }> = JSON.parse(
  readFileSync(new URL("../public/data/census.geojson", import.meta.url), "utf8"),
).features;
const council = (name: string) => features.find((f) => f.properties.name === name)!.properties;

describe("census markers per council", () => {
  it("has every council in the UK and Ireland, once", () => {
    expect(features.length).toBe(POINT_COUNTS.census);
    const byNation = (n: string) => features.filter((f) => f.properties.nation === n).length;
    expect([byNation("England") + byNation("Wales"), byNation("Scotland"), byNation("Northern Ireland"), byNation("Ireland")]).toEqual([318, 32, 11, 31]);
    expect(new Set(features.map((f) => f.properties.area_code)).size).toBe(features.length);
  });
  it("adds up to the isles' population", () => {
    const total = features.reduce((sum, f) => sum + f.properties.residents, 0);
    expect(total).toBeGreaterThan(71_500_000);
    expect(total).toBeLessThan(72_500_000);
    expect(council("Birmingham").residents).toBe(1_144_919);
  });
  it("keeps every share a real percentage, using the right 'born outside' base", () => {
    for (const { properties: p, geometry } of features) {
      const born = p.nation === "Ireland" ? p.born_outside_ie_pct : p.born_outside_uk_pct;
      expect(born).toBeGreaterThan(0);
      expect(born).toBeLessThan(70);
      expect(p.over65_pct).toBeGreaterThan(5);
      expect(p.over65_pct).toBeLessThan(40);
      expect(p.url).toMatch(/^https:\/\//);
      const [lon, lat] = geometry.coordinates;
      expect(lon).toBeGreaterThan(-11);
      expect(lat).toBeLessThan(61);
    }
    expect(council("Brent").born_outside_uk_pct).toBeGreaterThan(50);
  });
  it("shows the census facts and the publisher on the card", () => {
    const html = factRows("census", council("Dublin City Council"));
    expect(html).toContain("Born outside Ireland");
    expect(html).not.toContain("Born outside the UK");
    expect(html).toContain("CSO Census 2022");
    expect(factRows("census", council("Glasgow City"))).toContain("Born outside the UK");
  });
});
