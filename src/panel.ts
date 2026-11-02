import { ICONS } from "./icons";
import { LAYERS, isLayerId, type LayerDef, type LayerId } from "./layers";
import { LAYER_SECTIONS } from "./layer-groups";

const DATA_CREDITS: Array<[string, string]> = [
  ["Basemap", "OpenFreeMap · © OpenMapTiles · data © OpenStreetMap contributors (ODbL)"],
  ["Hillshade", "© Esri, USGS, NOAA (World Hillshade)"],
  ["Points of interest", "© OpenStreetMap contributors (ODbL 1.0): petrol, EV, power, hospitals, emergency services, heritage, culture, leisure, faith, services and post offices"],
  ["Constituencies", "ONS July 2024 BGC boundaries. Contains OS data © Crown copyright and database right 2024; contains National Statistics data © Crown copyright and database right 2024 (OGL v3.0)"],
  ["Wind turbines", "© OpenStreetMap contributors (ODbL 1.0); farm cross-check: DESNZ Renewable Energy Planning Database, July 2026, contains public sector information licensed under the Open Government Licence v3.0"],
  ["Candidates", "© Democracy Club (CC-BY-SA)"],
  ["Polls", "Wikipedia national polling, Electoral Calculus and More in Common seat projections. Projections are projections."],
  ["Place card ratings", "Food hygiene: Food Standards Agency FHRS/FHIS (live API, OGL v3.0); health and care: Care Quality Commission ratings, 1 Oct 2026 (OGL v3.0). Fuel prices not shown: DESNZ Fuel Finder needs One Login credentials."],
  ["Place card photos", "Wikimedia Commons, Wikipedia and Geograph Britain and Ireland; author and licence shown on each photo"],
  ["Sample layers", "Roads, schools, population, census and the remaining Upcoming layers use sample geometry, not real data. Churches, mosques and other religious sites are the OpenStreetMap places-of-worship extract split by religion."],
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

function section(label: string, layers: LayerDef[], open = false, extraClass = ""): {
  details: HTMLDetailsElement;
  grid: HTMLDivElement;
} {
  const details = document.createElement("details");
  details.className = `group${extraClass ? ` ${extraClass}` : ""}`;
  details.open = open;
  // The section's own colour: its first layer's concept-1 accent.
  if (layers[0]) details.style.setProperty("--group-accent", layers[0].accent);
  const summary = document.createElement("summary");
  summary.className = "group-label";
  // Folded state still says what is on: coloured dots of the enabled layers plus an "N on" badge.
  summary.innerHTML =
    `<span class="group-caret" aria-hidden="true"></span><span class="group-name"></span>` +
    `<span class="group-dots" aria-hidden="true"></span><span class="group-count"></span>`;
  summary.querySelector(".group-name")!.textContent = label;
  const grid = document.createElement("div");
  grid.className = "chip-grid";
  grid.setAttribute("role", "group");
  grid.setAttribute("aria-label", `${label} layers`);
  details.append(summary, grid);
  return { details, grid };
}

const MAX_DOTS = 4;
/** Updates one section's summary from the chips it holds. */
function refreshGroup(details: HTMLDetailsElement): void {
  const chips = [...details.querySelectorAll<HTMLButtonElement>(".chip")];
  const on = chips.filter((chip) => chip.getAttribute("aria-pressed") === "true");
  const count = details.querySelector<HTMLElement>(".group-count");
  const dots = details.querySelector<HTMLElement>(".group-dots");
  details.classList.toggle("has-on", on.length > 0);
  if (count) {
    count.textContent = on.length ? `${on.length} on` : String(chips.length);
    // Spoken with the section name, e.g. "Health & emergency, 2 of 8 layers on".
    count.setAttribute("aria-label", on.length ? `, ${on.length} of ${chips.length} layers on` : `, ${chips.length} layers`);
  }
  if (dots) {
    dots.replaceChildren(...on.slice(0, MAX_DOTS).map((chip) => {
      const dot = document.createElement("i");
      dot.style.setProperty("--accent", chip.style.getPropertyValue("--accent"));
      return dot;
    }));
    if (on.length > MAX_DOTS) dots.append(Object.assign(document.createElement("b"), { textContent: `+${on.length - MAX_DOTS}` }));
  }
}

function aboutDialog(): HTMLDialogElement {
  const dialog = document.createElement("dialog");
  dialog.className = "about-data";
  dialog.setAttribute("aria-labelledby", "about-data-title");
  dialog.innerHTML =
    `<div class="about-head"><h2 id="about-data-title">About the data</h2>` +
    `<button type="button" class="about-close" aria-label="Close About the data">×</button></div>` +
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
    <p class="panel-sub" id="layer-status"><span class="status-count" role="status"></span><button type="button" class="status-clear">Clear</button></p>
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
  const voting = section("Voting", [constituencies], true, "group-voting");
  voting.details.querySelector(".group-count")?.remove();
  voting.details.querySelector(".group-dots")?.remove();
  const votingChip = chipButton(constituencies, options.isOn("constituencies"));
  votingChip.classList.add("chip-wide");
  voting.grid.append(votingChip);
  const votingBox = document.createElement("div");
  votingBox.className = "voting-strip";
  votingBox.textContent = "Who to back to stop Labour in each seat, with projections and 2024 results.";
  voting.details.append(votingBox);

  // Grouped sections, collapsed by default with counts.
  const groups: HTMLDetailsElement[] = [];
  for (const def of LAYER_SECTIONS) {
    const layers = def.layers.map((id) => LAYERS.find((layer) => layer.id === id)!).filter(Boolean);
    const group = section(def.label, layers);
    group.details.dataset.section = def.id;
    for (const layer of layers) group.grid.append(chipButton(layer, options.isOn(layer.id)));
    groups.push(group.details);
  }
  const upcomingLayers = LAYERS.filter((layer) => layer.group === "upcoming");
  const upcoming = section("Upcoming", upcomingLayers, false, "group-upcoming");
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

  // Filter stays put while the sections scroll under it.
  const head = document.createElement("div");
  head.className = "panel-sticky";
  head.append(filter);
  body.append(head, voting.details, ...groups, about);

  const chips = () => [...body.querySelectorAll<HTMLButtonElement>(".chip")];

  // "N layers on · Clear" (fix 6).
  const refreshStatus = () => {
    const n = LAYERS.filter((layer) => options.isOn(layer.id)).length;
    count.textContent = `${n} layer${n === 1 ? "" : "s"} on`;
    clear.hidden = n === 0;
    count.classList.toggle("is-off", n === 0);
    for (const details of groups) refreshGroup(details);
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
