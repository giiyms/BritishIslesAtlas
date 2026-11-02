/**
 * Card rows for layers whose facts come from an official dataset rather than live OSM tags
 * (mountains, schools, weather, crime, census, ...). Each layer lists the properties it shows,
 * in order; the source line links the dataset the feature came from.
 */
const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Fmt = (value: unknown, props: Record<string, unknown>) => string;
const text: Fmt = (v) => String(v);
const metres: Fmt = (v) => `${Number(v).toLocaleString("en-GB")} m`;
const count: Fmt = (v) => Number(v).toLocaleString("en-GB");

export const FACT_ROWS: Readonly<Record<string, Array<[key: string, label: string, fmt: Fmt]>>> = {
  mountains: [
    ["alt_name", "Also called", text],
    ["ele", "Height", metres],
    ["prominence", "Prominence", metres],
    ["lists", "On the lists", text],
    ["county", "County", text],
    ["summit_feature", "Summit", text],
  ],
};

/** Label/value rows plus a source link; empty for layers with no dataset facts. */
export function factRows(layerId: string, props: Record<string, unknown>): string {
  const spec = FACT_ROWS[layerId];
  if (!spec) return "";
  const rows = spec
    .filter(([key]) => props[key] != null && props[key] !== "")
    .map(([key, label, fmt]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(fmt(props[key], props))}</dd>`);
  const source = props.source ? String(props.source) : "";
  const url = typeof props.url === "string" && /^https:\/\//.test(props.url) ? props.url : "";
  if (source) {
    rows.push(`<dt>Source</dt><dd>${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(source)}</a>` : escapeHtml(source)}</dd>`);
  }
  return rows.length ? `<dl class="popup-rows">${rows.join("")}</dl>` : "";
}

export const formatters = { text, metres, count };
