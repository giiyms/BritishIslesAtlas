/**
 * Rich place card (t251u/t252u): every OSM tag as a row, live opening-hours badge,
 * photos from Wikimedia Commons / Wikipedia / Wikidata / OSM image=* / Geograph,
 * and ratings only from open official sources (FSA hygiene, CQC). Nothing is
 * invented: a missing photo or rating shows an explicit empty state.
 */
import { minuteOfWeek, openState, parseOpeningHours } from "./opening-hours";
import { turbineRows } from "./turbine";
import { factRows } from "./fact-rows";

export const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Tags = Record<string, string>;

const svg = (d: string) =>
  `<svg class="pr-ico" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const ROW_ICONS = {
  clock: svg('<circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/>'),
  ticket: svg('<path d="M2.5 5.5h11v2a1.5 1.5 0 0 0 0 3v2h-11v-2a1.5 1.5 0 0 0 0-3z"/>'),
  people: svg('<circle cx="6" cy="5.5" r="2"/><path d="M2.5 13c0-2 1.6-3.5 3.5-3.5S9.5 11 9.5 13"/><circle cx="11" cy="6" r="1.6"/><path d="M10.5 9.6c1.7 0 3 1.3 3 3.4"/>'),
  faith: svg('<path d="M8 2v12M4.5 5.5h7"/>'),
  heritage: svg('<path d="M2.5 13.5h11M3.5 6.5h9L8 3zM5 7v5M8 7v5M11 7v5"/>'),
  access: svg('<circle cx="8" cy="3" r="1.2"/><path d="M5 6h6M8 6v4l3 3.5M8 10H5.5"/>'),
  globe: svg('<circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12"/>'),
  phone: svg('<path d="M4 2.5h2l1 3-1.5 1a7 7 0 0 0 4 4l1-1.5 3 1v2c0 .8-.7 1.5-1.5 1.5A10.5 10.5 0 0 1 2.5 4c0-.8.7-1.5 1.5-1.5z"/>'),
  pin: svg('<path d="M8 14s4.5-4.2 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 9.8 8 14 8 14z"/><circle cx="8" cy="6.5" r="1.5"/>'),
  book: svg('<path d="M3 3h4a1.5 1.5 0 0 1 1 .5 1.5 1.5 0 0 1 1-.5h4v9.5H9a1 1 0 0 0-1 1 1 1 0 0 0-1-1H3z"/>'),
  info: svg('<circle cx="8" cy="8" r="6"/><path d="M8 7.5v3.5M8 5v.1"/>'),
  food: svg('<path d="M4 2v5a1.5 1.5 0 0 0 3 0V2M5.5 7v7M11 2c-1.5 1-2 3-2 5h2v7"/>'),
  building: svg('<path d="M3 13.5V3.5h6v10M9 6.5h4v7M2 13.5h12M5 6h2M5 8.5h2M5 11h2"/>'),
  star: svg('<path d="M8 2.2l1.8 3.7 4 .6-2.9 2.8.7 4L8 11.4l-3.6 1.9.7-4L2.2 6.5l4-.6z"/>'),
} as const;

export interface Row { icon: keyof typeof ROW_ICONS; label: string; html: string; keys: string[] }

const YES_NO: Record<string, string> = { yes: "Yes", no: "No", limited: "Limited", designated: "Designated" };
const nice = (v: string) => YES_NO[v] ?? v.replace(/_/g, " ").replace(/;/g, ", ").replace(/^./, (c) => c.toUpperCase());
const link = (href: string, text: string) =>
  `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}<span class="ext" aria-hidden="true">↗</span></a>`;

export function wikipediaUrl(value: string): string | null {
  const m = /^([a-z-]{2,12}):(.+)$/.exec(value);
  if (!m) return null;
  return `https://${m[1]}.wikipedia.org/wiki/${encodeURIComponent(m[2].replace(/ /g, "_"))}`;
}

function websiteText(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

const HERITAGE_LEVEL: Record<string, string> = { "1": "World Heritage", "2": "National", "4": "Local" };

/** Structured rows from OSM tags, in a fixed reading order. `keys` lists the tags each row consumed. */
export function tagRows(tags: Tags, now: Date = new Date()): Row[] {
  const rows: Row[] = [];
  const t = (k: string) => (tags[k] ?? "").trim();
  if (t("opening_hours")) {
    const week = parseOpeningHours(t("opening_hours"));
    const state = week ? openState(week, minuteOfWeek(now)) : null;
    const badge = state ? `<span class="pr-badge ${state.open ? "is-open" : "is-closed"}">${escapeHtml(state.label)}</span>` : "";
    rows.push({ icon: "clock", label: "Hours", keys: ["opening_hours"],
      html: `${badge}<span class="pr-raw">${escapeHtml(t("opening_hours").replace(/;\s*/g, "; "))}</span>` });
  }
  if (t("cuisine") || t("food")) {
    rows.push({ icon: "food", label: "Food", keys: ["cuisine", "food"],
      html: escapeHtml([t("cuisine") && nice(t("cuisine")), t("food") && `Food: ${nice(t("food"))}`].filter(Boolean).join(" · ")) });
  }
  if (t("fee") || t("charge")) {
    rows.push({ icon: "ticket", label: "Fee", keys: ["fee", "charge"],
      html: escapeHtml([t("fee") && `Entry fee: ${nice(t("fee"))}`, t("charge")].filter(Boolean).join(" · ")) });
  }
  if (t("capacity") || t("beds")) {
    rows.push({ icon: "people", label: "Capacity", keys: ["capacity", "beds"],
      html: escapeHtml([t("capacity") && t("capacity"), t("beds") && `${t("beds")} beds`].filter(Boolean).join(" · ")) });
  }
  if (t("religion") || t("denomination")) {
    rows.push({ icon: "faith", label: "Faith", keys: ["religion", "denomination"],
      html: escapeHtml([t("religion") && nice(t("religion")), t("denomination") && nice(t("denomination"))].filter(Boolean).join(" · ")) });
  }
  if (t("heritage") || t("listed_status") || t("HE_ref") || t("historic")) {
    const bits = [
      t("listed_status") || (t("heritage") && `${HERITAGE_LEVEL[t("heritage")] ?? "Level " + t("heritage")} heritage`),
      t("historic") && t("historic") !== "yes" && nice(t("historic")),
    ].filter((b): b is string => Boolean(b)).map((b) => escapeHtml(b));
    if (t("HE_ref")) bits.push(link(`https://historicengland.org.uk/listing/the-list/list-entry/${encodeURIComponent(t("HE_ref"))}`, `List entry ${t("HE_ref")}`));
    rows.push({ icon: "heritage", label: "Heritage", keys: ["heritage", "listed_status", "HE_ref", "historic", "heritage:operator"], html: bits.join(" · ") });
  }
  if (t("start_date") || t("building:architecture") || t("architect")) {
    rows.push({ icon: "building", label: "Built", keys: ["start_date", "building:architecture", "architect"],
      html: escapeHtml([t("start_date") && `Built ${t("start_date")}`, t("building:architecture") && `${nice(t("building:architecture"))} style`, t("architect") && `Architect: ${t("architect")}`].filter(Boolean).join(" · ")) });
  }
  if (t("wheelchair")) rows.push({ icon: "access", label: "Wheelchair", keys: ["wheelchair", "wheelchair:description"],
    html: escapeHtml([`Wheelchair access: ${nice(t("wheelchair"))}`, t("wheelchair:description")].filter(Boolean).join(" · ")) });
  if (t("emergency")) rows.push({ icon: "info", label: "Emergency", keys: ["emergency"], html: escapeHtml(`Emergency department: ${nice(t("emergency"))}`) });
  if (t("operator") || t("brand")) {
    rows.push({ icon: "building", label: "Operator", keys: ["operator", "brand"],
      html: escapeHtml([...new Set([t("operator"), t("brand")].filter(Boolean))].join(" · ")) });
  }
  const street = [t("addr:housenumber"), t("addr:street")].filter(Boolean).join(" ");
  const addr = [t("addr:housename"), street, t("addr:city") || t("addr:town") || t("addr:village"), t("addr:postcode")].filter(Boolean).join(", ");
  if (addr) rows.push({ icon: "pin", label: "Address", keys: Object.keys(tags).filter((k) => k.startsWith("addr:")), html: escapeHtml(addr) });
  const phone = t("phone") || t("contact:phone");
  if (phone) rows.push({ icon: "phone", label: "Phone", keys: ["phone", "contact:phone"],
    html: `<a href="tel:${escapeHtml(phone.replace(/[^\d+]/g, ""))}">${escapeHtml(phone)}</a>` });
  const web = t("website") || t("contact:website") || t("url");
  if (web && /^https?:\/\//.test(web)) rows.push({ icon: "globe", label: "Website", keys: ["website", "contact:website", "url"], html: link(web, websiteText(web)) });
  const refs: string[] = [];
  if (t("wikipedia")) { const u = wikipediaUrl(t("wikipedia")); if (u) refs.push(link(u, "Wikipedia")); }
  if (/^Q\d+$/.test(t("wikidata"))) refs.push(link(`https://www.wikidata.org/wiki/${t("wikidata")}`, `Wikidata ${t("wikidata")}`));
  if (refs.length) rows.push({ icon: "book", label: "Reference", keys: ["wikipedia", "wikidata"], html: refs.join(" · ") });
  return rows;
}

const HIDDEN_TAG = /^(name|layer|source|check_date|note|fixme|created_by|image|wikimedia_commons)(:|$)|^(name|old_name|alt_name|official_name):|^not:/;

/** Every tag not already shown in a structured row, for the "All tags" list. */
export function otherTags(tags: Tags, rows: Row[]): Array<[string, string]> {
  const used = new Set(rows.flatMap((r) => r.keys));
  return Object.entries(tags).filter(([k]) => !used.has(k) && !HIDDEN_TAG.test(k)).sort(([a], [b]) => a.localeCompare(b));
}

export type PhotoSource =
  | { kind: "commons"; file: string; via: string }
  | { kind: "geograph"; id: string; via: string }
  | { kind: "url"; url: string; via: string }
  | { kind: "wikidata"; id: string }
  | { kind: "wikipedia"; lang: string; title: string };

function commonsFile(value: string): string | null {
  const v = decodeURIComponent(value.trim());
  const m = /(?:^|\/wiki\/)(File:[^?#]+)$/.exec(v) ?? /^(File:.+)$/.exec(v);
  return m ? m[1].replace(/_/g, " ") : null;
}

/** Photo sources in priority order. Remote image URLs are only used when they are Commons or Geograph pages. */
export function photoSources(tags: Tags): PhotoSource[] {
  const out: PhotoSource[] = [];
  for (const key of ["wikimedia_commons", "image"]) {
    const value = tags[key];
    if (!value) continue;
    const file = commonsFile(value);
    if (file) { out.push({ kind: "commons", file, via: `OSM ${key}` }); continue; }
    const geo = /geograph\.(?:org\.uk|ie)\/(?:photo|p)\/(\d+)/.exec(value);
    if (geo) { out.push({ kind: "geograph", id: geo[1], via: `OSM ${key}` }); continue; }
  }
  if (/^Q\d+$/.test(tags.wikidata ?? "")) out.push({ kind: "wikidata", id: tags.wikidata });
  const wp = /^([a-z-]{2,12}):(.+)$/.exec(tags.wikipedia ?? "");
  if (wp) out.push({ kind: "wikipedia", lang: wp[1], title: wp[2] });
  return out;
}

export interface Photo { src: string; width?: number; height?: number; credit: string; licence: string; page: string; via: string }

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

async function getJson<T>(url: string, signal: AbortSignal, headers?: Record<string, string>): Promise<T> {
  const response = await fetch(url, { signal, headers });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json() as Promise<T>;
}

async function commonsPhoto(file: string, via: string, signal: AbortSignal): Promise<Photo | null> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=url|extmetadata|mime&iiurlwidth=640&titles=${encodeURIComponent(file)}`;
  const data = await getJson<{ query?: { pages?: Record<string, { imageinfo?: Array<Record<string, any>> }> } }>(url, signal);
  const info = Object.values(data.query?.pages ?? {})[0]?.imageinfo?.[0];
  if (!info?.thumburl || !/^image\/(jpeg|png|webp|gif)/.test(info.mime ?? "")) return null;
  const meta = info.extmetadata ?? {};
  return {
    src: info.thumburl, width: info.thumbwidth, height: info.thumbheight,
    credit: stripHtml(meta.Artist?.value ?? "") || "Unknown author",
    licence: stripHtml(meta.LicenseShortName?.value ?? "") || "see file page",
    page: info.descriptionurl, via: `Wikimedia Commons (${via})`,
  };
}

async function resolvePhoto(source: PhotoSource, signal: AbortSignal): Promise<Photo | null> {
  if (source.kind === "commons") return commonsPhoto(source.file, source.via, signal);
  if (source.kind === "geograph") {
    const page = `https://www.geograph.org.uk/photo/${source.id}`;
    const d = await getJson<Record<string, string>>(`https://api.geograph.org.uk/api/oembed?format=json&url=${encodeURIComponent(page)}`, signal);
    if (!d.url) return null;
    return { src: d.url, width: Number(d.width), height: Number(d.height), credit: d.author_name || "Geograph contributor",
      licence: d.license_url?.includes("by-sa/2.0") ? "CC BY-SA 2.0" : d.license || "see photo page", page, via: `Geograph (${source.via})` };
  }
  if (source.kind === "wikidata") {
    const d = await getJson<{ claims?: { P18?: Array<{ mainsnak?: { datavalue?: { value?: string } } }> } }>(
      `https://www.wikidata.org/w/api.php?action=wbgetclaims&format=json&origin=*&property=P18&entity=${source.id}`, signal);
    const file = d.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    return file ? commonsPhoto(`File:${file}`, `Wikidata ${source.id}`, signal) : null;
  }
  if (source.kind === "wikipedia") {
    const d = await getJson<{ query?: { pages?: Record<string, { pageimage?: string }> } }>(
      `https://${source.lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=name&redirects=1&titles=${encodeURIComponent(source.title)}`, signal);
    const name = Object.values(d.query?.pages ?? {})[0]?.pageimage;
    return name ? commonsPhoto(`File:${name}`, `${source.lang}.wikipedia`, signal) : null;
  }
  return null;
}

export async function findPhoto(tags: Tags, signal: AbortSignal): Promise<Photo | null> {
  for (const source of photoSources(tags)) {
    try {
      const photo = await resolvePhoto(source, signal);
      if (photo) return photo;
    } catch (error) {
      if (signal.aborted) throw error;
    }
  }
  return null;
}

/* ---------- ratings ---------- */

export type RatingKind = "fsa" | "cqc" | null;
const FOOD_AMENITY = new Set(["pub", "bar", "restaurant", "cafe", "fast_food", "nightclub", "biergarten", "food_court"]);
export function ratingKind(layerId: string, tags: Tags): RatingKind {
  if (["hospitals", "clinics", "dentists"].includes(layerId)) return "cqc";
  if (["pubs", "nightclubs"].includes(layerId) || FOOD_AMENITY.has(tags.amenity ?? "")) return "fsa";
  return null;
}

export interface Rating { label: string; value: string; date: string; source: string; href: string; matched?: string; tone: "good" | "mid" | "bad" | "neutral" }

const nameTokens = (s: string) => new Set(s.toLowerCase().replace(/&/g, " and ").match(/[a-z0-9]+/g)?.filter((w) => !["the", "and", "of", "inn", "bar", "pub", "ltd", "limited", "hotel"].includes(w)) ?? []);
export function nameScore(a: string, b: string): number {
  const ta = nameTokens(a), tb = nameTokens(b);
  if (!ta.size || !tb.size) return 0;
  let shared = 0; ta.forEach((w) => { if (tb.has(w)) shared++; });
  return shared / Math.max(ta.size, tb.size);
}

export interface FsaEstablishment { BusinessName: string; FHRSID: number; RatingValue: string; RatingDate: string | null; SchemeType: string; Distance?: number }

const FHRS_WORDS: Record<string, string> = { "5": "Very good", "4": "Good", "3": "Generally satisfactory", "2": "Improvement necessary", "1": "Major improvement necessary", "0": "Urgent improvement necessary" };

/** Best FSA establishment for a place: names must agree (score ≥ 0.5), nearest wins ties. */
export function pickFsa(list: FsaEstablishment[], name: string): Rating | null {
  const best = list
    .map((e) => ({ e, s: nameScore(name, e.BusinessName) }))
    .filter(({ s }) => s >= 0.5)
    .sort((a, b) => b.s - a.s || (a.e.Distance ?? 0) - (b.e.Distance ?? 0))[0]?.e;
  if (!best) return null;
  const fhis = best.SchemeType === "FHIS";
  const v = best.RatingValue;
  const tone = fhis ? (v === "Pass" || v === "Pass and Eat Safe" ? "good" : v.startsWith("Improvement") ? "bad" : "neutral")
    : /^[0-5]$/.test(v) ? (Number(v) >= 4 ? "good" : Number(v) >= 3 ? "mid" : "bad") : "neutral";
  return {
    label: fhis ? "Food hygiene (FHIS, Scotland)" : "Food hygiene rating",
    value: /^[0-5]$/.test(v) ? `${v} / 5 · ${FHRS_WORDS[v]}` : v.replace(/([a-z])([A-Z])/g, "$1 $2"),
    date: best.RatingDate ? best.RatingDate.slice(0, 10) : "date not given",
    source: "Food Standards Agency", href: `https://ratings.food.gov.uk/business/${best.FHRSID}`,
    matched: best.BusinessName, tone,
  };
}

async function fsaRating(name: string, lon: number, lat: number, signal: AbortSignal): Promise<Rating | null> {
  const base = `https://api.ratings.food.gov.uk/Establishments?latitude=${lat}&longitude=${lon}&pageSize=25&sortOptionKey=distance`;
  const headers = { "x-api-version": "2", accept: "application/json" };
  const near = await getJson<{ establishments: FsaEstablishment[] }>(`${base}&maxDistanceLimit=0.25`, signal, headers);
  return pickFsa(near.establishments ?? [], name);
}

let cqcTable: Promise<Record<string, [string, string, string, string]>> | null = null;
async function cqcRating(osmId: string): Promise<Rating | null> {
  cqcTable ??= fetch("/data/ratings-cqc.json").then((r) => r.json());
  const row = (await cqcTable)[osmId];
  if (!row) return null;
  const [value, date, id, matched] = row;
  return { label: "CQC overall rating", value, date, source: "Care Quality Commission", href: `https://www.cqc.org.uk/location/${id}`, matched,
    tone: value === "Outstanding" || value === "Good" ? "good" : value === "Requires improvement" ? "mid" : "bad" };
}

/* ---------- OSM tags ---------- */

const tagCache = new Map<string, Promise<Tags | null>>();
export function osmTags(osmId: string, signal: AbortSignal): Promise<Tags | null> {
  if (!/^(node|way|relation)\/\d+$/.test(osmId)) return Promise.resolve(null);
  let hit = tagCache.get(osmId);
  if (!hit) {
    hit = getJson<{ elements: Array<{ tags?: Tags }> }>(`https://api.openstreetmap.org/api/0.6/${osmId}.json`, signal)
      .then((d) => d.elements?.[0]?.tags ?? null)
      .catch((error) => { tagCache.delete(osmId); if (signal.aborted) throw error; return null; });
    tagCache.set(osmId, hit);
  }
  return hit;
}

/* ---------- rendering ---------- */

export interface PoiCard {
  layerId: string; name: string; typeLine: string; accent: string; tint: string; icon: string;
  props: Record<string, unknown>; lngLat: [number, number];
}

export function mapLinks(name: string, [lon, lat]: [number, number], osmUrl: string): string {
  const ll = `${lat.toFixed(6)},${lon.toFixed(6)}`;
  const links = [
    osmUrl && [osmUrl, "OpenStreetMap"],
    [`https://maps.apple.com/?ll=${ll}&q=${encodeURIComponent(name)}`, "Apple Maps"],
    [`https://www.google.com/maps/search/?api=1&query=${ll}`, "Google Maps"],
  ].filter(Boolean) as string[][];
  return links.map(([href, text]) => link(href, text)).join("");
}

export function poiCardHtml(card: PoiCard): string {
  const [lon, lat] = card.lngLat;
  const coords = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  const osmUrl = card.props.osm_url ? String(card.props.osm_url) : "";
  return `<article class="poi-card" style="--poi-accent:${escapeHtml(card.accent)};--poi-tint:${escapeHtml(card.tint)}">` +
    `<header class="poi-head"><span class="poi-glyph" aria-hidden="true">${card.icon}</span><div class="poi-titles">` +
    `<strong class="popup-title popup-title-poi">${escapeHtml(card.name)}</strong>` +
    `<div class="popup-meta">${escapeHtml(card.typeLine)}</div></div></header>` +
    `<figure class="poi-photo is-loading" aria-busy="true"><div class="poi-skeleton"></div></figure>` +
    turbineRows(card.props) + factRows(card.layerId, card.props) +
    `<div class="poi-rating" hidden></div>` +
    `<dl class="poi-rows"><div class="poi-row poi-row-loading"><dt>${ROW_ICONS.info}</dt><dd><span class="poi-line"></span></dd></div></dl>` +
    `<div class="poi-actions"><button type="button" class="poi-copy" data-coords="${coords}">Copy ${coords}</button>` +
    `<nav class="poi-links" aria-label="Open in">${mapLinks(card.name, card.lngLat, osmUrl)}</nav></div>` +
    `</article>`;
}

function rowsHtml(rows: Row[], extra: Array<[string, string]>): string {
  const main = rows.map((r) => `<div class="poi-row"><dt title="${r.label}">${ROW_ICONS[r.icon]}<span class="sr">${r.label}</span></dt><dd>${r.html}</dd></div>`).join("");
  const more = extra.length
    ? `<details class="poi-more"><summary>All ${extra.length} OpenStreetMap tags</summary><dl>${extra.map(([k, v]) =>
        `<dt>${escapeHtml(k)}</dt><dd>${/^https?:\/\//.test(v) ? link(v, websiteText(v)) : escapeHtml(v)}</dd>`).join("")}</dl></details>`
    : "";
  return main + more;
}

function ratingHtml(r: Rating): string {
  return `<div class="poi-rating-box tone-${r.tone}">${ROW_ICONS.star}<div><div class="poi-rating-label">${escapeHtml(r.label)}</div>` +
    `<div class="poi-rating-value">${escapeHtml(r.value)}</div>` +
    `<div class="poi-rating-src">${link(r.href, r.source)} · inspected ${escapeHtml(r.date)}${r.matched ? ` · record “${escapeHtml(r.matched)}”` : ""}</div></div></div>`;
}

/** Fill a card in place. Each section settles independently; `onResize` lets the map re-check overlap. */
export async function hydratePoiCard(root: HTMLElement, card: PoiCard, signal: AbortSignal, onResize: () => void): Promise<void> {
  root.querySelector<HTMLButtonElement>(".poi-copy")?.addEventListener("click", (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    void navigator.clipboard?.writeText(button.dataset.coords ?? "").then(() => { button.textContent = "Copied"; }, () => { button.textContent = button.dataset.coords ?? ""; });
  });
  const osmId = String(card.props.osm_id ?? "");
  const tags = (await osmTags(osmId, signal).catch(() => null)) ?? {};
  if (signal.aborted) return;
  const rows = tagRows(tags);
  const extra = otherTags(tags, rows);
  const dl = root.querySelector<HTMLElement>(".poi-rows");
  if (dl && !osmId && root.querySelector(".popup-rows")) dl.remove();
  else if (dl) {
    dl.innerHTML = rows.length || extra.length ? rowsHtml(rows, extra)
      : `<div class="poi-row"><dt>${ROW_ICONS.info}</dt><dd class="poi-empty">${osmId ? "No further details recorded in OpenStreetMap yet." : "No details available."}</dd></div>`;
  }
  onResize();
  const figure = root.querySelector<HTMLElement>(".poi-photo");
  const photoTask = findPhoto(tags, signal).then((photo) => {
    if (!figure || signal.aborted) return;
    figure.classList.remove("is-loading"); figure.removeAttribute("aria-busy");
    if (!photo && !osmId) { figure.remove(); onResize(); return; }
    if (!photo) { figure.classList.add("is-empty"); figure.innerHTML = `<div class="poi-nophoto">No open-licence photo linked yet</div>`; onResize(); return; }
    const ratio = photo.width && photo.height ? `aspect-ratio:${photo.width}/${photo.height};` : "";
    figure.innerHTML = `<div class="poi-skeleton"></div><img loading="lazy" decoding="async" alt="${escapeHtml(card.name)}" src="${escapeHtml(photo.src)}" style="${ratio}">` +
      `<figcaption>${link(photo.page, `${photo.credit}`)} · ${escapeHtml(photo.licence)} · ${escapeHtml(photo.via)}</figcaption>`;
    const img = figure.querySelector("img")!;
    img.addEventListener("load", () => { figure.classList.add("is-ready"); onResize(); });
    img.addEventListener("error", () => { figure.classList.add("is-empty"); figure.innerHTML = `<div class="poi-nophoto">Photo could not be loaded</div>`; });
  }).catch(() => undefined);
  const kind = ratingKind(card.layerId, tags);
  const ratingBox = root.querySelector<HTMLElement>(".poi-rating");
  const ratingTask = (async () => {
    if (!kind || !ratingBox) return;
    ratingBox.hidden = false;
    ratingBox.innerHTML = `<div class="poi-rating-box tone-neutral">${ROW_ICONS.star}<div class="poi-rating-label">Checking ${kind === "fsa" ? "Food Standards Agency" : "CQC"} records…</div></div>`;
    let rating: Rating | null = null;
    try {
      rating = kind === "fsa" ? await fsaRating(card.name, card.lngLat[0], card.lngLat[1], signal) : await cqcRating(osmId);
    } catch { if (signal.aborted) return; }
    if (signal.aborted) return;
    ratingBox.innerHTML = rating ? ratingHtml(rating)
      : `<div class="poi-rating-box tone-neutral">${ROW_ICONS.star}<div class="poi-rating-label">${kind === "fsa"
        ? "No matching Food Standards Agency record within 400 m (FSA covers England, Wales, Northern Ireland and Scotland)"
        : "No CQC-rated location matched (CQC rates England only)"}</div></div>`;
    onResize();
  })();
  await Promise.all([photoTask, ratingTask]);
}
