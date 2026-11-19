import type { LayerSpecification, SourceSpecification, ExpressionSpecification } from "maplibre-gl";

/**
 * Snapchat "slab" theme: the British Isles drawn top-down as a raised land
 * slab (soft drop shadow, crisp light coast) floating in a glowing sea, with
 * everything outside the islands flattened to cream. Data: public/data/isles-*.geojson
 * (scripts/build_isles_mask.py, Natural Earth 10m, public domain).
 */
/** Land outside the isles: the same soft green as the lowlands, a touch paler (Apple Maps look, t245u). */
export const SLAB_CREAM = "#DDF0C8";
/** Low-land green; also the background under the relief. */
export const SLAB_LAND = "#D2EDB0";
/** Open sea: bright turquoise-cyan, deepest away from the coast. */
export const SLAB_SEA = "#56BDEB";
/** Shelf water near the coast: lighter, built up by the halo bands. */
export const SLAB_SEA_NEAR = "#B4EAF8";
export const SLAB_INK = "#2B2B33";
export const SLAB_REGION = "#6F8466";
export const SLAB_SEA_LABEL = "#2C6A92";
export const SLAB_BORDER = "#9A6A96";

/** Coarse GB + Ireland hull; town names/dots outside it (the continent) are hidden. */
export const ISLES_WITHIN: ExpressionSpecification = ["within", {
  type: "Polygon",
  coordinates: [[[-11, 51.3], [-10.8, 55.6], [-7.8, 58.7], [-3.5, 59.5], [-1.2, 61], [1.9, 60.6], [-1.4, 57.8], [0.4, 53.6],
    [1.95, 52.9], [1.5, 51.1], [-1, 50.6], [-6.5, 49.8], [-11, 51.3]]],
} as never];

const FONT_BOLD = ["Noto Sans Bold"];
const FONT_REG = ["Noto Sans Regular"];
const FONT_ITALIC = ["Noto Sans Italic"];

// Isles-only names: no continental labels (France/Norway etc. stay blank cream).
type Label = [number, number, string, 0 | 1 | 2, "land" | "sea" | "nation"];
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
  [-4.1, 56.75, "SCOTLAND", 0, "nation"],
  [-1.4, 52.75, "ENGLAND", 0, "nation"],
  [-3.65, 52.05, "WALES", 0, "nation"],
  [-6.75, 54.7, "NORTHERN IRELAND", 0, "nation"],
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
  -5, "#D2EDB0",
  80, "#CFEBAA",
  200, "#C9E7A2",
  350, "#CBE3A2",
  500, "#D3E2AA",
  700, "#DEE5BC",
  900, "#EAEDD5",
  1100, "#F6F7EE",
];

const zw = (a: number, b: number, c: number): ExpressionSpecification =>
  ["interpolate", ["exponential", 1.4], ["zoom"], 4, a, 7, b, 11, c];

/** National-to-regional fade: the halo is a fixed-size geographic band, so it fades out by z9. */
const haloFade = (a: number, b: number, c: number, d: number): ExpressionSpecification => {
  const bands = (scale: number): ExpressionSpecification =>
    ["match", ["get", "i"], 0, a * scale, 1, b * scale, 2, c * scale, d * scale];
  // MapLibre permits a single zoom expression, at the top level of the paint value.
  return ["interpolate", ["linear"], ["zoom"], 4, bands(1), 8, bands(0.85), 10.5, bands(0.5), 12, 0];
};

/** Layers drawn above the water fill: banded sea glow, stepped drop shadow, crisp coast + islet outlines. */
export const SLAB_SEA_LAYERS: LayerSpecification[] = [
  {
    id: "slab-glow", type: "fill", source: "isles-halo", filter: ["==", ["get", "kind"], "glow"],
    paint: { "fill-color": SLAB_SEA_NEAR, "fill-antialias": false,
      "fill-opacity": haloFade(0.3, 0.26, 0.22, 0.18) },
  },
  {
    // A wide blurred line along the coast makes the shallow-water gradient smooth instead of stepped.
    id: "slab-coast-glow", type: "line", source: "isles-edge",
    layout: { "line-join": "round" },
    paint: {
      "line-color": SLAB_SEA_NEAR,
      "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 4, 10, 7, 26, 10, 60],
      "line-blur": ["interpolate", ["exponential", 1.5], ["zoom"], 4, 10, 7, 26, 10, 60],
      "line-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.7, 10, 0.55, 12, 0],
    },
  },
  {
    // Darker and wider than the first slab cut (Daniel: closer to the reference's deep SE shadow).
    id: "slab-shadow", type: "fill", source: "isles-halo", filter: ["==", ["get", "kind"], "shadow"],
    // Apple-style flat map: only a whisper of the old slab shadow is left.
    paint: { "fill-color": "#0A4A75", "fill-antialias": false,
      "fill-opacity": haloFade(0.07, 0.04, 0.02, 0) },
  },
  {
    id: "slab-edge", type: "line", source: "isles-edge",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": "#F4FCFF", "line-width": zw(0.5, 0.8, 1.2), "line-blur": 0.3, "line-opacity": 0.7 },
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
  paint: { "fill-color": "#A6D98A", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0.35, 10, 0.55] },
};

/** National parks and protected areas: a soft green wash from z6 (tiles carry them from z6). */
export const SLAB_PARKS: LayerSpecification = {
  id: "slab-parks", type: "fill", source: "openmaptiles", "source-layer": "park", minzoom: 6, maxzoom: 10,
  paint: { "fill-color": "#B5E09A", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0.45, 9, 0.5, 10, 0] },
};

/**
 * Borders: thin dashed lines for the Ireland / Northern Ireland border (admin 2) and between
 * England, Scotland and Wales (admin 4, isles only). Maritime lines are skipped.
 */
export const SLAB_BORDERS: LayerSpecification[] = [
  {
    id: "slab-border-nations", type: "line", source: "openmaptiles", "source-layer": "boundary", minzoom: 4.5,
    filter: ["all", ["==", ["get", "admin_level"], 4], ["!=", ["get", "maritime"], 1], ISLES_WITHIN],
    layout: { "line-join": "round" },
    paint: { "line-color": SLAB_BORDER, "line-opacity": 0.75, "line-width": zw(0.7, 1, 1.4), "line-dasharray": [3, 2] },
  },
  {
    id: "slab-border-country", type: "line", source: "openmaptiles", "source-layer": "boundary",
    filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1]],
    layout: { "line-join": "round" },
    paint: { "line-color": SLAB_BORDER, "line-opacity": 0.95, "line-width": zw(1, 1.3, 1.8), "line-dasharray": [4, 2] },
  },
];

/** Thin light trunk-road lines from z6, handing over to the full road hierarchy by z10. */
export const SLAB_NATIONAL_ROADS: LayerSpecification = {
  id: "slab-roads", type: "line", source: "openmaptiles", "source-layer": "transportation", minzoom: 5.5, maxzoom: 10.5,
  filter: ["all", ["match", ["get", "class"], ["motorway", "trunk", "primary"], true, false], ["!=", ["get", "brunnel"], "tunnel"]],
  layout: { "line-join": "round", "line-cap": "round" },
  paint: {
    "line-color": ["match", ["get", "class"], "motorway", "#FFF6DA", "#FFFFFF"],
    "line-width": ["interpolate", ["linear"], ["zoom"], 6, ["match", ["get", "class"], "primary", 0.35, 0.6], 9, ["match", ["get", "class"], "primary", 0.8, 1.3]],
    "line-opacity": ["interpolate", ["linear"], ["zoom"], 5.5, 0, 6.3, 0.9, 9.6, 0.9, 10.5, 0],
  },
};

/** Country names in spaced bold caps (UK, Ireland, and the continent's edges); GB nations in lighter caps. */
export const SLAB_COUNTRY_LABELS: LayerSpecification[] = [
  {
    id: "slab-country-label", type: "symbol", source: "openmaptiles", "source-layer": "place", maxzoom: 7,
    filter: ["==", ["get", "class"], "country"],
    layout: {
      "text-field": ["upcase", ["coalesce", ["get", "name:en"], ["get", "name"]]],
      "text-font": FONT_BOLD,
      "text-size": ["interpolate", ["linear"], ["zoom"], 4, 11, 7, 15],
      "text-letter-spacing": 0.18,
      "text-max-width": 7,
    },
    paint: { "text-color": "#33333B", "text-halo-color": "rgba(255,255,255,0.8)", "text-halo-width": 1.3,
      // The UK name hands over to the nation names; other countries stay until z7.
      "text-opacity": ["interpolate", ["linear"], ["zoom"], 5.5, 1, 5.9, ["match", ["get", "name"], "United Kingdom", 0, 1]] },
  },
  {
    id: "slab-nation-label", type: "symbol", source: "slab-labels", minzoom: 5.4, maxzoom: 8.5,
    filter: ["==", ["get", "kind"], "nation"],
    layout: {
      "text-field": ["get", "name"],
      "text-font": FONT_BOLD,
      "text-size": ["interpolate", ["linear"], ["zoom"], 5.4, 10.5, 8, 14],
      "text-letter-spacing": 0.24,
      "text-max-width": 8,
    },
    paint: { "text-color": "#707A86", "text-halo-color": "rgba(255,255,255,0.75)", "text-halo-width": 1.2,
      "text-opacity": ["interpolate", ["linear"], ["zoom"], 5.4, 0, 5.9, 1] },
  },
];

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
    filter: ["all", ["==", ["get", "rank"], rank], ["!=", ["get", "kind"], "nation"]],
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["match", ["get", "kind"], "sea", ["literal", FONT_ITALIC], ["literal", FONT_BOLD]],
      "text-size": ["interpolate", ["linear"], ["zoom"], 4.5,
        ["match", ["get", "kind"], "sea", 13, 10], 8,
        ["match", ["get", "kind"], "sea", 17, 13]],
      "text-letter-spacing": ["match", ["get", "kind"], "sea", 0.12, 0.22],
      "text-max-width": ["match", ["get", "kind"], "sea", 6, 9],
      // Region / sea names are the hierarchy: always place them, towns yield.
      "text-allow-overlap": true,
      "symbol-z-order": "source",
      "text-padding": 2,
    },
    paint: {
      "text-color": ["match", ["get", "kind"], "sea", SLAB_SEA_LABEL, SLAB_REGION],
      "text-halo-color": ["match", ["get", "kind"], "sea", "rgba(214,244,255,0.55)", "rgba(255,255,255,0.7)"],
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
    // OpenMapTiles rank orders places by population: London rank 1, small towns ~10+.
    "text-size": ["interpolate", ["linear"], ["zoom"],
      5, ["match", ["get", "class"], "city", ["interpolate", ["linear"], ["coalesce", ["get", "rank"], 10], 1, 14, 4, 11.5, 8, 10], 9],
      10, ["match", ["get", "class"], "city", ["interpolate", ["linear"], ["coalesce", ["get", "rank"], 10], 1, 19, 4, 16, 8, 14], "town", 12.5, 11]],
    "text-variable-anchor": ["left", "right", "top", "bottom"],
    "text-radial-offset": 0.7,
    "text-max-width": 8,
    "text-padding": 4,
    "symbol-sort-key": ["coalesce", ["get", "rank"], 99],
  },
  paint: { "text-color": SLAB_INK, "text-halo-color": "rgba(255,255,255,0.92)", "text-halo-width": 1.6, "text-halo-blur": 0.18 },
};

/** Terrain DEM (AWS Terrarium, z≤12) powering colour relief + hillshade; no 3D terrain is set. */
export const TERRAIN_SOURCE: SourceSpecification = {
  type: "raster-dem", tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
  tileSize: 256, maxzoom: 12, encoding: "terrarium",
};

export const SLAB_RELIEF_LAYERS: LayerSpecification[] = [
  { id: "dem-color-relief", type: "color-relief", source: "terrain",
    paint: { "color-relief-color": SLAB_RELIEF, "color-relief-opacity": ["interpolate", ["linear"], ["zoom"], 10.5, 1, 14, 0] } } as LayerSpecification,
  { id: "dem-hillshade", type: "hillshade", source: "terrain",
    paint: {
      "hillshade-illumination-direction": 315, "hillshade-illumination-anchor": "map",
      "hillshade-exaggeration": ["interpolate", ["linear"], ["zoom"], 5, 0.28, 10, 0.38, 14, 0.18], "hillshade-method": "multidirectional",
      "hillshade-shadow-color": "rgba(70,95,60,0.3)", "hillshade-highlight-color": "rgba(255,255,240,0.35)",
      "hillshade-accent-color": "rgba(90,80,50,0.18)",
    } } as LayerSpecification,
];

