import { ICONS } from "./icons";
import { LAYERS, type LayerId } from "./layers";

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

  const body = root.querySelector<HTMLElement>("#layer-body");
  const status = root.querySelector<HTMLElement>(".status-value");
  const toggle = root.querySelector<HTMLButtonElement>(".panel-toggle");
  if (!body || !status || !toggle) return;

  const dataGrid = document.createElement("div");
  dataGrid.className = "chip-grid";
  const upcomingLabel = document.createElement("p");
  upcomingLabel.className = "group-label";
  upcomingLabel.textContent = "Upcoming";
  const upcomingGrid = document.createElement("div");
  upcomingGrid.className = "chip-grid";
  const note = document.createElement("p");
  note.className = "panel-note";
  note.textContent = "Preview geometry. Live datasets come later.";

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

  body.append(dataGrid, upcomingLabel, upcomingGrid, note);

  const refreshStatus = () => {
    const anyOn = LAYERS.some((layer) => layer.group === "data" && options.isOn(layer.id));
    status.textContent = anyOn ? "ON" : "OFF";
    status.classList.toggle("is-off", !anyOn);
  };
  refreshStatus();

  body.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(".chip");
    if (!button?.dataset.layer) return;
    const id = button.dataset.layer as LayerId;
    const next = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", next ? "true" : "false");
    options.setOn(id, next);
    refreshStatus();
  });

  toggle.addEventListener("click", () => {
    const collapsed = root.classList.toggle("collapsed");
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  });
}
