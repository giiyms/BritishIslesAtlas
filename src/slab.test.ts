import { describe, expect, it } from "vitest";
import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import { SLAB_SOURCES, SLAB_SEA_LAYERS, SLAB_RELIEF_LAYERS, SLAB_OUTSIDE, SLAB_WOOD, SLAB_LABEL_LAYERS, SLAB_PLACE_LABELS, TERRAIN_SOURCE } from "./slab";

describe("slab style", () => {
  it("loads with MapLibre validation, including zoom-faded halo bands", () => {
    const errors = validateStyleMin({
      version: 8,
      glyphs: "https://example.com/{fontstack}/{range}.pbf",
      sources: {
        ...SLAB_SOURCES,
        terrain: TERRAIN_SOURCE,
        openmaptiles: { type: "vector", tiles: ["https://example.com/{z}/{x}/{y}.pbf"] },
      },
      layers: [...SLAB_RELIEF_LAYERS, SLAB_WOOD, SLAB_OUTSIDE, ...SLAB_SEA_LAYERS, ...SLAB_LABEL_LAYERS, SLAB_PLACE_LABELS],
    });
    expect(errors.map((error) => error.message)).toEqual([]);
  });
});
