import { ICONS } from "./icons";
import { LAYERS, isLayerId, type LayerId } from "./layers";
import { formatPollsUpdated, loadVotingBundle } from "./voting";

export function mountPanel(
  root: HTMLElement,
  options: {
    isOn: (id: LayerId) => boolean;
    setOn: (id: LayerId, on: boolean) => void;
  },
): void {
  root.innerHTML = `
    <button class="panel-toggle" type="button" aria-expanded="true" aria-controls="layer-body">
      <span class="panel-title">${ICONS.layers}<span>Layers</span></span>
      <span class="chevron">${ICONS.chevron}</span>
    </button>
    <p class="panel-sub" id="layer-status">Data layers · <span class="status-value">ON</span></p>
    <div class="panel-body" id="layer-body"></div>
  `;

  if (window.matchMedia("(max-width: 860px)").matches) {
    root.classList.add("collapsed");
    root.querySelector(".panel-toggle")?.setAttribute("aria-expanded", "false");
  }

  const body = root.querySelector<HTMLElement>("#layer-body");
  const status = root.querySelector<HTMLElement>(".status-value");
  const toggle = root.querySelector<HTMLButtonElement>(".panel-toggle");
  if (!body || !status || !toggle) return;

  const dataGrid = document.createElement("div");
  dataGrid.className = "chip-grid";
  dataGrid.setAttribute("role", "group");
  dataGrid.setAttribute("aria-label", "Data layers");
  dataGrid.setAttribute("aria-describedby", "layer-status");
  const upcoming = document.createElement("details");
  upcoming.className = "group";
  const upcomingLabel = document.createElement("summary");
  upcomingLabel.className = "group-label";
  upcomingLabel.textContent = "Upcoming";
  const upcomingGrid = document.createElement("div");
  upcomingGrid.className = "chip-grid";
  upcomingGrid.setAttribute("role", "group");
  upcomingGrid.setAttribute("aria-label", "Upcoming layers");
  upcomingGrid.setAttribute("aria-describedby", "layer-status");
  const note = document.createElement("p");
  note.className = "panel-note";
  note.textContent = "Petrol, EV, power, hospitals, fire stations, police, castles, libraries, universities, museums, railway stations, aerodromes, ferry terminals, marinas, zoos, theatres, battlefields, cinemas, stadiums, theme parks, viewpoints, arts centres, aquariums, piers, ruins, golf courses, galleries, marketplaces, nature reserves, camp sites, memorials, sports centres, caravan sites, fitness centres, community centres, playgrounds, beaches, swimming pools, pharmacies, town halls, places of worship, lighthouses, courthouses, nightclubs, windmills, prisons, clinics, dentists, and post offices: © OpenStreetMap contributors (ODbL). Constituencies: ONS July 2024 BGC (OGL v3; contains OS + National Statistics data © Crown copyright). Candidates © Democracy Club (CC-BY-SA). Polls: Wikipedia / Electoral Calculus / More in Common (projections). Other layers are preview geometry.";

  const votingBox = document.createElement("div");
  votingBox.className = "voting-strip";
  votingBox.innerHTML = `
    <p class="voting-disclaimer"><strong>Editorial endorsement map</strong> — partisan Reform / Restore Britain guide. Never Labour or Conservatives. Not Electoral Commission advice. Projections are projections.</p>
    <p class="voting-vi" id="national-vi">National VI loading…</p>
    <p class="voting-updated" id="polls-updated"></p>
  `;

  for (const layer of LAYERS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.dataset.layer = layer.id;
    button.title = layer.blurb;
    button.setAttribute("aria-pressed", options.isOn(layer.id) ? "true" : "false");
    button.style.setProperty("--accent", layer.accent);
    button.style.setProperty("--tint", layer.tint);
    button.innerHTML = `<span class="chip-icon">${layer.icon}</span><span class="chip-label">${layer.label}</span>`;
    (layer.group === "data" ? dataGrid : upcomingGrid).append(button);
  }

  upcoming.append(upcomingLabel, upcomingGrid);
  body.append(dataGrid, upcoming, votingBox, note);
  void loadVotingBundle().then((bundle) => {
    const vi = votingBox.querySelector<HTMLElement>("#national-vi");
    const updated = votingBox.querySelector<HTMLElement>("#polls-updated");
    const avg = bundle.national?.rolling_average;
    if (vi && avg) {
      const rb = avg.rb != null ? ` · RB ${avg.rb}%` : " · RB —";
      vi.textContent = `National VI (rolling ${avg.n}): Lab ${avg.lab ?? "—"}% · Con ${avg.con ?? "—"}% · Ref ${avg.ref ?? "—"}% · LD ${avg.ld ?? "—"}% · Grn ${avg.grn ?? "—"}%${rb}`;
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

  const refreshStatus = () => {
    const anyOn = LAYERS.some((layer) => layer.group === "data" && options.isOn(layer.id));
    status.textContent = anyOn ? "ON" : "OFF";
    status.classList.toggle("is-off", !anyOn);
  };
  refreshStatus();

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
    for (const chip of body.querySelectorAll<HTMLButtonElement>(".chip")) {
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
