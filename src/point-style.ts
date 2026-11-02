import type { ExpressionSpecification } from "maplibre-gl";
import { POINT_COUNTS } from "./point-counts";

/**
 * Point layers draw every feature at every zoom: one flat GeoJSON source, no clustering,
 * no minzoom, no collision culling. Zoom only changes size and opacity, continuously.
 * A heatmap of the same source carries the national view and crossfades out as the
 * points crossfade in, both drawn across a wide zoom window so nothing pops.
 */
export const CROSSFADE = { start: 5, end: 12 } as const;
/** The heatmap is fully gone by this zoom, so it stops being drawn at all after it. */
export const HEAT_MAXZOOM = CROSSFADE.end + 0.5;

const zoomRamp = (stops: [number, number][]): ExpressionSpecification =>
  ["interpolate", ["linear"], ["zoom"], ...stops.flat()] as ExpressionSpecification;

/** Heat opacity: full at national zoom, linear to zero at street zoom. */
export const HEAT_OPACITY_STOPS: [number, number][] = [[CROSSFADE.start, 0.85], [8, 0.6], [CROSSFADE.end, 0]];
/** Point opacity: faint but present at national zoom, solid at street zoom. */
export const POINT_OPACITY_STOPS: [number, number][] = [[3, 0.22], [CROSSFADE.start, 0.3], [8, 0.6], [CROSSFADE.end, 0.95]];

export const pointOpacity = (): ExpressionSpecification => zoomRamp(POINT_OPACITY_STOPS);
export const pointRadius = (scale: number): ExpressionSpecification =>
  zoomRamp([[3, 1 * scale], [6, 1.6 * scale], [9, 3.4 * scale], [12, 6 * scale], [15, 7.5 * scale]]);
/** White keyline only once points are big enough for it to read. */
export const pointStroke = (): ExpressionSpecification => zoomRamp([[7, 0], [10, 0.8]]);
export const iconScale = (scale: number): ExpressionSpecification =>
  zoomRamp([[3, 0.2 * scale], [6, 0.3 * scale], [9, 0.5 * scale], [12, 0.85 * scale], [15, 1 * scale]]);
/** Chip icons sit on top of the points and fade in; the points stay under them. */
export const ICON_FADE: [number, number][] = [[11, 0], [12.5, 1]];

/** Constant per-layer weight: dense layers weigh less so every layer uses the whole ramp. */
export function heatWeight(id: string): number {
  const count = POINT_COUNTS[id] ?? 300;
  return Math.min(1, Math.max(0.06, 26 / Math.sqrt(count)));
}

function rgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Fixed ramp in the layer's own colour (stable across zoom, distinct per layer); no labels. */
export function heatmapPaint(id: string, color: string, accent: string) {
  return {
    "heatmap-weight": heatWeight(id),
    "heatmap-intensity": zoomRamp([[3, 0.6], [6, 1], [9, 1.8], [12, 2.6]]),
    "heatmap-radius": zoomRamp([[3, 6], [6, 12], [9, 20], [12, 28]]),
    "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"],
      0, rgba(color, 0), 0.15, rgba(color, 0.18), 0.4, rgba(color, 0.42), 0.7, rgba(color, 0.68), 1, rgba(accent, 0.85)] as ExpressionSpecification,
    "heatmap-opacity": zoomRamp(HEAT_OPACITY_STOPS),
  };
}
