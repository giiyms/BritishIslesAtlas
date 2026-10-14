import { afterEach, describe, expect, it, vi } from "vitest";
import type { Map as MapLibreMap } from "maplibre-gl";
import { createDensityRenderer } from "./density-renderer";
import manifestRaw from "../public/data/density/pubs-manifest.json?raw";

vi.mock("maplibre-gl", () => ({ Popup: class { remove() {} } }));
function setup(zoom = 5) {
  const element = () => ({ hidden: false, className: "", textContent: "", style: {}, setAttribute() {}, append() {}, replaceChildren() {} });
  vi.stubGlobal("document", { createElement: element });
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
  const layers = new Map<string, { layout: { visibility: string } }>([["pubs", { layout: { visibility: "none" } }]]);
  const dataUrls: string[] = [];
  const sources = new Map<string, unknown>([["pubs", { setData: (url: string) => dataUrls.push(url) }]]);
  let pitch = 0, bearing = 0;
  const map = {
    getLayer: (id: string) => layers.get(id), getSource: (id: string) => sources.get(id),
    addSource: (id: string, value: unknown) => sources.set(id, value),
    addLayer: (layer: { id: string; layout?: { visibility: string } }) => layers.set(layer.id, { layout: layer.layout ?? { visibility: "visible" } }),
    setLayoutProperty: (id: string, _: string, value: string) => { layers.get(id)!.layout.visibility = value; },
    getLayoutProperty: (id: string) => layers.get(id)?.layout.visibility,
    getZoom: () => zoom, setLayerZoomRange() {}, setPaintProperty() {}, on() {},
    getPitch: () => pitch, getBearing: () => bearing, isMoving: () => false,
    easeTo: (opts: { pitch: number; bearing: number }) => { pitch = opts.pitch; bearing = opts.bearing; },
  };
  const errors: string[] = [];
  const renderer = createDensityRenderer(map as unknown as MapLibreMap, element() as unknown as HTMLElement, message => errors.push(message));
  return { renderer, layers, sources, dataUrls, errors, setZoom: (value: number) => { zoom = value; }, pitch: () => pitch, setExternalPitch: (value: number) => { pitch = value; } };
}
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
afterEach(() => vi.unstubAllGlobals());

describe("density lifecycle", () => {
  it("points and heatmap fetch no polygon artifacts, and disabled layers stay hidden", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const { renderer, layers, dataUrls } = setup();
    renderer.update("points", []);
    expect(fetcher).not.toHaveBeenCalled();
    renderer.update("points", ["pubs"]);
    renderer.update("heatmap", ["pubs"]);
    await settle();
    expect(fetcher).not.toHaveBeenCalled();
    expect(dataUrls).toEqual(["/data/pubs.geojson"]);
    expect(layers.get("density-heatmap-pubs")?.layout.visibility).toBe("visible");
    renderer.update("heatmap", []);
    expect([...layers.values()].every(l => l.layout.visibility === "none")).toBe(true);
  });
  it("an old hex fetch cannot hide dots after switching to points", async () => {
    let resolveBand!: (value: unknown) => void;
    const band = new Promise(resolve => { resolveBand = resolve; });
    const fetcher = vi.fn((url: string) => url.endsWith("manifest.json")
      ? Promise.resolve({ ok: true, json: async () => JSON.parse(manifestRaw) })
      : band);
    vi.stubGlobal("fetch", fetcher);
    const { renderer, layers, sources } = setup();
    renderer.update("auto", ["pubs"]);
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(2); // manifest and coarse only
    renderer.update("points", ["pubs"]);
    resolveBand({ ok: true, json: async () => ({ type: "FeatureCollection", features: [] }) });
    await settle();
    expect(layers.get("pubs")?.layout.visibility).toBe("visible");
    expect(sources.has("density-src-pubs-coarse")).toBe(false);
  });
  it.each(["hex", "auto"] as const)("hides reused %s hexes when Auto reaches its dots view", async initialStyle => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith("manifest.json") ? JSON.parse(manifestRaw) : { type: "FeatureCollection", features: [], size_m: 1000, cells: [] } })));
    const { renderer, layers, setZoom } = setup(9);
    renderer.update(initialStyle, ["pubs"]);
    await settle();
    expect(layers.get("density-hex-pubs-fine")?.layout.visibility).toBe("visible");
    setZoom(initialStyle === "hex" ? 12 : 10);
    renderer.update("auto", ["pubs"]);
    await settle();
    expect(layers.get("density-hex-pubs-fine")?.layout.visibility).toBe("none");
    expect(layers.get("pubs")?.layout.visibility).toBe("visible");
  });
  it.each(["contours", "spikes"] as const)("loads local %s geometry at London zoom and hides it on exit", async style => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith("manifest.json") ? JSON.parse(manifestRaw) : { type: "FeatureCollection", features: [], size_m: 1000, cells: [] } })));
    const { renderer, layers, sources } = setup(10.5);
    renderer.update(style, ["pubs"]);
    await settle();
    expect(sources.has(`density-${style}-src-pubs-local`)).toBe(true);
    expect(layers.get(`density-${style}-pubs-local`)?.layout.visibility).toBe("visible");
    renderer.update("points", ["pubs"]);
    expect(layers.get(`density-${style}-pubs-local`)?.layout.visibility).toBe("none");
  });

  it.each(["spikes", "columns", "hex", "auto"] as const)("%s never changes the camera", async style => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ type: "FeatureCollection", features: [], size_m: 1000, cells: [], bands: [] }) })));
    const { renderer, pitch, setExternalPitch } = setup();
    setExternalPitch(0);
    renderer.update(style, ["pubs"]);
    await settle();
    expect(pitch()).toBe(0);
    setExternalPitch(30); // user tilted
    renderer.update("points", ["pubs"]);
    expect(pitch()).toBe(30);
  });
});
