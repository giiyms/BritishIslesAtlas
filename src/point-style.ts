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
/** Every point layer shares one fill opacity: 80% at street zoom, so a neighbour underneath still reads. */
export const POINT_MAX_OPACITY = 0.8;
/** Point opacity: faint but present at national zoom (the heat carries it), 80% from city zoom. */
export const POINT_OPACITY_STOPS: [number, number][] = [[3, 0.22], [CROSSFADE.start, 0.3], [8, 0.6], [CROSSFADE.end, POINT_MAX_OPACITY]];
/**
 * One radius ramp for every point layer (t254u): small, the same for pubs and churches alike,
 * growing smoothly from ~2.5px at national zoom to ~5.5px at street zoom.
 */
export const POINT_RADIUS_STOPS: [number, number][] = [[3, 1.5], [6, 2.5], [10, 3.5], [14, 4.75], [16, 5.5], [18, 6.25]];
/** Logical span of the generic marker shapes inside their 32px canvas (see markerImage). */
const MARKER_SPAN = 22;
/** Logical diameter of the white chip-icon disc inside its 22px image (see discIconSvg). */
const ICON_DISC_SPAN = 21;
/** Same footprint as a dot: diameter plus the white keyline. */
const footprint = (r: number) => 2 * r + 1;

export const pointOpacity = (): ExpressionSpecification => zoomRamp(POINT_OPACITY_STOPS);
export const pointRadius = (): ExpressionSpecification => zoomRamp(POINT_RADIUS_STOPS);
/** Thin white keyline so overlapping dots stay separable. */
export const pointStroke = (): ExpressionSpecification => zoomRamp([[5, 0.4], [10, 0.8], [16, 1]]);
/** Diamonds, squares, triangles and crosses drawn at the same footprint as a dot. */
export const markerScale = (): ExpressionSpecification =>
  zoomRamp(POINT_RADIUS_STOPS.map(([z, r]) => [z, footprint(r) / MARKER_SPAN]));
/** Chip icons: same footprint again, so switching to icons never changes the size. */
export const iconDiscScale = (): ExpressionSpecification =>
  zoomRamp(POINT_RADIUS_STOPS.map(([z, r]) => [z, footprint(r) / ICON_DISC_SPAN]));
/** Chip icons fade in only once dots are big enough to carry a glyph; the dots stay under them. */
export const ICON_FADE: [number, number][] = [[14.5, 0], [15.5, POINT_MAX_OPACITY]];

/**
 * Draw order between point layers: densest at the bottom, rarest on top, ties by id.
 * A pub (40k+) next to a church never hides it, and a lighthouse sits on both.
 * Deterministic: depends only on the feature counts, never on toggle order.
 */
export function pointDrawOrder(ids: readonly string[]): string[] {
  const count = (id: string) => POINT_COUNTS[id] ?? 300;
  return [...ids].sort((a, b) => count(b) - count(a) || a.localeCompare(b));
}

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
