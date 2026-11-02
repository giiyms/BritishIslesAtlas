const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const TURBINE_ROWS: Array<[string, string, (v: unknown) => string]> = [
  ["farm", "Farm", String],
  ["operator", "Operator", String],
  ["capacity_mw", "Capacity", (v) => `${Number(v)} MW`],
  ["rotor_m", "Rotor", (v) => `${Number(v)} m`],
  ["hub_m", "Hub height", (v) => `${Number(v)} m`],
  ["status", "Status", String],
];

/** Wind turbine facts as label/value rows; empty for other layers. */
export function turbineRows(properties: Record<string, unknown>): string {
  if (properties.layer !== "wind") return "";
  const rows = TURBINE_ROWS.filter(([key]) => properties[key] != null && properties[key] !== "")
    .map(([key, label, fmt]) => {
      const shown = key === "farm" && properties.farm_from_repd ? "Nearest REPD site" : label;
      return `<dt>${shown}</dt><dd>${escapeHtml(fmt(properties[key]))}</dd>`;
    });
  rows.push(`<dt>Location</dt><dd>${properties.offshore ? "Offshore" : "Onshore"}</dd>`);
  return `<dl class="popup-rows">${rows.join("")}</dl>`;
}

