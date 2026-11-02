import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RELIGION_VIEWS } from "./religion-views";
import { POINT_COUNTS } from "./point-counts";

type Feature = { properties: { religion?: string | null } };
const features: Feature[] = JSON.parse(
  readFileSync(new URL("../public/data/places-of-worship.geojson", import.meta.url), "utf8"),
).features;

// Mirror of the three MapLibre filters, so the split is checked against the real extract.
const religion = (f: Feature) => f.properties.religion ?? "";
const inView = {
  churches: (f: Feature) => religion(f) === "christian",
  mosques: (f: Feature) => religion(f) === "muslim",
  "other-religious": (f: Feature) => !["christian", "muslim"].includes(religion(f)),
} as const;

describe("religion views of the OSM places-of-worship extract", () => {
  it("has a filter for churches, mosques and other religious sites", () => {
    expect(Object.keys(RELIGION_VIEWS).sort()).toEqual(["churches", "mosques", "other-religious"]);
    expect(JSON.stringify(RELIGION_VIEWS.churches)).toContain("christian");
    expect(JSON.stringify(RELIGION_VIEWS.mosques)).toContain("muslim");
  });
  it("splits every place of worship into exactly one view, with real counts", () => {
    const counts = Object.fromEntries(Object.entries(inView).map(([id, test]) => [id, features.filter(test).length]));
    for (const f of features) expect(Object.values(inView).filter((test) => test(f)).length).toBe(1);
    expect(counts.churches + counts.mosques + counts["other-religious"]).toBe(features.length);
    expect(counts.churches).toBeGreaterThan(30000);
    expect(counts.mosques).toBeGreaterThan(1000);
    expect(counts["other-religious"]).toBeGreaterThan(500);
    for (const id of Object.keys(counts)) expect(POINT_COUNTS[id]).toBe(counts[id]);
  });
});
