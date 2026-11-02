import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { turbineRows } from "./turbine";

type F = { geometry: { coordinates: [number, number] }; properties: Record<string, unknown> };
const fc = JSON.parse(readFileSync(new URL("../public/data/wind.geojson", import.meta.url), "utf8")) as { features: F[] };

describe("wind turbines (OSM + REPD)", () => {
  it("is a real per-turbine extract, not the old preview stub", () => {
    expect(fc.features.length).toBeGreaterThan(15000);
    for (const f of fc.features) {
      expect(f.properties.layer).toBe("wind");
      expect(String(f.properties.osm_id)).toMatch(/^node\/\d+$/);
      expect(String(f.properties.note)).not.toMatch(/preview|stub|sample/i);
    }
  });

  it("keeps UK and Irish offshore farms and drops French and Belgian ones", () => {
    const offshore = fc.features.filter((f) => f.properties.offshore);
    expect(offshore.length).toBeGreaterThan(2500);
    for (const f of fc.features) {
      const [lon, lat] = f.geometry.coordinates;
      expect(lat < 50.1 && lon > -1.5 && !(lat > 49.1 && lat < 49.75 && lon < -2)).toBe(false);
      expect(lat < 51.2 && lon > 1.45).toBe(false);
    }
  });

  it("names Whitelee turbines with their farm", () => {
    const whitelee = fc.features.filter((f) => /whitelee/i.test(String(f.properties.farm ?? "")));
    expect(whitelee.length).toBeGreaterThan(150);
  });

  it("renders farm, capacity and status rows only for turbines", () => {
    const html = turbineRows({ layer: "wind", farm: "Whitelee", capacity_mw: 2.3, status: "Operational", offshore: false });
    expect(html).toContain("<dt>Farm</dt><dd>Whitelee</dd>");
    expect(html).toContain("2.3 MW");
    expect(html).toContain("Onshore");
    expect(turbineRows({ layer: "pubs", farm: "x" })).toBe("");
    expect(turbineRows({ layer: "wind", farm: "Kype Muir", farm_from_repd: true })).toContain("Nearest REPD site");
  });
});
