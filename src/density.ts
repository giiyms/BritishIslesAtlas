/**
 * Generic pre-binned density extrusion for point layers.
 * Only pubs opts in for now (see DENSITY_ENABLED). Any LayerId can join later
 * by shipping public/data/density/<id>-manifest.json + band GeoJSON and adding
 * the id to DENSITY_ENABLED.
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
  cell_count: number;
  max_count: number;
  scale_max: number;
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
}

/** Layers that use the density extrusion view (generic machinery; pubs only today). */
export const DENSITY_ENABLED = new Set<LayerId>(["pubs"]);

const SOURCE_PREFIX = "density-src-";
const LAYER_PREFIX = "density-fill-";
const OUTLINE_PREFIX = "density-outline-";

const manifests = new Map<LayerId, DensityManifest>();
const loadedBands = new Set<string>(); // `${layer}:${bandId}`

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

function colourExpression(band: DensityBand, ramp: [string, string, string]): ExpressionSpecification {
  const hi = Math.max(band.scale_max, 1);
  return [
    "interpolate",
    ["linear"],
    ["get", "count"],
    1,
    ramp[0],
    Math.max(2, hi * 0.35),
    ramp[1],
    hi,
    ramp[2],
  ];
}

function heightExpression(band: DensityBand): ExpressionSpecification {
  const hi = Math.max(band.scale_max, 1);
  // Metres in MapLibre extrusion space; coarse bands taller so national view reads.
  const peak = band.id === "coarse" ? 120000 : band.id === "medium" ? 60000 : 28000;
  return [
    "interpolate",
    ["linear"],
    ["get", "count"],
    1,
    peak * 0.08,
    hi,
    peak,
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
          "fill-extrusion-opacity": 0.82,
          "fill-extrusion-vertical-gradient": true,
        },
      },
      beforeId,
    );
  } else {
    map.setLayoutProperty(fillId, "visibility", vis);
  }

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
          "line-color": "#7a3e12",
          "line-width": 0.4,
          "line-opacity": 0.25,
        },
      },
      beforeId,
    );
  } else {
    map.setLayoutProperty(outlineId, "visibility", vis);
  }
}

/** Mount (or refresh visibility of) density bands for a layer. Lazy-loads band GeoJSON. */
export async function applyDensity(
  map: MapLibreMap,
  id: LayerId,
  on: boolean,
  beforeId?: string,
): Promise<DensityManifest | null> {
  if (!DENSITY_ENABLED.has(id)) return null;
  const man = await fetchManifest(id);
  if (!man) return null;
  // Eagerly register all bands so zoom switches don't stall; GeoJSON fetch is lazy per source.
  await Promise.all(man.bands.map((band) => ensureBand(map, id, band, man, on, beforeId)));
  return man;
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
  const z = map.getZoom();
  return z < man.dot_minzoom;
}

const DEFAULT_PITCH = 0;
let pitchOwner: LayerId | null = null;

export function syncDensityPitch(map: MapLibreMap, activeLayer: LayerId | null, pitch = 45): void {
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
