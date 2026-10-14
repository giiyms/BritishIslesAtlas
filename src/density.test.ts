import manifestRaw from "../public/data/density/pubs-manifest.json?raw";
import coarseRaw from "../public/data/density/pubs-coarse.json?raw";
import mediumRaw from "../public/data/density/pubs-medium.json?raw";
import fineRaw from "../public/data/density/pubs-fine.json?raw";
import { describe, expect, it } from "vitest";
import { bandNear, hexCells, type DensityManifest, type HexCells } from "./density";

const manifest = JSON.parse(manifestRaw) as DensityManifest;
const bandRaw: Record<string, string> = { coarse: coarseRaw, medium: mediumRaw, fine: fineRaw };
const R = 6378137;
const merc = ([lon, lat]: number[]) => [R * lon * Math.PI / 180, R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))];

describe("density band lazy loading", () => {
  it("bands tile the zoom range contiguously up to the dot handoff", () => {
    const bands = [...manifest.bands].sort((a, b) => a.minzoom - b.minzoom);
    expect(bands[0].minzoom).toBe(0);
    for (let i = 1; i < bands.length; i++) expect(bands[i].minzoom).toBe(bands[i - 1].maxzoom);
    expect(bands[bands.length - 1].maxzoom).toBe(manifest.dot_minzoom);
  });

  it("only the coarse band is near at the national landing zoom", () => {
    expect(manifest.bands.filter((b) => bandNear(b, 4.1)).map((b) => b.id)).toEqual(["coarse"]);
  });

  it("every cell has count >= 1 and band totals equal the point count", () => {
    for (const band of manifest.bands) {
      const raw = JSON.parse(bandRaw[band.id]) as HexCells;
      const counts = raw.cells.filter((_, i) => i % 3 === 2);
      expect(counts.length).toBe(band.cell_count);
      expect(counts.every((c) => c >= 1)).toBe(true);
      expect(counts.reduce((a, c) => a + c, 0)).toBe(manifest.point_count);
    }
  });

  it("hexes are regular on screen (Web Mercator): equal sides at every latitude", () => {
    for (const band of manifest.bands) {
      const fc = hexCells(JSON.parse(bandRaw[band.id]) as HexCells);
      for (const f of fc.features.slice(0, 200)) {
        const ring = f.geometry.coordinates[0].map(merc);
        const sides = ring.slice(0, 6).map((p, i) => Math.hypot(ring[i + 1][0] - p[0], ring[i + 1][1] - p[1]));
        const mean = sides.reduce((a, s) => a + s, 0) / 6;
        for (const s of sides) expect(Math.abs(s - mean) / mean).toBeLessThan(0.001);
      }
    }
  });

  it("first-load coarse band is tiny and the city band is sub-km on the ground", () => {
    expect(bandRaw.coarse.length).toBeLessThan(100 * 1024);
    const fine = manifest.bands.find((b) => b.id === "fine")!;
    expect(fine.size_m * Math.cos(54 * Math.PI / 180)).toBeLessThan(1000);
    expect(manifest.ramp.length).toBeGreaterThanOrEqual(5);
  });
});
