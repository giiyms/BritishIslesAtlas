import {
  AttributionControl,
  Map,
  Popup,
  addProtocol,
  setWorkerUrl,
  type ExpressionSpecification,
  type FilterSpecification,
  type ImageSource,
  type Map as MapLibreMap,
  type MapGeoJSONFeature,
  type StyleSpecification,
} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { Protocol } from "pmtiles";

import { LAYERS, type LayerDef, type LayerId, type MarkerKind } from "./layers";
import { PLACES } from "./geo";
import { singularLabel } from "./layer-groups";
import { legendHtml, stepExpression, type Classes } from "./classify";
import {
  DISTANCE_RASTER,
  loadSeatStats,
  normaliseSurface,
  seatValues,
  surfaceClasses,
  type SeatStats,
  type Surface,
} from "./surfaces";
import {
  electionLegendHtml,
  fillColor as electionFillColor,
  fillOpacity as electionFillOpacity,
  loadProjections,
  pickKey,
  PARTY_COLORS,
  REFORM_CLASSES,
  type ElectionLayout,
  type ElectionView,
  type SeatProjection,
} from "./election";
import { constituencyPopupHtml, loadVotingBundle, type VotingBundle } from "./voting";
import { ENDORSE_COLORS } from "./endorse";
import { mountHexMap } from "./hexmap";
import { MAX_POINTS, type AtlasState, type BasemapId, type Mode } from "./state";
import { showToast } from "./toast";

setWorkerUrl(workerUrl);
addProtocol("pmtiles", new Protocol().tile);

export const HOME_BOUNDS: [[number, number], [number, number]] = [
  [-12.2, 49.35],
  [2.35, 61.15],
];
export const HOME_PADDING = { top: 28, bottom: 48, left: 36, right: 28 };

const tiles = (name: string) => `pmtiles://${location.origin}/tiles/${name}.pmtiles`;
const SEATS = { source: "seats", sourceLayer: "constituencies" } as const;

const HILLSHADE_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}";
const HILLSHADE_OPACITY: ExpressionSpecification = ["interpolate", ["linear"], ["zoom"], 4, 0.9, 7, 0.9, 10, 0.62, 14, 0.4];

/** Basemap tokens. Surfaces draw under `water`, so the sea clips every surface to the coast. */
const BASEMAPS: Record<BasemapId, {
  land: string; water: string; coast: string; coastWidth: number; border: string; hillshade: boolean;
  road: string; roadCasing: string; label: string; halo: string; seatLine: string;
}> = {
  relief: { land: "#eef0f1", water: "#d6dee6", coast: "#9aa5b1", coastWidth: 0.6, border: "#8e959f", hillshade: true,
    road: "#ffffff", roadCasing: "#b9c0c8", label: "#3d4652", halo: "rgba(255,255,255,0.9)", seatLine: "#ffffff" },
  light: { land: "#fafaf8", water: "#d4dadc", coast: "#b8c0c5", coastWidth: 0.6, border: "#a4abb3", hillshade: false,
    road: "#ffffff", roadCasing: "#d3d7db", label: "#4b5563", halo: "rgba(255,255,255,0.95)", seatLine: "#ffffff" },
  dark: { land: "#22262c", water: "#0e1116", coast: "#3a4049", coastWidth: 0.6, border: "#555c66", hillshade: false,
    road: "#3b414a", roadCasing: "#2b3037", label: "#c9ced6", halo: "rgba(14,17,22,0.85)", seatLine: "#2f343b" },
  mono: { land: "#ffffff", water: "#ffffff", coast: "#111111", coastWidth: 0.9, border: "#111111", hillshade: false,
    road: "#ffffff", roadCasing: "#9a9a9a", label: "#111111", halo: "rgba(255,255,255,0.95)", seatLine: "#ffffff" },
};

/** Non-GB land, muted in election mode (Northern Ireland seats are not in the ONS GB file). */
const NON_GB_LAND = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature", properties: { name: "Ireland" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-7.4, 55.5], [-6.6, 55.32], [-6.05, 55.25], [-5.9, 55.05], [-5.62, 54.85], [-5.35, 54.55],
          [-5.42, 54.2], [-5.95, 53.95], [-6.0, 53.5], [-5.95, 53.0], [-6.1, 52.4], [-6.3, 52.1],
          [-7.0, 52.05], [-8.0, 51.7], [-9.0, 51.4], [-10.3, 51.6], [-10.6, 52.1], [-10.0, 52.7],
          [-10.3, 53.4], [-10.3, 54.1], [-8.9, 54.4], [-8.7, 54.8], [-8.5, 55.25], [-7.4, 55.5],
        ]],
      },
    },
    {
      type: "Feature", properties: { name: "Isle of Man" },
      geometry: { type: "Polygon", coordinates: [[[-4.85, 54.03], [-4.28, 54.03], [-4.24, 54.45], [-4.66, 54.45], [-4.85, 54.03]]] },
    },
  ],
} as const;

const NAME: ExpressionSpecification = ["coalesce", ["get", "name:en"], ["get", "name_en"], ["get", "name"]];

const STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    hillshade: { type: "raster", tiles: [HILLSHADE_TILES], tileSize: 256, maxzoom: 16 },
    openmaptiles: { type: "vector", url: "https://tiles.openfreemap.org/planet", attribution: "" },
    seats: { type: "vector", url: tiles("constituencies"), promoteId: { constituencies: "PCON24CD" } },
    "non-gb": { type: "geojson", data: NON_GB_LAND as never },
    "restore-callouts": { type: "geojson", data: { type: "FeatureCollection", features: [] } },
  },
  layers: [
    { id: "land", type: "background", paint: { "background-color": BASEMAPS.relief.land } },
    {
      id: "hillshade", type: "raster", source: "hillshade",
      paint: {
        "raster-opacity": HILLSHADE_OPACITY,
        "raster-saturation": -1,
        "raster-contrast": ["interpolate", ["linear"], ["zoom"], 7, 0.28, 11, 0.12],
        "raster-brightness-min": 0.12,
        // Contrast applies before brightness; 0.78 → 0.85 keeps flats near #e6e6e6.
        "raster-brightness-max": ["interpolate", ["linear"], ["zoom"], 7, 0.78, 11, 0.85],
      },
    },
    // Surfaces are inserted here, before "non-gb-land".
    {
      id: "non-gb-land", type: "fill", source: "non-gb", layout: { visibility: "none" },
      paint: { "fill-color": "#e9ebee", "fill-opacity": 0.6 },
    },
    {
      id: "water", type: "fill", source: "openmaptiles", "source-layer": "water",
      filter: ["!=", ["get", "class"], "swimming_pool"],
      paint: { "fill-color": BASEMAPS.relief.water },
    },
    {
      id: "water-coast", type: "line", source: "openmaptiles", "source-layer": "water",
      filter: ["match", ["get", "class"], ["ocean", "lake"], true, false],
      layout: { "line-join": "round" },
      paint: { "line-color": BASEMAPS.relief.coast, "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.4, 10, 0.9], "line-opacity": 0.7 },
    },
    {
      id: "boundary-country", type: "line", source: "openmaptiles", "source-layer": "boundary",
      filter: ["all", ["==", ["get", "admin_level"], 2], ["==", ["get", "maritime"], 0]],
      paint: { "line-color": BASEMAPS.relief.border, "line-width": 1, "line-dasharray": [3, 2], "line-opacity": 0.75 },
    },
    // Seat outlines / election overlays are inserted here, before "roads-casing".
    {
      id: "roads-casing", type: "line", source: "openmaptiles", "source-layer": "transportation", minzoom: 5,
      filter: ["match", ["get", "class"], ["motorway", "trunk", "primary"], true, false],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": BASEMAPS.relief.roadCasing,
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, ["match", ["get", "class"], "motorway", 1.2, 0.6],
          10, ["match", ["get", "class"], "motorway", 4, "trunk", 3.2, 2.2], 14, ["match", ["get", "class"], "motorway", 9, 7]],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 5, ["match", ["get", "class"], "primary", 0, 0.8], 8, 0.9],
      },
    },
    {
      id: "roads", type: "line", source: "openmaptiles", "source-layer": "transportation", minzoom: 7,
      filter: ["match", ["get", "class"], ["motorway", "trunk", "primary"], true, false],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": BASEMAPS.relief.road,
        "line-width": ["interpolate", ["linear"], ["zoom"], 7, ["match", ["get", "class"], "motorway", 0.8, 0.4],
          10, ["match", ["get", "class"], "motorway", 2.6, "trunk", 2, 1.2], 14, ["match", ["get", "class"], "motorway", 7, 5]],
      },
    },
    // Point layers are inserted here, before "place-labels".
    {
      id: "place-labels", type: "symbol", source: "openmaptiles", "source-layer": "place",
      filter: ["match", ["get", "class"], ["city", "town", "village"], true, false],
      layout: {
        "text-field": NAME,
        "text-font": ["match", ["get", "class"], "city", ["literal", ["Noto Sans Bold"]], ["literal", ["Noto Sans Regular"]]],
        "text-size": ["interpolate", ["linear"], ["zoom"], 5, ["match", ["get", "class"], "city", 11, 9],
          10, ["match", ["get", "class"], "city", 15, "town", 12.5, 11]],
        "text-max-width": 8,
        "text-padding": 4,
        "symbol-sort-key": ["coalesce", ["get", "rank"], 99],
      },
      paint: { "text-color": BASEMAPS.relief.label, "text-halo-color": BASEMAPS.relief.halo, "text-halo-width": 1.3 },
    },
  ],
};

const ATTRIBUTION =
  '© Esri · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a>' +
  ' · <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a>' +
  " · Contains OS & ONS data © Crown 2024 (OGL)";

const CLUSTER_RADIUS: ExpressionSpecification = ["interpolate", ["linear"], ["sqrt", ["get", "point_count"]],
  1.4, 4.5, 5, 8, 15, 13, 30, 18];
const IS_CLUSTER: ExpressionSpecification = ["has", "point_count"];
const NOT_CLUSTER: ExpressionSpecification = ["!", ["has", "point_count"]];
/** tippecanoe clusters up to z10 (scripts/build_tiles.py); chip icons replace markers from z11. */
const ICON_MINZOOM = 11;
const SYMBOL_KINDS = new Set<MarkerKind>(["cross", "diamond", "square", "triangle"]);

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

function iconBody(svg: string): string {
  const start = svg.indexOf(">");
  const end = svg.lastIndexOf("</svg>");
  return start >= 0 && end > start ? svg.slice(start + 1, end) : "";
}

/** 22px white disc, accent stroke, chip icon inside; rendered @2x. */
function discIconSvg(iconSvg: string, accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 22 22">` +
    `<circle cx="11" cy="11" r="10" fill="#ffffff" stroke="${accent}" stroke-width="1.5"/>` +
    `<g transform="translate(5 5) scale(0.5)" fill="none" stroke="${accent}" stroke-width="2.3" ` +
    `stroke-linecap="round" stroke-linejoin="round">${iconBody(iconSvg).replaceAll("currentColor", accent)}</g></svg>`;
}

function markerImage(kind: MarkerKind, color: string): ImageData {
  const ratio = 2, size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size * ratio;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");
  ctx.scale(ratio, ratio);
  ctx.fillStyle = color;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const outline = () => { ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 1.7; ctx.stroke(); };
  ctx.beginPath();
  if (kind === "cross") {
    ctx.arc(16, 16, 11.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath(); ctx.arc(16, 16, 12.4, 0, Math.PI * 2); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
    ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(16, 9.2); ctx.lineTo(16, 22.8); ctx.moveTo(9.2, 16); ctx.lineTo(22.8, 16); ctx.stroke();
  } else if (kind === "diamond") {
    ctx.moveTo(16, 4.2); ctx.lineTo(27.2, 16); ctx.lineTo(16, 27.8); ctx.lineTo(4.8, 16); ctx.closePath(); ctx.fill(); outline();
  } else if (kind === "square") {
    ctx.roundRect(6.2, 6.2, 19.6, 19.6, 3.5); ctx.fill(); outline();
  } else {
    ctx.moveTo(16, 4); ctx.lineTo(28, 26.5); ctx.lineTo(4, 26.5); ctx.closePath(); ctx.fill(); outline();
  }
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

const zoomScale = (a: number, b: number, c: number, d: number) => (scale: number): ExpressionSpecification =>
  ["interpolate", ["linear"], ["zoom"], 4, a * scale, 5.4, b * scale, 8, c * scale, 12, d * scale];
const zoomRadius = zoomScale(2.15, 3.15, 4.8, 7.2);
const iconSize = zoomScale(0.4, 0.54, 0.74, 1);

function motionDuration(ms: number): number {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ms;
}

function nearestPlace(lon: number, lat: number): string {
  let best = "", bestD = Infinity;
  const k = Math.cos((lat * Math.PI) / 180);
  for (const place of PLACES) {
    const d = ((place.lon - lon) * k) ** 2 + (place.lat - lat) ** 2;
    if (d < bestD) { bestD = d; best = place.name; }
  }
  return bestD < 0.09 ? best : ""; // ~33 km
}

function searchPadding(container: HTMLElement) {
  const width = container.clientWidth;
  const narrow = width <= 860;
  const panel = document.querySelector<HTMLElement>("#layers");
  const search = document.querySelector<HTMLElement>("#search");
  return {
    top: narrow ? Math.min(130, (search?.getBoundingClientRect().bottom ?? 64) + 12) : 80,
    bottom: narrow ? Math.min(240, container.clientHeight * 0.3) : Math.min(80, container.clientHeight * 0.15),
    left: narrow ? 24 : Math.min(width * 0.35, (panel?.getBoundingClientRect().right ?? 340) + 16),
    right: narrow ? 24 : 80,
  };
}

interface SeatIndexEntry { name: string; label: [number, number]; bbox: [number, number, number, number] }

export interface Atlas {
  map: MapLibreMap;
  getState: () => AtlasState;
  setMode: (mode: Mode) => void;
  setSurface: (surface: Surface) => void;
  /** Returns false when the point cap is reached. */
  setPoint: (id: LayerId, on: boolean) => boolean;
  clearPoints: () => void;
  setBasemap: (id: BasemapId) => void;
  setRoads: (on: boolean) => void;
  setLabels: (on: boolean) => void;
  setElectionView: (view: ElectionView) => void;
  setElectionLayout: (layout: ElectionLayout) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  home: () => void;
  show: (options: { lon: number; lat: number; zoom?: number; bounds?: [[number, number], [number, number]] }) => void;
  openSeat: (code: string, lngLat?: [number, number]) => void;
  flyToRestore: () => void;
}

/** Fired on every state change; panel and URL hash both listen. */
export interface AtlasChange { state: AtlasState; legend: string }
/** Features in view per active point layer (clusters count their members). */
export interface AtlasCounts { counts: Partial<Record<LayerId, number>> }

export function createAtlas(container: HTMLElement, initial: AtlasState): Atlas {
  const state: AtlasState = { ...initial, surface: normaliseSurface(initial.surface), points: [...initial.points] };

  const map = new Map({
    container,
    style: STYLE,
    bounds: HOME_BOUNDS,
    fitBoundsOptions: { padding: HOME_PADDING },
    maxBounds: [[-18, 45], [10, 64.5]],
    minZoom: 3.6,
    maxZoom: 16,
    attributionControl: false,
    renderWorldCopies: false,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    fadeDuration: 0,
    canvasContextAttributes: {
      antialias: window.devicePixelRatio < 2,
      preserveDrawingBuffer: import.meta.env.DEV || new URLSearchParams(location.search).has("capture"),
      failIfMajorPerformanceCaveat: false,
    },
  });

  const compactAttribution = window.matchMedia("(max-width: 860px)").matches;
  map.addControl(new AttributionControl({ compact: compactAttribution, customAttribution: ATTRIBUTION }), "bottom-right");
  if (compactAttribution) {
    map.once("load", () => {
      const attrib = container.querySelector<HTMLDetailsElement>(".maplibregl-ctrl-attrib.maplibregl-compact");
      attrib?.classList.remove("maplibregl-compact-show");
      attrib?.removeAttribute("open");
    });
  }

  let loaded = false;
  let stats: SeatStats | null = null;
  let projections: globalThis.Map<string, SeatProjection> | null = null;
  let voting: VotingBundle | null = null;
  let seatIndex: Record<string, SeatIndexEntry> | null = null;
  let seatIndexPromise: Promise<Record<string, SeatIndexEntry>> | null = null;
  const loadSeatIndex = () => {
    seatIndexPromise ??= fetch("/data/seat-index.json").then((r) => r.json() as Promise<Record<string, SeatIndexEntry>>)
      .then((index) => (seatIndex = index));
    return seatIndexPromise;
  };

  // ------------------------------------------------------------------ change events

  const legendFor = (): string => {
    if (state.mode === "election") {
      const tally = new globalThis.Map<string, number>();
      for (const p of projections?.values() ?? []) tally.set(p.winner, (tally.get(p.winner) ?? 0) + 1);
      return electionLegendHtml(state.electionView, tally, voting?.endorsements.counts);
    }
    const c = surfaceClasses(state.surface, stats);
    return c ? legendHtml(c) : "";
  };
  const emit = () => {
    window.dispatchEvent(new CustomEvent<AtlasChange>("atlas:change", {
      detail: { state: { ...state, surface: { ...state.surface }, points: [...state.points] }, legend: legendFor() },
    }));
  };

  // ------------------------------------------------------------------ basemap

  const applyBasemap = () => {
    const b = BASEMAPS[state.basemap];
    const set = (id: string, prop: string, value: unknown) => { if (map.getLayer(id)) map.setPaintProperty(id, prop as never, value as never); };
    set("land", "background-color", b.land);
    set("water", "fill-color", b.water);
    set("water-coast", "line-color", b.coast);
    set("water-coast", "line-opacity", state.basemap === "mono" ? 1 : 0.7);
    set("boundary-country", "line-color", b.border);
    set("roads", "line-color", b.road);
    set("roads-casing", "line-color", b.roadCasing);
    set("place-labels", "text-color", b.label);
    set("place-labels", "text-halo-color", b.halo);
    set("surface-seat-line", "line-color", b.seatLine);
    set("election-line", "line-color", state.basemap === "dark" ? "#22262c" : "#ffffff");
    map.setLayoutProperty("hillshade", "visibility", b.hillshade ? "visible" : "none");
    set("hillshade", "raster-opacity", state.mode === "election" ? 0.35 : HILLSHADE_OPACITY);
    for (const id of ["roads", "roads-casing"]) map.setLayoutProperty(id, "visibility", state.roads ? "visible" : "none");
    map.setLayoutProperty("place-labels", "visibility", state.labels ? "visible" : "none");
    document.documentElement.dataset.basemap = state.basemap;
  };

  // ------------------------------------------------------------------ seat feature-state

  const seatState = (code: string, values: Record<string, unknown>) =>
    map.setFeatureState({ ...SEATS, id: code }, values);

  const pushSurfaceValues = () => {
    if (!stats || state.surface.kind !== "seat") return;
    for (const [code, v] of seatValues(stats, state.surface.dataset)) seatState(code, { v });
  };
  const pushElectionValues = () => {
    if (projections) {
      for (const [code, p] of projections) seatState(code, { w: p.winner, m: p.margin ?? 0, ref: p.reform ?? -1 });
    }
    if (voting) for (const [code, seat] of Object.entries(voting.endorsements.seats)) seatState(code, { pick: pickKey(seat) });
  };

  // ------------------------------------------------------------------ surfaces

  const surfaceBefore = "non-gb-land";
  const overlayBefore = "roads-casing";

  const ensureSurfaceLayers = () => {
    if (map.getLayer("surface-seat")) return;
    const c = DISTANCE_RASTER.bounds;
    map.addSource("distance", {
      type: "image", url: "/tiles/distance-hospitals.png",
      coordinates: [[c[0], c[3]], [c[2], c[3]], [c[2], c[1]], [c[0], c[1]]],
    });
    map.addLayer({ id: "surface-distance", type: "raster", source: "distance", layout: { visibility: "none" },
      paint: { "raster-opacity": DISTANCE_RASTER.opacity, "raster-resampling": "nearest", "raster-fade-duration": 0 } }, surfaceBefore);
    map.addSource("hex", { type: "vector", url: tiles("hex") });
    map.addLayer({ id: "surface-hex", type: "fill", source: "hex", "source-layer": "hex", layout: { visibility: "none" },
      paint: { "fill-color": "#ccc", "fill-opacity": 0.88, "fill-outline-color": "rgba(255,255,255,0.4)" } }, surfaceBefore);
    map.addLayer({ id: "surface-seat", type: "fill", ...seatSrc(), layout: { visibility: "none" },
      paint: { "fill-color": "#ccc", "fill-opacity": 0.85 } }, surfaceBefore);
    map.addLayer({ id: "surface-seat-line", type: "line", ...seatSrc(), layout: { visibility: "none", "line-join": "round" },
      paint: { "line-color": BASEMAPS[state.basemap].seatLine, "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.2, 8, 0.6, 12, 1.2], "line-opacity": 0.8 } },
    overlayBefore);
  };
  const seatSrc = () => ({ source: SEATS.source, "source-layer": SEATS.sourceLayer }) as const;

  const applySurface = async () => {
    if (!loaded) return;
    ensureSurfaceLayers();
    const s = state.surface;
    const show = (id: string, on: boolean) => map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    const atlas = state.mode === "atlas";
    show("surface-distance", atlas && s.kind === "distance");
    show("surface-hex", atlas && s.kind === "hex");
    show("surface-seat", atlas && s.kind === "seat");
    show("surface-seat-line", atlas && s.kind === "seat");
    if (!atlas || s.kind === "none") { emit(); return; }
    if (s.kind === "distance") {
      (map.getSource("distance") as ImageSource).updateImage({ url: `/tiles/distance-${s.dataset}.png` });
      emit();
      return;
    }
    stats ??= await loadSeatStats().catch(() => null);
    const c = surfaceClasses(s, stats);
    if (!c) return;
    if (s.kind === "hex") {
      const key = `n_${s.dataset}`;
      map.setFilter("surface-hex", ["has", key]);
      map.setPaintProperty("surface-hex", "fill-color", stepExpression(["get", key], c));
    } else {
      pushSurfaceValues();
      map.setPaintProperty("surface-seat", "fill-color", stepExpression(["coalesce", ["feature-state", "v"], 0], c));
    }
    emit();
  };

  // ------------------------------------------------------------------ election

  const ELECTION_IDS = ["election-fill", "election-line", "election-override", "election-restore-casing",
    "election-restore-inner", "restore-callout-ring", "restore-callout-dot", "restore-callout-label"];
  const ensureElectionLayers = () => {
    if (map.getLayer("election-fill")) return;
    const vis = { visibility: "none" } as const;
    const line = { ...vis, "line-cap": "round", "line-join": "round" } as const;
    const none: FilterSpecification = ["in", ["get", "PCON24CD"], ["literal", []]];
    map.addLayer({ id: "election-fill", type: "fill", ...seatSrc(), layout: vis,
      paint: { "fill-color": electionFillColor(state.electionView), "fill-opacity": electionFillOpacity(state.electionView) } }, surfaceBefore);
    map.addLayer({ id: "election-line", type: "line", ...seatSrc(), layout: line,
      paint: { "line-color": "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.25, 7, 0.5, 10, 1, 13, 1.6], "line-opacity": 0.9 } }, overlayBefore);
    map.addLayer({ id: "election-override", type: "line", ...seatSrc(), layout: line, filter: none,
      paint: { "line-color": ENDORSE_COLORS.override.accent, "line-width": 1.5, "line-dasharray": [2, 1] } }, overlayBefore);
    map.addLayer({ id: "election-restore-casing", type: "line", ...seatSrc(), layout: line, filter: none,
      paint: { "line-color": "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.5, 10, 2.5] } }, overlayBefore);
    map.addLayer({ id: "election-restore-inner", type: "line", ...seatSrc(), layout: line, filter: none,
      paint: { "line-color": ENDORSE_COLORS.restore.fill, "line-width": 1 } }, overlayBefore);
    map.addLayer({ id: "restore-callout-ring", type: "circle", source: "restore-callouts", maxzoom: 8, layout: vis,
      paint: { "circle-radius": 16, "circle-color": "rgba(0,0,0,0)", "circle-stroke-width": 2,
        "circle-stroke-color": ENDORSE_COLORS.restore.fill, "circle-stroke-opacity": 0.45 } });
    map.addLayer({ id: "restore-callout-dot", type: "circle", source: "restore-callouts", maxzoom: 8, layout: vis,
      paint: { "circle-radius": 7, "circle-color": ENDORSE_COLORS.restore.fill, "circle-stroke-width": 2.5, "circle-stroke-color": "#ffffff" } });
    map.addLayer({ id: "restore-callout-label", type: "symbol", source: "restore-callouts", maxzoom: 8,
      layout: { ...vis, "text-field": ["get", "name"], "text-font": ["Noto Sans Bold"], "text-size": 12,
        "text-offset": [1.4, 0], "text-anchor": "left", "text-allow-overlap": true },
      paint: { "text-color": ENDORSE_COLORS.restore.fill, "text-halo-color": "#ffffff", "text-halo-width": 1.5 } });
  };

  const restoreCodes = () => Object.values(voting?.endorsements.seats ?? {}).filter((s) => pickKey(s) === "restore").map((s) => s.pcon24cd);

  const applyElection = async () => {
    if (!loaded) return;
    ensureElectionLayers();
    const on = state.mode === "election";
    const pick = on && state.electionView === "pick";
    for (const id of ELECTION_IDS) {
      const visible = on && (id === "election-fill" || id === "election-line" || pick);
      map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    }
    map.setLayoutProperty("non-gb-land", "visibility", on ? "visible" : "none");
    applyBasemap();
    for (const id of state.points) applyPoint(id);
    if (on) {
      map.setPaintProperty("election-fill", "fill-color", electionFillColor(state.electionView));
      map.setPaintProperty("election-fill", "fill-opacity", electionFillOpacity(state.electionView));
      const [p, v, index] = await Promise.all([
        projections ?? loadProjections().catch(() => null), voting ?? loadVotingBundle().catch(() => null), loadSeatIndex(),
      ]);
      const fresh = !projections || !voting;
      projections = p; voting = v;
      if (fresh) pushElectionValues();
      const codes = restoreCodes();
      const overrides = Object.values(voting?.endorsements.seats ?? {}).filter((s) => s.isOverride).map((s) => s.pcon24cd);
      map.setFilter("election-restore-casing", ["in", ["get", "PCON24CD"], ["literal", codes]]);
      map.setFilter("election-restore-inner", ["in", ["get", "PCON24CD"], ["literal", codes]]);
      map.setFilter("election-override", ["in", ["get", "PCON24CD"], ["literal", overrides]]);
      (map.getSource("restore-callouts") as import("maplibre-gl").GeoJSONSource).setData({
        type: "FeatureCollection",
        features: codes.filter((c) => index[c]).map((c) => ({
          type: "Feature", properties: { pcon24cd: c, name: index[c].name },
          geometry: { type: "Point", coordinates: index[c].label },
        })),
      });
    }
    if (on && state.electionLayout === "hex") hexmap.show(); else hexmap.hide();
    document.body.classList.toggle("election-mode", on);
    document.body.classList.toggle("hex-layout", on && state.electionLayout === "hex");
    emit();
  };

  // ------------------------------------------------------------------ points

  const layerOf = (id: LayerId): LayerDef => LAYERS.find((layer) => layer.id === id)!;
  const pointIds = (id: LayerId) => {
    const ids = [`${id}-cluster-halo`, `${id}-cluster`, `${id}-cluster-count`, id, `${id}-icon`];
    if (id === "hospitals") ids.push("hospitals-hi");
    return ids;
  };
  /** First existing point layer drawn above this one (by z), else the label layer. */
  const beforeFor = (layer: LayerDef): string => {
    const above = [...LAYERS].filter((l) => l.z > layer.z && map.getLayer(`${l.id}-cluster-halo`)).sort((a, b) => a.z - b.z)[0];
    return above ? `${above.id}-cluster-halo` : "place-labels";
  };

  const addPoint = (id: LayerId) => {
    if (map.getLayer(id)) return;
    const layer = layerOf(id);
    if (!map.getSource(id)) map.addSource(id, { type: "vector", url: tiles(id) });
    const before = beforeFor(layer);
    const src = { source: id, "source-layer": id } as const;
    const minzoom = 3;
    map.addLayer({ id: `${id}-cluster-halo`, type: "circle", ...src, filter: IS_CLUSTER, minzoom, maxzoom: ICON_MINZOOM,
      paint: { "circle-radius": ["+", CLUSTER_RADIUS, 1.5], "circle-color": "#ffffff", "circle-opacity": 0.95 } }, before);
    map.addLayer({ id: `${id}-cluster`, type: "circle", ...src, filter: IS_CLUSTER, minzoom, maxzoom: ICON_MINZOOM,
      paint: { "circle-radius": CLUSTER_RADIUS, "circle-color": layer.tint, "circle-opacity": 0.95,
        "circle-stroke-width": 1.5, "circle-stroke-color": layer.accent } }, before);
    map.addLayer({ id: `${id}-cluster-count`, type: "symbol", ...src, minzoom, maxzoom: ICON_MINZOOM,
      filter: ["all", IS_CLUSTER, [">=", ["get", "point_count"], 25]],
      layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Regular"],
        "text-size": ["step", ["get", "point_count"], 10.5, 100, 11.5], "text-allow-overlap": true },
      paint: { "text-color": layer.accent } }, before);
    if (SYMBOL_KINDS.has(layer.kind)) {
      if (!map.hasImage(`${id}-mark`)) map.addImage(`${id}-mark`, markerImage(layer.kind, layer.color), { pixelRatio: 2 });
      map.addLayer({ id, type: "symbol", ...src, filter: NOT_CLUSTER, minzoom, maxzoom: id === "hospitals" ? 10 : ICON_MINZOOM,
        layout: { "icon-image": `${id}-mark`, "icon-size": iconSize(layer.pointScale), "icon-allow-overlap": false } }, before);
      if (id === "hospitals") {
        map.addLayer({ id: "hospitals-hi", type: "symbol", ...src, filter: NOT_CLUSTER, minzoom: 10, maxzoom: ICON_MINZOOM,
          layout: { "icon-image": `${id}-mark`, "icon-size": iconSize(layer.pointScale), "icon-allow-overlap": true,
            "icon-ignore-placement": true } }, before);
      }
    } else {
      map.addLayer({ id, type: "circle", ...src, filter: NOT_CLUSTER, minzoom, maxzoom: ICON_MINZOOM,
        paint: layer.kind === "ring"
          ? { "circle-radius": zoomRadius(layer.pointScale * 1.15), "circle-color": "rgba(255,255,255,0.2)",
            "circle-stroke-width": 1.8, "circle-stroke-color": layer.color }
          : { "circle-radius": zoomRadius(layer.pointScale), "circle-color": layer.color, "circle-opacity": 0.95,
            "circle-stroke-width": 0.8, "circle-stroke-color": "rgba(255,255,255,0.92)" } }, before);
    }
    const iconId = `${id}-icon`;
    const placeIcon = () => {
      if (map.getLayer(iconId)) return;
      map.addLayer({ id: iconId, type: "symbol", ...src, filter: NOT_CLUSTER, minzoom: ICON_MINZOOM,
        layout: { visibility: shown(id) ? "visible" : "none", "icon-image": iconId,
          "icon-size": ["interpolate", ["linear"], ["zoom"], ICON_MINZOOM, 0.85, 14, 1],
          "icon-allow-overlap": id === "hospitals", "icon-padding": 1 } }, beforeFor(layer));
    };
    if (map.hasImage(iconId)) placeIcon();
    else {
      const image = new Image(44, 44);
      image.onload = () => { if (!map.hasImage(iconId)) map.addImage(iconId, image, { pixelRatio: 2 }); placeIcon(); };
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(discIconSvg(layer.icon, layer.accent))}`;
    }
  };
  /** Points stay visible in election mode only on request; the seat map is the story there. */
  const shown = (id: LayerId) => state.points.includes(id) && state.mode === "atlas";
  const applyPoint = (id: LayerId) => {
    if (!loaded) return;
    if (shown(id)) addPoint(id);
    for (const layerId of pointIds(id)) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", shown(id) ? "visible" : "none");
    }
  };

  // Live counts in view, debounced.
  let countTimer = 0;
  const countInView = () => {
    window.clearTimeout(countTimer);
    countTimer = window.setTimeout(() => {
      const counts: Partial<Record<LayerId, number>> = {};
      for (const id of state.points) {
        if (!shown(id)) continue;
        const layers = pointIds(id).filter((l) => !l.endsWith("-halo") && !l.endsWith("-count") && map.getLayer(l));
        const seen = new Set<string>();
        let n = 0;
        for (const f of map.queryRenderedFeatures({ layers })) {
          const p = f.properties ?? {};
          const key = p.point_count ? `c${(f.geometry as { coordinates?: number[] }).coordinates?.join(",")}` : String(p.osm_id ?? f.id ?? Math.random());
          if (seen.has(key)) continue;
          seen.add(key);
          n += Number(p.point_count ?? 1);
        }
        counts[id] = n;
      }
      window.dispatchEvent(new CustomEvent<AtlasCounts>("atlas:counts", { detail: { counts } }));
    }, 250);
  };
  map.on("idle", countInView);

  // ------------------------------------------------------------------ hex cartogram

  const hexColor = (code: string) => {
    if (state.electionView === "pick") {
      const key = pickKey(voting?.endorsements.seats[code]);
      return voting?.endorsements.seats[code] ? { fill: ENDORSE_COLORS[key].fill, opacity: Math.max(0.55, ENDORSE_COLORS[key].fillOpacity) } : null;
    }
    const p = projections?.get(code);
    if (!p) return null;
    if (state.electionView === "reform") {
      if (p.reform == null) return null;
      let i = 0;
      while (i < REFORM_CLASSES.breaks.length && p.reform >= REFORM_CLASSES.breaks[i]) i++;
      return { fill: REFORM_CLASSES.colors[i], opacity: 1 };
    }
    return { fill: PARTY_COLORS[p.winner] ?? PARTY_COLORS.Other, opacity: 0.18 + 0.82 * Math.min(1, (p.margin ?? 0) / 20) };
  };
  const seatSummary = (code: string, fallbackName: string) => {
    const p = projections?.get(code);
    const name = escapeHtml(seatIndex?.[code]?.name ?? fallbackName);
    if (!p) return `<b>${name}</b><br>Northern Ireland: not covered`;
    return `<b>${name}</b><br>${escapeHtml(p.winner)}${p.margin != null ? ` by ${p.margin} pts` : ""}` +
      (p.reform != null ? `<br>Reform ${p.reform}%` : "");
  };
  const hexmap = mountHexMap(container.parentElement ?? document.body, {
    colorOf: hexColor,
    tooltipOf: seatSummary,
    onSelect: (code) => {
      hexmap.select(code);
      void openSeat(code);
    },
  });

  // ------------------------------------------------------------------ popups & interaction

  const popup = new Popup({ closeButton: true, maxWidth: "260px", className: "atlas-popup", offset: 10 });
  let popupIsSeat = false;
  let selected: string | null = null;
  const setSelected = (code: string | null) => {
    if (selected) map.setFeatureState({ ...SEATS, id: selected }, { selected: false });
    selected = code;
    if (code) map.setFeatureState({ ...SEATS, id: code }, { selected: true });
  };
  popup.on("close", () => {
    setSelected(null);
    hexmap.select(null);
    document.body.classList.remove("seat-sheet-open", "seat-card-open");
  });
  popup.on("open", () => {
    popup.getElement()?.classList.toggle("is-seat", popupIsSeat);
    document.body.classList.toggle("seat-sheet-open", popupIsSeat);
  });

  const openSeat = async (code: string, lngLat?: [number, number]) => {
    popupIsSeat = true;
    const index = await loadSeatIndex();
    voting ??= await loadVotingBundle().catch(() => null);
    const at = lngLat ?? index[code]?.label;
    if (!at) return;
    setSelected(code);
    const seat = voting?.endorsements.seats[code];
    const html = seat
      ? constituencyPopupHtml(seat, voting!.endorsements.retrieved_at)
      : `<strong class="popup-title">${escapeHtml(index[code]?.name ?? code)}</strong>`;
    popup.setLngLat(at).setMaxWidth("320px").setHTML(html).addTo(map);
    if (state.mode === "election" && state.electionLayout === "hex") document.body.classList.add("seat-card-open");
  };

  const seatAtlasPopup = (code: string, name: string, lngLat: [number, number]) => {
    if (!stats || state.surface.kind !== "seat") return;
    const values = seatValues(stats, state.surface.dataset);
    const v = values.get(code) ?? 0;
    const rank = [...values.values()].filter((x) => x > v).length + 1;
    const label = layerOf(state.surface.dataset).label.toLowerCase();
    popupIsSeat = false;
    setSelected(code);
    popup.setLngLat(lngLat).setMaxWidth("260px").setHTML(
      `<strong class="popup-title">${escapeHtml(name || code)}</strong>` +
      `<div class="popup-meta">${v} ${escapeHtml(label)} · rank ${rank} of ${values.size}</div>`,
    ).addTo(map);
  };

  const interactive = () => {
    const ids: string[] = [];
    for (const id of state.points) if (shown(id)) ids.push(...pointIds(id).filter((l) => !l.endsWith("-halo") && !l.endsWith("-count")));
    if (state.mode === "election") ids.push("restore-callout-dot", "election-fill");
    else if (state.surface.kind === "seat") ids.push("surface-seat");
    else if (state.surface.kind === "hex") ids.push("surface-hex");
    return ids.filter((id) => map.getLayer(id) && map.getLayoutProperty(id, "visibility") !== "none");
  };
  const topFeature = (point: { x: number; y: number }): MapGeoJSONFeature | undefined =>
    map.queryRenderedFeatures([[point.x - 5, point.y - 5], [point.x + 5, point.y + 5]], { layers: interactive() })[0];

  map.on("click", (event) => {
    const feature = topFeature(event.point);
    if (!feature) return;
    const lngLat: [number, number] = [event.lngLat.lng, event.lngLat.lat];
    const props = (feature.properties ?? {}) as Record<string, unknown>;
    const layerId = feature.layer.id;
    if (layerId.endsWith("-cluster")) {
      const center = (feature.geometry as { coordinates: [number, number] }).coordinates;
      map.easeTo({ center, zoom: Math.min(ICON_MINZOOM, map.getZoom() + 2), duration: motionDuration(450) });
      return;
    }
    if (layerId === "restore-callout-dot") {
      const code = String(props.pcon24cd ?? "");
      map.easeTo({ center: event.lngLat, zoom: Math.max(map.getZoom(), 9.5), duration: motionDuration(600) });
      map.once("moveend", () => void openSeat(code));
      return;
    }
    if (layerId === "election-fill") { void openSeat(String(feature.id ?? props.PCON24CD ?? ""), lngLat); return; }
    if (layerId === "surface-seat") { seatAtlasPopup(String(feature.id ?? props.PCON24CD ?? ""), String(props.PCON24NM ?? ""), lngLat); return; }
    if (layerId === "surface-hex") return;
    // POI popup: name, singular type + context, one source link.
    const source = feature.source as LayerId;
    const layer = LAYERS.find((item) => item.id === source);
    const name = String(props.name ?? (layer ? singularLabel(layer.label) : "Place"));
    const brand = props.brand ? String(props.brand) : "";
    const osmId = props.osm_id ? String(props.osm_id) : "";
    const point = (feature.geometry as { coordinates: [number, number] }).coordinates;
    const context = brand && brand !== name ? brand : nearestPlace(point[0], point[1]);
    popupIsSeat = false;
    popup.setLngLat(lngLat).setMaxWidth("260px").setHTML(
      `<strong class="popup-title popup-title-poi">${escapeHtml(name)}</strong>` +
      `<div class="popup-meta">${escapeHtml([layer ? singularLabel(layer.label) : "Place", context].filter(Boolean).join(" · "))}</div>` +
      (osmId ? `<a class="popup-link" href="https://www.openstreetmap.org/${escapeHtml(osmId)}" target="_blank" rel="noopener noreferrer">View on OpenStreetMap<span class="ext" aria-hidden="true">↗</span></a>` : ""),
    ).addTo(map);
  });

  // Hover: seat outline via feature-state + a small tooltip for surfaces.
  const tip = document.createElement("div");
  tip.className = "map-tip";
  tip.hidden = true;
  container.append(tip);
  let hovered: string | null = null;
  const setHovered = (code: string | null) => {
    if (hovered === code) return;
    if (hovered) map.setFeatureState({ ...SEATS, id: hovered }, { hover: false });
    hovered = code;
    if (code) map.setFeatureState({ ...SEATS, id: code }, { hover: true });
  };
  map.on("mousemove", (event) => {
    const feature = topFeature(event.point);
    map.getCanvas().style.cursor = feature && feature.layer.id !== "surface-hex" ? "pointer" : "";
    const isSeat = feature && (feature.layer.id === "surface-seat" || feature.layer.id === "election-fill");
    setHovered(isSeat ? String(feature.id ?? "") : null);
    let html = "";
    if (feature?.layer.id === "surface-seat" && stats) {
      const code = String(feature.id ?? "");
      const v = seatValues(stats, state.surface.dataset).get(code) ?? 0;
      html = `<b>${escapeHtml(String(feature.properties?.PCON24NM ?? ""))}</b> · ${v} ${escapeHtml(layerOf(state.surface.dataset).label.toLowerCase())}`;
    } else if (feature?.layer.id === "surface-hex") {
      const n = Number(feature.properties?.[`n_${state.surface.dataset}`] ?? 0);
      html = `<b>${n}</b> ${escapeHtml(layerOf(state.surface.dataset).label.toLowerCase())} in this ${stats?.hexAreaKm2 ?? ""} km² hex`;
    } else if (feature?.layer.id === "election-fill") {
      html = seatSummary(String(feature.id ?? ""), String(feature.properties?.PCON24NM ?? ""));
    }
    tip.hidden = !html;
    if (html) {
      tip.innerHTML = html;
      tip.style.left = `${event.point.x + 14}px`;
      tip.style.top = `${event.point.y + 14}px`;
    }
  });
  map.getCanvas().addEventListener("mouseleave", () => { setHovered(null); tip.hidden = true; });

  map.on("load", () => {
    loaded = true;
    // Seat hover / selected outlines (shared by surfaces and election mode).
    map.addLayer({ id: "seat-hover", type: "line", ...seatSrc(), layout: { "line-join": "round" },
      paint: { "line-color": "#1d232c", "line-width": 1.5,
        "line-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 1, 0] } }, overlayBefore);
    map.addLayer({ id: "seat-selected", type: "line", ...seatSrc(), layout: { "line-join": "round" },
      paint: { "line-color": "#1d232c", "line-width": 2.5,
        "line-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 1, 0] } }, overlayBefore);
    // Feature-state set before tiles load still applies, but re-push once seats arrive to be safe.
    map.on("sourcedata", (e) => {
      if (e.sourceId === "seats" && e.isSourceLoaded && !seatsPushed) {
        seatsPushed = true;
        pushSurfaceValues();
        pushElectionValues();
      }
    });
    applyBasemap();
    for (const id of state.points) applyPoint(id);
    void applySurface();
    void applyElection();
    map.once("idle", () => { document.body.dataset.mapReady = "true"; });
  });
  let seatsPushed = false;

  // ------------------------------------------------------------------ API

  return {
    map,
    getState: () => ({ ...state, surface: { ...state.surface }, points: [...state.points] }),
    setMode: (mode) => {
      if (state.mode === mode) return;
      state.mode = mode;
      popup.remove();
      void applySurface();
      void applyElection();
    },
    setSurface: (surface) => {
      state.surface = normaliseSurface(surface);
      popup.remove();
      void applySurface();
    },
    setPoint: (id, on) => {
      if (on === state.points.includes(id)) return true;
      if (on && state.points.length >= MAX_POINTS) {
        showToast(`Up to ${MAX_POINTS} point layers at once. Turn one off first.`);
        return false;
      }
      state.points = on ? [...state.points, id] : state.points.filter((p) => p !== id);
      applyPoint(id);
      emit();
      countInView();
      return true;
    },
    clearPoints: () => {
      const was = state.points;
      state.points = [];
      for (const id of was) applyPoint(id);
      emit();
    },
    setBasemap: (id) => { state.basemap = id; if (loaded) applyBasemap(); emit(); },
    setRoads: (on) => { state.roads = on; if (loaded) applyBasemap(); emit(); },
    setLabels: (on) => { state.labels = on; if (loaded) applyBasemap(); emit(); },
    setElectionView: (view) => { state.electionView = view; hexmap.refresh(); void applyElection(); },
    setElectionLayout: (layout) => { state.electionLayout = layout; popup.remove(); void applyElection(); },
    zoomIn: () => { map.zoomIn({ duration: motionDuration(280) }); },
    zoomOut: () => { map.zoomOut({ duration: motionDuration(280) }); },
    home: () => { map.fitBounds(HOME_BOUNDS, { padding: HOME_PADDING, duration: motionDuration(700) }); },
    show: ({ lon, lat, zoom = 11, bounds }) => {
      if (bounds) {
        map.fitBounds(bounds, { padding: searchPadding(container), duration: motionDuration(800), maxZoom: zoom });
        return;
      }
      map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), zoom), duration: motionDuration(800) });
    },
    openSeat: (code, lngLat) => { void openSeat(code, lngLat); },
    flyToRestore: () => {
      void loadSeatIndex().then(async (index) => {
        voting ??= await loadVotingBundle().catch(() => null);
        const codes = restoreCodes().filter((c) => index[c]);
        if (!codes.length) return;
        const b = codes.map((c) => index[c].bbox);
        const bounds: [[number, number], [number, number]] = [
          [Math.min(...b.map((x) => x[0])), Math.min(...b.map((x) => x[1]))],
          [Math.max(...b.map((x) => x[2])), Math.max(...b.map((x) => x[3]))],
        ];
        if (state.electionLayout === "hex") { state.electionLayout = "map"; void applyElection(); }
        map.fitBounds(bounds, { padding: searchPadding(container), duration: motionDuration(800), maxZoom: 11 });
        map.once("moveend", () => void openSeat(codes[0]));
      });
    },
  };
}

export type { Classes };
