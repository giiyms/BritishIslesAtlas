import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { factRows } from "./fact-rows";

type Props = { name: string; layer: string; osm_id: string; osm_url: string; source: string; cemetery_kind: string; area_ha?: number };
const features: Array<{ properties: Props; geometry: { coordinates: [number, number] } }> = JSON.parse(
  readFileSync(new URL("../public/data/cemeteries.geojson", import.meta.url), "utf8"),
).features;

describe("cemeteries layer", () => {
  it("is the real OpenStreetMap set across the isles", () => {
    expect(features.length).toBeGreaterThan(20000);
    for (const name of ["Highgate Cemetery", "Glasnevin Cemetery", "Glasgow Necropolis", "Arnos Vale Cemetery"]) {
      expect(features.some((f) => f.properties.name.includes(name)), name).toBe(true);
    }
    for (const f of features) {
      expect(f.properties.osm_url).toBe(`https://www.openstreetmap.org/${f.properties.osm_id}`);
      const [lon, lat] = f.geometry.coordinates;
      expect(lon).toBeGreaterThan(-11);
      expect(lon).toBeLessThan(2.1);
      expect(lat).toBeGreaterThan(49);
      expect(lat).toBeLessThan(61);
    }
  });
  it("cards the kind and surveyed area", () => {
    const highgate = features.find((f) => f.properties.name.startsWith("Highgate Cemetery") && f.properties.area_ha)!;
    const html = factRows("cemeteries", highgate.properties);
    expect(html).toContain("Cemetery");
    expect(html).toMatch(/\d ha/);
    expect(html).toContain("OpenStreetMap");
  });
});
