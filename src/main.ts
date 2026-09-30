import "maplibre-gl/dist/maplibre-gl.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "./style.css";
import { createAtlas } from "./map";
import { mountPanel } from "./panel";
import { mountScale } from "./scale";
import { mountSearch } from "./search";

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
mountPanel(panel, { isOn: atlas.isOn, setOn: atlas.setLayer });
mountScale(scale, atlas.map);
mountSearch(search, (hit) => {
  atlas.show(hit);
});

zoomIn.addEventListener("click", () => atlas.zoomIn());
zoomOut.addEventListener("click", () => atlas.zoomOut());
home.addEventListener("click", () => atlas.home());
