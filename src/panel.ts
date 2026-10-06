import { ICONS } from "./icons";
import { LAYERS, isLayerId, type LayerDef, type LayerId } from "./layers";
import { LAYER_SECTIONS } from "./layer-groups";
import { ENDORSE_COLORS } from "./endorse";
import { formatPollsUpdated, loadVotingBundle } from "./voting";

const DATA_CREDITS: Array<[string, string]> = [
  ["Basemap", "OpenFreeMap · © OpenMapTiles · data © OpenStreetMap contributors (ODbL)"],
  ["Hillshade", "© Esri, USGS, NOAA (World Hillshade)"],
  ["Points of interest", "© OpenStreetMap contributors (ODbL 1.0): petrol, EV, power, hospitals, emergency services, heritage, culture, leisure, faith, services and post offices"],
  ["Constituencies", "ONS July 2024 BGC boundaries. Contains OS data © Crown copyright and database right 2024; contains National Statistics data © Crown copyright and database right 2024 (OGL v3.0)"],
  ["Candidates", "© Democracy Club (CC-BY-SA)"],
  ["Polls", "Wikipedia national polling, Electoral Calculus and More in Common seat projections. Projections are projections."],
  ["Sample layers", "Roads, schools, churches, mosques, population, census and the Upcoming layers use sample geometry, not real data. Pubs are a real OpenStreetMap layer."],
];

function chipButton(layer: LayerDef, on: boolean): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "chip";
  button.dataset.layer = layer.id;
  button.dataset.label = layer.label.toLowerCase();
  button.title = layer.blurb;
  button.setAttribute("aria-pressed", on ? "true" : "false");
  button.style.setProperty("--accent", layer.accent);
  button.style.setProperty("--tint", layer.tint);
  button.innerHTML = `<span class="chip-icon">${layer.icon}</span><span class="chip-label">${layer.label}</span>`;
  return button;
}

function section(label: string, count: number, open = false, extraClass = ""): {
  details: HTMLDetailsElement;
  grid: HTMLDivElement;
} {
  const details = document.createElement("details");
  details.className = `group${extraClass ? ` ${extraClass}` : ""}`;
  details.open = open;
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
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  document.body.append(dialog);
  return dialog;
}

export function mountPanel(
  root: HTMLElement,
  options: {
    isOn: (id: LayerId) => boolean;
    setOn: (id: LayerId, on: boolean) => void;
    onRestore?: () => void;
  },
): void {
  root.innerHTML = `
    <button class="panel-toggle" type="button" aria-expanded="true" aria-controls="layer-body">
      <span class="panel-title">${ICONS.layers}<span>Layers</span></span>
      <span class="chevron">${ICONS.chevron}</span>
    </button>
    <p class="panel-sub" id="layer-status"><span class="status-count"></span><button type="button" class="status-clear">Clear</button></p>
    <div class="panel-body" id="layer-body"></div>
  `;

  if (window.matchMedia("(max-width: 860px)").matches) {
    root.classList.add("collapsed");
    root.querySelector(".panel-toggle")?.setAttribute("aria-expanded", "false");
  }

  const body = root.querySelector<HTMLElement>("#layer-body");
  const count = root.querySelector<HTMLElement>(".status-count");
  const clear = root.querySelector<HTMLButtonElement>(".status-clear");
  const toggle = root.querySelector<HTMLButtonElement>(".panel-toggle");
  if (!body || !count || !clear || !toggle) return;

  // Filter (fix 6).
  const filter = document.createElement("input");
  filter.type = "search";
  filter.className = "layer-filter";
  filter.placeholder = "Filter layers…";
  filter.setAttribute("aria-label", "Filter layers");
  filter.autocomplete = "off";
  filter.spellcheck = false;

  // Pinned Voting section, expanded by default.
  const constituencies = LAYERS.find((layer) => layer.id === "constituencies")!;
  const voting = section("Voting", 1, true, "group-voting");
  voting.details.querySelector(".group-count")?.remove();
  const votingChip = chipButton(constituencies, options.isOn("constituencies"));
  votingChip.classList.add("chip-wide");
  voting.grid.append(votingChip);
  const votingBox = document.createElement("div");
  votingBox.className = "voting-strip";
  votingBox.innerHTML = `
    <div class="voting-legend" role="group" aria-label="Endorsement legend">
      <span class="vote-legend-item"><span class="vote-swatch" style="background:${ENDORSE_COLORS.reform.fill};opacity:0.6"></span>Reform <span class="vote-count" data-count="reform">–</span></span>
      <span class="vote-legend-sep" aria-hidden="true">·</span>
      <button type="button" class="vote-legend-item vote-legend-restore" title="Fly to the Restore seat"><span class="vote-swatch" style="background:${ENDORSE_COLORS.restore.fill}"></span>Restore <span class="vote-count" data-count="restore">–</span></button>
    </div>
    <p class="voting-vi" id="national-vi">National VI loading…</p>
    <p class="voting-disclaimer"><strong>Editorial endorsement map</strong>: partisan Reform / Restore Britain guide. Never Labour or Conservatives. Not Electoral Commission advice. Projections are projections.</p>
    <p class="voting-updated" id="polls-updated"></p>
  `;
  votingBox.querySelector(".vote-legend-restore")?.addEventListener("click", () => {
    if (!options.isOn("constituencies")) {
      votingChip.setAttribute("aria-pressed", "true");
      options.setOn("constituencies", true);
      refreshStatus();
    }
    options.onRestore?.();
  });
  voting.details.append(votingBox);

  // Grouped sections, collapsed by default with counts.
  const groups: HTMLDetailsElement[] = [];
  for (const def of LAYER_SECTIONS) {
    const layers = def.layers.map((id) => LAYERS.find((layer) => layer.id === id)!).filter(Boolean);
    const group = section(def.label, layers.length);
    group.details.dataset.section = def.id;
    for (const layer of layers) group.grid.append(chipButton(layer, options.isOn(layer.id)));
    groups.push(group.details);
  }
  const upcomingLayers = LAYERS.filter((layer) => layer.group === "upcoming");
  const upcoming = section("Upcoming", upcomingLayers.length, false, "group-upcoming");
  for (const layer of upcomingLayers) upcoming.grid.append(chipButton(layer, options.isOn(layer.id)));
  groups.push(upcoming.details);

  // About the data (fix 10): one link instead of a 90-word credits paragraph.
  const about = document.createElement("button");
  about.type = "button";
  about.className = "about-link";
  about.innerHTML = `About the data <span aria-hidden="true">↗</span>`;
  let dialog: HTMLDialogElement | null = null;
  about.addEventListener("click", () => {
    dialog ??= aboutDialog();
    dialog.showModal();
  });

  body.append(filter, voting.details, ...groups, about);

  void loadVotingBundle().then((bundle) => {
    const vi = votingBox.querySelector<HTMLElement>("#national-vi");
    const updated = votingBox.querySelector<HTMLElement>("#polls-updated");
    for (const el of votingBox.querySelectorAll<HTMLElement>("[data-count]")) {
      const n = bundle.endorsements.counts[el.dataset.count ?? ""];
      el.textContent = typeof n === "number" ? String(n) : "–";
    }
    const avg = bundle.national?.rolling_average;
    if (vi && avg) {
      const rb = avg.rb != null ? ` · RB ${avg.rb}%` : " · RB –";
      vi.textContent = `National VI (rolling ${avg.n}): Lab ${avg.lab ?? "–"}% · Con ${avg.con ?? "–"}% · Ref ${avg.ref ?? "–"}% · LD ${avg.ld ?? "–"}% · Grn ${avg.grn ?? "–"}%${rb}`;
    } else if (vi) {
      vi.textContent = "National VI unavailable";
    }
    if (updated) {
      updated.textContent = formatPollsUpdated(bundle.endorsements.retrieved_at || bundle.national?.retrieved_at);
    }
  }).catch(() => {
    const vi = votingBox.querySelector<HTMLElement>("#national-vi");
    if (vi) vi.textContent = "National VI unavailable";
  });

  const chips = () => [...body.querySelectorAll<HTMLButtonElement>(".chip")];

  // "N layers on · Clear" (fix 6).
  const refreshStatus = () => {
    const n = LAYERS.filter((layer) => options.isOn(layer.id)).length;
    count.textContent = `${n} layer${n === 1 ? "" : "s"} on`;
    clear.hidden = n === 0;
    count.classList.toggle("is-off", n === 0);
  };
  refreshStatus();

  clear.addEventListener("click", () => {
    for (const chip of chips()) {
      const id = chip.dataset.layer;
      if (!isLayerId(id) || !options.isOn(id)) continue;
      chip.setAttribute("aria-pressed", "false");
      options.setOn(id, false);
    }
    refreshStatus();
  });

  const openBefore = new Map<HTMLDetailsElement, boolean>();
  filter.addEventListener("input", () => {
    const q = filter.value.trim().toLowerCase();
    const all = [voting.details, ...groups];
    if (q && openBefore.size === 0) for (const d of all) openBefore.set(d, d.open);
    for (const details of all) {
      let matches = 0;
      for (const chip of details.querySelectorAll<HTMLButtonElement>(".chip")) {
        const hit = !q || (chip.dataset.label ?? "").includes(q);
        chip.hidden = !hit;
        if (hit) matches += 1;
      }
      details.hidden = Boolean(q) && matches === 0;
      if (q) details.open = matches > 0;
    }
    votingBox.hidden = Boolean(q);
    if (!q) {
      for (const [d, open] of openBefore) d.open = open;
      openBefore.clear();
    }
  });

  body.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(".chip");
    const id = button?.dataset.layer;
    if (!button || !isLayerId(id)) return;
    const next = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", next ? "true" : "false");
    options.setOn(id, next);
    refreshStatus();
  });

  // Voting view pauses context layers on the map; dim their chips so state stays honest.
  window.addEventListener("atlas:voting-mode", (event) => {
    const paused = new Set((event as CustomEvent<{ paused: string[] }>).detail?.paused ?? []);
    for (const chip of chips()) {
      if (paused.has(chip.dataset.layer ?? "")) {
        chip.dataset.paused = "true";
        chip.title = "Paused in voting view";
      } else {
        delete chip.dataset.paused;
        const layer = LAYERS.find((item) => item.id === chip.dataset.layer);
        if (layer) chip.title = layer.blurb;
      }
    }
  });

  toggle.addEventListener("click", () => {
    const collapsed = root.classList.toggle("collapsed");
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  });
}
