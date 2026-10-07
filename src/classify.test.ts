import { describe, expect, it } from "vitest";
import { classes, classIndex, classLabels, legendHtml, quantileBreaks, stepExpression } from "./classify";
import config from "./surfaces.json";

const PAL = ["#a", "#b", "#c", "#d", "#e"];

describe("quantileBreaks", () => {
  it("returns distinct thresholds above the minimum", () => {
    expect(quantileBreaks([1, 1, 1, 1, 2, 2, 3, 4, 8, 20])).toEqual([2, 3, 8]);
    expect(quantileBreaks([5, 5, 5])).toEqual([]);
    expect(quantileBreaks([])).toEqual([]);
  });
});

describe("classes", () => {
  it("spreads a short scale across the palette", () => {
    const c = classes([2, 4], PAL, { unit: "u", source: "", integer: true, min: 1 });
    expect(c.colors).toEqual(["#a", "#c", "#e"]);
    expect(c.breaks).toEqual([2, 4]);
  });

  it("builds a step expression matching its legend", () => {
    const c = classes([2, 4, 8, 16], PAL, { unit: "u", source: "", integer: true, min: 0 });
    expect(stepExpression(["get", "n"], c)).toEqual(["step", ["get", "n"], "#a", 2, "#b", 4, "#c", 8, "#d", 16, "#e"]);
    expect(classLabels(c)).toEqual(["0–1", "2–3", "4–7", "8–15", "16+"]);
    expect(classIndex(0, c)).toBe(0);
    expect(classIndex(4, c)).toBe(2);
    expect(classIndex(99, c)).toBe(4);
  });

  it("labels single-value and continuous classes", () => {
    expect(classLabels(classes([2, 3], PAL, { unit: "u", source: "", integer: true, min: 1 }))).toEqual(["1", "2", "3+"]);
    expect(classLabels(classes([5, 10, 20, 30], PAL, { unit: "km", source: "", integer: false }))).toEqual(
      ["<5", "5–10", "10–20", "20–30", "30+"]);
  });

  it("escapes legend text", () => {
    expect(legendHtml(classes([1], PAL, { unit: "<b>", source: "", integer: true, min: 0 }))).not.toContain("<b>");
  });
});

describe("surfaces.json", () => {
  it("has five colours per palette and four ascending distance breaks per layer", () => {
    for (const pal of Object.values(config.palettes)) expect(pal).toHaveLength(5);
    for (const breaks of Object.values(config.distance.layers)) {
      expect(breaks).toHaveLength(4);
      expect([...breaks].sort((a, b) => a - b)).toEqual(breaks);
    }
  });
});
