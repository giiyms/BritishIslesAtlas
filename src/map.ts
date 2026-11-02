import { BASEMAP_BUILDINGS, BASEMAP_GROUND, BASEMAP_LABELS, BASEMAP_ROADS, BASEMAP_WATERWAYS } from "./basemap";
import {
  AttributionControl,
  Map,
  Popup,
  setWorkerUrl,
  type ExpressionSpecification,
  type Map as MapLibreMap,
  type StyleSpecification,
  type MapGeoJSONFeature,
  type CircleLayerSpecification,
  type FilterSpecification,
} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

setWorkerUrl(workerUrl);
import { buildCollection } from "./geo";
import { LAYERS, type LayerId, type MarkerKind } from "./layers";
import {
  labelPoint as labelPointOf,
  type FeatureCollection as VotingFeatureCollection,
} from "./voting";
import { ENDORSE_COLORS } from "./endorse";
import { DEFAULT_MEASURE, loadElection, loadResultsHistory, loadSeatHistory, seatColour, seatHtml, type ElectionData, type Measure } from "./election";
import { attachResultHistory, attachSeatHistory } from "./poll-trend";
import { singularLabel } from "./layer-groups";
import { PLACES } from "./geo";
import { mountVotingLegend, showVotingToast, hideVotingToast } from "./voting-ui";
import { HEAT_MAXZOOM, ICON_FADE, heatmapPaint, iconScale, pointOpacity, pointRadius, pointStroke } from "./point-style";
import { SLAB_SOURCES, SLAB_RELIEF_LAYERS, SLAB_SEA_LAYERS, SLAB_OUTSIDE, SLAB_WOOD, SLAB_LABEL_LAYERS, SLAB_PLACE_LABELS, SLAB_CREAM, SLAB_SEA, TERRAIN_SOURCE } from "./slab";
/** ~43k points each: plain points and heat only, no chip icons (they would pile up at z11). */
const DENSE_LAYERS: ReadonlySet<LayerId> = new Set<LayerId>(["places-of-worship", "pubs"]);
const ELECTION_OPACITY: ExpressionSpecification = ["coalesce", ["get", "electionOpacity"], 0.78];

export const HOME_BOUNDS: [[number, number], [number, number]] = [
  [-10.6, 49.85],
  [1.85, 60.86],
];

/** Home fit that clears the desktop layer panel (left) and search bar (top), so Shetland is never under the search box. */
export const homePadding = () => window.matchMedia("(max-width: 860px)").matches
  ? { top: 76, bottom: 64, left: 16, right: 16 }
  : { top: 84, bottom: 48, left: 300, right: 40 };

/**
 * Non-GB land masked in voting mode (style roast fix 2). Coarse hulls for the
 * island of Ireland and the Isle of Man; drawn under the water layer so the sea
 * clips them to the coastline.
 */
const NON_GB_LAND = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Ireland" },
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
      type: "Feature",
      properties: { name: "Isle of Man" },
      geometry: {
        type: "Polygon",
        coordinates: [[[-4.85, 54.03], [-4.28, 54.03], [-4.24, 54.45], [-4.66, 54.45], [-4.85, 54.03]]],
      },
    },
  ],
} as const;

const NON_GB_LABEL = {
  type: "FeatureCollection",
  features: [{
    type: "Feature",
    properties: { label: "Northern Ireland, not covered" },
    geometry: { type: "Point", coordinates: [-6.75, 54.62] },
  }],
} as const;

/** Relief opacity: full colour in atlas mode, muted under the voting map. */
const RELIEF_OPACITY = 1;
const RELIEF_OPACITY_VOTING = 0.35;

const STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    terrain: TERRAIN_SOURCE,
    openmaptiles: {
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
      // Explicit source options beat the TileJSON credit; ATTRIBUTION carries it once (fix 10).
      attribution: "",
    },
    "non-gb": { type: "geojson", data: NON_GB_LAND as never },
    "non-gb-label": { type: "geojson", data: NON_GB_LABEL as never },
    ...SLAB_SOURCES,
  },
  layers: [
    { id: "land", type: "background", paint: { "background-color": SLAB_CREAM } },
    ...SLAB_RELIEF_LAYERS,
    SLAB_WOOD,
    SLAB_OUTSIDE,
    ...BASEMAP_GROUND,
    {
      id: "non-gb-land",
      type: "fill",
      source: "non-gb",
      layout: { visibility: "none" },
      paint: { "fill-color": "#e9ebee", "fill-opacity": 0.6 },
    },
    {
      id: "water",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "water",
      filter: ["!=", ["get", "class"], "swimming_pool"],
      paint: { "fill-color": ["interpolate", ["linear"], ["zoom"], 9, SLAB_SEA, 13, "#9ccbef"] as unknown as ExpressionSpecification },
    },
    ...SLAB_SEA_LAYERS,
    ...BASEMAP_WATERWAYS,
    ...BASEMAP_BUILDINGS,
    ...BASEMAP_ROADS,
    {
      id: "non-gb-label",
      type: "symbol",
      source: "non-gb-label",
      maxzoom: 9,
      layout: {
        visibility: "none",
        "text-field": ["get", "label"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 11,
        "text-max-width": 9,
      },
      paint: { "text-color": "#6b7280", "text-halo-color": "rgba(255,255,255,0.85)", "text-halo-width": 1.2 },
    },
    ...SLAB_LABEL_LAYERS,
    SLAB_PLACE_LABELS,
    ...BASEMAP_LABELS,
  ],
};

/** Preview road corridors are fake straight lines: never draw them past z7 (roast fix 7). */
const ROADS_MAXZOOM = 7;

/** One-line, deduped credit (roast fix 10); the panel's "About the data" has the full list. */
const ATTRIBUTION =
  '© AWS Terrain Tiles · Natural Earth · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a>' +
  ' · <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a>' +
  " · Contains OS & ONS data © Crown 2024 (OGL)";

/** Chip icons replace the generic marker shapes from this zoom (fix 8). */
const ICON_MINZOOM = 11;

/** Inner markup of a chip icon <svg>. */
function iconBody(svg: string): string {
  const start = svg.indexOf(">");
  const end = svg.lastIndexOf("</svg>");
  return start >= 0 && end > start ? svg.slice(start + 1, end) : "";
}

/** 22px white disc, 1.5px accent stroke, chip icon inside; rendered @2x. */
function discIconSvg(iconSvg: string, accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 22 22">` +
    `<circle cx="11" cy="11" r="10" fill="#ffffff" stroke="${accent}" stroke-width="1.5"/>` +
    `<g transform="translate(5 5) scale(0.5)" fill="none" stroke="${accent}" stroke-width="2.3" ` +
    `stroke-linecap="round" stroke-linejoin="round">${iconBody(iconSvg).replaceAll("currentColor", accent)}</g></svg>`;
}

function nearestPlace(lon: number, lat: number): string {
  let best = "";
  let bestD = Infinity;
  const k = Math.cos((lat * Math.PI) / 180);
  for (const place of PLACES) {
    const dx = (place.lon - lon) * k;
    const dy = place.lat - lat;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = place.name; }
  }
  // ~0.3° ≈ 33 km: beyond that the "context" would be misleading.
  return bestD < 0.09 ? best : "";
}

/** Layers paused while the voting view is on (fix 2). */
const VOTING_MUTED: ReadonlySet<LayerId> = new Set<LayerId>(["roads", "pubs", "schools", "churches"]);

/** Extra constituency layers drawn above the choropleth fill. */
const CONSTITUENCY_LAYERS = [
  "constituencies",
  "constituencies-outline",
  "constituencies-override",
  "constituencies-restore-casing",
  "constituencies-restore-inner",
  "constituencies-hover",
  "constituencies-selected-glow",
  "constituencies-selected",
  "restore-callout-ring",
  "restore-callout-dot",
  "restore-callout-label",
] as const;

const SYMBOL_KINDS = new Set<MarkerKind>(["cross", "diamond", "square", "triangle"]);

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function markerImage(kind: MarkerKind, color: string): ImageData {
  const pixelRatio = 2;
  const logical = 32;
  const canvas = document.createElement("canvas");
  canvas.width = logical * pixelRatio;
  canvas.height = logical * pixelRatio;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");
  context.scale(pixelRatio, pixelRatio);
  context.clearRect(0, 0, logical, logical);
  context.fillStyle = color;
  context.strokeStyle = color;
  context.lineJoin = "round";
  context.lineCap = "round";

  const outline = () => {
    context.strokeStyle = "rgba(255,255,255,0.95)";
    context.lineWidth = 1.7;
    context.stroke();
  };

  if (kind === "cross") {
    context.beginPath();
    context.arc(16, 16, 11.2, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(16, 16, 12.4, 0, Math.PI * 2);
    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;
    context.stroke();
    context.strokeStyle = "#ffffff";
    context.lineWidth = 2.6;
    context.beginPath();
    context.moveTo(16, 9.2);
    context.lineTo(16, 22.8);
    context.moveTo(9.2, 16);
    context.lineTo(22.8, 16);
    context.stroke();
  } else if (kind === "diamond") {
    context.beginPath();
    context.moveTo(16, 4.2);
    context.lineTo(27.2, 16);
    context.lineTo(16, 27.8);
    context.lineTo(4.8, 16);
    context.closePath();
    context.fill();
    outline();
  } else if (kind === "square") {
    context.beginPath();
    context.roundRect(6.2, 6.2, 19.6, 19.6, 3.5);
    context.fill();
    outline();
  } else {
    context.beginPath();
    context.moveTo(16, 4);
    context.lineTo(28, 26.5);
    context.lineTo(4, 26.5);
    context.closePath();
    context.fill();
    outline();
  }

  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function motionDuration(ms: number): number {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ms;
}

export interface Atlas {
  map: MapLibreMap;
  isOn: (id: LayerId) => boolean;
  setLayer: (id: LayerId, on: boolean) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  home: () => void;
  show: (options: {
    lon: number;
    lat: number;
    zoom?: number;
    bounds?: [[number, number], [number, number]];
  }) => void;
  /** Open (and select) a seat's voting popup, e.g. after a postcode search. */
  openSeat: (code: string, lngLat?: [number, number]) => void;
  /** Fit the view to every Restore seat and open the first one. */
  flyToRestore: () => void;
}

function searchPadding(container: HTMLElement) {
  const width = container.clientWidth;
  const height = container.clientHeight;
  const narrow = width <= 860;
  const panel = document.querySelector<HTMLElement>("#layers");
  const search = document.querySelector<HTMLElement>("#search");
  return {
    top: narrow ? Math.min(130, (search?.getBoundingClientRect().bottom ?? 64) + 12) : 80,
    bottom: Math.min(80, height * 0.15),
    left: narrow ? 24 : Math.min(width * 0.35, (panel?.getBoundingClientRect().right ?? 340) + 16),
    right: narrow ? 24 : 80,
  };
}

export function createAtlas(container: HTMLElement): Atlas {
  const state = Object.fromEntries(LAYERS.map((layer) => [layer.id, layer.defaultOn])) as Record<
    LayerId,
    boolean
  >;

  const map = new Map({
    container,
    style: STYLE,
    bounds: HOME_BOUNDS,
    fitBoundsOptions: { padding: homePadding() },
    // Leave enough sea around the home fit. Tighter bounds force a minimum
    // zoom on wide screens, overriding the padding and clipping the islands.
    maxBounds: [
      [-30, 35],
      [30, 72],
    ],
    minZoom: 3.6,
    maxZoom: 16,
    attributionControl: false,
    renderWorldCopies: false,
    // Flat top-down by default. The camera is the user's: nothing in the app
    // sets pitch; tilt is only via right-drag / two-finger gestures.
    dragRotate: true,
    pitchWithRotate: true,
    touchPitch: true,
    pitch: 0,
    fadeDuration: 0,
    canvasContextAttributes: {
      antialias: window.devicePixelRatio < 2,
      preserveDrawingBuffer: import.meta.env.DEV || new URLSearchParams(location.search).has("capture"),
      failIfMajorPerformanceCaveat: false,
    },
  });

  // Compact ⓘ attribution at every width: the full one-line credit would run under the right-hand panel or the scale bar.
  map.addControl(new AttributionControl({ compact: true, customAttribution: ATTRIBUTION }), "bottom-right");
  // MapLibre opens the compact ⓘ on load; start collapsed so it never covers the scale bar.
  map.once("load", () => {
    const attrib = container.querySelector<HTMLDetailsElement>(".maplibregl-ctrl-attrib.maplibregl-compact");
    attrib?.classList.remove("maplibregl-compact-show");
    attrib?.removeAttribute("open");
  });

  let loaded = false;
  let electionData: ElectionData | null = null;
  let measure: Measure = DEFAULT_MEASURE;
  let enrichedSeats: VotingFeatureCollection | null = null;
  /** User chose "Show" on the voting toast: keep context layers visible. */
  let showOthers = false;
  let selected: string | null = null;
  function setSelected(code: string | null) {
    selected = code;
    const filter: FilterSpecification = ["==", ["get", "PCON24CD"], selected ?? "__none__"];
    for (const id of ["constituencies-selected-glow", "constituencies-selected"]) {
      if (map.getLayer(id)) map.setFilter(id, filter);
    }
  }
  /** Restore casing, override dashes, hover/selected states and the GB-scale Restore callout. */
  function addConstituencyOverlays(visibility: "visible" | "none", before: string | undefined) {
    const vis = { visibility } as const;
    const lineLayout = { ...vis, "line-cap": "round", "line-join": "round" } as const;
    map.addLayer({
      id: "constituencies-outline", type: "line", source: "constituencies", layout: lineLayout,
      paint: {
        "line-color": "#ffffff",
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.25, 7, 0.5, 10, 1.0, 13, 1.6],
        "line-opacity": 0.9,
      },
    }, before);
    map.addLayer({
      id: "constituencies-override", type: "line", source: "constituencies", layout: lineLayout,
      filter: ["==", ["get", "endorseColor"], "override"],
      paint: { "line-color": ENDORSE_COLORS.override.accent, "line-width": 1.5, "line-dasharray": [2, 1] },
    }, before);
    map.addLayer({
      id: "constituencies-restore-casing", type: "line", source: "constituencies", layout: lineLayout,
      filter: ["==", ["get", "endorseColor"], "restore"],
      paint: {
        "line-color": "#ffffff",
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.5, 10, 2.5],
      },
    }, before);
    map.addLayer({
      id: "constituencies-restore-inner", type: "line", source: "constituencies", layout: lineLayout,
      filter: ["==", ["get", "endorseColor"], "restore"],
      paint: { "line-color": ENDORSE_COLORS.restore.fill, "line-width": 1 },
    }, before);
    map.addLayer({
      id: "constituencies-hover", type: "line", source: "constituencies", layout: lineLayout,
      paint: {
        "line-color": "#1d232c",
        "line-width": 1.5,
        "line-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 1, 0],
      },
    }, before);
    const none: FilterSpecification = ["==", ["get", "PCON24CD"], selected ?? "__none__"];
    map.addLayer({
      id: "constituencies-selected-glow", type: "line", source: "constituencies", layout: lineLayout,
      filter: none,
      paint: { "line-color": "#ffffff", "line-width": 6, "line-opacity": 0.6, "line-blur": 1 },
    }, before);
    map.addLayer({
      id: "constituencies-selected", type: "line", source: "constituencies", layout: lineLayout,
      filter: none,
      paint: { "line-color": "#1d232c", "line-width": 2.5 },
    }, before);
    if (!map.getSource("restore-callouts")) {
      map.addSource("restore-callouts", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    }
    // Callouts sit above every point layer: at GB scale this is the headline.
    map.addLayer({
      id: "restore-callout-ring", type: "circle", source: "restore-callouts", maxzoom: 8, layout: vis,
      paint: {
        "circle-radius": 16, "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-width": 2, "circle-stroke-color": ENDORSE_COLORS.restore.fill, "circle-stroke-opacity": 0.45,
      },
    });
    map.addLayer({
      id: "restore-callout-dot", type: "circle", source: "restore-callouts", maxzoom: 8, layout: vis,
      paint: {
        "circle-radius": 7, "circle-color": ENDORSE_COLORS.restore.fill,
        "circle-stroke-width": 2.5, "circle-stroke-color": "#ffffff",
      },
    });
    map.addLayer({
      id: "restore-callout-label", type: "symbol", source: "restore-callouts", maxzoom: 8,
      layout: {
        ...vis,
        "text-field": ["get", "pcon24nm"],
        "text-font": ["Noto Sans Bold"],
        "text-size": 12,
        "text-offset": [1.4, 0],
        "text-anchor": "left",
        "text-allow-overlap": true,
      },
      paint: { "text-color": ENDORSE_COLORS.restore.fill, "text-halo-color": "#ffffff", "text-halo-width": 1.5 },
    });
  }
  const ordered = [...LAYERS].sort((a, b) => a.z - b.z);
  const OSM_STATIC = new Set<LayerId>(["petrol", "ev", "power", "hospitals", "fire-stations", "police", "castles", "libraries", "universities", "museums", "railway-stations", "aerodromes", "ferry-terminals", "marinas", "zoos", "theatres", "battlefields", "cinemas", "stadiums", "theme-parks", "viewpoints", "arts-centres", "aquariums", "piers", "ruins", "golf-courses", "galleries", "marketplaces", "nature-reserves", "camp-sites", "memorials", "sports-centres", "caravan-sites", "fitness-centres", "community-centres", "playgrounds", "post-offices", "beaches", "swimming-pools", "pharmacies", "townhalls", "places-of-worship", "lighthouses", "courthouses", "nightclubs", "windmills", "prisons", "clinics", "dentists", "pubs"]);
  const hasIcon = (layer: { kind: MarkerKind }) =>
    layer.kind === "dot" || layer.kind === "ring" || SYMBOL_KINDS.has(layer.kind);
  /** Every point layer: heat plus every point at every zoom (see point-style.ts). */
  const isPoint = hasIcon;
  const layerIds = (id: LayerId): string[] => {
    if (id === "roads") return [id, "roads-hit"];
    if (id === "constituencies") return [...CONSTITUENCY_LAYERS];
    const layer = LAYERS.find((item) => item.id === id)!;
    const ids: string[] = [id];
    if (isPoint(layer)) ids.push(`${id}-heat`);
    if (hasIcon(layer) && !DENSE_LAYERS.has(id)) ids.push(`${id}-icon`);
    return ids;
  };
  const beforeFor = (z: number): string | undefined => {
    const next = ordered.find((layer) => layer.z > z && map.getLayer(layer.id));
    return next?.id;
  };
  /** z≥11: chip SVG icon in a white disc instead of the generic shapes (fix 8). */
  const addIconLayer = (id: LayerId, filter: FilterSpecification | undefined) => {
    const layer = LAYERS.find((item) => item.id === id)!;
    const imageId = `${id}-icon`;
    const place = () => {
      if (map.getLayer(imageId) || !map.getSource(id)) return;
      const shown = state[id] && !paused(id);
      map.addLayer({
        id: imageId, type: "symbol", source: id, minzoom: ICON_MINZOOM,
        ...(filter ? { filter } : {}),
        layout: {
          visibility: shown ? "visible" : "none",
          "icon-image": imageId,
          "icon-size": ["interpolate", ["linear"], ["zoom"], ICON_MINZOOM, 0.85, 14, 1],
          // Every feature keeps its icon: no collision culling that adds icons as you zoom in.
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: { "icon-opacity": ["interpolate", ["linear"], ["zoom"], ...ICON_FADE.flat()] as ExpressionSpecification },
      }, beforeFor(layer.z));
    };
    if (map.hasImage(imageId)) { place(); return; }
    const image = new Image(44, 44);
    image.onload = () => {
      if (!map.hasImage(imageId)) map.addImage(imageId, image, { pixelRatio: 2 });
      place();
    };
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(discIconSvg(layer.icon, layer.accent))}`;
  };
  const add = (id: LayerId) => {
    if (map.getLayer(id)) return;
    const layer = LAYERS.find((item) => item.id === id)!;
    if (!map.getSource(id)) {
      const sourceData =
        id === "constituencies"
          ? { type: "FeatureCollection" as const, features: [] }
          : OSM_STATIC.has(id)
              ? `/data/${id}.geojson`
              : buildCollection(id);
      // Source credits live in the single ATTRIBUTION line (fix 10), not per source.
      map.addSource(id, {
        type: "geojson",
        data: sourceData,
        ...(id === "constituencies" ? { promoteId: "PCON24CD" } : {}),
      });
    }
    const before = beforeFor(layer.z);
    const visible = state[id] ? "visible" : "none";
    const layout = { visibility: visible } as const;
    if (isPoint(layer)) {
      // Heat under the points, gone by HEAT_MAXZOOM; fades out as the points fade in.
      map.addLayer({ id: `${id}-heat`, type: "heatmap", source: id, maxzoom: HEAT_MAXZOOM, layout,
        paint: heatmapPaint(id, layer.color, layer.accent) }, before);
    }
    if (layer.kind === "fill") {
      const isConstituencies = id === "constituencies";
      map.addLayer({
        id,
        type: "fill",
        source: id,
        layout,
        paint: {
          "fill-color": (isConstituencies
            ? ["coalesce", ["get", "electionColor"], "#b9bec4"]
            : layer.color) as ExpressionSpecification | string,
          // Tactical colouring shades by pick confidence (electionOpacity, set per feature).
          // Seat colours thin out at street zoom so the Apple-style basemap underneath reads clearly.
          "fill-opacity": isConstituencies ? ["interpolate", ["linear"], ["zoom"], 10.5, ELECTION_OPACITY, 13.5, ["*", 0.22, ELECTION_OPACITY]] as unknown as ExpressionSpecification : 0.16,
        },
      }, before);
      if (!isConstituencies) {
        map.addLayer({
          id: `${id}-outline`,
          type: "line",
          source: id,
          layout: { ...layout, "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": layer.accent,
            "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.4, 8, 0.8, 12, 1.4],
            "line-opacity": 0.85,
          },
        }, before);
      } else {
        addConstituencyOverlays(layout.visibility, before);
        void (async () => {
          try {
            // One boundary download: loadElection() fetches it and the source is fed by setData.
            const data = await loadElection();
            electionData = data;
            enrichedSeats = data.geo as VotingFeatureCollection;
            updateElectionColours();
            const code = new URLSearchParams(location.search).get("seat");
            if (code) void openSeat(code);
          } catch (err) {
            console.warn("Failed to load election data", err);
          }
        })();
      }
    } else if (layer.kind === "line") {
      // Preview corridors are straight-line stubs: never let them outlive regional zoom (fix 2).
      map.addLayer({ id, type: "line", source: id, maxzoom: ROADS_MAXZOOM,
        layout: { ...layout, "line-cap": "round", "line-join": "round" },
        // Context gray, not brand teal (fix 2); only drawn to z7.
        paint: { "line-color": layer.color,
          "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.5, 8, 1.2, 12, 2.4],
          "line-opacity": 0.7 },
      }, before);
      map.addLayer({ id: "roads-hit", type: "line", source: id, maxzoom: ROADS_MAXZOOM,
        layout: { ...layout, "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#000", "line-width": 14, "line-opacity": 0.01 },
      }, before);
    } else if (layer.kind === "dot" || layer.kind === "ring" || layer.kind === "disc") {
      const paint: CircleLayerSpecification["paint"] = layer.kind === "disc" ? {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, ["*", ["get", "r"], 0.62],
          5.6, ["get", "r"], 8, ["*", ["get", "r"], 1.7]],
        "circle-color": layer.color, "circle-opacity": 0.28,
        "circle-stroke-width": 1, "circle-stroke-color": layer.accent, "circle-stroke-opacity": 0.7,
      } : layer.kind === "ring" ? {
        "circle-radius": pointRadius(layer.pointScale * 1.15),
        "circle-color": "rgba(255,255,255,0.2)", "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 5, 0.8, 9, 1.8],
        "circle-stroke-color": layer.color, "circle-stroke-opacity": pointOpacity(),
      } : {
        "circle-radius": pointRadius(layer.pointScale), "circle-color": layer.color,
        "circle-opacity": pointOpacity(), "circle-stroke-width": pointStroke(),
        "circle-stroke-color": "rgba(255,255,255,0.92)", "circle-stroke-opacity": pointOpacity(),
      };
      // No minzoom/maxzoom: the same points are drawn at every zoom.
      map.addLayer({ id, type: "circle", source: id, layout, paint }, before);
    } else if (SYMBOL_KINDS.has(layer.kind)) {
      if (!map.hasImage(`${id}-mark`)) {
        map.addImage(`${id}-mark`, markerImage(layer.kind, layer.color), { pixelRatio: 2 });
      }
      // Every marker at every zoom: overlap allowed, nothing culled by collision.
      map.addLayer({ id, type: "symbol", source: id, layout: {
        ...layout, "icon-image": `${id}-mark`, "icon-size": iconScale(layer.pointScale),
        "icon-allow-overlap": true, "icon-ignore-placement": true,
      }, paint: { "icon-opacity": pointOpacity() } }, before);
    }
    if (hasIcon(layer) && !DENSE_LAYERS.has(id)) addIconLayer(id, undefined);
  };
  const votingOn = () => state.constituencies;
  const paused = (id: LayerId) => votingOn() && !showOthers && VOTING_MUTED.has(id);
  /** Layer whose feature the open popup describes; hiding that layer closes it. */
  let popupLayer: LayerId | null = null;
  /** Set before addTo(); addTo() on an open popup fires "close" first, so it is copied on "open". */
  let nextPopupLayer: LayerId | null = null;
  const apply = (id: LayerId) => {
    const shown = state[id] && !paused(id);
    if (!shown && popupLayer === id) popup.remove();
    if (shown && loaded) add(id);
    const visibility = shown ? "visible" : "none";
    for (const layerId of layerIds(id)) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", visibility);
    }
  };
  /** Voting view: pause context layers, cap relief, mask non-GB land, show legend (fix 2). */
  const applyVotingMode = (announce: boolean) => {
    const on = votingOn();
    const muteOthers = on && !showOthers;
    for (const id of VOTING_MUTED) apply(id);
    if (map.getLayer("density-glow")) {
      map.setLayoutProperty("density-glow", "visibility", muteOthers ? "none" : "visible");
    }
    if (map.getLayer("dem-color-relief")) {
      map.setPaintProperty("dem-color-relief", "color-relief-opacity", on ? RELIEF_OPACITY_VOTING : RELIEF_OPACITY);
    }
    for (const layerId of ["non-gb-land", "non-gb-label"]) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", on ? "visible" : "none");
    }
    legend.setVisible(on);
    const pausedIds = [...VOTING_MUTED].filter((id) => state[id] && muteOthers);
    window.dispatchEvent(new CustomEvent("atlas:voting-mode", { detail: { on, paused: pausedIds } }));
    if (muteOthers && announce && pausedIds.length) {
      showVotingToast("Voting view: other layers paused", "Show", () => {
        showOthers = true;
        applyVotingMode(false);
      });
    } else if (!muteOthers) {
      hideVotingToast();
    }
    if (!on) setSelected(null);
  };
  // closeOnClick is off: the built-in handler runs after ours and closed the popup we had just re-opened for the newly tapped seat (second tap needed).
  const popup = new Popup({ closeButton: true, closeOnClick: false, maxWidth: "260px", className: "atlas-popup", offset: 10 });
  popup.on("close", () => {
    popupLayer = null;
    setSelected(null);
    document.body.classList.remove("seat-sheet-open");
  });
  let popupIsSeat = false;
  popup.on("open", () => {
    popupLayer = nextPopupLayer;
    popup.getElement()?.classList.toggle("is-seat", popupIsSeat);
    popup.getElement()?.classList.remove("sheet-peek");
    document.body.classList.toggle("seat-sheet-open", popupIsSeat);
  });
  // Bottom-sheet gestures (<=520px): drag down to peek, further to dismiss; drag up to expand.
  {
    let startY = 0, dy = 0, dragging = false, sheet: HTMLElement | null = null, content: HTMLElement | null = null, wasPeek = false;
    const sheetFrom = (target: EventTarget | null) => {
      if (!window.matchMedia("(max-width: 520px)").matches || !(target instanceof Element)) return null;
      return target.closest<HTMLElement>(".atlas-popup.is-seat");
    };
    document.addEventListener("touchstart", (event) => {
      sheet = sheetFrom(event.target);
      if (!sheet || event.touches.length !== 1) { sheet = null; return; }
      content = sheet.querySelector<HTMLElement>(".maplibregl-popup-content");
      startY = event.touches[0].clientY; dy = 0; dragging = false; wasPeek = sheet.classList.contains("sheet-peek");
    }, { passive: true });
    document.addEventListener("touchmove", (event) => {
      if (!sheet || !content) return;
      dy = event.touches[0].clientY - startY;
      if (!dragging) {
        const onHandle = (event.target as Element).closest(".maplibregl-popup-close-button") === null &&
          startY - content.getBoundingClientRect().top < 36;
        const canDrag = onHandle || wasPeek || content.scrollTop <= 0 && dy > 0 || (wasPeek && dy < 0);
        if (Math.abs(dy) < 6 || !canDrag) return;
        dragging = true; sheet.classList.add("sheet-dragging");
      }
      event.preventDefault();
      sheet.style.setProperty("--sheet-dy", `${Math.max(dy, wasPeek ? -60 : -20)}px`);
    }, { passive: false });
    const end = () => {
      if (!sheet) return;
      const el = sheet; sheet = null;
      if (!dragging) return;
      el.classList.remove("sheet-dragging"); el.style.removeProperty("--sheet-dy");
      if (dy > 140 || (wasPeek && dy > 40)) popup.remove();
      else if (dy > 50) el.classList.add("sheet-peek");
      else if (dy < -30) el.classList.remove("sheet-peek");
    };
    document.addEventListener("touchend", end);
    document.addEventListener("touchcancel", end);
  }
  const NON_INTERACTIVE = new Set<string>(CONSTITUENCY_LAYERS.filter((id) =>
    id !== "constituencies" && id !== "restore-callout-dot"));
  const interactiveIds = () => ordered.flatMap((layer) => layerIds(layer.id))
    .filter((id) => id !== "roads" && !id.endsWith("-heat") && !NON_INTERACTIVE.has(id) && !!map.getLayer(id));
  const seatFallbackHtml = (name: string, code: string) =>
    `<strong class="popup-title">${escapeHtml(name)}</strong>` +
    (code ? `<div class="popup-meta">${escapeHtml(code)}</div>` : "");
  const updateElectionColours = () => {
    if (!enrichedSeats || !electionData) return;
    const byCode = new globalThis.Map(electionData.seats.map(seat => [seat.code, seat]));
    for (const feature of enrichedSeats.features) {
      const props = feature.properties ?? (feature.properties = {});
      const { color, opacity } = seatColour(byCode.get(String(props.PCON24CD)), electionData, measure);
      props.electionColor = color;
      props.electionOpacity = opacity;
    }
    (map.getSource("constituencies") as import("maplibre-gl").GeoJSONSource | undefined)?.setData(enrichedSeats as never);
  };
  window.addEventListener("atlas:measure", (event) => { measure = (event as CustomEvent<Measure>).detail; updateElectionColours(); });
  const seatLngLat = (code: string): [number, number] | null => {
    const feature = enrichedSeats?.features.find((f) => f.properties?.PCON24CD === code);
    return feature ? labelPointOf(feature.geometry) : null;
  };
  const openSeat = async (code: string, lngLat?: [number, number], fallbackName = "") => {
    setSelected(code);
    // ≤520px: seat popups render as a bottom sheet (fix 7); nav/scale hide while it is open.
    popupIsSeat = true;
    nextPopupLayer = "constituencies";
    try {
      if (!electionData) electionData = await loadElection();
      if (!enrichedSeats) enrichedSeats = electionData.geo as VotingFeatureCollection;
      const at = lngLat ?? seatLngLat(code);
      if (!at) return;
      if (!lngLat) map.flyTo({ center: at, zoom: 9, duration: motionDuration(800) });
      const seat = electionData.seats.find(s => s.code === code);
      if (!seat) {
        popup.setLngLat(at).setHTML(seatFallbackHtml(fallbackName || code, code)).addTo(map);
        return;
      }
      popup.setLngLat(at).setMaxWidth("380px").setHTML(seatHtml(seat, electionData)).addTo(map);
      // Wider than a phone: the seat panel docks on the right, so keep the tapped seat out from under it.
      if (window.matchMedia("(min-width: 521px)").matches) {
        const px = map.project(at);
        const edge = window.innerWidth - Math.min(380, window.innerWidth - 120) - (window.innerWidth > 860 ? 16 : 12) - 24;
        if (px.x > edge) map.panBy([px.x - edge, 0], { duration: motionDuration(400) });
      }
      void loadSeatHistory().then((history) => {
        const el = popup.getElement();
        // Only fill the panel if it still shows this seat (the user may have tapped another meanwhile).
        if (el?.querySelector(`.copy-seat[data-seat="${code}"]`)) attachSeatHistory(el, code, history);
      }).catch(() => { /* keep the latest-share text list */ });
      void loadResultsHistory().then((history) => {
        const el = popup.getElement();
        if (el?.querySelector(`.copy-seat[data-seat="${code}"]`)) attachResultHistory(el, code, history);
      }).catch(() => { /* keep the 2024 text list */ });
      popup.getElement()?.querySelector<HTMLButtonElement>(".copy-seat")?.addEventListener("click", (event) => {
        const url = new URL(location.href); url.searchParams.set("seat", code);
        void navigator.clipboard.writeText(url.href).then(() => { (event.target as HTMLButtonElement).textContent = "Link copied"; });
      });
      const url = new URL(location.href); url.searchParams.set("seat", code); history.replaceState(null, "", url);
      setSelected(code);
    } catch {
      if (lngLat) popup.setLngLat(lngLat).setHTML(seatFallbackHtml(fallbackName || code, code)).addTo(map);
    }
  };
  const restoreBounds = (): [[number, number], [number, number]] | null => {
    const feats = enrichedSeats?.features.filter((f) => f.properties?.endorseColor === "restore") ?? [];
    let w = Infinity, so = Infinity, e = -Infinity, n = -Infinity;
    const visit = (c: unknown): void => {
      if (Array.isArray(c) && typeof c[0] === "number") {
        const [x, y] = c as [number, number];
        w = Math.min(w, x); e = Math.max(e, x); so = Math.min(so, y); n = Math.max(n, y);
      } else if (Array.isArray(c)) c.forEach(visit);
    };
    for (const f of feats) visit((f.geometry as { coordinates?: unknown } | undefined)?.coordinates);
    return Number.isFinite(w) ? [[w, so], [e, n]] : null;
  };
  const flyToRestore = () => {
    const bounds = restoreBounds();
    if (!bounds) return;
    const first = enrichedSeats?.features.find((f) => f.properties?.endorseColor === "restore");
    const code = String(first?.properties?.PCON24CD ?? "");
    map.fitBounds(bounds, { padding: searchPadding(container), duration: motionDuration(800), maxZoom: 11 });
    map.once("moveend", () => { if (code) void openSeat(code); });
  };
  const legend = mountVotingLegend(container.parentElement ?? document.body, {
    restoreColor: ENDORSE_COLORS.restore.fill,
    reformColor: ENDORSE_COLORS.reform.fill,
    onRestore: flyToRestore,
  });
  let hovered: string | null = null;
  const setHovered = (code: string | null) => {
    if (hovered === code || !map.getSource("constituencies")) return;
    if (hovered) map.setFeatureState({ source: "constituencies", id: hovered }, { hover: false });
    hovered = code;
    if (code) map.setFeatureState({ source: "constituencies", id: code }, { hover: true });
  };
  const topFeature = (point: { x: number; y: number }): MapGeoJSONFeature | undefined => {
    const bounds: [[number, number], [number, number]] = [
      [point.x - 5, point.y - 5], [point.x + 5, point.y + 5],
    ];
    return map.queryRenderedFeatures(bounds, { layers: interactiveIds() })[0];
  };
  map.on("click", async (event) => {
    const feature = topFeature(event.point);
    if (!feature) { popup.remove(); return; }
    const properties = feature.properties as Record<string, unknown>;
    const layerId = String(properties.layer ?? feature.source ?? "");
    const layer = LAYERS.find((item) => item.id === layerId);
    const name = String(properties.name ?? layer?.label ?? "Place");
    if (feature.layer.id === "restore-callout-dot") {
      const code = String(properties.pcon24cd ?? "");
      if (code) {
        map.easeTo({ center: event.lngLat, zoom: Math.max(map.getZoom(), 9.5), duration: motionDuration(600) });
        map.once("moveend", () => void openSeat(code));
      }
      return;
    }
    if (layerId === "constituencies") {
      const code = String(properties.PCON24CD ?? "");
      void openSeat(code, [event.lngLat.lng, event.lngLat.lat], name);
      return;
    }
    // Generic POI popup (fix 10): name, singular type + context, one source link.
    const brand = properties.brand ? String(properties.brand) : "";
    const isSample = !OSM_STATIC.has(layerId as LayerId);
    const osmUrl = properties.osm_url ? String(properties.osm_url) : "";
    const point = feature.geometry.type === "Point" ? feature.geometry.coordinates as [number, number] : null;
    const context = brand && brand !== name ? brand : point ? nearestPlace(point[0], point[1]) : "";
    const typeBits = [layer ? singularLabel(layer.label) : "Place", context].filter(Boolean);
    popupIsSeat = false;
    nextPopupLayer = layer?.id ?? null;
    popup.setLngLat(event.lngLat).setMaxWidth("260px").setHTML(
      `<strong class="popup-title popup-title-poi">${escapeHtml(name)}</strong>` +
      `<div class="popup-meta">${escapeHtml(typeBits.join(" · "))}</div>` +
      (isSample ? `<div class="popup-sample">Sample data</div>` : "") +
      (osmUrl
        ? `<a class="popup-link" href="${escapeHtml(osmUrl)}" target="_blank" rel="noopener noreferrer">View on OpenStreetMap<span class="ext" aria-hidden="true">↗</span></a>`
        : ""),
    ).addTo(map);
  });
  map.on("mousemove", (event) => {
    const feature = topFeature(event.point);
    map.getCanvas().style.cursor = feature ? "pointer" : "";
    setHovered(feature?.layer.id === "constituencies" ? String(feature.properties?.PCON24CD ?? "") || null : null);
  });
  map.getCanvas().addEventListener("mouseleave", () => setHovered(null));
  map.on("load", () => {
    loaded = true;
    add("population");
    map.addLayer({ id: "density-glow", type: "heatmap", source: "population",
      paint: {
        "heatmap-weight": ["interpolate", ["linear"], ["get", "pop"], 0, 0, 100000, 0.3, 1000000, 0.8, 9000000, 1],
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 4, 0.7, 9, 1.3],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 4, 18, 9, 36],
        // Cool slate, max alpha 0.16: no warm blobs bleeding into the pick fills (fix 4).
        "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"],
          0, "rgba(93,107,122,0)", 0.25, "rgba(93,107,122,0.06)",
          0.65, "rgba(93,107,122,0.12)", 1, "rgba(93,107,122,0.16)"],
        "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 7, 0.65, 10, 0],
      },
    }, "population");
    for (const layer of ordered) if (state[layer.id] && !paused(layer.id)) add(layer.id);
    applyVotingMode(false);

    map.once("idle", () => { document.body.dataset.mapReady = "true"; });
  });

  return {
    map,
    isOn: (id) => state[id],
    setLayer: (id, on) => {
      const was = state[id];
      state[id] = on;
      if (id === "constituencies" && was !== on) {
        showOthers = false;
        apply(id);
        applyVotingMode(on);
        return;
      }
      if (VOTING_MUTED.has(id) && on && votingOn() && !showOthers) {
        // Explicitly re-enabling a context layer in voting view un-pauses context.
        showOthers = true;
        applyVotingMode(false);
        return;
      }
      apply(id);
    },
    zoomIn: () => {
      map.zoomIn({ duration: motionDuration(280) });
    },
    zoomOut: () => {
      map.zoomOut({ duration: motionDuration(280) });
    },
    home: () => {
      map.fitBounds(HOME_BOUNDS, { padding: homePadding(), duration: motionDuration(700) });
    },
    show: ({ lon, lat, zoom = 11, bounds }) => {
      if (bounds) {
        map.fitBounds(bounds, {
          padding: searchPadding(container),
          duration: motionDuration(800),
          maxZoom: zoom,
        });
        return;
      }
      map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), zoom), duration: motionDuration(800) });
    },
    openSeat: (code, lngLat) => {
      void openSeat(code, lngLat);
    },
    flyToRestore,
  };
}
