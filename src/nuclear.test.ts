import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { factRows } from "./fact-rows";

type Props = Record<string, string | number | undefined> & { name: string; category: string; status: string };
const features: Array<{ properties: Props; geometry: { coordinates: [number, number] } }> = JSON.parse(
  readFileSync(new URL("../public/data/nuclear.geojson", import.meta.url), "utf8"),
).features;
const site = (name: string) => features.find((f) => f.properties.name === name)!;

describe("nuclear layer", () => {
  it("lists every ONR-licensed site and the MOD berths", () => {
    expect(features.filter((f) => f.properties.licence).length).toBeGreaterThanOrEqual(36);
    for (const name of ["Sellafield", "Hinkley Point C", "Torness", "AWE Aldermaston", "Capenhurst", "Dounreay", "HMNB Clyde (Faslane)"]) {
      expect(site(name), name).toBeDefined();
    }
    expect(features.filter((f) => f.properties.status === "Generating").map((f) => f.properties.name).sort())
      .toEqual(["Hartlepool", "Heysham 1", "Heysham 2", "Sizewell B", "Torness"]);
  });
  it("sits on the island of Great Britain", () => {
    for (const f of features) {
      const [lon, lat] = f.geometry.coordinates;
      expect(lon > -6 && lon < 2 && lat > 50 && lat < 59, f.properties.name).toBe(true);
    }
  });
  it("cards the licence and links the ONR register", () => {
    const html = factRows("nuclear", site("Hartlepool").properties);
    expect(html).toContain("1,185 MW");
    expect(html).toContain("ONR site licence");
    expect(html).toContain("https://www.onr.org.uk/register-of-nuclear-site-licences");
  });
});
