import manifestRaw from "../public/data/density/pubs-manifest.json?raw";
import coarseRaw from "../public/data/density/pubs-coarse.geojson?raw";
import mediumRaw from "../public/data/density/pubs-medium.geojson?raw";
import fineRaw from "../public/data/density/pubs-fine.geojson?raw";
import { describe, expect, it } from "vitest";
import { bandNear, type DensityManifest } from "./density";

const manifest = JSON.parse(manifestRaw) as DensityManifest;
const bandRaw: Record<string, string> = { coarse: coarseRaw, medium: mediumRaw, fine: fineRaw };

describe("density band lazy loading", () => {
  it("bands tile the zoom range contiguously up to the dot handoff", () => {
    const bands = [...manifest.bands].sort((a, b) => a.minzoom - b.minzoom);
    expect(bands[0].minzoom).toBe(0);
    for (let i = 1; i < bands.length; i++) expect(bands[i].minzoom).toBe(bands[i - 1].maxzoom);
    expect(bands[bands.length - 1].maxzoom).toBe(manifest.dot_minzoom);
  });

  it("only the coarse band is near at the national landing zoom", () => {
    const near = manifest.bands.filter((b) => bandNear(b, 4.1)).map((b) => b.id);
    expect(near).toEqual(["coarse"]);
  });

  it("prefetches the next band just before its minzoom", () => {
    const medium = manifest.bands.find((b) => b.id === "medium")!;
    expect(bandNear(medium, medium.minzoom - 0.5)).toBe(true);
    expect(bandNear(medium, medium.minzoom - 1)).toBe(false);
  });

  it("every cell has count >= 1 and band totals equal the point count", () => {
    for (const band of manifest.bands) {
      const fc = JSON.parse(bandRaw[band.id]) as { features: Array<{ properties: { count: number } }> };
      expect(fc.features.length).toBe(band.cell_count);
      expect(fc.features.every((f) => f.properties.count >= 1)).toBe(true);
      expect(fc.features.reduce((a, f) => a + f.properties.count, 0)).toBe(manifest.point_count);
    }
  });

  it("national coarse band is chunky (~15–20 km) and first-load sized", () => {
    const coarse = manifest.bands.find((b) => b.id === "coarse")!;
    // size_deg 0.020 ≈ 3.5 km in the builder; 0.102 ≈ 18 km.
    const km = 3.5 * (coarse.size_deg / 0.02);
    expect(km).toBeGreaterThanOrEqual(15);
    expect(km).toBeLessThanOrEqual(20);
    expect(coarse.maxzoom).toBeLessThanOrEqual(7);
    expect(coarse.draw_scale ?? manifest.draw_scale).toBeGreaterThanOrEqual(0.9);
    expect(coarse.draw_scale ?? manifest.draw_scale).toBeLessThanOrEqual(0.96);
    // Coarse GeoJSON alone must stay under the ~1 MB first-/data budget.
    expect(bandRaw.coarse.length).toBeLessThan(1 * 1024 * 1024);
    expect(manifest.ramp.length).toBeGreaterThanOrEqual(5);
    expect(coarse.colour_stops?.length).toBe(5);
  });
});
