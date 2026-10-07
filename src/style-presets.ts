import type { Mode, BasemapId } from "./state";
import type { Surface } from "./surfaces";

export type StylePresetId = "recommended" | "relief" | "paper" | "night";

export const STYLE_PRESETS: ReadonlyArray<{ id: StylePresetId; label: string; hint: string }> = [
  { id: "recommended", label: "Recommended", hint: "Auto follows the active reading" },
  { id: "relief", label: "Relief", hint: "Terrain context with hillshade" },
  { id: "paper", label: "Paper", hint: "Quiet, high-contrast reference map" },
  { id: "night", label: "Night", hint: "Dark surroundings for bright data" },
];

export function recommendedBasemap(mode: Mode, surface: Surface): Exclude<BasemapId, "auto"> {
  if (mode === "election") return "light";
  if (surface.kind === "distance") return "dark";
  if (surface.kind === "seat" || surface.kind === "hex") return "light";
  return "relief";
}

export function presetBasemap(preset: StylePresetId, mode: Mode, surface: Surface): Exclude<BasemapId, "auto"> {
  if (preset === "recommended") return recommendedBasemap(mode, surface);
  if (preset === "relief") return "relief";
  if (preset === "paper") return "mono";
  return "dark";
}
