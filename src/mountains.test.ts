import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { factRows } from "./fact-rows";
import { POINT_COUNTS } from "./point-counts";

type Props = { name: string; ele: number; prominence: number | null; lists: string; url: string; source: string; country: string };
const features: Array<{ properties: Props; geometry: { coordinates: [number, number] } }> = JSON.parse(
  readFileSync(new URL("../public/data/mountains.geojson", import.meta.url), "utf8"),
).features;
const byName = (name: string) => features.find((f) => f.properties.name === name)!;

describe("mountains from the Database of British and Irish Hills", () => {
  it("covers the four nations, Ireland and Man with real summits", () => {
    expect(features.length).toBe(POINT_COUNTS.mountains);
    expect(features.length).toBeGreaterThan(2500);
    expect(new Set(features.map((f) => f.properties.country))).toEqual(
      new Set(["Scotland", "England", "Wales", "Ireland", "Isle of Man", "England/Scotland border"]),
    );
    expect(byName("Ben Nevis").properties.ele).toBeCloseTo(1344.5, 1);
    expect(byName("Ben Nevis").properties.lists).toContain("Munro");
    expect(byName("Carrauntoohil").properties.lists).toContain("Arderin");
    expect(byName("Scafell Pike").properties.lists).toContain("Wainwright");
  });
  it("gives every hill a list, a height and a hill-bagging link", () => {
    for (const { properties: p } of features) {
      expect(p.lists).not.toBe("");
      expect(p.ele).toBeGreaterThan(0);
      expect(p.url).toMatch(/^https:\/\/www\.hill-bagging\.co\.uk\//);
      expect(p.source).toBe("DoBIH");
    }
  });
  it("shows height, prominence and the source on the card", () => {
    const html = factRows("mountains", byName("Ben Nevis").properties);
    expect(html).toContain("1,344.5 m");
    expect(html).toContain("Prominence");
    expect(html).toContain("Beinn Nibheis");
    expect(html).toContain("hill-bagging.co.uk");
  });
});
