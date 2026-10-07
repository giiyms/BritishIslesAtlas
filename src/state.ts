import { LAYERS, isLayerId, type LayerId } from "./layers";
import { DEFAULT_SURFACE, normaliseSurface, type Surface, type SurfaceKind } from "./surfaces";
import type { ElectionLayout, ElectionView } from "./election";

export type Mode = "atlas" | "election";
export type BasemapId = "relief" | "light" | "dark" | "mono";

export const MAX_POINTS = 5;
export const BASEMAP_IDS: readonly BasemapId[] = ["relief", "light", "dark", "mono"];

export interface AtlasState {
  mode: Mode;
  surface: Surface;
  points: LayerId[];
  basemap: BasemapId;
  roads: boolean;
  labels: boolean;
  electionView: ElectionView;
  electionLayout: ElectionLayout;
}

export function defaultState(): AtlasState {
  return {
    mode: "atlas",
    surface: { ...DEFAULT_SURFACE },
    points: LAYERS.filter((layer) => layer.defaultOn).map((layer) => layer.id).slice(0, MAX_POINTS),
    basemap: "relief",
    roads: true,
    labels: true,
    electionView: "winner",
    electionLayout: "map",
  };
}

/** `#m=atlas&s=seat:pharmacies&p=hospitals,castles&b=light&r=0&l=1&v=winner&h=1` */
export function encodeState(s: AtlasState): string {
  const d = defaultState();
  const parts: string[] = [];
  if (s.mode !== d.mode) parts.push(`m=${s.mode}`);
  if (s.surface.kind !== "none") parts.push(`s=${s.surface.kind}:${s.surface.dataset}`);
  if (s.points.join(",") !== d.points.join(",")) parts.push(`p=${s.points.join(",")}`);
  if (s.basemap !== d.basemap) parts.push(`b=${s.basemap}`);
  if (s.roads !== d.roads) parts.push(`r=${s.roads ? 1 : 0}`);
  if (s.labels !== d.labels) parts.push(`l=${s.labels ? 1 : 0}`);
  if (s.electionView !== d.electionView) parts.push(`v=${s.electionView}`);
  if (s.electionLayout !== d.electionLayout) parts.push(`h=${s.electionLayout === "hex" ? 1 : 0}`);
  return parts.join("&");
}

export function decodeState(hash: string): AtlasState {
  const s = defaultState();
  const q = new URLSearchParams(hash.replace(/^#/, ""));
  if (q.get("m") === "election") s.mode = "election";
  const surface = q.get("s");
  if (surface) {
    const [kind, dataset] = surface.split(":");
    if (["seat", "hex", "distance"].includes(kind) && isLayerId(dataset)) {
      s.surface = normaliseSurface({ kind: kind as SurfaceKind, dataset });
    }
  }
  const points = q.get("p");
  if (points !== null) s.points = [...new Set(points.split(",").filter(isLayerId))].slice(0, MAX_POINTS);
  const b = q.get("b");
  if (b && (BASEMAP_IDS as readonly string[]).includes(b)) s.basemap = b as BasemapId;
  if (q.get("r") !== null) s.roads = q.get("r") === "1";
  if (q.get("l") !== null) s.labels = q.get("l") === "1";
  const v = q.get("v");
  if (v === "winner" || v === "reform" || v === "pick") s.electionView = v;
  if (q.get("h") === "1") s.electionLayout = "hex";
  return s;
}
