import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { factRows } from "./fact-rows";

type Props = Record<string, string | number | undefined> & { name: string; kind: string; nation: string; recorded: number; url: string };
const features: Array<{ properties: Props; geometry: { coordinates: [number, number] } }> = JSON.parse(
  readFileSync(new URL("../public/data/crime.geojson", import.meta.url), "utf8"),
).features;
const area = (name: string) => features.find((f) => f.properties.name === name)!;
const total = (nation: string) => features.filter((f) => f.properties.nation === nation).reduce((n, f) => n + f.properties.recorded, 0);

describe("crime layer", () => {
  it("has one point per published area in all five nations", () => {
    const kinds = features.reduce<Record<string, number>>((m, f) => ({ ...m, [f.properties.kind]: (m[f.properties.kind] ?? 0) + 1 }), {});
    expect(kinds["Council area"]).toBe(32);
    expect(kinds["Policing district"]).toBe(11);
    expect(kinds["Community safety partnership"]).toBeGreaterThan(300);
    expect(kinds["Garda station"]).toBeGreaterThan(550);
    const coords = new Set(features.map((f) => f.geometry.coordinates.join()));
    expect(coords.size).toBe(features.length);
  });
  it("matches the published totals", () => {
    expect(area("Aberdeen City").properties.recorded).toBe(15461);
    expect(area("Belfast").properties.recorded).toBe(30994);
    expect(total("Northern Ireland")).toBe(93601);
    expect(total("Ireland")).toBe(278363);
    expect(total("England") + total("Wales")).toBeGreaterThan(5_000_000);
  });
  it("links every point to its official source and gives UK rates", () => {
    for (const f of features) {
      const p = f.properties;
      expect(p.recorded, p.name).toBeGreaterThan(0);
      expect(p.url, p.name).toMatch(/^https:\/\/(www\.gov\.uk|www\.gov\.scot|www\.psni\.police\.uk|data\.cso\.ie)\//);
      if (p.nation !== "Ireland" && p.name !== "Manchester Airport") expect(Number(p.per_1000), p.name).toBeGreaterThan(5);
    }
  });
  it("keeps same-named Irish stations in their own counties", () => {
    const [lonD, latD] = area("Milford, Co Donegal Garda station").geometry.coordinates;
    expect(latD).toBeGreaterThan(54.8);
    expect(lonD).toBeGreaterThan(-8.5);
    expect(area("Newport, Co Tipperary Garda station").geometry.coordinates[1]).toBeLessThan(53);
  });
  it("cards the counts, the basis and the source", () => {
    const html = factRows("crime", area("Leeds").properties);
    expect(html).toContain("Crimes recorded");
    expect(html).toContain("Census 2021 residents");
    expect(html).toContain("police-recorded-crime-and-outcomes-open-data-tables");
    expect(factRows("crime", area("Bridewell Dublin Garda station").properties)).toContain("under reservation");
  });
});
