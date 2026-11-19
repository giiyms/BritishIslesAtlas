import { readFileSync, existsSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LAYERS } from "./layers";
import { POINT_COUNTS } from "./point-counts";
import { RELIGION_VIEWS } from "./religion-views";

// Zero-sample gate: every layer must ship a real data file with a sourced, licensed SOURCES.md section.
const sources = readFileSync("SOURCES.md", "utf8").split(/\n(?=## )/);
const LICENCE = /licen[cs]e|ODbL|OGL|CC[ -]BY|public domain/i;
const fileOf = (id: string) =>
  id === "constituencies" ? "constituencies-gb-2024" : id in RELIGION_VIEWS ? "places-of-worship" : id;

describe("zero sample data", () => {
  for (const layer of LAYERS) {
    const file = `public/data/${fileOf(layer.id)}.geojson`;
    it(`${layer.id} ships real data with a licensed source`, () => {
      expect(existsSync(file), file).toBe(true);
      const features = (JSON.parse(readFileSync(file, "utf8")) as { features: unknown[] }).features;
      expect(features.length).toBeGreaterThan(0);
      if (layer.id in POINT_COUNTS && fileOf(layer.id) === layer.id) expect(features.length).toBe(POINT_COUNTS[layer.id]);
      const section = sources.filter((text) => text.includes(`${fileOf(layer.id)}.geojson`));
      expect(section.length, `SOURCES.md section for ${file}`).toBeGreaterThan(0);
      expect(section.some((text) => LICENCE.test(text) && /https?:\/\//.test(text)), `licence + link for ${layer.id}`).toBe(true);
    });
  }

  it("has no sample generators, sample labels or Upcoming group left in the app", () => {
    const app = readdirSync("src")
      .filter((name) => /\.(ts|css)$/.test(name) && !name.endsWith(".test.ts"))
      .map((name) => [name, readFileSync(`src/${name}`, "utf8")] as const);
    for (const [name, text] of app) {
      expect(text, name).not.toMatch(/sample data|sample layers|sample geometry|popup-sample|group-upcoming|"upcoming"|buildCollection|namedLayer/i);
    }
  });
});
