import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { factRows } from "./fact-rows";
import { POINT_COUNTS } from "./point-counts";

type Props = Record<string, string | number | undefined> & { name: string; nation: string };
const features: Array<{ properties: Props; geometry: { coordinates: [number, number] } }> = JSON.parse(
  readFileSync(new URL("../public/data/schools.geojson", import.meta.url), "utf8"),
).features;
const school = (name: string) => features.find((f) => f.properties.name === name)!.properties;
const GRADES = new Set(["Outstanding", "Good", "Requires improvement", "Inadequate"]);

describe("schools layer", () => {
  it("covers every nation, with England from GIAS and the rest from OpenStreetMap", () => {
    expect(features.length).toBe(POINT_COUNTS.schools);
    const byNation = (n: string) => features.filter((f) => f.properties.nation === n);
    expect(byNation("England").length).toBeGreaterThan(24_000);
    for (const [nation, min] of [["Scotland", 2000], ["Wales", 1200], ["Northern Ireland", 900], ["Ireland", 2500], ["Isle of Man", 20], ["Jersey", 20], ["Guernsey", 10]] as const) {
      expect(byNation(nation).length, nation).toBeGreaterThan(min);
    }
    expect(byNation("England").every((f) => typeof f.properties.urn === "number")).toBe(true);
    expect(features.filter((f) => f.properties.nation !== "England").every((f) => /^(node|way|relation)\/\d+$/.test(String(f.properties.osm_id)))).toBe(true);
    for (const { geometry } of features) {
      const [lon, lat] = geometry.coordinates;
      expect(lon).toBeGreaterThan(-11);
      expect(lon).toBeLessThan(2);
      expect(lat).toBeGreaterThan(49);
      expect(lat).toBeLessThan(61);
    }
  });
  it("only uses real Ofsted grades", () => {
    const graded = features.filter((f) => f.properties.ofsted_overall);
    expect(graded.length).toBeGreaterThan(5000);
    expect(graded.every((f) => GRADES.has(String(f.properties.ofsted_overall)))).toBe(true);
    expect(features.filter((f) => f.properties.ofsted_framework === "Report card").length).toBeGreaterThan(1000);
  });
  it("links each card to its Ofsted report, GIAS record or OSM object", () => {
    const graded = features.find((f) => f.properties.ofsted_overall)!.properties;
    expect(factRows("schools", graded)).toContain(`https://reports.ofsted.gov.uk/provider/ELS/${graded.urn}`);
    expect(factRows("schools", graded)).toContain("Ofsted overall effectiveness");
    const eton = factRows("schools", school("Eton College"));
    expect(eton).toContain("Independent Schools Inspectorate");
    expect(eton).toContain("get-information-schools.service.gov.uk/Establishments/Establishment/Details/110158");
    const glantaf = factRows("schools", school("Ysgol Gyfun Gymraeg Glantaf"));
    expect(glantaf).toContain("Estyn");
    expect(glantaf).toContain("https://www.openstreetmap.org/way/");
  });
});
