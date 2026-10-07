import config from "./surfaces.json";
import { classes, quantileBreaks, type Classes } from "./classify";
import { LAYERS, isLayerId, type LayerId } from "./layers";
import { singularLabel } from "./layer-groups";

/**
 * Surfaces are the one areal layer on the map at a time (choropleth, hexbin or
 * distance raster). Points sit on top; only one surface is ever drawn.
 */
export type SurfaceKind = "none" | "seat" | "hex" | "distance";

export interface Surface {
  kind: SurfaceKind;
  dataset: LayerId;
}

export const SURFACE_KINDS: ReadonlyArray<{ kind: SurfaceKind; label: string; hint: string }> = [
  { kind: "none", label: "None", hint: "Points only" },
  { kind: "seat", label: "Count per seat", hint: "Each 2024 seat has ≈73k voters, so this is a per-person rate" },
  { kind: "hex", label: "Hex density", hint: `Equal-area ${config.hex.radiusKm} km hexagons` },
  { kind: "distance", label: "Distance to nearest", hint: "Straight-line km from anywhere on land" },
];

export const DISTANCE_LAYERS = Object.keys(config.distance.layers).filter(isLayerId);

export const DEFAULT_SURFACE: Surface = { kind: "none", dataset: "pharmacies" };

export interface SeatStats {
  layers: string[];
  seats: Record<string, number[]>;
  hexBreaks: Record<string, number[]>;
  hexAreaKm2: number;
}

let statsPromise: Promise<SeatStats> | null = null;
export function loadSeatStats(): Promise<SeatStats> {
  statsPromise ??= fetch("/data/seat-stats.json").then((r) => {
    if (!r.ok) throw new Error(`seat-stats.json ${r.status}`);
    return r.json() as Promise<SeatStats>;
  });
  return statsPromise;
}

export function seatValues(stats: SeatStats, dataset: LayerId): Map<string, number> {
  const j = stats.layers.indexOf(dataset);
  return new Map(Object.entries(stats.seats).map(([code, counts]) => [code, j >= 0 ? counts[j] : 0]));
}

const labelOf = (id: LayerId) => LAYERS.find((layer) => layer.id === id)?.label ?? id;

/** Valid dataset for a kind: distance surfaces only exist for a handful of layers. */
export function normaliseSurface(s: Surface): Surface {
  if (s.kind === "distance" && !DISTANCE_LAYERS.includes(s.dataset)) return { ...s, dataset: DISTANCE_LAYERS[0] };
  return s;
}

export function surfaceClasses(s: Surface, stats: SeatStats | null): Classes | null {
  const name = labelOf(s.dataset);
  switch (s.kind) {
    case "seat": {
      if (!stats) return null;
      const values = [...seatValues(stats, s.dataset).values()];
      return classes(quantileBreaks(values), config.palettes.perSeat, {
        unit: `${name} per seat`, integer: true, min: Math.min(...values),
        source: "OSM · ONS 2024 seats (≈73k voters each) · quantile classes",
      });
    }
    case "hex":
      if (!stats) return null;
      return classes(stats.hexBreaks[s.dataset] ?? [], config.palettes.hex, {
        unit: `${name} per ${stats.hexAreaKm2} km² hex`, integer: true, min: 1,
        source: "OSM · equal-area hexes · quantile classes",
      });
    case "distance": {
      const breaks = (config.distance.layers as Record<string, number[]>)[s.dataset] ?? [];
      return classes(breaks, config.palettes.distance, {
        unit: `km to nearest ${singularLabel(name).toLowerCase()}`, integer: false,
        source: "OSM · straight-line distance, not travel time",
      });
    }
    default:
      return null;
  }
}

export const DISTANCE_RASTER = {
  bounds: config.distance.bounds as [number, number, number, number],
  opacity: config.distance.opacity,
};
