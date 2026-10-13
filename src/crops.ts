/**
 * CROME 2024 crop map metadata and the small, baked vector contract used by
 * the optional crop-area detail UI.
 *
 * The WMS is the always-available visual layer.  The vector PMTiles are a
 * separate build artifact because the source contains roughly 32 million
 * hexagons and is deliberately not checked into this repository.
 */

export const CROME_DATASET_PAGE =
  "https://environment.data.gov.uk/dataset/0903079b-35a2-47de-b805-77a0cc0c57bf";
export const CROME_WMS_URL = "https://environment.data.gov.uk/spatialdata/crop-map-of-england-2024/wms";
export const CROME_WMS_LAYER = "Crop_Map_of_England_2024";
export const CROME_WMS_VERSION = "1.3.0";
export const CROME_VECTOR_PATH = "/tiles/crome.pmtiles";
export const CROME_VECTOR_SOURCE = "crome";
export const CROME_VECTOR_LAYER = "crome";
export const CROME_ATTRIBUTION = "Contains data © Rural Payments Agency copyright and/or database right 2024";

/** Theme-spec colours.  Keep this palette stable across WMS/vector rendering. */
export const CROP_PALETTE = {
  greens: "#7CD97C",
  brassica: "#5BBDF4",
  berries: "#FF6E91",
  grain: "#FFD369",
  flowers: "#C8A6FF",
  nuts: "#FF6EA7",
} as const;

export type CropPaletteKey = keyof typeof CROP_PALETTE;

export interface CropRanking {
  code: string;
  label: string;
  palette: CropPaletteKey;
  color: string;
  areaHa: number;
  areaAcres: number;
  percent: number;
}

export interface CropFeatureLike {
  id?: string | number;
  properties?: Record<string, unknown> | null;
}

export interface CropPanelDetail {
  /** True only after the optional baked PMTiles artifact passes its magic-byte probe. */
  available: boolean;
  /** True when the map is in England and crop-area details may be shown. */
  england: boolean;
  ranking: CropRanking[];
}

const ACRES_PER_HECTARE = 2.4710538147;
const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"] as const;

/** Approximate category windows are visual context, not field-survey dates. */
const HARVEST_MONTHS: Record<CropPaletteKey, readonly number[]> = {
  greens: [4, 5, 6, 7, 8, 9],
  brassica: [6, 7, 8, 9, 10, 11],
  berries: [5, 6, 7, 8],
  grain: [6, 7, 8, 9],
  flowers: [5, 6, 7, 8, 9],
  nuts: [8, 9, 10],
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function number(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** Escape untrusted crop names before they enter popup/panel markup. */
export function escapeCropHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

/** Broad display group used by the Snapchat theme palette. */
export function cropPaletteKey(codeOrName: string): CropPaletteKey {
  const value = codeOrName.toLowerCase();
  if (/(strawber|raspber|blackber|gooseber|berry)/.test(value)) return "berries";
  if (/(daffodil|borage|chamomile|phacelia|poppy|sunflower|gladiol|sweet william|flower)/.test(value)) return "flowers";
  if (/(tree|orchard|perennial|nut|nursery|woody|hedgerow)/.test(value)) return "nuts";
  if (/(cabbage|turnip|mustard|oilseed|radish|beet|brassica)/.test(value)) return "brassica";
  if (/(barley|wheat|oat|rye|triticale|linseed|maize|millet|sorghum|cereal|spelt)/.test(value)) return "grain";
  if (/(grass|clover|lucerne|sainfoin|pea|bean|chickpea|fenugreek|lupin|soya|cowpea|lettuce|spinach|celery|carrot|parsley|parsnip|leek|hemp|fallow|vegetable|crop)/.test(value)) return "greens";
  // CROME's code prefixes are useful when a lookup label is unavailable.
  if (/^lg/i.test(codeOrName)) return "greens";
  if (/^ac/i.test(codeOrName)) return "grain";
  if (/^(fa|he|pg|tg)/i.test(codeOrName)) return "greens";
  if (/^(na|wa)/i.test(codeOrName)) return "greens";
  return "greens";
}

export function cropColor(codeOrName: string): string {
  return CROP_PALETTE[cropPaletteKey(codeOrName)];
}

export function cropLabel(properties: Record<string, unknown> | null | undefined): string {
  const p = properties ?? {};
  return text(p.crop_name) || text(p.crop) || text(p.land_use) || text(p.lucode) || "Unknown crop";
}

export function cropCode(properties: Record<string, unknown> | null | undefined): string {
  const p = properties ?? {};
  return text(p.crop_code) || text(p.lucode) || "unknown";
}

export function cropAreaHa(properties: Record<string, unknown> | null | undefined): number {
  const p = properties ?? {};
  return Math.max(0, number(p.area_ha ?? p.areaHa ?? p.shape_area));
}

export function cropFeatureKey(feature: CropFeatureLike): string {
  const p = feature.properties ?? {};
  const stable = text(p.feature_id) || text(p.cromeid) || text(p.field_id);
  if (stable) return stable;
  if (feature.id !== undefined && feature.id !== null) return String(feature.id);
  // The pipeline emits one feature per county/crop when source IDs are not
  // available. This fallback prevents adjacent tile copies being counted twice.
  return [text(p.county), cropCode(p), String(cropAreaHa(p))].join(":");
}

/**
 * Rank unique dissolved vector features in the current viewport.  A tile can
 * expose the same feature more than once at a boundary, hence the key-based
 * de-duplication before percentages are computed.
 */
export function rankCropFeatures(features: readonly CropFeatureLike[], limit = 8): CropRanking[] {
  const seen = new Set<string>();
  const byCode = new Map<string, { label: string; areaHa: number }>();
  for (const feature of features) {
    const key = cropFeatureKey(feature);
    if (seen.has(key)) continue;
    seen.add(key);
    const properties = feature.properties ?? {};
    const code = cropCode(properties);
    const label = cropLabel(properties);
    const row = byCode.get(code) ?? { label, areaHa: 0 };
    row.areaHa += cropAreaHa(properties);
    if (row.label === "Unknown crop" && label !== "Unknown crop") row.label = label;
    byCode.set(code, row);
  }
  const total = [...byCode.values()].reduce((sum, row) => sum + row.areaHa, 0);
  if (total <= 0) return [];
  return [...byCode.entries()]
    .map(([code, row]) => {
      const palette = cropPaletteKey(`${code} ${row.label}`);
      return {
        code,
        label: row.label,
        palette,
        color: CROP_PALETTE[palette],
        areaHa: row.areaHa,
        areaAcres: row.areaHa * ACRES_PER_HECTARE,
        percent: (row.areaHa / total) * 100,
      };
    })
    .sort((a, b) => b.areaHa - a.areaHa || a.label.localeCompare(b.label))
    .slice(0, Math.max(1, limit));
}

export function formatCropAreaAcres(areaHa: number): string {
  const acres = Math.max(0, areaHa) * ACRES_PER_HECTARE;
  return acres >= 1000 ? `${(acres / 1000).toFixed(1)}k acres` : `${Math.round(acres).toLocaleString("en-GB")} acres`;
}

function calendarHtml(palette: CropPaletteKey): string {
  const active = new Set(HARVEST_MONTHS[palette]);
  return `<div class="crop-calendar" aria-label="Indicative harvest window, January through December">` +
    MONTHS.map((month, i) => `<span class="crop-month${active.has(i + 1) ? " is-active" : ""}">${month}</span>`).join("") +
    `</div>`;
}

/** Crop-area popup body. MapLibre supplies the physical caret. */
export function cropPopupHtml(properties: Record<string, unknown> | null | undefined): string {
  const label = cropLabel(properties);
  const code = cropCode(properties);
  const palette = cropPaletteKey(`${code} ${label}`);
  const areaHa = cropAreaHa(properties);
  const probability = number((properties ?? {}).prob);
  const confidencePercent = probability > 1 ? probability : probability * 100;
  const confidence = confidencePercent > 0
    ? `<div class="popup-meta">Classification confidence ${Math.min(100, Math.round(confidencePercent))}%</div>`
    : "";
  return `<div class="crop-popup">` +
    `<strong class="popup-title">${escapeCropHtml(label)}</strong>` +
    `<div class="popup-meta">Crop area · ${escapeCropHtml(code)} · ${escapeCropHtml(formatCropAreaAcres(areaHa))}</div>` +
    confidence +
    `<div class="crop-calendar-label">Indicative harvest · J–D</div>` +
    calendarHtml(palette) +
    `<div class="popup-note">CROME 2024 · England only</div>` +
    `</div>`;
}

export function cropRankingHtml(ranking: readonly CropRanking[]): string {
  if (!ranking.length) return "";
  return `<ol class="crop-ranking" aria-label="Crop cover in view">${ranking.map((row) =>
    `<li class="crop-rank" data-crop-code="${escapeCropHtml(row.code)}" style="--crop-color:${row.color}">` +
    `<span class="crop-rank-swatch" aria-hidden="true"></span><span class="crop-rank-label">${escapeCropHtml(row.label)}</span>` +
    `<span class="crop-rank-percent">${row.percent.toFixed(1)}%</span>` +
    `</li>`).join("")}</ol>`;
}
