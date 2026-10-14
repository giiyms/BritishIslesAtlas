import type { LayerId } from "./layers";

/** Point layers that get density styles (the two ~40k-point layers). Others render as plain points.
 * Kept to two to cap committed artifact size; add more by listing them here and in build_density_styles.py. */
export const DENSE_LAYERS: readonly LayerId[] = ["places-of-worship", "pubs"];
export const DENSITY_STYLES = ["auto", "heatmap", "hex", "columns", "constituency", "points", "contours", "spikes"] as const;
export type DensityStyle = typeof DENSITY_STYLES[number];
export function parseDensityStyle(search: string): DensityStyle {
  const value = new URLSearchParams(search).get("density");
  return DENSITY_STYLES.find(style => style === value) ?? "auto";
}
export function serializeDensityStyle(url: string, style: DensityStyle): string {
  const next = new URL(url);
  if (style === "auto") next.searchParams.delete("density");
  else next.searchParams.set("density", style);
  return next.toString();
}
export function styleLayerIds(id: LayerId, style: DensityStyle): string[] {
  const levels = ["coarse", "medium", "fine"];
  switch (style) {
    case "points": return [id];
    case "heatmap": return [`density-heatmap-${id}`, id];
    case "auto": return [...styleLayerIds(id, "hex"), id];
    case "hex": return levels.map(level => `density-hex-${id}-${level}`);
    case "columns": return [...levels.flatMap(level => [`density-fill-${id}-${level}`, `density-outline-${id}-${level}`]), id];
    case "constituency": return [`density-constituency-${id}`];
    case "contours": return ["national", "regional", "local"].flatMap(level => [`density-contours-${id}-${level}`, `density-contours-outline-${id}-${level}`]);
    case "spikes": return ["national", "regional", "local"].map(level => `density-spikes-${id}-${level}`);
  }
}
export function densityNeedsPoints(style: DensityStyle, zoom: number): boolean {
  return style === "points" || style === "heatmap" || (style === "auto" && zoom >= 8) || (style === "columns" && zoom >= 11);
}
