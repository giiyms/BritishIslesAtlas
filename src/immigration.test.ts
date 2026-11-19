import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { factRows } from "./fact-rows";

type Props = Record<string, string | number | undefined> & { name: string; kind: string; source: string; url: string };
const features: Array<{ properties: Props }> = JSON.parse(
  readFileSync(new URL("../public/data/immigration.geojson", import.meta.url), "utf8"),
).features;
const site = (name: string) => features.find((f) => f.properties.name === name)!;

describe("immigration layer", () => {
  it("covers airports, seaports, the tunnel and detention in both islands", () => {
    const kinds = new Set(features.map((f) => f.properties.kind));
    for (const k of ["Airport", "Seaport", "Cruise terminal", "Rail tunnel", "Removal centre", "Short-term holding facility"]) expect(kinds).toContain(k);
    for (const name of ["London Heathrow", "Dublin Airport", "Port of Dover", "Rosslare Europort", "Harmondsworth IRC"]) expect(site(name), name).toBeDefined();
  });
  it("carries an official count on every point except the Eurostar terminal", () => {
    for (const f of features) {
      const p = f.properties;
      if (p.kind === "Rail terminal") continue;
      expect(p.passengers ?? p.passenger_cars ?? p.detained, p.name).toBeGreaterThan(0);
      expect(p.url, p.name).toMatch(/^https:\/\/(www\.caa\.co\.uk|www\.gov\.uk|data\.cso\.ie)\//);
    }
    expect(Number(site("London Heathrow").properties.passengers)).toBeGreaterThan(70_000_000);
  });
  it("cards the count and its source", () => {
    const html = factRows("immigration", site("Port of Dover").properties);
    expect(html).toContain("International sea passengers, 2025");
    expect(html).toContain("sea-passenger-statistics-spas");
  });
});
