/**
 * Generic pre-binned density extrusion for point layers.
 * Only pubs opts in for now (see DENSITY_ENABLED). Any LayerId can join later
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

export interface DensityBand {
  id: string;
  file: string;
  url: string;
  minzoom: number;
  maxzoom: number;
  size_deg: number;
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
  pitch: number;
  bearing?: number;
  scaling?: string;
  draw_scale?: number;
}

/** Layers that use the density extrusion view (generic machinery; pubs only today). */
export const DENSITY_ENABLED = new Set<LayerId>(["pubs"]);

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
function heightExpression(band: DensityBand, screenScale: number): ExpressionSpecification {
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
    ["exponential", 2],
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
    map.addSource(srcId, { type: "geojson", data: band.url, maxzoom: 14 });
    loadedBands.add(key);
  }

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
): Promise<DensityManifest | null> {
  if (!DENSITY_ENABLED.has(id)) return null;
  beforeIds.set(id, beforeId);
  const man = await fetchManifest(id);
  if (!man) return null;
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

const DEFAULT_PITCH = 0;
const DEFAULT_BEARING = 0;
let pitchOwner: LayerId | null = null;

export type DensityCameraOpts = { pitch?: number; bearing?: number };

/** Density-mode camera: steeper pitch + slight bearing; restore flat north-up on exit. */
export function syncDensityPitch(
  map: MapLibreMap,
  activeLayer: LayerId | null,
  opts: DensityCameraOpts | number = {},
): void {
  const pitch = typeof opts === "number" ? opts : (opts.pitch ?? 55);
  const bearing = typeof opts === "number" ? -15 : (opts.bearing ?? -15);
  if (activeLayer) {
    const pitchDrift = Math.abs(map.getPitch() - pitch) > 1;
    const bearingDrift = Math.abs(map.getBearing() - bearing) > 1;
    if (pitchOwner !== activeLayer || pitchDrift || bearingDrift) {
      pitchOwner = activeLayer;
      map.easeTo({ pitch, bearing, duration: 450, essential: true });
    }
  } else if (pitchOwner) {
    pitchOwner = null;
    const needsReset = map.getPitch() > 1 || Math.abs(map.getBearing()) > 1;
    if (needsReset) {
      map.easeTo({ pitch: DEFAULT_PITCH, bearing: DEFAULT_BEARING, duration: 450, essential: true });
    }
  }
}

/** Prefer desktop/mobile pitch+bearing from the manifest (or sensible defaults). */
export function densityCameraForViewport(man: DensityManifest | null | undefined): DensityCameraOpts {
  const narrow =
    typeof window !== "undefined" && window.matchMedia("(max-width: 520px)").matches;
  if (narrow) {
    return { pitch: 50, bearing: man?.bearing ?? -15 };
  }
  return { pitch: man?.pitch ?? 55, bearing: man?.bearing ?? -15 };
}

/** Small Low / Medium / High legend for the density ramp. */
export function mountDensityLegend(
  host: HTMLElement,
  man: DensityManifest,
): { setVisible: (on: boolean) => void; destroy: () => void } {
  const el = document.createElement("div");
  el.className = "density-legend";
  el.setAttribute("aria-label", "Pub density");
  el.hidden = true;
  const labels = man.legend.length >= 3 ? man.legend : ["Low", "Medium", "High"];
  const ramp = man.ramp.length ? man.ramp : DEFAULT_RAMP;
  const gradient = ramp.join(",");
  el.innerHTML =
    `<div class="density-legend-title">Pub density</div>` +
    `<div class="density-legend-ramp" style="background:linear-gradient(90deg,${gradient})"></div>` +
    `<div class="density-legend-labels"><span>${labels[0]}</span><span>${labels[1]}</span><span>${labels[2]}</span></div>`;
  host.appendChild(el);
  return {
    setVisible: (on) => {
      el.hidden = !on;
    },
    destroy: () => el.remove(),
  };
}
