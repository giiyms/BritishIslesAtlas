import {
  Map,
  Popup,
  type ExpressionSpecification,
  type Map as MapLibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import { buildCollections } from "./geo";
import { LAYERS, type LayerId, type MarkerKind } from "./layers";

export const HOME_BOUNDS: [[number, number], [number, number]] = [
  [-12.2, 49.35],
  [2.35, 61.15],
];

export const HOME_PADDING = { top: 28, bottom: 48, left: 36, right: 28 };

const HILLSHADE_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}";

const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    hillshade: {
      type: "raster",
      tiles: [HILLSHADE_TILES],
      tileSize: 256,
      maxzoom: 16,
      attribution: "Hillshade © Esri, USGS, NOAA",
    },
    openmaptiles: {
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
    },
  },
  layers: [
    {
      id: "land",
      type: "background",
      paint: { "background-color": "#f4f6f8" },
    },
    {
      id: "hillshade",
      type: "raster",
      source: "hillshade",
      paint: {
        "raster-opacity": 0.58,
        "raster-saturation": -1,
        "raster-contrast": -0.18,
        "raster-brightness-min": 0.22,
        "raster-brightness-max": 0.94,
        "raster-resampling": "linear",
      },
    },
    {
      id: "water",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "water",
      paint: {
        "fill-color": "#e5eaf0",
      },
    },
  ],
};

const RANK: Record<string, number> = {
  population: 10,
  census: 20,
  weather: 30,
  mountains: 40,
  roads: 50,
  wind: 60,
  power: 70,
  petrol: 80,
  ev: 90,
  cemeteries: 100,
  churches: 110,
  mosques: 120,
  "other-religious": 130,
  schools: 140,
  historic: 150,
  legends: 160,
  castles: 170,
  immigration: 180,
  crime: 190,
  health: 200,
  "post-offices": 210,
  pubs: 220,
  nuclear: 230,
  hospitals: 240,
};

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

function zoomRadius(scale: number): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    4,
    2.15 * scale,
    5.4,
    3.15 * scale,
    8,
    4.8 * scale,
    12,
    7.2 * scale,
  ];
}

function iconSize(scale: number): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    4,
    0.4 * scale,
    5.4,
    0.54 * scale,
    8,
    0.74 * scale,
    12,
    1 * scale,
  ];
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
}

export function createAtlas(container: HTMLElement): Atlas {
  const state = Object.fromEntries(LAYERS.map((layer) => [layer.id, layer.defaultOn])) as Record<
    LayerId,
    boolean
  >;
  const collections = buildCollections();

  const map = new Map({
    container,
    style: STYLE,
    bounds: HOME_BOUNDS,
    fitBoundsOptions: { padding: HOME_PADDING },
    maxBounds: [
      [-18, 45],
      [10, 64.5],
    ],
    minZoom: 3.6,
    maxZoom: 16,
    attributionControl: {},
    renderWorldCopies: false,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    fadeDuration: 0,
    canvasContextAttributes: {
      antialias: true,
      preserveDrawingBuffer: true,
      failIfMajorPerformanceCaveat: false,
    },
  });

  const apply = (id: LayerId) => {
    const visibility = state[id] ? "visible" : "none";
    const ids = id === "roads" ? ["roads", "roads-hit"] : [id];
    for (const layerId of ids) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", visibility);
    }
  };

  const openPopup = (lngLat: { lng: number; lat: number }, properties: Record<string, unknown>) => {
    const name = String(properties.name ?? "Preview");
    const note = String(properties.note ?? "Preview stub");
    const layerId = String(properties.layer ?? "");
    const layer = LAYERS.find((item) => item.id === layerId);
    new Popup({ closeButton: true, maxWidth: "260px", className: "atlas-popup", offset: 10 })
      .setLngLat(lngLat)
      .setHTML(
        `<strong>${escapeHtml(name)}</strong><div class="popup-meta">${escapeHtml(layer?.label ?? "Layer")}</div><div class="popup-note">${escapeHtml(note)}</div>`,
      )
      .addTo(map);
  };

  map.on("load", () => {
    const ordered = [...LAYERS].sort((a, b) => (RANK[a.id] ?? 0) - (RANK[b.id] ?? 0));
    for (const layer of ordered) {
      map.addSource(layer.id, { type: "geojson", data: collections[layer.id] });
      const visible = state[layer.id] ? "visible" : "none";

      if (layer.kind === "line") {
        map.addLayer({
          id: layer.id,
          type: "line",
          source: layer.id,
          layout: {
            visibility: visible,
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": layer.color,
            "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.15, 5.4, 1.7, 8, 2.6, 12, 4.2],
            "line-opacity": 0.92,
          },
        });
        map.addLayer({
          id: "roads-hit",
          type: "line",
          source: layer.id,
          layout: { visibility: visible, "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#000000",
            "line-width": 14,
            "line-opacity": 0.01,
          },
        });
      } else if (layer.kind === "dot") {
        map.addLayer({
          id: layer.id,
          type: "circle",
          source: layer.id,
          layout: { visibility: visible },
          paint: {
            "circle-radius": zoomRadius(layer.pointScale),
            "circle-color": layer.color,
            "circle-opacity": 0.95,
            "circle-stroke-width": 0.8,
            "circle-stroke-color": "rgba(255,255,255,0.92)",
          },
        });
      } else if (layer.kind === "ring") {
        map.addLayer({
          id: layer.id,
          type: "circle",
          source: layer.id,
          layout: { visibility: visible },
          paint: {
            "circle-radius": zoomRadius(layer.pointScale * 1.15),
            "circle-color": "rgba(255,255,255,0.2)",
            "circle-stroke-width": 1.8,
            "circle-stroke-color": layer.color,
          },
        });
      } else if (layer.kind === "disc") {
        map.addLayer({
          id: layer.id,
          type: "circle",
          source: layer.id,
          layout: { visibility: visible },
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              4,
              ["*", ["get", "r"], 0.62],
              5.6,
              ["get", "r"],
              8,
              ["*", ["get", "r"], 1.7],
            ],
            "circle-color": layer.color,
            "circle-opacity": 0.28,
            "circle-stroke-width": 1,
            "circle-stroke-color": layer.accent,
            "circle-stroke-opacity": 0.7,
          },
        });
      } else if (SYMBOL_KINDS.has(layer.kind)) {
        map.addImage(`${layer.id}-mark`, markerImage(layer.kind, layer.color), { pixelRatio: 2 });
        map.addLayer({
          id: layer.id,
          type: "symbol",
          source: layer.id,
          layout: {
            visibility: visible,
            "icon-image": `${layer.id}-mark`,
            "icon-size": iconSize(layer.pointScale),
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          },
        });
      }

      const hitId = layer.id === "roads" ? "roads-hit" : layer.id;
      map.on("click", hitId, (event) => {
        const feature = event.features?.[0];
        if (!feature?.properties) return;
        openPopup(event.lngLat, feature.properties as Record<string, unknown>);
      });
      map.on("mouseenter", hitId, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", hitId, () => {
        map.getCanvas().style.cursor = "";
      });
    }

    map.once("idle", () => {
      document.body.dataset.mapReady = "true";
    });
  });

  return {
    map,
    isOn: (id) => state[id],
    setLayer: (id, on) => {
      state[id] = on;
      apply(id);
    },
    zoomIn: () => {
      map.zoomIn({ duration: motionDuration(280) });
    },
    zoomOut: () => {
      map.zoomOut({ duration: motionDuration(280) });
    },
    home: () => {
      map.fitBounds(HOME_BOUNDS, { padding: HOME_PADDING, duration: motionDuration(700) });
    },
    show: ({ lon, lat, zoom = 11, bounds }) => {
      if (bounds) {
        map.fitBounds(bounds, {
          padding: { top: 80, bottom: 80, left: 360, right: 80 },
          duration: motionDuration(800),
          maxZoom: zoom,
        });
        return;
      }
      map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), zoom), duration: motionDuration(800) });
    },
  };
}
