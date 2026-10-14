/**
 * Generic pre-binned density extrusion for point layers.
 * Dense point layers opt in (see DENSE_LAYERS). Any LayerId can join later
 * by shipping public/data/density/<id>-manifest.json + band GeoJSON and adding
 * the id to DENSITY_ENABLED.
 *
 * Columns use ~93% of cell pitch (hairline seams). Height + colour use
 * sqrt(count); colour stops are per-band intensity quantiles so city cores
 * hit deep red. Height is screen-constant via exponential zoom scaling so
 * peaks stay ~20–25% of the viewport at national and regional zoom.
 */
import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl";
import type { LayerId } from "./layers";
import { DENSE_LAYERS } from "./density-styles";

export interface DensityBand {
  id: string;
  file: string;
  url: string;
  minzoom: number;
  maxzoom: number;
  size_m: number;
  projection?: string;
  draw_scale?: number;
  cell_count: number;
  max_count: number;
  scale_max: number;
  intensity_max?: number;
  /** sqrt(count) stops for the 5-colour ramp (quantiles). */
  colour_stops?: number[];
  peak_m?: number;
  label: string;
}

export interface DensityManifest {
  layer: string;
  point_count: number;
  point_url: string;
  dot_minzoom: number;
  bands: DensityBand[];
  ramp: string[];
  legend: string[];
  scaling?: string;
  draw_scale?: number;
}

/** Layers eligible for the columns style. */
export const DENSITY_ENABLED = new Set<LayerId>(DENSE_LAYERS);

const SOURCE_PREFIX = "density-src-";
const LAYER_PREFIX = "density-fill-";
const OUTLINE_PREFIX = "density-outline-";

const manifests = new Map<LayerId, DensityManifest>();
const loadedBands = new Set<string>();
const beforeIds = new Map<LayerId, string | undefined>();

/** Mount a band's source only when the camera is within this many zoom levels of it. */
const BAND_PREFETCH_ZOOM = 0.75;

/** True when `zoom` is inside (or about to enter) a band's zoom range. */
export function bandNear(band: Pick<DensityBand, "minzoom" | "maxzoom">, zoom: number): boolean {
  return zoom >= band.minzoom - BAND_PREFETCH_ZOOM && zoom < band.maxzoom + BAND_PREFETCH_ZOOM;
}

/** Point GeoJSON is only needed once dots are close to showing (dot_minzoom − 1). */
export function densityPointsNear(id: LayerId, zoom: number): boolean {
  const dotMin = manifests.get(id)?.dot_minzoom ?? 12;
  return zoom >= dotMin - 1;
}

export function densitySourceIds(id: LayerId): string[] {
  const man = manifests.get(id);
  if (!man) return [];
  return man.bands.map((b) => `${SOURCE_PREFIX}${id}-${b.id}`);
}

export function densityLayerIds(id: LayerId): string[] {
  const man = manifests.get(id);
  if (!man) return [];
  const ids: string[] = [];
  for (const b of man.bands) {
    ids.push(`${LAYER_PREFIX}${id}-${b.id}`, `${OUTLINE_PREFIX}${id}-${b.id}`);
  }
  return ids;
}

export function densityDotMinZoom(id: LayerId): number | undefined {
  return manifests.get(id)?.dot_minzoom;
}

async function fetchManifest(id: LayerId): Promise<DensityManifest | null> {
  if (manifests.has(id)) return manifests.get(id)!;
  try {
    const res = await fetch(`/data/density/${id}-manifest.json`);
    if (!res.ok) return null;
    const man = (await res.json()) as DensityManifest;
    manifests.set(id, man);
    return man;
  } catch {
    return null;
  }
}

const DEFAULT_RAMP = ["#fbf3cf", "#f9d77e", "#f4a24c", "#e0452b", "#a50f15"];

/** Hotter 5-stop ramp driven by per-band intensity quantiles. */
function colourExpression(band: DensityBand, ramp: string[]): ExpressionSpecification {
  const colors = ramp.length >= 5 ? ramp.slice(0, 5) : DEFAULT_RAMP;
  const hi = Math.max(band.intensity_max ?? Math.sqrt(band.scale_max), Math.sqrt(2));
  const raw = band.colour_stops?.length === 5
    ? band.colour_stops
    : [1, hi * 0.35, hi * 0.55, hi * 0.75, hi];
  // Enforce strictly increasing stops for MapLibre interpolate.
  const stops: number[] = [Math.max(1, raw[0])];
  for (let i = 1; i < 5; i++) {
    stops.push(Math.max(stops[i - 1] + 0.05, raw[i] ?? stops[i - 1] + 0.05));
  }
  return [
    "interpolate",
    ["linear"],
    ["sqrt", ["get", "count"]],
    stops[0],
    colors[0],
    stops[1],
    colors[1],
    stops[2],
    colors[2],
    stops[3],
    colors[3],
    stops[4],
    colors[4],
  ];
}

/**
 * Screen-constant column height: metres scale ∝ 2^(−zoom) so peaks stay
 * ~20–25% of the viewport at national (z5.5) and regional (z8) zoom.
 * Mobile uses a lower screenScale so tall columns don't cover the chrome.
 */
export function heightExpression(band: DensityBand, screenScale: number): ExpressionSpecification {
  const hi = Math.max(band.intensity_max ?? Math.sqrt(band.scale_max), Math.sqrt(2));
  const peak = band.peak_m ?? (band.id === "coarse" ? 7200 : band.id === "medium" ? 1800 : 900);
  // Relative curve: short stubs for most cells; only near hi do they spike.
  const byCount: ExpressionSpecification = [
    "interpolate",
    ["linear"],
    ["sqrt", ["get", "count"]],
    1,
    peak * 0.04,
    Math.max(1.2, hi * 0.5),
    peak * 0.22,
    hi,
    peak,
  ];

  // Target peak metres at zRef so peaks read ~20–25% vh (not a wall).
  // Gate #58 cut 38k/22k/1.1k → 15k/7.5k/0.9k after tops clipped the viewport.
  const target =
    band.id === "coarse"
      ? { zRef: 5.5, peakM: 15_000 }
      : band.id === "medium"
        ? { zRef: 8.0, peakM: 7_500 }
        : { zRef: 11.0, peakM: 900 };
  const mulRef = (target.peakM / peak) * screenScale;
  const mulAt = (z: number) => mulRef * 2 ** (target.zRef - z);

  return [
    "interpolate",
    ["exponential", 0.5],
    ["zoom"],
    band.minzoom,
    ["*", byCount, mulAt(band.minzoom)],
    band.maxzoom,
    ["*", byCount, mulAt(band.maxzoom)],
  ];
}

/** Soft opacity near abutting band min/max so handoffs don't hard-pop. */
function opacityExpression(band: DensityBand): ExpressionSpecification {
  const start = band.minzoom <= 0 ? 0.82 : 0.35;
  const end = band.maxzoom >= 12 ? 0.82 : 0.35;
  const midLo = band.minzoom + 0.2;
  const midHi = Math.max(midLo + 0.05, band.maxzoom - 0.25);
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    band.minzoom,
    start,
    midLo,
    0.82,
    midHi,
    0.82,
    band.maxzoom,
    end,
  ];
}

function densityScreenScale(): number {
  // Narrow / mobile viewports: shorter columns so peaks don't cover search chrome.
  if (typeof window !== "undefined" && window.matchMedia("(max-width: 520px)").matches) {
    return 0.42;
  }
  return 1;
}

async function ensureBand(
  map: MapLibreMap,
  id: LayerId,
  band: DensityBand,
  man: DensityManifest,
  visible: boolean,
  beforeId?: string,
): Promise<void> {
  const key = `${id}:${band.id}`;
  const srcId = `${SOURCE_PREFIX}${id}-${band.id}`;
  const fillId = `${LAYER_PREFIX}${id}-${band.id}`;
  const outlineId = `${OUTLINE_PREFIX}${id}-${band.id}`;

  if (!map.getSource(srcId)) {
    const data = hexCells(await fetchHexCells(band.url));
    if (!map.getSource(srcId)) map.addSource(srcId, { type: "geojson", data, maxzoom: 14 });
  }

  loadedBands.add(key);
  const vis = visible ? "visible" : "none";
  const screenScale = densityScreenScale();
  if (!map.getLayer(fillId)) {
    map.addLayer(
      {
        id: fillId,
        type: "fill-extrusion",
        source: srcId,
        minzoom: band.minzoom,
        maxzoom: band.maxzoom,
        layout: { visibility: vis },
        paint: {
          "fill-extrusion-color": colourExpression(band, man.ramp),
          "fill-extrusion-height": heightExpression(band, screenScale),
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": opacityExpression(band),
          "fill-extrusion-vertical-gradient": true,
        },
      },
      beforeId,
    );
  } else {
    map.setLayoutProperty(fillId, "visibility", vis);
  }

  // Soft hairline only — avoid thickening the thin columns visually.
  if (!map.getLayer(outlineId)) {
    map.addLayer(
      {
        id: outlineId,
        type: "line",
        source: srcId,
        minzoom: band.minzoom,
        maxzoom: band.maxzoom,
        layout: { visibility: vis },
        paint: {
          "line-color": "#8a5a2b",
          "line-width": 0.25,
          "line-opacity": 0.18,
        },
      },
      beforeId,
    );
  } else {
    map.setLayoutProperty(outlineId, "visibility", vis);
  }
}

/**
 * Mount (or refresh visibility of) density bands for a layer. Band GeoJSON is
 * lazy: only bands near the current zoom get a source (and so a fetch); the
 * rest mount later via syncDensityBands as the camera zooms.
 */
export async function applyDensity(
  map: MapLibreMap,
  id: LayerId,
  on: boolean,
  beforeId?: string,
  stillActive: () => boolean = () => true,
): Promise<DensityManifest | null> {
  if (!DENSITY_ENABLED.has(id)) return null;
  beforeIds.set(id, beforeId);
  const man = await fetchManifest(id);
  if (!man) return null;
  if (!stillActive()) return man;
  const zoom = map.getZoom();
  await Promise.all(man.bands.map((band) => {
    if (bandNear(band, zoom)) return ensureBand(map, id, band, man, on, beforeId);
    return undefined;
  }));
  setDensityVisibility(map, id, on);
  return man;
}

/** Zoom hook: mount any not-yet-loaded band the camera is approaching. Cheap when nothing to do. */
export function syncDensityBands(map: MapLibreMap, id: LayerId, on: boolean): void {
  if (!on) return;
  const man = manifests.get(id);
  if (!man) return;
  const zoom = map.getZoom();
  for (const band of man.bands) {
    if (!loadedBands.has(`${id}:${band.id}`) && bandNear(band, zoom)) {
      void ensureBand(map, id, band, man, on, beforeIds.get(id));
    }
  }
}

export function setDensityVisibility(map: MapLibreMap, id: LayerId, on: boolean): void {
  for (const layerId of densityLayerIds(id)) {
    if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", on ? "visible" : "none");
  }
}

/** True when density extrusion should drive camera pitch. */
export function densityActive(map: MapLibreMap, id: LayerId, layerOn: boolean): boolean {
  if (!layerOn || !DENSITY_ENABLED.has(id)) return false;
  const man = manifests.get(id);
  if (!man) return false;
  return map.getZoom() < man.dot_minzoom;
}

const R = 6378137;
const fromMerc = ([x, y]: number[]) => [x / R * 180 / Math.PI, (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI];

type HexFeature = { type: "Feature"; properties: { count: number }; geometry: { type: "Polygon"; coordinates: number[][][] } };
type HexCollection = { type: "FeatureCollection"; features: HexFeature[] };

/** Compact band file: flat [q, r, count, ...] axial cells on a Web Mercator hex grid. */
export interface HexCells { size_m: number; draw_scale?: number; cells: number[] }

/** Rebuild flat-top Mercator hexes (regular on screen) from compact cells. */
export function hexCells(band: HexCells, scale = band.draw_scale ?? 0.93): HexCollection {
  const size = band.size_m, draw = size * scale, s3 = Math.sqrt(3);
  const corners = Array.from({ length: 6 }, (_, i) => [Math.cos(i * Math.PI / 3) * draw, Math.sin(i * Math.PI / 3) * draw]);
  const features: HexFeature[] = [];
  for (let i = 0; i + 2 < band.cells.length; i += 3) {
    const q = band.cells[i], r = band.cells[i + 1], count = band.cells[i + 2];
    const cx = size * 1.5 * q, cy = size * (s3 / 2 * q + s3 * r);
    const ring = corners.map(([dx, dy]) => fromMerc([cx + dx, cy + dy]));
    ring.push(ring[0]);
    features.push({ type: "Feature", properties: { count }, geometry: { type: "Polygon", coordinates: [ring] } });
  }
  return { type: "FeatureCollection", features };
}

const hexCache = new Map<string, Promise<HexCells>>();
export function fetchHexCells(url: string): Promise<HexCells> {
  let p = hexCache.get(url);
  if (!p) {
    p = fetch(url).then(r => { if (!r.ok) throw new Error(`Density data unavailable (${r.status})`); return r.json() as Promise<HexCells>; });
    p.catch(() => hexCache.delete(url));
    hexCache.set(url, p);
  }
  return p;
}

// The camera belongs to the user: density styles never set pitch, bearing or lock movement.
