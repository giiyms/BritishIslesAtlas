import "maplibre-gl/dist/maplibre-gl.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "./style.css";
import { createAtlas } from "./map";
import { mountPanel } from "./panel";
import { mountScale } from "./scale";
import { mountSearch } from "./search";
import { mountElectionUI } from "./election-ui";

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

const atlas = createAtlas(mapNode);
mountElectionUI((code) => atlas.openSeat(code));
mountPanel(panel, { isOn: atlas.isOn, setOn: atlas.setLayer, onRestore: atlas.flyToRestore, getDensityStyle: atlas.getDensityStyle, setDensityStyle: atlas.setDensityStyle });
mountScale(scale, atlas.map);
mountSearch(search, (hit) => {
  // "What do I vote here?": a postcode hit opens its seat popup once the camera lands.
  // Registered before show() so a zero-duration (reduced-motion) jump still triggers it.
  atlas.map.once("moveend", () => {
    const feature = atlas.map.getLayer("constituencies") ? atlas.map.queryRenderedFeatures(atlas.map.project([hit.lon, hit.lat]), { layers: ["constituencies"] })[0] : undefined;
    const code = hit.seatCode || String(feature?.properties?.PCON24CD ?? "");
    if (code) atlas.openSeat(code, [hit.lon, hit.lat]);
  });
  atlas.show(hit);
});

zoomIn.addEventListener("click", () => atlas.zoomIn());
zoomOut.addEventListener("click", () => atlas.zoomOut());
home.addEventListener("click", () => atlas.home());

// Screenshot harness hook (?capture=1 only).
if (new URLSearchParams(location.search).has("capture")) {
  (window as unknown as { __atlas: unknown }).__atlas = atlas;
}
