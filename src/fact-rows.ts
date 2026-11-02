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

const degrees: Fmt = (v) => `${Number(v).toFixed(1)} °C`;
const mm: Fmt = (v) => `${Number(v).toLocaleString("en-GB")} mm`;
const pct: Fmt = (v) => `${Number(v).toFixed(1)}%`;
const hours: Fmt = (v) => `${Number(v).toLocaleString("en-GB")} h`;

export const FACT_ROWS: Readonly<Record<string, Array<[key: string, label: string, fmt: Fmt]>>> = {
  mountains: [
    ["alt_name", "Also called", text],
    ["ele", "Height", metres],
    ["prominence", "Prominence", metres],
    ["lists", "On the lists", text],
    ["county", "County", text],
    ["summit_feature", "Summit", text],
  ],
  schools: [
    ["phase", "Phase", text],
    ["school_type", "Type", text],
    ["ages", "Ages", text],
    ["pupils", "Pupils", count],
    ["gender", "Pupils admitted", text],
    ["religion", "Religious character", text],
    ["ofsted_framework", "Latest Ofsted", text],
    ["ofsted_date", "Inspected", text],
    ["ofsted_achievement", "Achievement", text],
    ["ofsted_curriculum", "Curriculum and teaching", text],
    ["ofsted_behaviour", "Attendance and behaviour", text],
    ["ofsted_wellbeing", "Personal development", text],
    ["ofsted_inclusion", "Inclusion", text],
    ["ofsted_leadership", "Leadership and governance", text],
    ["ofsted_safeguarding", "Safeguarding", text],
    ["ofsted_overall", "Ofsted overall effectiveness", text],
    ["ofsted_overall_date", "Graded inspection", text],
    ["ofsted_ungraded", "Latest ungraded inspection", text],
    ["ofsted_ungraded_date", "Ungraded inspection date", text],
    ["inspectorate", "Inspectorate", text],
    ["isced", "ISCED level", text],
    ["town", "Town", text],
    ["nation", "Nation", text],
  ],
  cemeteries: [
    ["cemetery_kind", "Kind", text],
    ["area_ha", "Area", (v) => `${Number(v).toLocaleString("en-GB")} ha`],
  ],
  historic: [
    ["site_type", "Site type", text],
    ["fortification_type", "Fortification", text],
    ["civilization", "Period", text],
  ],
  legends: [
    ["legend_kind", "Kind", text],
    ["feature", "Feature", text],
  ],
  health: [
    ["nation", "Nation", text],
    ["code", "Practice code", text],
    ["patients", "Registered patients", count],
    ["partners", "Partners", text],
    ["address", "Address", text],
    ["cqc_rating", "CQC rating", text],
    ["cqc_date", "Rating published", text],
    ["updated", "Register entry updated", text],
  ],
  immigration: [
    ["kind", "Type", text],
    ["icao", "ICAO code", text],
    ["passengers", "Passengers", count],
    ["passengers_note", "Counted", text],
    ["ferry_passengers", "Ferry passengers", count],
    ["cruise_passengers", "Cruise passengers", count],
    ["passenger_cars", "Passenger cars, 2025", count],
    ["detained", "People detained", count],
    ["detained_note", "Counted", text],
  ],
  nuclear: [
    ["category", "Site", text],
    ["status", "Status", text],
    ["operator", "Licensee / operator", text],
    ["capacity_mw", "Capacity", (v) => `${Number(v).toLocaleString("en-GB")} MW`],
    ["established", "Established", text],
    ["opened", "Opened", text],
    ["closed", "Stopped generating", text],
    ["licence", "ONR site licence", text],
    ["licence_granted", "Licence granted", text],
  ],
  roads: [
    ["road_class", "Class", text],
    ["nation", "Nation", text],
  ],
  census: [
    ["residents", "Usual residents", count],
    ["born_outside_uk_pct", "Born outside the UK", pct],
    ["born_outside_ie_pct", "Born outside Ireland", pct],
    ["over65_pct", "Aged 65 and over", pct],
    ["census_year", "Census", text],
    ["nation", "Nation", text],
  ],
  population: [
    ["pop", "Population", count],
    ["nation", "Nation", text],
    ["updated", "GeoNames record updated", text],
  ],
  weather: [
    ["latest_month", "Latest month", text],
    ["latest_tmax", "Mean daily high", degrees],
    ["latest_tmin", "Mean daily low", degrees],
    ["latest_rain", "Rain", mm],
    ["latest_sun", "Sunshine", hours],
    ["avg_tmax", "1991–2020 high", degrees],
    ["avg_tmin", "1991–2020 low", degrees],
    ["avg_rain", "1991–2020 rain / yr", mm],
    ["avg_sun", "1991–2020 sun / yr", hours],
    ["since", "Records since", text],
    ["record_ended", "Record ended", text],
    ["elevation_m", "Station height", metres],
  ],
};

/** Layers whose files carry an id instead of a per-feature source/url (keeps default-on files small). */
const DERIVED_SOURCE: Readonly<Record<string, (p: Record<string, unknown>) => [source: string, url: string] | null>> = {
  health: (p) => {
    if (typeof p.cqc_id === "string" && /^[\w-]+$/.test(p.cqc_id)) return ["CQC report (NHS ODS + CQC)", `https://www.cqc.org.uk/location/${p.cqc_id}`];
    if (p.nation === "England" || p.nation === "Wales")
      return ["NHS ODS GP practice register", "https://www.odsdatasearchandexport.nhs.uk/?search=" + encodeURIComponent(String(p.code ?? ""))];
    if (p.nation === "Scotland") return ["Public Health Scotland GP practices", "https://www.opendata.nhs.scot/dataset/gp-practice-contact-details-and-list-sizes"];
    if (p.nation === "Northern Ireland") return ["BSO GP practice reference file (OpenDataNI)", "https://www.opendatani.gov.uk/dataset/gp-practice-list-sizes"];
    if (p.nation === "Ireland") return ["HSE Service Directory, May 2022", "https://www2.hse.ie/services/find-a-gp/"];
    return typeof p.osm_id === "string" && /^(node|way|relation)\/\d+$/.test(p.osm_id)
      ? ["OpenStreetMap", `https://www.openstreetmap.org/${p.osm_id}`]
      : null;
  },
  roads: (p) => ["OpenStreetMap (highway=motorway/trunk)",
    `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${String(p.name ?? "")} ${String(p.nation ?? "")}`.trim())}`],
  schools: (p) => {
    if (p.urn != null) {
      const graded = Object.keys(p).some((key) => key.startsWith("ofsted_"));
      return graded
        ? ["Ofsted report (DfE GIAS + Ofsted)", `https://reports.ofsted.gov.uk/provider/ELS/${Number(p.urn)}`]
        : ["DfE Get Information about Schools", `https://get-information-schools.service.gov.uk/Establishments/Establishment/Details/${Number(p.urn)}`];
    }
    return typeof p.osm_id === "string" && /^(node|way|relation)\/\d+$/.test(p.osm_id)
      ? ["OpenStreetMap", `https://www.openstreetmap.org/${p.osm_id}`]
      : null;
  },
};

/** Label/value rows plus a source link; empty for layers with no dataset facts. */
export function factRows(layerId: string, props: Record<string, unknown>): string {
  const spec = FACT_ROWS[layerId];
  if (!spec) return "";
  const rows = spec
    .filter(([key]) => props[key] != null && props[key] !== "")
    .map(([key, label, fmt]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(fmt(props[key], props))}</dd>`);
  const derived = props.source ? null : DERIVED_SOURCE[layerId]?.(props);
  const source = derived ? derived[0] : props.source ? String(props.source) : "";
  const rawUrl = derived ? derived[1] : props.url;
  const url = typeof rawUrl === "string" && /^https:\/\//.test(rawUrl) ? rawUrl : "";
  if (source) {
    rows.push(`<dt>Source</dt><dd>${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(source)}</a>` : escapeHtml(source)}</dd>`);
  }
  return rows.length ? `<dl class="popup-rows">${rows.join("")}</dl>` : "";
}

export const formatters = { text, metres, count, degrees, mm, hours };
