/**
 * Equal-area seat cartogram: one hexagon per Westminster seat (odileeds/hexmaps
 * 2023 layout, MIT; same positions as the 2024 layout). Rendered as SVG over the
 * map when Election mode is in "Hex" layout.
 */
interface HexFile {
  layout: "odd-r" | "even-r" | "odd-q" | "even-q";
  hexes: Record<string, { n: string; q: number; r: number }>;
}

export interface HexCell {
  code: string;
  name: string;
  x: number;
  y: number;
}

export interface HexMapOptions {
  colorOf: (code: string) => { fill: string; opacity: number } | null;
  tooltipOf: (code: string, name: string) => string;
  onSelect: (code: string) => void;
}

export interface HexMap {
  show: () => void;
  hide: () => void;
  /** Recolour after the election view or data changes. */
  refresh: () => void;
  select: (code: string | null) => void;
}

const SQRT3 = Math.sqrt(3);

/** Pointy-top centres; rows flip so larger r (north) is drawn higher. */
export function layoutHexes(file: HexFile): HexCell[] {
  const odd = file.layout === "odd-r";
  return Object.entries(file.hexes).map(([code, h]) => {
    const shifted = (h.r & 1) === (odd ? 1 : 0);
    return { code, name: h.n, x: SQRT3 * (h.q + (shifted ? 0.5 : 0)), y: -1.5 * h.r };
  });
}

function hexPath(x: number, y: number, size: number): string {
  let d = "";
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    d += `${i ? "L" : "M"}${(x + Math.cos(a) * size).toFixed(2)},${(y + Math.sin(a) * size).toFixed(2)}`;
  }
  return `${d}Z`;
}

export function mountHexMap(parent: HTMLElement, options: HexMapOptions): HexMap {
  const root = document.createElement("div");
  root.className = "hexmap";
  root.hidden = true;
  root.innerHTML = `<svg role="img" aria-label="Hex map: one hexagon per Westminster seat"></svg><div class="hexmap-tip" hidden></div>` +
    `<p class="hexmap-note">One hexagon per seat · Northern Ireland not covered · layout: Open Innovations (MIT)</p>`;
  parent.append(root);
  const svg = root.querySelector("svg")!;
  const tip = root.querySelector<HTMLElement>(".hexmap-tip")!;
  let cells: HexCell[] = [];
  const paths = new Map<string, SVGPathElement>();
  let selected: string | null = null;

  const paint = () => {
    for (const cell of cells) {
      const path = paths.get(cell.code);
      if (!path) continue;
      const c = options.colorOf(cell.code);
      path.setAttribute("fill", c?.fill ?? "#e3e6ea");
      path.setAttribute("fill-opacity", String(c?.opacity ?? 1));
      path.classList.toggle("is-empty", !c);
      path.classList.toggle("is-selected", cell.code === selected);
    }
  };

  const ready = fetch("/data/hexmap-pcon.json")
    .then((r) => r.json() as Promise<HexFile>)
    .then((file) => {
      cells = layoutHexes(file);
      const xs = cells.map((c) => c.x), ys = cells.map((c) => c.y);
      const [x0, x1, y0, y1] = [Math.min(...xs) - 1, Math.max(...xs) + 1, Math.min(...ys) - 1, Math.max(...ys) + 1];
      svg.setAttribute("viewBox", `${x0} ${y0} ${x1 - x0} ${y1 - y0}`);
      const frag = document.createDocumentFragment();
      for (const cell of cells) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", hexPath(cell.x, cell.y, 0.96));
        path.dataset.code = cell.code;
        path.dataset.name = cell.name;
        path.setAttribute("tabindex", "-1");
        paths.set(cell.code, path);
        frag.append(path);
      }
      svg.append(frag);
      paint();
    })
    .catch((err) => console.warn("Hex map unavailable", err));

  const target = (event: Event) => (event.target as Element | null)?.closest<SVGPathElement>("path[data-code]");
  svg.addEventListener("pointermove", (event) => {
    const path = target(event);
    if (!path) { tip.hidden = true; return; }
    tip.innerHTML = options.tooltipOf(path.dataset.code!, path.dataset.name!);
    tip.hidden = false;
    const box = root.getBoundingClientRect();
    tip.style.left = `${Math.min(box.width - 220, event.clientX - box.left + 14)}px`;
    tip.style.top = `${event.clientY - box.top + 14}px`;
  });
  svg.addEventListener("pointerleave", () => { tip.hidden = true; });
  svg.addEventListener("click", (event) => {
    const path = target(event);
    if (path && !path.classList.contains("is-empty")) options.onSelect(path.dataset.code!);
  });

  return {
    show: () => { root.hidden = false; void ready.then(paint); },
    hide: () => { root.hidden = true; tip.hidden = true; },
    refresh: () => { void ready.then(paint); },
    select: (code) => { selected = code; paint(); },
  };
}
