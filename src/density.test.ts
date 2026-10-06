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
});
