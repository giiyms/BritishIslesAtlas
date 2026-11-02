import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { factRows } from "./fact-rows";
import { POINT_COUNTS } from "./point-counts";

type Props = Record<string, string | number | undefined> & { name: string; url: string };
const features: Array<{ properties: Props; geometry: { coordinates: [number, number] } }> = JSON.parse(
  readFileSync(new URL("../public/data/weather.geojson", import.meta.url), "utf8"),
).features;
const station = (name: string) => features.find((f) => f.properties.name === name)!.properties;

describe("weather stations from the Met Office historic station data", () => {
  it("has all 37 long-record stations with their own data file", () => {
    expect(features.length).toBe(37);
    expect(POINT_COUNTS.weather).toBe(37);
    for (const { properties: p } of features) {
      expect(p.url).toMatch(/^https:\/\/www\.metoffice\.gov\.uk\/pub\/data\/weather\/uk\/climate\/stationdata\/[a-z]+data\.txt$/);
      expect(p.name).not.toMatch(/ {2}|\//);
    }
  });
  it("reports real monthly values and plausible 1991-2020 averages", () => {
    const oxford = station("Oxford");
    expect(oxford.latest_month).toMatch(/^[A-Z][a-z]{2} 20\d\d/);
    expect(oxford.since).toBe(1853);
    expect(Number(oxford.avg_tmax)).toBeGreaterThan(13);
    expect(Number(oxford.avg_tmax)).toBeLessThan(16);
    expect(Number(station("Eskdalemuir").avg_rain)).toBeGreaterThan(Number(oxford.avg_rain));
    expect(Number(station("Lerwick").avg_tmax)).toBeLessThan(Number(oxford.avg_tmax));
  });
  it("marks stations whose record has stopped", () => {
    expect(station("Southampton").record_ended).toMatch(/2000/);
    expect(station("Oxford").record_ended).toBeUndefined();
  });
  it("shows the month, averages and a link to the station file on the card", () => {
    const html = factRows("weather", station("Heathrow (London Airport)"));
    expect(html).toContain("°C");
    expect(html).toContain("1991–2020 rain / yr");
    expect(html).toContain("heathrowdata.txt");
  });
});
