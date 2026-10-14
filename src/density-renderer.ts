import { Popup, type ExpressionSpecification, type Map as MapLibreMap, type GeoJSONSourceSpecification } from "maplibre-gl";
import type { LayerId } from "./layers";
import { LAYERS } from "./layers";
import { applyDensity, syncDensityBands, syncDensityPitch, densityCameraForViewport, densityLayerIds, heightExpression, type DensityManifest } from "./density";
import { DENSE_LAYERS, densityNeedsPoints, styleLayerIds, type DensityStyle } from "./density-styles";

const RAMP = ["#fbf3cf", "#f9d77e", "#f4a24c", "#e0452b", "#a50f15"];
const interpolate = (input: ExpressionSpecification, stops: number[]): ExpressionSpecification => [
  "interpolate", ["linear"], input, ...stops.flatMap((n, i) => [n, RAMP[i]]),
] as ExpressionSpecification;
const fadeDots: ExpressionSpecification = ["interpolate", ["linear"], ["zoom"], 8.5, 0, 10, .6, 14, .8];

/** Owns density sources, visibility and one legend. All IO is gated by current layer/style. */
export function createDensityRenderer(map: MapLibreMap, host: HTMLElement, onError: (message: string) => void) {
  const cache = new globalThis.Map<string, Promise<unknown>>();
  const pointsLoaded = new Set<LayerId>();
  let currentStyle: DensityStyle = "auto";
  let enabled: LayerId[] = [];
  let cameraLayer: LayerId | null = null;
  let lastLegendKey = "";
  let lastMountKey = "";
  const legend = document.createElement("div");
  legend.className = "density-legend";
  legend.hidden = true;
  legend.setAttribute("aria-live", "polite");
  host.append(legend);
  const popup = new Popup({ closeButton: true, maxWidth: "240px" });
  async function fetchData<T>(url: string): Promise<T> {
    let pending = cache.get(url);
    if (!pending) {
      pending = fetch(url).then(res => {
        if (!res.ok) throw new Error(`Density data unavailable (${res.status})`);
        return res.json();
      }).catch(error => { cache.delete(url); throw error; });
      cache.set(url, pending);
    }
    return pending as Promise<T>;
  }
  const isCurrent = (id: LayerId, style: DensityStyle) => enabled.includes(id) && style === currentStyle;
  const setVis = (layer: string, vis: "visible" | "none") => {
    // Only touch changed layers: each real change makes MapLibre reload the source.
    if (map.getLayer(layer) && (map.getLayoutProperty(layer, "visibility") ?? "visible") !== vis) map.setLayoutProperty(layer, "visibility", vis);
  };
  const allIds = (id: LayerId) => new Set([...styleLayerIds(id, "columns"), ...densityLayerIds(id), ...["auto", "heatmap", "hex", "constituency", "contours", "spikes"].flatMap(s => styleLayerIds(id, s as DensityStyle))]);
  function hide(id: LayerId) {
    for (const layer of allIds(id)) setVis(layer, "none");
  }
  function show(id: LayerId, style: DensityStyle) {
    if (!isCurrent(id, style)) return;
    const visible = new Set<string>();
    for (const layer of styleLayerIds(id, style)) {
      // Transparent fills still participate in hit testing; Auto is dots only at z10.
      if (style === "auto" && map.getZoom() >= 10 && layer !== id) continue;
      visible.add(layer);
    }
    if (style === "columns") for (const layer of densityLayerIds(id)) visible.add(layer);
    for (const layer of allIds(id)) if (!visible.has(layer)) setVis(layer, "none");
    for (const layer of visible) setVis(layer, "visible");
  }
  async function source(id: LayerId, style: DensityStyle, sourceId: string, url: string): Promise<boolean> {
    if (!map.getSource(sourceId)) {
      const data = await fetchData<GeoJSONSourceSpecification["data"]>(url);
      if (!isCurrent(id, style)) return false;
      if (!map.getSource(sourceId)) map.addSource(sourceId, { type: "geojson", data });
    }
    return isCurrent(id, style);
  }
  function dots(id: LayerId, style: DensityStyle) {
    if (!map.getLayer(id)) return;
    map.setLayerZoomRange(id, 0, 24);
    map.setPaintProperty(id, "circle-radius", ["interpolate", ["linear"], ["zoom"], 3, .9, 8, 1.35, 10, 1.8, 15, 3.5]);
    map.setPaintProperty(id, "circle-stroke-width", 0);
    map.setPaintProperty(id, "circle-opacity", style === "points" ? ["interpolate", ["linear"], ["zoom"], 3, .35, 9, .55, 14, .75] : style === "heatmap" ? ["interpolate", ["linear"], ["zoom"], 11, 0, 14, .8] : style === "columns" ? ["interpolate", ["linear"], ["zoom"], 11, 0, 12, .65] : fadeDots);
    if (densityNeedsPoints(style, map.getZoom()) && !pointsLoaded.has(id)) {
      pointsLoaded.add(id);
      const src = map.getSource(id) as import("maplibre-gl").GeoJSONSource;
      src.setData(`/data/${id}.geojson`);
    }
  }
  async function mount(id: LayerId, style: DensityStyle) {
    dots(id, style);
    if (style === "points") { show(id, style); return; }
    if (style === "heatmap") {
      const layerId = styleLayerIds(id, style)[0];
      if (!map.getLayer(layerId)) map.addLayer({
        id: layerId, type: "heatmap", source: id, maxzoom: 14,
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["zoom"], 3, .012, 5, .025, 8, .1, 11, .4, 14, 1],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 3, 10, 5, 14, 8, 22, 11, 28, 14, 32],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 3, .55, 5, .65, 8, .9, 11, 1.1, 14, 1.2],
          "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 11, .8, 14, 0],
          "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(251,243,207,0)", .15, RAMP[0], .35, RAMP[1], .55, RAMP[2], .75, RAMP[3], 1, RAMP[4]],
        },
      }, id);
      show(id, style); return;
    }
    if (style === "columns") {
      await applyDensity(map, id, true, id, () => isCurrent(id, style));
      show(id, style); return;
    }
    if (style === "auto" || style === "hex") {
      const man = await fetchData<DensityManifest>(`/data/density/${id}-manifest.json`);
      if (!isCurrent(id, style)) return;
      const zoom = map.getZoom();
      // Overlapping zoom windows let each level crossfade into the next.
      const ranges = man.bands.map((band, i) => [
        Math.max(0, band.minzoom - .5),
        i === man.bands.length - 1 ? 23 : band.maxzoom - .5,
        i === man.bands.length - 1 ? 24 : band.maxzoom + .5,
      ]);
      await Promise.all(man.bands.map(async (band, i) => {
        const [lo, hi, end] = ranges[i];
        if (zoom < lo-.75 || zoom > end+.75 || (style === "auto" && zoom >= 10.5)) return;
        const src = `density-src-${id}-${band.id}`;
        if (!await source(id, style, src, band.url)) return;
        const layerId = `density-hex-${id}-${band.id}`;
        if (!map.getLayer(layerId)) {
          let stops = band.colour_stops ?? [1, 2, 3, 5, 10];
          stops = stops.map((n,i) => Math.max(n, 1+i*.05));
          const opacity: ExpressionSpecification = i === 0
            ? ["interpolate", ["linear"], ["zoom"], hi, .8, end, 0]
            : ["interpolate", ["linear"], ["zoom"], lo, 0, lo+1, .8, hi, .8, end, 0];
          map.addLayer({ id: layerId, type: "fill", source: src, minzoom: lo, maxzoom: end,
            paint: { "fill-color": interpolate(["sqrt", ["get", "count"]], stops), "fill-opacity": opacity },
          }, id);
          map.on("click", layerId, event => {
            if (!enabled.includes(id) || !["auto", "hex"].includes(currentStyle) || (currentStyle === "auto" && map.getZoom() >= 10)) return;
            popup.setLngLat(event.lngLat).setText(`${LAYERS.find(l => l.id === id)?.label}: ${Number(event.features?.[0]?.properties?.count ?? 0).toLocaleString()} points in this hex`).addTo(map);
          });
        }
        // Auto ends at z10; explicit hex remains available at all zooms.
        map.setPaintProperty(layerId, "fill-opacity", style === "auto" && i === 2
          ? ["interpolate", ["linear"], ["zoom"], lo, 0, lo+.5, .8, 10, 0]
          : i === 0 ? ["interpolate", ["linear"], ["zoom"], hi, .8, end, 0]
          : ["interpolate", ["linear"], ["zoom"], lo, 0, lo+1, .8, hi, .8, end, 0]);
      }));
    } else if (style === "constituency") {
      const values = await fetchData<Record<string, { count: number; per_km2: number }>>(`/data/density/${id}-constituency.json`);
      const src = "density-constituencies";
      if (!await source(id, style, src, "/data/constituencies-gb-2024.geojson")) return;
      const value: ExpressionSpecification = ["match", ["get", "PCON24CD"], ...Object.entries(values).flatMap(([code, val]) => [code, val.per_km2]), 0] as unknown as ExpressionSpecification;
      const layerId = styleLayerIds(id, style)[0];
      if (!map.getLayer(layerId)) map.addLayer({ id: layerId, type: "fill", source: src,
        paint: { "fill-color": interpolate(value, [0, .05, .2, .6, 2]), "fill-opacity": .72, "fill-outline-color": "#866c51" },
      }, id);
    } else {
      const man = style === "spikes" ? await fetchData<DensityManifest>(`/data/density/${id}-manifest.json`) : null;
      if (!isCurrent(id, style)) return;
      await Promise.all(["national", "regional", "local"].map(async (band, i) => {
        const zoom = map.getZoom();
        const range = [{ minzoom: 0, maxzoom: 7 }, { minzoom: 7, maxzoom: 9 }, { minzoom: 9, maxzoom: 24 }][i];
        if (zoom < range.minzoom - .75 || zoom >= range.maxzoom + .75) return;
        const src = `density-${style}-src-${id}-${band}`;
        if (!await source(id, style, src, `/data/density/${id}-${style}-${band}.geojson`)) return;
        const layerId = `density-${style}-${id}-${band}`;
        if (!map.getLayer(layerId)) {
          if (style === "spikes") map.addLayer({ id: layerId, type: "fill-extrusion", source: src, ...range,
            paint: { "fill-extrusion-color": interpolate(["sqrt", ["get", "count"]], man!.bands[i].colour_stops ?? [1, 2, 4, 8, 16]),
              "fill-extrusion-height": heightExpression({ ...man!.bands[i], ...range }, i === 0 ? 3 : 2), "fill-extrusion-opacity": .95 },
          }, id);
          else {
            map.addLayer({ id: layerId, type: "fill", source: src, ...range,
              paint: { "fill-color": interpolate(["get", "intensity"], [0, .25, .5, .75, 1]), "fill-opacity": .65 },
            }, id);
            map.addLayer({ id: `density-contours-outline-${id}-${band}`, type: "line", source: src, ...range,
              paint: { "line-color": "#8a5a2b", "line-width": .6, "line-opacity": .4 },
            }, id);
          }
        }
      }));
    }
    show(id, style);
  }
  const units = (style: DensityStyle) => style === "constituency" ? "per km² (per-capita coming later) · GB only" : style === "points" ? "Every point" : style === "heatmap" ? "Relative point density" : style === "contours" ? "Smoothed points per grid cell" : "Points per hex";
  function update(style: DensityStyle, layers: LayerId[]) {
    if (style !== currentStyle || layers.join() !== enabled.join()) popup.remove();
    currentStyle = style;
    enabled = layers;
    for (const id of DENSE_LAYERS) if (!layers.includes(id)) hide(id);
    const zoom = map.getZoom();
    const showingPoints = style === "points" || ((style === "auto" && zoom >= 10) || (style === "heatmap" && zoom >= 14)) || (style === "columns" && zoom >= 12);
    const legendKey = `${style}|${layers.join()}|${showingPoints}`;
    if (legendKey !== lastLegendKey) {
    lastLegendKey = legendKey;
    legend.hidden = layers.length === 0;
    legend.replaceChildren();
    if (layers.length) {
      const title = document.createElement("div");
      title.className = "density-legend-title";
      title.textContent = `${layers.map(id => LAYERS.find(l => l.id === id)?.label).join(" / ")} · ${style}`;
      const ramp = document.createElement("div");
      ramp.className = "density-legend-ramp";
      ramp.style.background = showingPoints ? LAYERS.find(l => l.id === layers[0])!.color : `linear-gradient(90deg,${RAMP.join(",")})`;
      const label = document.createElement("div");
      label.textContent = (showingPoints ? "Every point" : units(style)) + (showingPoints ? "" : style === "constituency" ? " · 0 → 2+" : " · Low → High");
      legend.append(title, ramp, label);
    }
    }
    const nextCameraLayer = (style === "columns" && map.getZoom() < 12) || style === "spikes" ? layers[0] ?? null : null;
    const camera = densityCameraForViewport(null);
    const pitchDrift = Math.abs(map.getPitch() - (nextCameraLayer ? camera.pitch! : 0)) > 1;
    if (cameraLayer !== nextCameraLayer || (pitchDrift && !map.isMoving())) {
      cameraLayer = nextCameraLayer;
      syncDensityPitch(map, cameraLayer, camera);
    }
    // Re-mount only when style/layers change or a half-zoom step is crossed.
    const mountKey = `${style}|${layers.join()}|${Math.floor(zoom * 2)}`;
    const remount = mountKey !== lastMountKey;
    lastMountKey = mountKey;
    for (const id of layers) {
      show(id, style);
      if (!remount) continue;
      if (style === "columns") syncDensityBands(map, id, true);
      void mount(id, style).catch(error => { if (isCurrent(id, style)) onError(String(error)); });
    }
  }
  return { update };
}
