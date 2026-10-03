import {
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

export const HOME_BOUNDS: [[number, number], [number, number]] = [
  [-12.2, 49.35],
  [2.35, 61.15],
];

export const HOME_PADDING = { top: 28, bottom: 48, left: 36, right: 28 };

const HILLSHADE_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}";

const STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
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
        "raster-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.78, 7, 0.66, 11, 0.5, 14, 0.38],
        "raster-saturation": -1,
        "raster-contrast": 0.08,
        "raster-brightness-min": 0.16,
        "raster-brightness-max": 1,
      },
    },
    {
      id: "water",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "water",
      filter: ["!=", ["get", "class"], "swimming_pool"],
      paint: { "fill-color": "#e3e8ee" },
    },
    {
      id: "boundary-country", type: "line", source: "openmaptiles", "source-layer": "boundary",
      filter: ["all", ["==", ["get", "admin_level"], 2], ["==", ["get", "maritime"], 0]],
      paint: { "line-color": "#8e959f", "line-width": 1, "line-dasharray": [3, 2], "line-opacity": 0.75 },
    },
  ],
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
    fitBoundsOptions: { padding: HOME_PADDING },
    maxBounds: [
      [-18, 45],
      [10, 64.5],
    ],
    minZoom: 3.6,
    maxZoom: 16,
    attributionControl: { compact: false },
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

  let loaded = false;
  const ordered = [...LAYERS].sort((a, b) => a.z - b.z);
  const OSM_STATIC = new Set<LayerId>(["petrol", "ev", "power", "hospitals", "fire-stations", "police", "castles", "libraries", "universities", "museums", "railway-stations", "aerodromes", "ferry-terminals", "marinas", "zoos", "theatres", "battlefields", "cinemas", "stadiums", "theme-parks", "viewpoints", "arts-centres", "aquariums", "piers", "ruins", "golf-courses", "galleries", "marketplaces", "nature-reserves", "camp-sites", "memorials", "sports-centres", "caravan-sites", "fitness-centres", "community-centres", "playgrounds", "post-offices", "beaches", "swimming-pools", "pharmacies"]);
  const clustered = new Set<LayerId>([
    "pubs", "schools", "churches", "post-offices", "mosques", "other-religious", "petrol", "ev", "power", "hospitals", "fire-stations", "police", "castles", "libraries", "universities", "museums", "railway-stations", "aerodromes", "ferry-terminals", "marinas", "zoos", "theatres", "battlefields", "cinemas", "stadiums", "theme-parks", "viewpoints", "arts-centres", "aquariums", "piers", "ruins", "golf-courses", "galleries", "marketplaces", "nature-reserves", "camp-sites", "memorials", "sports-centres", "caravan-sites", "fitness-centres", "community-centres", "playgrounds", "beaches", "swimming-pools", "pharmacies",
    "census", "weather", "crime", "legends",
  ]);
  const minZoom = (id: LayerId) => id === "post-offices" ? 7 :
    ["pubs", "schools", "churches", "other-religious", "mosques", "petrol", "ev", "libraries", "universities", "museums", "railway-stations", "aerodromes", "ferry-terminals", "marinas", "zoos", "theatres", "battlefields", "cinemas", "stadiums", "theme-parks", "viewpoints", "arts-centres", "aquariums", "piers", "ruins", "golf-courses", "galleries", "marketplaces", "nature-reserves", "camp-sites", "memorials", "sports-centres", "caravan-sites", "fitness-centres", "community-centres", "playgrounds", "beaches", "swimming-pools", "pharmacies"].includes(id) ? 6 : 0;
  const layerIds = (id: LayerId) => id === "roads" ? [id, "roads-hit"] :
    id === "constituencies" ? [id, `${id}-outline`] :
    clustered.has(id) ? [id, `${id}-cluster`, `${id}-cluster-count`] : [id];
  const beforeFor = (z: number): string | undefined => {
    const next = ordered.find((layer) => layer.z > z && map.getLayer(layer.id));
    return next?.id;
  };
  const add = (id: LayerId) => {
    if (map.getLayer(id)) return;
    const layer = LAYERS.find((item) => item.id === id)!;
    const clusters = clustered.has(id);
    if (!map.getSource(id)) {
      const sourceData =
        id === "constituencies"
          ? "/data/constituencies-gb-2024.geojson"
          : OSM_STATIC.has(id)
            ? `/data/${id}.geojson`
            : buildCollection(id);
      const attribution =
        id === "constituencies"
          ? "Contains OS data © Crown copyright and database right 2024; Contains National Statistics data © Crown copyright and database right 2024 (OGL v3.0)"
          : OSM_STATIC.has(id)
            ? "© OpenStreetMap contributors (ODbL 1.0)"
            : undefined;
      map.addSource(id, {
        type: "geojson",
        data: sourceData,
        ...(clusters ? { cluster: true, clusterRadius: 44, clusterMaxZoom: 11, clusterMinPoints: 3,
          maxzoom: 12, buffer: 64, tolerance: 0.5 } : {}),
        ...(attribution ? { attribution } : {}),
      });
    }
    const before = beforeFor(layer.z);
    const visible = state[id] ? "visible" : "none";
    const layout = { visibility: visible } as const;
    const pointFilter: { filter?: FilterSpecification } =
      clusters ? { filter: ["!", ["has", "point_count"]] } : {};
    if (layer.kind === "fill") {
      map.addLayer({
        id,
        type: "fill",
        source: id,
        layout,
        paint: {
          "fill-color": layer.color,
          "fill-opacity": 0.16,
        },
      }, before);
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
    } else if (layer.kind === "line") {
      map.addLayer({ id, type: "line", source: id,
        layout: { ...layout, "line-cap": "round", "line-join": "round" },
        paint: { "line-color": layer.color,
          "line-width": ["interpolate", ["exponential", 1.35], ["zoom"], 4, 0.9, 8, 2.1, 12, 3.8],
          "line-opacity": 0.85 },
      }, before);
      map.addLayer({ id: "roads-hit", type: "line", source: id,
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
        "circle-radius": zoomRadius(layer.pointScale * 1.15),
        "circle-color": "rgba(255,255,255,0.2)", "circle-stroke-width": 1.8,
        "circle-stroke-color": layer.color,
      } : {
        "circle-radius": zoomRadius(layer.pointScale), "circle-color": layer.color,
        "circle-opacity": 0.95, "circle-stroke-width": 0.8,
        "circle-stroke-color": "rgba(255,255,255,0.92)",
      };
      map.addLayer({ id, type: "circle", source: id, layout, ...pointFilter,
        minzoom: minZoom(id), paint }, before);
    } else if (SYMBOL_KINDS.has(layer.kind)) {
      if (!map.hasImage(`${id}-mark`)) {
        map.addImage(`${id}-mark`, markerImage(layer.kind, layer.color), { pixelRatio: 2 });
      }
      map.addLayer({ id, type: "symbol", source: id, layout: {
        ...layout, "icon-image": `${id}-mark`, "icon-size": iconSize(layer.pointScale),
        "icon-allow-overlap": id === "hospitals",
        ...(id === "hospitals" ? { "icon-ignore-placement": true } : {}),
      }, ...pointFilter, minzoom: minZoom(id) }, before);
    }
    if (clusters) {
      map.addLayer({ id: `${id}-cluster`, type: "circle", source: id,
        filter: ["has", "point_count"], minzoom: minZoom(id), layout,
        paint: { "circle-radius": ["step", ["get", "point_count"], 11, 10, 14, 50, 18, 250, 24],
          "circle-color": layer.tint, "circle-stroke-width": 1.5, "circle-stroke-color": layer.accent },
      }, before);
      map.addLayer({ id: `${id}-cluster-count`, type: "symbol", source: id,
        filter: ["has", "point_count"], minzoom: minZoom(id),
        layout: { ...layout, "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Noto Sans Bold"], "text-size": 11 },
        paint: { "text-color": layer.accent },
      }, before);
    }
  };
  const apply = (id: LayerId) => {
    if (state[id] && loaded) add(id);
    const visibility = state[id] ? "visible" : "none";
    for (const layerId of layerIds(id)) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", visibility);
    }
  };
  const popup = new Popup({ closeButton: true, maxWidth: "260px", className: "atlas-popup", offset: 10 });
  const interactiveIds = () => ordered.flatMap((layer) => layerIds(layer.id))
    .filter((id) => id !== "roads" && !id.endsWith("-cluster-count") && !!map.getLayer(id));
  const topFeature = (point: { x: number; y: number }): MapGeoJSONFeature | undefined => {
    const bounds: [[number, number], [number, number]] = [
      [point.x - 5, point.y - 5], [point.x + 5, point.y + 5],
    ];
    return map.queryRenderedFeatures(bounds, { layers: interactiveIds() })[0];
  };
  map.on("click", async (event) => {
    const feature = topFeature(event.point);
    if (!feature) return;
    if (feature.layer.id.endsWith("-cluster")) {
      const source = map.getSource(feature.layer.source) as import("maplibre-gl").GeoJSONSource;
      const clusterId = Number(feature.properties?.cluster_id);
      if (Number.isFinite(clusterId)) {
        const zoom = await source.getClusterExpansionZoom(clusterId);
        const center = feature.geometry.type === "Point" ? feature.geometry.coordinates as [number, number] : event.lngLat;
        map.easeTo({ center, zoom, duration: motionDuration(450) });
      }
      return;
    }
    const properties = feature.properties as Record<string, unknown>;
    const layerId = String(properties.layer ?? feature.source ?? "");
    const layer = LAYERS.find((item) => item.id === layerId);
    const name = String(properties.name ?? layer?.label ?? "Place");
    if (layerId === "constituencies") {
      const code = String(properties.PCON24CD ?? "");
      popup.setLngLat(event.lngLat).setHTML(
        `<strong>${escapeHtml(name)}</strong>` +
        (code ? `<div class="popup-meta">${escapeHtml(code)}</div>` : ""),
      ).addTo(map);
      return;
    }
    const brand = properties.brand ? String(properties.brand) : "";
    const note = properties.note != null && String(properties.note).length
      ? String(properties.note)
      : OSM_STATIC.has(layerId as LayerId)
        ? "OpenStreetMap"
        : "Preview stub";
    const osmUrl = properties.osm_url ? String(properties.osm_url) : "";
    const metaBits = [layer?.label ?? "Layer", brand && brand !== name ? brand : ""].filter(Boolean);
    popup.setLngLat(event.lngLat).setHTML(
      `<strong>${escapeHtml(name)}</strong>` +
      `<div class="popup-meta">${escapeHtml(metaBits.join(" · "))}</div>` +
      `<div class="popup-note">${escapeHtml(note)}</div>` +
      (osmUrl
        ? `<div class="popup-note"><a href="${escapeHtml(osmUrl)}" target="_blank" rel="noopener noreferrer">OpenStreetMap</a></div>`
        : ""),
    ).addTo(map);
  });
  map.on("mousemove", (event) => {
    map.getCanvas().style.cursor = topFeature(event.point) ? "pointer" : "";
  });
  map.on("load", () => {
    loaded = true;
    add("population");
    map.addLayer({ id: "density-glow", type: "heatmap", source: "population",
      paint: {
        "heatmap-weight": ["interpolate", ["linear"], ["get", "pop"], 0, 0, 100000, 0.3, 1000000, 0.8, 9000000, 1],
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 4, 0.7, 9, 1.3],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 4, 18, 9, 36],
        "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"],
          0, "rgba(255,184,77,0)", 0.25, "rgba(255,190,94,0.18)",
          0.65, "rgba(236,142,42,0.4)", 1, "rgba(220,113,31,0.52)"],
        "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 7, 0.65, 10, 0],
      },
    }, "population");
    for (const layer of ordered) if (state[layer.id]) add(layer.id);
    map.once("idle", () => { document.body.dataset.mapReady = "true"; });
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
          padding: searchPadding(container),
          duration: motionDuration(800),
          maxZoom: zoom,
        });
        return;
      }
      map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), zoom), duration: motionDuration(800) });
    },
  };
}
