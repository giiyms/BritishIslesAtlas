import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { factRows } from "./fact-rows";

type Props = { name: string; osm_id: string; osm_url: string; site_type?: string; civilization?: string };
const features: Array<{ properties: Props; geometry: { coordinates: [number, number] } }> = JSON.parse(
  readFileSync(new URL("../public/data/historic.geojson", import.meta.url), "utf8"),
).features;
const named = (name: string) => features.find((f) => f.properties.name === name);

describe("historic layer", () => {
  it("is the real OpenStreetMap archaeological record across the isles", () => {
    expect(features.length).toBeGreaterThan(35000);
    for (const name of ["Skara Brae", "Newgrange", "Housesteads Roman Fort", "Navan Fort", "Avebury Stone Circle", "Castell Henllys"]) {
      expect(named(name), name).toBeDefined();
    }
    expect(features.every((f) => f.properties.osm_url === `https://www.openstreetmap.org/${f.properties.osm_id}`)).toBe(true);
  });
  it("cards the site type", () => {
    const html = factRows("historic", named("Newgrange")!.properties);
    expect(html).toContain("Tumulus");
    expect(html).toContain("OpenStreetMap");
  });
});
