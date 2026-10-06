/**
 * Generic pre-binned density extrusion for point layers.
 * Only pubs opts in for now (see DENSITY_ENABLED). Any LayerId can join later
 * by shipping public/data/density/<id>-manifest.json + band GeoJSON and adding
 * the id to DENSITY_ENABLED.
 *
 * Columns are thin hex stubs (drawn ~75% of cell pitch). Height + colour use
 * sqrt(count) with a per-band peak_m cap so most land stays low/pale and only
 * hotspot cells spike red. National (coarse) height is also scaled by zoom so
 * low-z columns read as tall 3D spikes rather than flat speckles.
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
  peak_m?: number;
  label: string;
}

export interface DensityManifest {
  layer: string;
  point_count: number;
  point_url: string;
  dot_minzoom: number;
  bands: DensityBand[];
  ramp: [string, string, string];
  legend: [string, string, string];
  pitch: number;
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

/** sqrt(count) stops → pale yellow stubs for most cells; red only near scale_max. */
function colourExpression(band: DensityBand, ramp: [string, string, string]): ExpressionSpecification {
  const hi = Math.max(band.intensity_max ?? Math.sqrt(band.scale_max), Math.sqrt(2));
  return [
    "interpolate",
    ["linear"],
    ["sqrt", ["get", "count"]],
    1,
    ramp[0],
    Math.max(1.2, hi * 0.45),
    ramp[1],
    hi,
    ramp[2],
  ];
}

function heightExpression(band: DensityBand): ExpressionSpecification {
  const hi = Math.max(band.intensity_max ?? Math.sqrt(band.scale_max), Math.sqrt(2));
  const peak = band.peak_m ?? (band.id === "coarse" ? 4800 : band.id === "medium" ? 1800 : 900);
  // Most cells: short stubs (~4–22% of peak). Only near hi do they spike.
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
  // Screen-space height shrinks as the camera zooms out — boost meters at
  // low zoom so national columns read as distinct 3D spikes (NYC-style).
  if (band.id === "coarse") {
    return [
      "interpolate",
      ["linear"],
      ["zoom"],
      3.5,
      ["*", byCount, 3.4],
      5.0,
      ["*", byCount, 2.1],
      6.5,
      ["*", byCount, 1.0],
    ];
  }
  // Soft handoff into medium: slight boost at the low end of the band.
  if (band.id === "medium") {
    return [
      "interpolate",
      ["linear"],
      ["zoom"],
      6.5,
      ["*", byCount, 1.25],
      8.0,
      ["*", byCount, 1.0],
      9.5,
      ["*", byCount, 0.9],
    ];
  }
  return byCount;
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
          "fill-extrusion-height": heightExpression(band),
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
let pitchOwner: LayerId | null = null;

export function syncDensityPitch(map: MapLibreMap, activeLayer: LayerId | null, pitch = 40): void {
  if (activeLayer) {
    if (pitchOwner !== activeLayer || Math.abs(map.getPitch() - pitch) > 1) {
      pitchOwner = activeLayer;
      map.easeTo({ pitch, duration: 450, essential: true });
    }
  } else if (pitchOwner) {
    pitchOwner = null;
    if (map.getPitch() > 1) map.easeTo({ pitch: DEFAULT_PITCH, duration: 450, essential: true });
  }
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
  const [low, mid, high] = man.legend;
  const [c0, c1, c2] = man.ramp;
  el.innerHTML =
    `<div class="density-legend-title">Pub density</div>` +
    `<div class="density-legend-ramp" style="background:linear-gradient(90deg,${c0},${c1},${c2})"></div>` +
    `<div class="density-legend-labels"><span>${low}</span><span>${mid}</span><span>${high}</span></div>`;
  host.appendChild(el);
  return {
    setVisible: (on) => {
      el.hidden = !on;
    },
    destroy: () => el.remove(),
  };
}
