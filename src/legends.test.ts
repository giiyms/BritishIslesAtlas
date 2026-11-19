import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { factRows } from "./fact-rows";

type Props = { name: string; osm_id: string; osm_url: string; legend_kind: string; feature?: string };
const features: Array<{ properties: Props }> = JSON.parse(
  readFileSync(new URL("../public/data/legends.geojson", import.meta.url), "utf8"),
).features;

describe("legends layer", () => {
  it("holds real holy wells and folklore-named places from OSM", () => {
    expect(features.length).toBeGreaterThan(1200);
    const kinds = new Set(features.map((f) => f.properties.legend_kind));
    expect(kinds).toEqual(new Set(["Holy well", "Place named in folklore"]));
    expect(features.filter((f) => f.properties.legend_kind === "Holy well").length).toBeGreaterThan(800);
    for (const name of ["Giant's Causeway", "Devil's Arrows", "Devil's Dyke"]) {
      expect(features.some((f) => f.properties.name.startsWith(name)), name).toBe(true);
    }
    expect(features.some((f) => f.properties.name === "Fionn Loch")).toBe(false);
    expect(features.every((f) => !/hostel|scouts|transformer/i.test(f.properties.name))).toBe(true);
  });
  it("cards the kind", () => {
    const well = features.find((f) => f.properties.legend_kind === "Holy well")!;
    expect(factRows("legends", well.properties)).toContain("Holy well");
  });
});
