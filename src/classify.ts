import type { ExpressionSpecification } from "maplibre-gl";

/**
 * One classified scale. The same object builds the MapLibre `step` expression and
 * the legend, so the map and its key can never disagree.
 */
export interface Classes {
  /** Ascending thresholds; `colors.length === breaks.length + 1`. */
  breaks: number[];
  colors: readonly string[];
  /** Legend heading, e.g. "Pharmacies per seat". */
  unit: string;
  /** Short provenance line under the legend. */
  source: string;
  /** Integer counts label as "4–7"; continuous values as "5–10". */
  integer: boolean;
  /** Smallest possible value, for the first integer label (counts start at 0 or 1). */
  min?: number;
}

/** Up to n−1 distinct quantile thresholds above the minimum. */
export function quantileBreaks(values: readonly number[], n = 5): number[] {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return [];
  const breaks = new Set<number>();
  for (let i = 1; i < n; i++) breaks.add(sorted[Math.floor((i / n) * sorted.length)]);
  return [...breaks].filter((b) => b > sorted[0]).sort((a, b) => a - b);
}

/** Build a Classes object, trimming the palette to the number of classes. */
export function classes(
  breaks: number[],
  palette: readonly string[],
  meta: Omit<Classes, "breaks" | "colors">,
): Classes {
  const n = Math.min(breaks.length + 1, palette.length);
  // Spread a short scale across the palette so 3 classes still run light → dark.
  const colors = n === palette.length
    ? palette.slice()
    : Array.from({ length: n }, (_, i) => palette[Math.round((i * (palette.length - 1)) / Math.max(1, n - 1))]);
  return { breaks: breaks.slice(0, n - 1), colors, ...meta };
}

export function stepExpression(input: ExpressionSpecification, c: Classes): ExpressionSpecification {
  const expr: unknown[] = ["step", input, c.colors[0]];
  c.breaks.forEach((b, i) => expr.push(b, c.colors[i + 1]));
  return expr as ExpressionSpecification;
}

export function interpolateExpression(input: ExpressionSpecification, c: Classes): ExpressionSpecification {
  if (!c.breaks.length) return c.colors[0] as unknown as ExpressionSpecification;
  const expr: unknown[] = ["interpolate", ["linear"], input, 0, c.colors[0]];
  c.breaks.forEach((b, i) => expr.push(b, c.colors[i + 1]));
  return expr as ExpressionSpecification;
}

export function classIndex(value: number, c: Classes): number {
  let i = 0;
  while (i < c.breaks.length && value >= c.breaks[i]) i++;
  return i;
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function classLabels(c: Classes): string[] {
  return c.colors.map((_, i) => {
    const lo = i === 0 ? c.min : c.breaks[i - 1];
    const hi = c.breaks[i];
    if (i === c.breaks.length) return `${fmt(lo ?? 0)}+`;
    if (!c.integer) return i === 0 ? `<${fmt(hi)}` : `${fmt(lo!)}–${fmt(hi)}`;
    if (lo == null) return `<${fmt(hi)}`;
    return lo >= hi - 1 ? fmt(lo) : `${fmt(lo)}–${fmt(hi - 1)}`;
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

export function legendHtml(c: Classes, continuous = false): string {
  const labels = classLabels(c);
  return `<div class="legend" role="img" aria-label="${escapeHtml(`${c.unit}: ${labels.join(", ")}`)}">` +
    `<div class="legend-unit">${escapeHtml(c.unit)}</div>` +
    `<div class="legend-bar${continuous ? " is-continuous" : ""}">${c.colors.map((col) => `<span style="background:${col}"></span>`).join("")}</div>` +
    `<div class="legend-labels">${labels.map((l) => `<span>${escapeHtml(l)}</span>`).join("")}</div>` +
    (c.source ? `<div class="legend-source">${escapeHtml(c.source)}</div>` : "") +
    `</div>`;
}

/** Categorical legend: [color, label] swatches. */
export function swatchLegendHtml(unit: string, items: Array<[string, string]>, source = ""): string {
  return `<div class="legend"><div class="legend-unit">${escapeHtml(unit)}</div>` +
    `<div class="legend-swatches">${items.map(([col, label]) =>
      `<span><i style="background:${col}"></i>${escapeHtml(label)}</span>`).join("")}</div>` +
    (source ? `<div class="legend-source">${escapeHtml(source)}</div>` : "") +
    `</div>`;
}
