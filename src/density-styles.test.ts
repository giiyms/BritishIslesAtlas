import { describe, expect, it } from "vitest";
import { DENSE_LAYERS, DENSITY_STYLES, parseDensityStyle, serializeDensityStyle, styleLayerIds } from "./density-styles";

describe("density URL state", () => {
  it("defaults missing and invalid values to auto", () => {
    expect(parseDensityStyle("?layers=pubs")).toBe("auto");
    expect(parseDensityStyle("?density=invalid")).toBe("auto");
  });
  it("round trips every style and preserves unrelated parameters and hash", () => {
    for (const style of DENSITY_STYLES) {
      const url = serializeDensityStyle("https://atlas.test/?layers=pubs&q=a%20b&density=spikes#map", style);
      expect(parseDensityStyle(new URL(url).search)).toBe(style);
      expect(new URL(url).searchParams.get("layers")).toBe("pubs");
      expect(new URL(url).searchParams.get("q")).toBe("a b");
      expect(new URL(url).hash).toBe("#map");
      expect(new URL(url).searchParams.has("density")).toBe(style !== "auto");
    }
  });
});
describe("density layer mapping", () => {
  it("maps automatic view to hex levels and dots", () => {
    expect(styleLayerIds("pubs", "auto")).toEqual(["density-hex-pubs-coarse", "density-hexline-pubs-coarse", "density-hex-pubs-medium", "density-hexline-pubs-medium", "density-hex-pubs-fine", "density-hexline-pubs-fine", "pubs"]);
  });
  it("points and heatmap need no polygon layers", () => {
    expect(styleLayerIds("pubs", "points")).toEqual(["pubs"]);
    expect(styleLayerIds("pubs", "heatmap")).toEqual(["density-heatmap-pubs", "pubs"]);
  });
  it("distinguishes all polygon modes and includes outlines", () => {
    expect(styleLayerIds("pubs", "columns")).toContain("density-fill-pubs-coarse");
    expect(styleLayerIds("pubs", "hex")).not.toContain("pubs");
    expect(styleLayerIds("pubs", "constituency")).toEqual(["density-constituency-pubs"]);
    expect(styleLayerIds("pubs", "contours")).toContain("density-contours-outline-pubs-regional");
    expect(styleLayerIds("pubs", "spikes")).toContain("density-spikes-pubs-regional");
    expect(DENSE_LAYERS).toHaveLength(2);
  });
});
