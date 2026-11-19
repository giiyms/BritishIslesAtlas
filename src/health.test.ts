import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { factRows } from "./fact-rows";

type Props = Record<string, string | number | undefined> & { name: string; nation: string };
const features: Array<{ properties: Props; geometry: { coordinates: [number, number] } }> = JSON.parse(
  readFileSync(new URL("../public/data/health.geojson", import.meta.url), "utf8"),
).features;
const byNation = (n: string) => features.filter((f) => f.properties.nation === n);

describe("health layer", () => {
  it("holds GP practices from every nation's register", () => {
    expect(byNation("England").length).toBeGreaterThan(5500);
    expect(byNation("Scotland").length).toBeGreaterThan(800);
    expect(byNation("Wales").length).toBeGreaterThan(350);
    expect(byNation("Northern Ireland").length).toBeGreaterThan(250);
    expect(byNation("Ireland").length).toBeGreaterThan(2000);
    expect(byNation("Isle of Man").length).toBeGreaterThan(0);
    expect(features.every((f) => f.properties.name && !/^[A-Z ]{12,}$/.test(f.properties.name))).toBe(true);
  });
  it("cards CQC ratings and links the CQC report in England", () => {
    const rated = byNation("England").filter((f) => f.properties.cqc_rating);
    expect(rated.length).toBeGreaterThan(5000);
    const html = factRows("health", rated[0].properties);
    expect(html).toContain("CQC rating");
    expect(html).toContain(`https://www.cqc.org.uk/location/${rated[0].properties.cqc_id}`);
  });
  it("cards list sizes in Scotland and the HSE source in Ireland", () => {
    const scot = byNation("Scotland")[0].properties;
    expect(Number(scot.patients)).toBeGreaterThan(0);
    expect(factRows("health", scot)).toContain("Registered patients");
    expect(factRows("health", byNation("Ireland")[0].properties)).toContain("HSE Service Directory");
  });
});
