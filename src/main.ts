import "maplibre-gl/dist/maplibre-gl.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "./style.css";
import { createAtlas, type AtlasChange } from "./map";
import { mountPanel } from "./panel";
import { mountScale } from "./scale";
import { mountSearch } from "./search";
import { decodeState, encodeState } from "./state";

const mapNode = document.querySelector<HTMLElement>("#map");
const panel = document.querySelector<HTMLElement>("#layers");
const search = document.querySelector<HTMLFormElement>("#search");
const scale = document.querySelector<HTMLElement>("#scale");
const zoomIn = document.querySelector<HTMLButtonElement>("#zoom-in");
const zoomOut = document.querySelector<HTMLButtonElement>("#zoom-out");
const home = document.querySelector<HTMLButtonElement>("#home");

if (!mapNode || !panel || !search || !scale || !zoomIn || !zoomOut || !home) {
  throw new Error("Atlas markup is missing");
}

const atlas = createAtlas(mapNode, decodeState(location.hash));
mountPanel(panel, atlas);
mountScale(scale, atlas.map);
mountSearch(search, (hit) => {
  // "What do I vote here?": a postcode hit opens its seat once the camera lands.
  if (hit.seatCode) {
    const code = hit.seatCode;
    atlas.map.once("moveend", () => atlas.openSeat(code, [hit.lon, hit.lat]));
  }
  atlas.show(hit);
});

zoomIn.addEventListener("click", () => atlas.zoomIn());
zoomOut.addEventListener("click", () => atlas.zoomOut());
home.addEventListener("click", () => atlas.home());

// Shareable state: the hash mirrors mode, surface, points and basemap.
window.addEventListener("atlas:change", (event) => {
  const hash = encodeState((event as CustomEvent<AtlasChange>).detail.state);
  history.replaceState(null, "", hash ? `#${hash}` : location.pathname + location.search);
});

// Screenshot harness hook (?capture=1 only).
if (new URLSearchParams(location.search).has("capture")) {
  (window as unknown as { __atlas: unknown }).__atlas = atlas;
}
