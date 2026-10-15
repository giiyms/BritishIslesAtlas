import type { LayerSpecification, SourceSpecification, ExpressionSpecification } from "maplibre-gl";

/**
 * Snapchat "slab" theme: the British Isles drawn top-down as a raised land
 * slab (soft drop shadow, crisp light coast) floating in a glowing sea, with
 * everything outside the islands flattened to cream. Data: public/data/isles-*.geojson
 * (scripts/build_isles_mask.py, Natural Earth 10m, public domain).
 */
export const SLAB_CREAM = "#F3EEDF";
export const SLAB_SEA = "#4C9BEB";
export const SLAB_SEA_NEAR = "#A6DDF2";
export const SLAB_INK = "#2B2B33";
export const SLAB_REGION = "#7A6690";
export const SLAB_SEA_LABEL = "#D8F0FF";

/** Coarse GB + Ireland hull; town names/dots outside it (the continent) are hidden. */
export const ISLES_WITHIN: ExpressionSpecification = ["within", {
  type: "Polygon",
  coordinates: [[[-11, 51.3], [-10.8, 55.6], [-7.8, 58.7], [-3.5, 59.5], [-1.2, 61], [1.9, 60.6], [-1.4, 57.8], [0.4, 53.6],
    [1.95, 52.9], [1.5, 51.1], [-1, 50.6], [-6.5, 49.8], [-11, 51.3]]],
} as never];

const FONT_BOLD = ["Noto Sans Bold"];
const FONT_REG = ["Noto Sans Regular"];

// Isles-only names: no continental labels (France/Norway etc. stay blank cream).
type Label = [number, number, string, 0 | 1 | 2, "land" | "sea"];
// rank 0 = always, 1 = from z5.4, 2 = from z6.6
const LABELS: Label[] = [
  [-4.75, 57.25, "HIGHLANDS", 0, "land"],
  [-3.55, 57.06, "CAIRNGORMS", 1, "land"],
  [-3.6, 55.38, "SOUTHERN UPLANDS", 1, "land"],
  [-3.12, 54.5, "LAKE DISTRICT", 1, "land"],
  [-2.15, 54.15, "PENNINES", 0, "land"],
  [-0.95, 54.38, "NORTH YORK MOORS", 2, "land"],
  [-1.78, 53.33, "PEAK DISTRICT", 2, "land"],
  [-3.9, 52.98, "SNOWDONIA (ERYRI)", 1, "land"],
  [-3.75, 52.3, "CAMBRIAN MOUNTAINS", 1, "land"],
  [-3.45, 51.9, "BRECON BEACONS", 2, "land"],
  [-3.9, 50.58, "DARTMOOR", 1, "land"],
  [-3.6, 51.13, "EXMOOR", 2, "land"],
  [0.1, 52.55, "THE FENS", 2, "land"],
  [-6.35, 53.0, "WICKLOW MOUNTAINS", 1, "land"],
  [-9.65, 53.5, "CONNEMARA", 1, "land"],
  [-9.7, 51.95, "MACGILLYCUDDY'S REEKS", 2, "land"],
  [-6.0, 54.17, "MOURNES", 2, "land"],
  [2.3, 56.2, "NORTH SEA", 0, "sea"],
  [-5.15, 53.85, "IRISH SEA", 0, "sea"],
  [-11.4, 55.6, "ATLANTIC OCEAN", 0, "sea"],
  [-2.6, 50.2, "ENGLISH CHANNEL", 1, "sea"],
  [-7.6, 50.9, "CELTIC SEA", 1, "sea"],
  [-7.1, 56.75, "SEA OF THE HEBRIDES", 2, "sea"],
];

export const SLAB_SOURCES: Record<string, SourceSpecification> = {
  "isles-land": { type: "geojson", data: "/data/isles-land.geojson" },
  "isles-edge": { type: "geojson", data: "/data/isles-edge.geojson" },
  "isles-halo": { type: "geojson", data: "/data/isles-halo.geojson" },
  "isles-outside": { type: "geojson", data: "/data/isles-outside.geojson" },
  "slab-labels": {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: LABELS.map(([lon, lat, name, rank, kind]) => ({
        type: "Feature", properties: { name, rank, kind }, geometry: { type: "Point", coordinates: [lon, lat] },
      })),
    } as never,
  },
};

/** Colour relief tuned for British heights (Ben Nevis 1,345 m). */
export const SLAB_RELIEF: ExpressionSpecification = [
  "interpolate", ["linear"], ["elevation"],
  -5, "#9FD67A",
  60, "#A2D77B",
  180, "#A8D47C",
  300, "#B0CF7E",
  400, "#BCCB84",
  520, "#CFC48E",
  680, "#D6C29A",
  820, "#E2D8C6",
  920, "#F4F1EC",
  1020, "#FFFFFF",
];

const zw = (a: number, b: number, c: number): ExpressionSpecification =>
  ["interpolate", ["exponential", 1.4], ["zoom"], 4, a, 7, b, 11, c];

/** National-to-regional fade: the halo is a fixed-size geographic band, so it fades out by z9. */
const haloFade = (o: number): ExpressionSpecification => ["interpolate", ["linear"], ["zoom"], 4, o, 7.5, o * 0.8, 9, 0];

/** Layers drawn above the water fill: banded sea glow, stepped drop shadow, crisp coast + islet outlines. */
export const SLAB_SEA_LAYERS: LayerSpecification[] = [
  {
    id: "slab-glow", type: "fill", source: "isles-halo", filter: ["==", ["get", "kind"], "glow"],
    paint: { "fill-color": SLAB_SEA_NEAR, "fill-antialias": false,
      "fill-opacity": ["match", ["get", "i"], 0, haloFade(0.55), 1, haloFade(0.34), 2, haloFade(0.2), haloFade(0.1)] },
  },
  {
    // Darker and wider than the first slab cut (Daniel: closer to the reference's deep SE shadow).
    id: "slab-shadow", type: "fill", source: "isles-halo", filter: ["==", ["get", "kind"], "shadow"],
    paint: { "fill-color": "#0A2A55", "fill-antialias": false,
      "fill-opacity": ["match", ["get", "i"], 0, haloFade(0.5), 1, haloFade(0.34), 2, haloFade(0.2), haloFade(0.09)] },
  },
  {
    id: "slab-edge", type: "line", source: "isles-edge",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": "#FFFDF4", "line-width": zw(0.6, 1, 1.6), "line-blur": 0.3, "line-opacity": 0.85 },
  },
  {
    // Every islet gets a thin outline so Fair Isle, St Kilda, the Scillies etc. read at national zoom.
    id: "slab-islets", type: "line", source: "isles-land",
    layout: { "line-join": "round" },
    paint: { "line-color": "#FFFDF4", "line-width": zw(0.7, 0.8, 1), "line-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.9, 9, 0.5] },
  },
];

export const SLAB_OUTSIDE: LayerSpecification = {
  id: "slab-outside", type: "fill", source: "isles-outside",
  paint: { "fill-color": SLAB_CREAM, "fill-opacity": 1, "fill-antialias": false },
};

export const SLAB_WOOD: LayerSpecification = {
  id: "slab-wood", type: "fill", source: "openmaptiles", "source-layer": "landcover", minzoom: 6,
  filter: ["==", ["get", "class"], "wood"],
  paint: { "fill-color": "#5FAE5E", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0.25, 10, 0.45] },
};

export const SLAB_LABEL_LAYERS: LayerSpecification[] = [
  {
    id: "slab-town-dots", type: "circle", source: "openmaptiles", "source-layer": "place",
    filter: ["all", ["match", ["get", "class"], ["city", "town"], true, false], ISLES_WITHIN],
    paint: {
      "circle-radius": ["step", ["zoom"], ["match", ["get", "class"], "city", 3.2, 0], 7.5, 3.2, 10, 0],
      "circle-color": "#FFFFFF",
      "circle-stroke-color": "#4A4A55",
      "circle-stroke-width": ["step", ["zoom"], ["match", ["get", "class"], "city", 1.3, 0], 7.5, 1.3, 10, 0],
    },
  },
  ...([[0, 0], [1, 5.4], [2, 6.6]] as const).map(([rank, minzoom]): LayerSpecification => ({
    id: `slab-region-${rank}`, type: "symbol", source: "slab-labels", minzoom, maxzoom: 10,
    filter: ["==", ["get", "rank"], rank],
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["match", ["get", "kind"], "sea", ["literal", FONT_REG], ["literal", FONT_BOLD]],
      "text-size": ["interpolate", ["linear"], ["zoom"], 4.5,
        ["match", ["get", "kind"], "sea", 13, 13], 8,
        ["match", ["get", "kind"], "sea", 18, 19]],
      "text-letter-spacing": ["match", ["get", "kind"], "sea", 0.3, 0.32],
      "text-max-width": ["match", ["get", "kind"], "sea", 6, 9],
      // Region / sea names are the hierarchy: always place them, towns yield.
      "text-allow-overlap": true,
      "symbol-z-order": "source",
      "text-padding": 2,
    },
    paint: {
      "text-color": ["match", ["get", "kind"], "sea", SLAB_SEA_LABEL, SLAB_REGION],
      "text-halo-color": ["match", ["get", "kind"], "sea", "rgba(255,255,255,0.35)", "rgba(255,253,244,0.75)"],
      "text-halo-width": 1.2,
    },
  })),
];

/** Snapchat-style place labels (towns from z7.5, villages from z10), isles only. */
export const SLAB_PLACE_LABELS: LayerSpecification = {
  id: "place-labels", type: "symbol", source: "openmaptiles", "source-layer": "place",
  filter: ["all", ["match", ["get", "class"], ["city", "town", "village"], true, false], ISLES_WITHIN],
  layout: {
    "text-field": ["step", ["zoom"], ["match", ["get", "class"], "city", ["coalesce", ["get", "name:en"], ["get", "name"]], ""],
      7.5, ["match", ["get", "class"], "village", "", ["coalesce", ["get", "name:en"], ["get", "name"]]],
      10, ["coalesce", ["get", "name:en"], ["get", "name"]]],
    "text-font": ["match", ["get", "class"], "city", ["literal", FONT_BOLD], ["literal", FONT_REG]],
    "text-size": ["interpolate", ["linear"], ["zoom"], 5, ["match", ["get", "class"], "city", 11, 9],
      10, ["match", ["get", "class"], "city", 15, "town", 12.5, 11]],
    "text-variable-anchor": ["left", "right", "top", "bottom"],
    "text-radial-offset": 0.7,
    "text-max-width": 8,
    "text-padding": 4,
    "symbol-sort-key": ["coalesce", ["get", "rank"], 99],
  },
  paint: { "text-color": SLAB_INK, "text-halo-color": "rgba(255,255,255,0.85)", "text-halo-width": 1.6, "text-halo-blur": 0.18 },
};

/** Terrain DEM (AWS Terrarium, z≤12) powering colour relief + hillshade; no 3D terrain is set. */
export const TERRAIN_SOURCE: SourceSpecification = {
  type: "raster-dem", tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
  tileSize: 256, maxzoom: 12, encoding: "terrarium",
};

export const SLAB_RELIEF_LAYERS: LayerSpecification[] = [
  { id: "dem-color-relief", type: "color-relief", source: "terrain",
    paint: { "color-relief-color": SLAB_RELIEF, "color-relief-opacity": 1 } } as LayerSpecification,
  { id: "dem-hillshade", type: "hillshade", source: "terrain",
    paint: {
      "hillshade-illumination-direction": 315, "hillshade-illumination-anchor": "map",
      "hillshade-exaggeration": 0.5, "hillshade-method": "multidirectional",
      "hillshade-shadow-color": "rgba(60,70,40,0.36)", "hillshade-highlight-color": "rgba(255,255,240,0.35)",
      "hillshade-accent-color": "rgba(90,80,50,0.18)",
    } } as LayerSpecification,
];

