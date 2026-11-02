import type { ExpressionSpecification, LayerSpecification } from "maplibre-gl";

/**
 * Street-level basemap in the spirit of Apple Maps: warm neutral land, soft parks and water,
 * flat buildings, a proper road hierarchy with casings, and names for roads, places, water and
 * points of interest. All of it comes from the OpenMapTiles vector tiles already loaded as the
 * "openmaptiles" source; nothing here is fetched separately. Every layer fades in between z9 and
 * z15 so the national "slab" look stays untouched when zoomed out.
 */
const SRC = "openmaptiles";
const FONT_REG = ["Noto Sans Regular"];
const FONT_BOLD = ["Noto Sans Bold"];
const FONT_ITALIC = ["Noto Sans Italic"];
const NAME: ExpressionSpecification = ["coalesce", ["get", "name:en"], ["get", "name"]];
const INK = "#3a3a42";

/** Linear zoom ramp helper: [zoom, value, zoom, value, ...]. */
const ramp = (...stops: unknown[]): ExpressionSpecification =>
  ["interpolate", ["linear"], ["zoom"], ...stops] as unknown as ExpressionSpecification;
const expRamp = (base: number, ...stops: unknown[]): ExpressionSpecification =>
  ["interpolate", ["exponential", base], ["zoom"], ...stops] as unknown as ExpressionSpecification;
const inClass = (...classes: string[]): ExpressionSpecification =>
  ["match", ["get", "class"], classes, true, false] as unknown as ExpressionSpecification;
const notTunnel: ExpressionSpecification = ["!=", ["get", "brunnel"], "tunnel"];

// ----- Ground: land cover, land use, parks, rivers (drawn under the water fill) -----------------

export const BASEMAP_GROUND: LayerSpecification[] = [
  {
    id: "bm-landcover", type: "fill", source: SRC, "source-layer": "landcover", minzoom: 9,
    filter: inClass("grass", "farmland", "wetland", "sand", "rock"),
    paint: {
      "fill-color": ["match", ["get", "class"], "grass", "#e1eed0", "farmland", "#ebf0d8", "wetland", "#d6e8d2", "sand", "#f1e8c8", "#e3dfd8"],
      "fill-opacity": ramp(9, 0, 12, 0.85),
      "fill-antialias": false,
    },
  },
  {
    id: "bm-landuse", type: "fill", source: SRC, "source-layer": "landuse", minzoom: 10,
    filter: inClass("residential", "suburb", "neighbourhood", "commercial", "retail", "industrial", "cemetery", "hospital", "school", "university", "college", "playground", "pitch", "stadium", "railway", "garages", "military", "quarry"),
    paint: {
      "fill-color": ["match", ["get", "class"],
        ["residential", "suburb", "neighbourhood"], "#ece7dc",
        ["commercial", "retail"], "#efe2d3",
        ["industrial", "garages", "railway", "quarry"], "#e6e3e6",
        "cemetery", "#cfe3c3",
        "hospital", "#f6dede",
        ["school", "university", "college"], "#efe6d2",
        ["pitch", "playground", "stadium"], "#c4e3b4",
        "military", "#e8dcdc",
        "#ebe7dd"],
      "fill-opacity": ramp(10, 0, 13, 0.9),
      "fill-antialias": false,
    },
  },
  {
    id: "bm-wood", type: "fill", source: SRC, "source-layer": "landcover", minzoom: 10,
    filter: ["==", ["get", "class"], "wood"],
    paint: { "fill-color": "#c7e2b3", "fill-opacity": ramp(10, 0.1, 13, 0.7) },
  },
  {
    id: "bm-park", type: "fill", source: SRC, "source-layer": "park", minzoom: 8,
    paint: { "fill-color": "#c9e5b6", "fill-opacity": ramp(8, 0, 11, 0.55, 14, 0.8), "fill-antialias": true },
  },
];

export const BASEMAP_WATERWAYS: LayerSpecification[] = [
  {
    id: "bm-waterway", type: "line", source: SRC, "source-layer": "waterway", minzoom: 9,
    filter: inClass("river", "canal", "stream", "ditch", "drain"),
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "#9fcdf0",
      "line-width": expRamp(1.5,
        9, ["match", ["get", "class"], "river", 0.8, "canal", 0.6, 0.3],
        14, ["match", ["get", "class"], "river", 4, "canal", 2.5, 1],
        18, ["match", ["get", "class"], "river", 14, "canal", 8, 3]),
      "line-opacity": ramp(9, 0, 11, ["match", ["get", "class"], ["river", "canal"], 1, 0], 12, ["match", ["get", "class"], ["river", "canal"], 1, 0], 14, 1),
    },
  },
];

// ----- Buildings and roads (above the water and sea layers) ---------------------------------------

export const BASEMAP_BUILDINGS: LayerSpecification[] = [
  {
    id: "bm-building", type: "fill", source: SRC, "source-layer": "building", minzoom: 13,
    paint: {
      "fill-color": ramp(13, "#ebe5d8", 17, "#e4dccb"),
      "fill-opacity": ramp(13, 0, 14.5, 1),
      "fill-outline-color": "#d3c9b5",
    },
  },
  {
    id: "bm-building-edge", type: "line", source: SRC, "source-layer": "building", minzoom: 15.5,
    paint: { "line-color": "#cfc4ad", "line-width": ramp(15.5, 0.4, 19, 1), "line-opacity": ramp(15.5, 0, 17, 0.9) },
  },
];

type Tier = {
  id: string;
  classes: string[];
  minzoom: number;
  fill: string;
  casing: string;
  /** [z, px] pairs for the road body; the casing adds a fixed border on top. */
  width: (number | number)[];
};

// Painter's order: minor first, motorways last (on top).
const TIERS: Tier[] = [
  { id: "service", classes: ["service", "busway"], minzoom: 14, fill: "#ffffff", casing: "#dcd6c9", width: [14, 0.8, 17, 4, 20, 14] },
  { id: "minor", classes: ["minor"], minzoom: 12.5, fill: "#ffffff", casing: "#d9d3c5", width: [12.5, 0.7, 14, 2.4, 17, 9, 20, 26] },
  { id: "tertiary", classes: ["tertiary"], minzoom: 11.5, fill: "#ffffff", casing: "#d5cfc0", width: [11.5, 0.8, 14, 3.4, 17, 11, 20, 30] },
  { id: "secondary", classes: ["secondary"], minzoom: 10.5, fill: "#fff6d8", casing: "#e0cf9a", width: [10.5, 0.9, 14, 4.2, 17, 12, 20, 32] },
  { id: "primary", classes: ["primary"], minzoom: 9.5, fill: "#ffe9a6", casing: "#e4c466", width: [9.5, 0.9, 14, 4.8, 17, 13, 20, 34] },
  { id: "trunk", classes: ["trunk"], minzoom: 8.5, fill: "#fbd57a", casing: "#e2ab45", width: [8.5, 0.9, 14, 5.2, 17, 14, 20, 36] },
  { id: "motorway", classes: ["motorway"], minzoom: 8, fill: "#f8b95a", casing: "#dc9230", width: [8, 1, 14, 5.8, 17, 15, 20, 38] },
];

const roadLayers = (): LayerSpecification[] => {
  const layers: LayerSpecification[] = [];
  for (const tier of TIERS) {
    const filter = ["all", inClass(...tier.classes), notTunnel] as unknown as ExpressionSpecification;
    const body = expRamp(1.4, ...tier.width);
    const fade = ramp(tier.minzoom, 0, tier.minzoom + 1.2, 1);
    layers.push(
      {
        id: `bm-road-${tier.id}-casing`, type: "line", source: SRC, "source-layer": "transportation", minzoom: tier.minzoom, filter,
        layout: { "line-cap": "butt", "line-join": "round" },
        paint: { "line-color": tier.casing, "line-opacity": fade, "line-width": expRamp(1.4, ...tier.width.map((v, i) => (i % 2 ? (v as number) + 1.6 : v))) },
      },
      {
        id: `bm-road-${tier.id}`, type: "line", source: SRC, "source-layer": "transportation", minzoom: tier.minzoom, filter,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": tier.fill, "line-opacity": fade, "line-width": body },
      },
    );
  }
  return layers;
};

export const BASEMAP_ROADS: LayerSpecification[] = [
  // Footpaths, tracks and cycleways: thin dashed lines at street zoom only.
  {
    id: "bm-path", type: "line", source: SRC, "source-layer": "transportation", minzoom: 14.5,
    filter: ["all", inClass("path", "track", "pedestrian"), notTunnel] as unknown as ExpressionSpecification,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": ["match", ["get", "class"], "pedestrian", "#f7f3ea", "#bfae93"],
      "line-width": ramp(14.5, ["match", ["get", "class"], "pedestrian", 1, 0.6], 18, ["match", ["get", "class"], "pedestrian", 7, 1.6]),
      "line-dasharray": ["match", ["get", "class"], "pedestrian", ["literal", [1, 0]], ["literal", [2, 1.4]]],
      "line-opacity": ramp(14.5, 0, 15.5, 1),
    },
  },
  ...roadLayers(),
  {
    id: "bm-tunnel", type: "line", source: SRC, "source-layer": "transportation", minzoom: 11,
    filter: ["all", ["==", ["get", "brunnel"], "tunnel"], inClass("motorway", "trunk", "primary", "secondary", "tertiary", "minor")] as unknown as ExpressionSpecification,
    layout: { "line-join": "round" },
    paint: { "line-color": "#d8d2c4", "line-width": expRamp(1.4, 11, 0.8, 14, 3, 18, 12), "line-dasharray": [2, 1.5], "line-opacity": 0.8 },
  },
  {
    id: "bm-rail", type: "line", source: SRC, "source-layer": "transportation", minzoom: 10,
    filter: ["all", ["==", ["get", "class"], "rail"], notTunnel] as unknown as ExpressionSpecification,
    paint: { "line-color": "#b9b4ac", "line-width": ramp(10, 0.5, 14, 1.2, 18, 3), "line-opacity": ramp(10, 0, 11.5, 1) },
  },
  {
    id: "bm-rail-ties", type: "line", source: SRC, "source-layer": "transportation", minzoom: 14,
    filter: ["all", ["==", ["get", "class"], "rail"], notTunnel] as unknown as ExpressionSpecification,
    paint: { "line-color": "#ffffff", "line-width": ramp(14, 0.6, 18, 2), "line-dasharray": [3, 3] },
  },
];

// ----- Labels (placed on top so data layers and fills never hide them) --------------------------

const HALO = { "text-halo-color": "rgba(255,255,255,0.92)", "text-halo-width": 1.5, "text-halo-blur": 0.2 } as const;

/** Non-data POIs only: pubs, schools, churches and the like are already chips from the Layers panel. */
const COVERED_BY_LAYERS = ["school", "college", "hospital", "place_of_worship", "fuel", "post", "library", "charging_station", "pharmacy", "dentist", "doctors", "clinic", "townhall", "courthouse", "prison", "playground", "swimming_pool", "fitness_centre", "sports_centre", "cinema", "theatre", "museum", "attraction"];

export const BASEMAP_LABELS: LayerSpecification[] = [
  {
    id: "bm-road-label", type: "symbol", source: SRC, "source-layer": "transportation_name", minzoom: 11,
    filter: ["has", "name"],
    layout: {
      "symbol-placement": "line",
      "text-field": NAME,
      "text-font": FONT_REG,
      "text-size": ramp(11, 9, 14, 11, 18, 14),
      "text-letter-spacing": 0.02,
      "text-padding": 6,
      "text-max-angle": 30,
      "symbol-sort-key": ["match", ["get", "class"], ["motorway", "trunk"], 0, "primary", 1, "secondary", 2, "tertiary", 3, 4],
    },
    paint: {
      "text-color": "#4a4a52",
      ...HALO,
      "text-opacity": ["step", ["zoom"], ["match", ["get", "class"], ["motorway", "trunk", "primary", "secondary"], 1, 0], 13, ["match", ["get", "class"], ["minor", "service", "track", "path"], 0, 1], 14.5, 1],
    },
  },
  {
    id: "bm-water-label", type: "symbol", source: SRC, "source-layer": "water_name", minzoom: 9,
    filter: ["has", "name"],
    layout: { "text-field": NAME, "text-font": FONT_ITALIC, "text-size": ramp(9, 10, 15, 13), "text-letter-spacing": 0.08, "text-max-width": 7 },
    paint: { "text-color": "#4b86b8", "text-halo-color": "rgba(255,255,255,0.6)", "text-halo-width": 1.2 },
  },
  {
    id: "bm-place-minor", type: "symbol", source: SRC, "source-layer": "place", minzoom: 11.5,
    filter: inClass("suburb", "hamlet", "neighbourhood", "quarter", "isolated_dwelling"),
    layout: {
      "text-field": NAME,
      "text-font": FONT_REG,
      "text-size": ramp(11.5, 10, 15, 13, 17, 15),
      "text-transform": ["match", ["get", "class"], ["suburb", "quarter", "neighbourhood"], "uppercase", "none"],
      "text-letter-spacing": ["match", ["get", "class"], ["suburb", "quarter", "neighbourhood"], 0.08, 0],
      "text-max-width": 8,
      "text-padding": 6,
      "symbol-sort-key": ["coalesce", ["get", "rank"], 99],
    },
    paint: { "text-color": "#6b6b76", ...HALO, "text-opacity": ramp(13, ["match", ["get", "class"], ["neighbourhood", "quarter", "isolated_dwelling"], 0, 1], 14, 1) },
  },
  {
    id: "bm-park-label", type: "symbol", source: SRC, "source-layer": "park", minzoom: 13,
    filter: ["has", "name"],
    layout: { "text-field": NAME, "text-font": FONT_REG, "text-size": ramp(13, 10, 17, 13), "text-max-width": 7, "text-padding": 8 },
    paint: { "text-color": "#4f7f48", ...HALO },
  },
  {
    id: "bm-peak-label", type: "symbol", source: SRC, "source-layer": "mountain_peak", minzoom: 10,
    filter: ["has", "name"],
    layout: {
      "text-field": ["format", NAME, {}, ["case", ["has", "ele"], ["concat", "\n", ["get", "ele"], " m"], ""], { "font-scale": 0.85 }],
      "text-font": FONT_REG, "text-size": 11, "text-max-width": 7, "text-padding": 6,
      "symbol-sort-key": ["-", 0, ["to-number", ["coalesce", ["get", "ele"], 0]]],
    },
    paint: { "text-color": "#7d5f45", ...HALO },
  },
  {
    id: "bm-poi-dot", type: "circle", source: SRC, "source-layer": "poi", minzoom: 15.5,
    filter: ["all", ["has", "name"], ["!", inClass(...COVERED_BY_LAYERS)]] as unknown as ExpressionSpecification,
    paint: {
      "circle-radius": ramp(15.5, 2.5, 18, 4.5),
      "circle-color": ["match", ["get", "class"],
        ["restaurant", "fast_food", "cafe", "bar", "pub", "ice_cream", "bakery"], "#ee8a3a",
        ["shop", "grocery", "clothing_store", "department_store", "convenience", "supermarket", "butcher", "florist"], "#e06a7c",
        ["park", "garden", "pitch", "dog_park", "golf"], "#5faa57",
        ["lodging", "hotel"], "#9a74c8",
        ["bank", "atm"], "#5b8bd0",
        "#8f94a0"],
      "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.2,
      "circle-opacity": ramp(15.5, 0, 16.2, 1), "circle-stroke-opacity": ramp(15.5, 0, 16.2, 1),
    },
  },
  {
    id: "bm-poi-label", type: "symbol", source: SRC, "source-layer": "poi", minzoom: 15.5,
    filter: ["all", ["has", "name"], ["!", inClass(...COVERED_BY_LAYERS)]] as unknown as ExpressionSpecification,
    layout: {
      "text-field": NAME, "text-font": FONT_REG, "text-size": ramp(15.5, 10, 18, 12),
      "text-anchor": "left", "text-offset": [0.8, 0], "text-max-width": 7, "text-padding": 4, "text-optional": true,
      "symbol-sort-key": ["coalesce", ["get", "rank"], 99],
    },
    paint: { "text-color": "#585863", ...HALO, "text-opacity": ramp(15.5, 0, 16.2, 1) },
  },
  {
    id: "bm-housenumber", type: "symbol", source: SRC, "source-layer": "housenumber", minzoom: 17,
    layout: { "text-field": ["get", "housenumber"], "text-font": FONT_REG, "text-size": 10, "text-padding": 2 },
    paint: { "text-color": "#8b8678", "text-halo-color": "rgba(255,255,255,0.85)", "text-halo-width": 1 },
  },
];

export { FONT_BOLD, INK };
