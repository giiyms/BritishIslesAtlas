import { ICONS } from "./icons";
import { LAYERS, isLayerId, type LayerDef, type LayerId } from "./layers";
import { LAYER_SECTIONS } from "./layer-groups";
import { DISTANCE_LAYERS, SURFACE_KINDS, type SurfaceKind } from "./surfaces";
import { ELECTION_VIEWS, type ElectionView } from "./election";
import { BASEMAP_IDS, MAX_POINTS, type AtlasState, type BasemapId, type PointTreatment, type SurfaceTreatment } from "./state";
import { formatPollsUpdated, loadVotingBundle } from "./voting";
import type { Atlas, AtlasChange, AtlasCounts } from "./map";
import { STYLE_PRESETS, type StylePresetId } from "./style-presets";
import { CROME_ATTRIBUTION, cropRankingHtml, type CropPanelDetail } from "./crops";

const DATA_CREDITS: Array<[string, string]> = [
  ["Basemap", "OpenFreeMap · © OpenMapTiles · data © OpenStreetMap contributors (ODbL)"],
  ["Hillshade", "© Esri, USGS, NOAA (World Hillshade)"],
  ["Points of interest", "© OpenStreetMap contributors (ODbL 1.0), extracted with scripts/osm_extract.py and served as PMTiles"],
  ["Surfaces", "Per-seat counts, 7 km equal-area hexes and distance rasters derived from the OSM extracts (scripts/build_tiles.py). Distances are straight-line, not travel time."],
  ["Constituencies", "ONS July 2024 BGC boundaries. Contains OS data © Crown copyright and database right 2024; contains National Statistics data © Crown copyright and database right 2024 (OGL v3.0)"],
  ["CROME 2024", CROME_ATTRIBUTION],
  ["Hex map", "Seat layout © Open Innovations (odileeds/hexmaps, MIT)"],
  ["Projections", "Electoral Calculus and More in Common seat projections; Wikipedia national polling. Projections are projections."],
  ["Candidates", "© Democracy Club (CC-BY-SA)"],
];

const BASEMAP_LABELS: Record<BasemapId, string> = { auto: "Auto", relief: "Relief", light: "Light", dark: "Dark", mono: "Mono" };

const layerOf = (id: string): LayerDef | undefined => LAYERS.find((layer) => layer.id === id);

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

function chipButton(layer: LayerDef): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "chip";
  button.dataset.layer = layer.id;
  button.dataset.label = layer.label.toLowerCase();
  button.title = layer.blurb;
  button.setAttribute("aria-pressed", "false");
  button.style.setProperty("--accent", layer.accent);
  button.style.setProperty("--tint", layer.tint);
  button.innerHTML = `<span class="chip-icon">${layer.icon}</span><span class="chip-label">${escapeHtml(layer.label)}</span>`;
  return button;
}

function group(label: string, count: number): { details: HTMLDetailsElement; grid: HTMLDivElement } {
  const details = document.createElement("details");
  details.className = "group";
  const summary = document.createElement("summary");
  summary.className = "group-label";
  summary.innerHTML = `<span class="group-name"></span><span class="group-count">${count}</span>`;
  summary.querySelector(".group-name")!.textContent = label;
  const grid = document.createElement("div");
  grid.className = "chip-grid";
  grid.setAttribute("role", "group");
  grid.setAttribute("aria-label", `${label} layers`);
  details.append(summary, grid);
  return { details, grid };
}

function aboutDialog(): HTMLDialogElement {
  const dialog = document.createElement("dialog");
  dialog.className = "about-data";
  dialog.setAttribute("aria-labelledby", "about-data-title");
  dialog.innerHTML =
    `<div class="about-head"><h2 id="about-data-title">About the data</h2>` +
    `<button type="button" class="about-close" aria-label="Close">×</button></div>` +
    `<dl>${DATA_CREDITS.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>`;
  dialog.querySelector(".about-close")?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  document.body.append(dialog);
  return dialog;
}

function datasetOptions(kind: SurfaceKind): string {
  if (kind === "distance") {
    return DISTANCE_LAYERS.map((id) => `<option value="${id}">${escapeHtml(layerOf(id)?.label ?? id)}</option>`).join("");
  }
  return LAYER_SECTIONS.map((s) =>
    `<optgroup label="${escapeHtml(s.label)}">${s.layers.map((id) =>
      `<option value="${id}">${escapeHtml(layerOf(id)?.label ?? id)}</option>`).join("")}</optgroup>`).join("");
}

type Detent = "peek" | "half" | "full";

export function mountPanel(root: HTMLElement, atlas: Atlas): void {
  root.innerHTML = `
    <div class="sheet-grab" role="button" tabindex="0" aria-label="Resize layer panel"><span></span></div>
    <button class="panel-toggle" type="button" aria-expanded="true" aria-controls="layer-body">
      <span class="panel-title">${ICONS.layers}<span>Layers</span></span>
      <span class="chevron">${ICONS.chevron}</span>
    </button>
    <div class="mode-switch" role="radiogroup" aria-label="Map mode">
      <button type="button" role="radio" data-mode="atlas">Atlas</button>
      <button type="button" role="radio" data-mode="election">Election</button>
    </div>
    <div class="legend-slot" aria-live="polite"></div>
    <div class="panel-body" id="layer-body">
      <div class="mode-atlas">
        <section class="sec">
          <h3>Map style <span class="sec-note">best fit</span></h3>
          <div class="style-presets" role="radiogroup" aria-label="Map style">
            ${STYLE_PRESETS.map((p) => `<button type="button" role="radio" class="style-preset" data-preset="${p.id}"><b>${p.label}</b><small>${escapeHtml(p.hint)}</small></button>`).join("")}
          </div>
        </section>
        <section class="sec">
          <h3>Surface <span class="sec-note">pick one</span></h3>
          <div class="opts" role="radiogroup" aria-label="Surface">
            ${SURFACE_KINDS.map((s) => `<label class="opt"><input type="radio" name="surface" value="${s.kind}">` +
              `<span><b>${s.label}</b><small>${escapeHtml(s.hint)}</small></span></label>`).join("")}
          </div>
          <label class="dataset" hidden><span>of</span><select aria-label="Surface dataset"></select></label>
          <div class="surface-treatments" hidden role="radiogroup" aria-label="Surface treatment">
            <span class="surface-treatment-label">Representation</span>
            <button type="button" role="radio" data-surface-treatment="classes">Classes</button>
            <button type="button" role="radio" data-surface-treatment="continuous">Continuous</button>
          </div>
        </section>
        <section class="sec crops-section">
          <h3>What&apos;s in view <span class="sec-note">England only</span></h3>
          <label class="opt crop-toggle"><input type="checkbox" data-toggle="crops">` +
            `<span><b>CROME 2024</b><small>Crop cover raster · England only</small></span></label>
          <div class="crop-status hint" role="status" aria-live="polite"></div>
          <div class="crop-ranking-slot"></div>
        </section>
        <section class="sec">
          <h3>Points <span class="sec-note point-count"></span><button type="button" class="link-btn points-clear">Clear</button></h3>
          <div class="active-points"></div>
          <input type="search" class="layer-filter" placeholder="Find a layer… (${LAYERS.length})" aria-label="Find a point layer" autocomplete="off" spellcheck="false">
          <div class="catalogue"></div>
        </section>
        <section class="sec">
          <h3>Basemap</h3>
          <div class="basemaps" role="radiogroup" aria-label="Basemap">
            ${BASEMAP_IDS.map((b) => `<button type="button" role="radio" class="basemap basemap-${b}" data-basemap="${b}"><span>${BASEMAP_LABELS[b]}</span></button>`).join("")}
          </div>
          <div class="toggles">
            <label><input type="checkbox" data-toggle="roads"> Main roads</label>
            <label><input type="checkbox" data-toggle="labels"> Place names</label>
          </div>
        </section>
      </div>
      <div class="mode-election" hidden>
        <section class="sec">
          <h3>Seats <span class="sec-note">GB · 632 seats</span></h3>
          <div class="opts" role="radiogroup" aria-label="Election view">
            ${ELECTION_VIEWS.map((v) => `<label class="opt"><input type="radio" name="eview" value="${v.view}">` +
              `<span><b>${v.label}</b><small>${escapeHtml(v.hint)}</small></span></label>`).join("")}
          </div>
          <div class="seg layout-seg" role="radiogroup" aria-label="Seat layout">
            <button type="button" role="radio" data-layout="map">Map</button>
            <button type="button" role="radio" data-layout="hex">Hex · one seat each</button>
          </div>
          <div class="pick-note" hidden>
            <p class="voting-disclaimer"><strong>Editorial endorsement</strong>: partisan Reform / Restore Britain guide. Never Labour or Conservative. Not Electoral Commission advice.</p>
            <button type="button" class="link-btn restore-fly">Fly to the Restore seat</button>
          </div>
          <p class="voting-vi">National VI loading…</p>
          <p class="voting-updated"></p>
          <p class="hint">Search a postcode to open your seat.</p>
        </section>
      </div>
      <button type="button" class="about-link">About the data <span aria-hidden="true">↗</span></button>
    </div>
  `;

  const $ = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
  const legendSlot = $<HTMLElement>(".legend-slot");
  const dataset = $<HTMLLabelElement>(".dataset");
  const select = $<HTMLSelectElement>(".dataset select");
  const activePoints = $<HTMLElement>(".active-points");
  const catalogue = $<HTMLElement>(".catalogue");
  const filter = $<HTMLInputElement>(".layer-filter");
  const pointCount = $<HTMLElement>(".point-count");
  const toggle = $<HTMLButtonElement>(".panel-toggle");
  const cropToggle = $<HTMLInputElement>('[data-toggle="crops"]');
  const cropStatus = $<HTMLElement>(".crop-status");
  const cropRanking = $<HTMLElement>(".crop-ranking-slot");
  let counts: Partial<Record<LayerId, number>> = {};
  let cropDetail: CropPanelDetail = { available: false, england: false, ranking: [] };
  let state: AtlasState = atlas.getState();

  // Catalogue groups.
  const groups: HTMLDetailsElement[] = [];
  for (const def of LAYER_SECTIONS) {
    const layers = def.layers.map((id) => layerOf(id)).filter((l): l is LayerDef => Boolean(l));
    const g = group(def.label, layers.length);
    for (const layer of layers) g.grid.append(chipButton(layer));
    groups.push(g.details);
  }
  catalogue.append(...groups);

  const renderActive = () => {
    activePoints.replaceChildren(...state.points.map((id) => {
      const layer = layerOf(id)!;
      const row = document.createElement("div");
      row.className = "active-point";
      row.style.setProperty("--accent", layer.accent);
      const n = counts[id];
      row.innerHTML = `<span class="ap-dot"></span><span class="ap-name">${escapeHtml(layer.label)}</span>` +
        `<select class="ap-treatment" data-treatment="${id}" aria-label="${escapeHtml(layer.label)} map treatment">` +
        `<option value="clustered">Clusters</option><option value="dots">Dots</option><option value="symbols">Symbols</option></select>` +
        `<span class="ap-count" title="In view">${n == null ? "" : n.toLocaleString("en-GB")}</span>` +
        `<button type="button" class="ap-remove" data-layer="${id}" aria-label="Remove ${escapeHtml(layer.label)}">×</button>`;
      (row.querySelector(".ap-treatment") as HTMLSelectElement).value = state.pointTreatments[id] ?? "clustered";
      return row;
    }));
    if (!state.points.length) {
      const empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "No point layers. Pick up to five below.";
      activePoints.append(empty);
    }
  };

  const renderCrops = () => {
    cropToggle.checked = state.crops;
    cropRanking.innerHTML = "";
    if (!state.crops) {
      cropStatus.textContent = "Turn on the CROME 2024 raster to see England’s crop cover.";
      return;
    }
    if (!cropDetail.available) {
      cropStatus.textContent = "Raster is available; crop area details will appear after the CROME vector tiles are built.";
      return;
    }
    if (!cropDetail.england || !cropDetail.ranking.length) {
      cropStatus.textContent = "Open crop details are available for England only. Zoom into an English crop area.";
      return;
    }
    cropStatus.textContent = "Largest crop areas in the current view";
    cropRanking.innerHTML = cropRankingHtml(cropDetail.ranking);
  };

  const render = (legend: string) => {
    root.classList.toggle("is-election", state.mode === "election");
    for (const b of root.querySelectorAll<HTMLButtonElement>("[data-mode]")) b.setAttribute("aria-checked", String(b.dataset.mode === state.mode));
    $<HTMLElement>(".mode-atlas").hidden = state.mode !== "atlas";
    $<HTMLElement>(".mode-election").hidden = state.mode !== "election";
    $<HTMLElement>(".panel-title span").textContent = state.mode === "atlas" ? "Atlas" : "Election";
    legendSlot.innerHTML = legend;
    legendSlot.hidden = !legend;
    // Surface.
    for (const input of root.querySelectorAll<HTMLInputElement>('input[name="surface"]')) input.checked = input.value === state.surface.kind;
    dataset.hidden = state.surface.kind === "none";
    // The dataset picker sits directly under the chosen surface.
    root.querySelector('input[name="surface"]:checked')?.closest(".opt")?.after(dataset);
    const kindKey = state.surface.kind === "distance" ? "distance" : "all";
    if (select.dataset.kind !== kindKey) { select.innerHTML = datasetOptions(state.surface.kind); select.dataset.kind = kindKey; }
    select.value = state.surface.dataset;
    const treatmentOptions = root.querySelector<HTMLElement>(".surface-treatments")!;
    treatmentOptions.hidden = state.surface.kind !== "seat" && state.surface.kind !== "hex";
    for (const b of root.querySelectorAll<HTMLButtonElement>("[data-surface-treatment]")) {
      b.setAttribute("aria-checked", String(b.dataset.surfaceTreatment === (state.surfaceTreatments[state.surface.dataset] ?? "classes")));
    }
    // Points.
    pointCount.textContent = `${state.points.length} of ${MAX_POINTS}`;
    $<HTMLElement>(".points-clear").hidden = !state.points.length;
    const full = state.points.length >= MAX_POINTS;
    for (const chip of catalogue.querySelectorAll<HTMLButtonElement>(".chip")) {
      const on = state.points.includes(chip.dataset.layer as LayerId);
      chip.setAttribute("aria-pressed", String(on));
      chip.classList.toggle("is-capped", full && !on);
    }
    renderActive();
    // Basemap.
    for (const b of root.querySelectorAll<HTMLButtonElement>("[data-basemap]")) b.setAttribute("aria-checked", String(b.dataset.basemap === state.basemap));
    for (const b of root.querySelectorAll<HTMLButtonElement>("[data-preset]")) b.setAttribute("aria-checked", String(b.dataset.preset === state.preset));
    $<HTMLInputElement>('[data-toggle="roads"]').checked = state.roads;
    $<HTMLInputElement>('[data-toggle="labels"]').checked = state.labels;
    renderCrops();
    // Election.
    for (const input of root.querySelectorAll<HTMLInputElement>('input[name="eview"]')) input.checked = input.value === state.electionView;
    for (const b of root.querySelectorAll<HTMLButtonElement>("[data-layout]")) b.setAttribute("aria-checked", String(b.dataset.layout === state.electionLayout));
    $<HTMLElement>(".pick-note").hidden = state.electionView !== "pick";
  };

  window.addEventListener("atlas:change", (event) => {
    const detail = (event as CustomEvent<AtlasChange>).detail;
    state = detail.state;
    render(detail.legend);
  });
  window.addEventListener("atlas:counts", (event) => {
    counts = (event as CustomEvent<AtlasCounts>).detail.counts;
    renderActive();
  });
  window.addEventListener("atlas:crops", (event) => {
    cropDetail = (event as CustomEvent<CropPanelDetail>).detail;
    renderCrops();
  });
  render("");

  // ---------------------------------------------------------------- inputs

  root.addEventListener("click", (event) => {
    const t = event.target as HTMLElement;
    const mode = t.closest<HTMLElement>("[data-mode]")?.dataset.mode;
    if (mode === "atlas" || mode === "election") { atlas.setMode(mode); return; }
    const chip = t.closest<HTMLButtonElement>(".chip");
    if (chip && isLayerId(chip.dataset.layer)) {
      atlas.setPoint(chip.dataset.layer, chip.getAttribute("aria-pressed") !== "true");
      return;
    }
    const remove = t.closest<HTMLButtonElement>(".ap-remove");
    if (remove && isLayerId(remove.dataset.layer)) { atlas.setPoint(remove.dataset.layer, false); return; }
    if (t.closest(".ap-treatment")) return;
    if (t.closest(".points-clear")) { atlas.clearPoints(); return; }
    const surfaceTreatment = t.closest<HTMLElement>("[data-surface-treatment]")?.dataset.surfaceTreatment;
    if (surfaceTreatment === "classes" || surfaceTreatment === "continuous") {
      atlas.setSurfaceTreatment(state.surface.dataset, surfaceTreatment as SurfaceTreatment);
      return;
    }
    const base = t.closest<HTMLButtonElement>("button[data-basemap]")?.dataset.basemap;
    if (base) { atlas.setBasemap(base as BasemapId); return; }
    const preset = t.closest<HTMLElement>("[data-preset]")?.dataset.preset;
    if (preset) { atlas.setPreset(preset as StylePresetId); atlas.setBasemap("auto"); return; }
    const layout = t.closest<HTMLElement>("[data-layout]")?.dataset.layout;
    if (layout === "map" || layout === "hex") { atlas.setElectionLayout(layout); return; }
    if (t.closest(".restore-fly")) atlas.flyToRestore();
  });
  root.addEventListener("change", (event) => {
    const t = event.target as HTMLInputElement | HTMLSelectElement;
    if (t.name === "surface") atlas.setSurface({ kind: t.value as SurfaceKind, dataset: state.surface.dataset });
    else if (t instanceof HTMLSelectElement && t.dataset.treatment && isLayerId(t.dataset.treatment)) atlas.setPointTreatment(t.dataset.treatment, t.value as PointTreatment);
    else if (t === select && isLayerId(select.value)) atlas.setSurface({ ...state.surface, dataset: select.value });
    else if (t.name === "eview") atlas.setElectionView(t.value as ElectionView);
    else if (t instanceof HTMLInputElement && t.dataset.toggle === "roads") atlas.setRoads(t.checked);
    else if (t instanceof HTMLInputElement && t.dataset.toggle === "labels") atlas.setLabels(t.checked);
    else if (t instanceof HTMLInputElement && t.dataset.toggle === "crops") atlas.setCrops(t.checked);
  });

  const openBefore = new Map<HTMLDetailsElement, boolean>();
  filter.addEventListener("input", () => {
    const q = filter.value.trim().toLowerCase();
    if (q && openBefore.size === 0) for (const d of groups) openBefore.set(d, d.open);
    for (const details of groups) {
      let matches = 0;
      for (const chip of details.querySelectorAll<HTMLButtonElement>(".chip")) {
        const hit = !q || (chip.dataset.label ?? "").includes(q);
        chip.hidden = !hit;
        if (hit) matches += 1;
      }
      details.hidden = Boolean(q) && matches === 0;
      if (q) details.open = matches > 0;
    }
    if (!q) { for (const [d, open] of openBefore) d.open = open; openBefore.clear(); }
  });

  let dialog: HTMLDialogElement | null = null;
  $<HTMLButtonElement>(".about-link").addEventListener("click", () => { dialog ??= aboutDialog(); dialog.showModal(); });

  // The 0.9 MB endorsement bundle only loads once Election mode is opened.
  let votingLoaded = false;
  const loadVotingText = () => {
    if (votingLoaded) return;
    votingLoaded = true;
    void loadVotingBundle().then((bundle) => {
    const avg = bundle.national?.rolling_average;
    $<HTMLElement>(".voting-vi").textContent = avg
      ? `National VI (rolling ${avg.n}): Lab ${avg.lab ?? "–"}% · Con ${avg.con ?? "–"}% · Ref ${avg.ref ?? "–"}% · LD ${avg.ld ?? "–"}% · Grn ${avg.grn ?? "–"}% · RB ${avg.rb ?? "–"}%`
      : "National VI unavailable";
    $<HTMLElement>(".voting-updated").textContent = formatPollsUpdated(bundle.endorsements.retrieved_at || bundle.national?.retrieved_at);
    }).catch(() => { $<HTMLElement>(".voting-vi").textContent = "National VI unavailable"; });
  };
  window.addEventListener("atlas:change", (event) => {
    if ((event as CustomEvent<AtlasChange>).detail.state.mode === "election") loadVotingText();
  });

  // ---------------------------------------------------------------- desktop collapse / mobile sheet

  const narrow = window.matchMedia("(max-width: 860px)");
  const DETENTS: Detent[] = ["peek", "half", "full"];
  const setDetent = (d: Detent) => {
    root.dataset.detent = d;
    toggle.setAttribute("aria-expanded", String(d !== "peek"));
    requestAnimationFrame(() => {
      const h = narrow.matches ? root.getBoundingClientRect().height : 0;
      document.documentElement.style.setProperty("--sheet-h", `${Math.round(h)}px`);
    });
  };
  setDetent("peek");
  narrow.addEventListener("change", () => setDetent((root.dataset.detent as Detent) ?? "peek"));

  toggle.addEventListener("click", () => {
    if (narrow.matches) {
      const i = DETENTS.indexOf((root.dataset.detent as Detent) ?? "peek");
      setDetent(i === 0 ? "half" : "peek");
      return;
    }
    const collapsed = root.classList.toggle("collapsed");
    toggle.setAttribute("aria-expanded", String(!collapsed));
  });

  const grab = $<HTMLElement>(".sheet-grab");
  let startY: number | null = null;
  grab.addEventListener("pointerdown", (e) => { startY = e.clientY; grab.setPointerCapture(e.pointerId); });
  grab.addEventListener("pointerup", (e) => {
    if (startY == null) return;
    const dy = e.clientY - startY;
    startY = null;
    const i = DETENTS.indexOf((root.dataset.detent as Detent) ?? "peek");
    if (Math.abs(dy) < 8) setDetent(DETENTS[(i + 1) % DETENTS.length]);
    else setDetent(DETENTS[Math.max(0, Math.min(DETENTS.length - 1, i + (dy < 0 ? 1 : -1)))]);
  });
  grab.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    const i = DETENTS.indexOf((root.dataset.detent as Detent) ?? "peek");
    setDetent(DETENTS[(i + 1) % DETENTS.length]);
  });
  window.addEventListener("atlas:change", () => setDetent((root.dataset.detent as Detent) ?? "peek"));
}
