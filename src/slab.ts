import type { LayerSpecification, SourceSpecification, ExpressionSpecification } from "maplibre-gl";

/**
 * Snapchat "slab" theme: the British Isles drawn top-down as a raised land
 * slab (soft drop shadow, crisp light coast) floating in a glowing sea, with
 * everything outside the islands flattened to cream. Data: public/data/isles-*.geojson
 * (scripts/build_isles_mask.py, Natural Earth 10m, public domain).
 */
export const SLAB_CREAM = "#F3EEDF";
export const SLAB_SEA = "#4C9BEB";
export const SLAB_SEA_NEAR = "#7FDAF6";
export const SLAB_INK = "#2B2B33";
export const SLAB_REGION = "#7A6690";
export const SLAB_SEA_LABEL = "#D8F0FF";

const FONT_BOLD = ["Noto Sans Bold"];
const FONT_REG = ["Noto Sans Regular"];

type Label = [number, number, string, 0 | 1 | 2, "land" | "sea" | "outside"];
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
  [-12.6, 54.8, "ATLANTIC OCEAN", 0, "sea"],
  [-2.6, 50.2, "ENGLISH CHANNEL", 1, "sea"],
  [-7.6, 50.9, "CELTIC SEA", 1, "sea"],
  [-7.1, 56.75, "SEA OF THE HEBRIDES", 2, "sea"],
  [2.6, 49.4, "FRANCE", 0, "outside"],
  [7.0, 58.6, "NORWAY", 0, "outside"],
];

export const SLAB_SOURCES: Record<string, SourceSpecification> = {
  "isles-land": { type: "geojson", data: "/data/isles-land.geojson" },
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
  30, "#A3D77C",
  120, "#B4DA84",
  220, "#C9D58C",
  330, "#D8C58A",
  480, "#D2B27E",
  650, "#C9A97E",
  800, "#D9CBB4",
  900, "#F2EEE8",
  1000, "#FFFFFF",
];

const zw = (a: number, b: number, c: number): ExpressionSpecification =>
  ["interpolate", ["exponential", 1.4], ["zoom"], 4, a, 7, b, 11, c];

/** Layers drawn above the water fill (sea glow, slab shadow, coast edge). */
export const SLAB_SEA_LAYERS: LayerSpecification[] = [
  // Outward-only glow: offset half the width so it never bleeds onto land.
  ...[[60, 0.22], [30, 0.32], [14, 0.45], [6, 0.55]].map(([w, o], i): LayerSpecification => ({
    id: `slab-glow-${i}`, type: "line", source: "isles-land",
    layout: { "line-join": "round", visibility: "none" },
    paint: {
      "line-color": SLAB_SEA_NEAR,
      "line-width": zw(w * 0.55, w, w * 1.6),
      "line-offset": zw(-w * 0.275, -w * 0.5, -w * 0.8),
      "line-blur": zw(w * 0.4, w * 0.7, w * 1.1),
      "line-opacity": o,
    },
  })),
  {
    id: "slab-shadow", type: "line", source: "isles-land",
    layout: { "line-join": "round", visibility: "none" },
    paint: {
      "line-color": "#0E3A6B",
      "line-width": zw(5, 9, 14),
      "line-offset": zw(-2.5, -4.5, -7),
      "line-blur": zw(4, 7, 11),
      "line-translate": [3, 4],
      "line-opacity": 0.38,
    },
  },
  {
    id: "slab-edge", type: "line", source: "isles-land",
    layout: { "line-join": "round", visibility: "none" },
    paint: { "line-color": "#FFFDF4", "line-width": zw(0.5, 1.0, 1.8), "line-opacity": 0.85 },
  },
];

export const SLAB_OUTSIDE: LayerSpecification = {
  id: "slab-outside", type: "fill", source: "isles-outside", layout: { visibility: "none" },
  paint: { "fill-color": SLAB_CREAM, "fill-opacity": 1, "fill-antialias": false },
};

export const SLAB_WOOD: LayerSpecification = {
  id: "slab-wood", type: "fill", source: "openmaptiles", "source-layer": "landcover", minzoom: 6,
  filter: ["==", ["get", "class"], "wood"], layout: { visibility: "none" },
  paint: { "fill-color": "#5FAE5E", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0.25, 10, 0.45] },
};

export const SLAB_LABEL_LAYERS: LayerSpecification[] = [
  {
    id: "slab-town-dots", type: "circle", source: "openmaptiles", "source-layer": "place",
    filter: ["match", ["get", "class"], ["city", "town"], true, false],
    layout: { visibility: "none" },
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
      visibility: "none",
      "text-field": ["get", "name"],
      "text-font": ["match", ["get", "kind"], "sea", ["literal", FONT_REG], ["literal", FONT_BOLD]],
      "text-size": ["interpolate", ["linear"], ["zoom"], 4.5,
        ["match", ["get", "kind"], "outside", 20, "sea", 13, 13], 8,
        ["match", ["get", "kind"], "outside", 30, "sea", 18, 19]],
      "text-letter-spacing": ["match", ["get", "kind"], "outside", 0.5, "sea", 0.3, 0.32],
      "text-max-width": 7,
      "text-allow-overlap": false,
      "text-padding": 2,
    },
    paint: {
      "text-color": ["match", ["get", "kind"], "sea", SLAB_SEA_LABEL, "outside", "#C9C2E0", SLAB_REGION],
      "text-halo-color": ["match", ["get", "kind"], "sea", "rgba(255,255,255,0.35)", "rgba(255,253,244,0.75)"],
      "text-halo-width": 1.2,
    },
  })),
];

export const SLAB_LAYER_IDS = [
  "slab-outside", "slab-wood", ...SLAB_SEA_LAYERS.map((l) => l.id), ...SLAB_LABEL_LAYERS.map((l) => l.id),
];
