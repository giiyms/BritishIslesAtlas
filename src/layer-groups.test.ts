import { describe, expect, it } from "vitest";
import { LAYERS } from "./layers";
import { LAYER_SECTIONS, singularLabel } from "./layer-groups";

describe("LAYER_SECTIONS", () => {
  it("covers every data layer except constituencies exactly once", () => {
    const listed = LAYER_SECTIONS.flatMap((section) => section.layers);
    const data = LAYERS.filter((layer) => layer.group === "data" && layer.id !== "constituencies").map((l) => l.id);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual([...data].sort());
  });
});

describe("palette dedupe", () => {
  it("has no exact duplicate map colours among data layers", () => {
    const data = LAYERS.filter((layer) => layer.group === "data" && layer.id !== "townhalls");
    const colours = data.map((layer) => layer.color.toLowerCase());
    const dupes = colours.filter((c, i) => colours.indexOf(c) !== i);
    // courthouses + townhalls share the civic slate on purpose (roast fix 8).
    expect(dupes).toEqual([]);
  });

  it("moves amenity dots off the pick colours", () => {
    const byId = Object.fromEntries(LAYERS.map((layer) => [layer.id, layer.color]));
    expect(byId.schools).toBe("#3f7fbf");
    expect(byId.pubs).toBe("#d9822b");
    expect(byId["community-centres"]).toBe("#5a6fb0");
    expect(byId["nature-reserves"]).toBe("#5e8c3a");
    expect(byId.windmills).toBe("#b07a45");
    expect(byId.courthouses).toBe("#55657a");
    expect(byId.townhalls).toBe("#55657a");
  });
});

describe("singularLabel", () => {
  it("singularises chip labels for POI popups", () => {
    expect(singularLabel("Castles")).toBe("Castle");
    expect(singularLabel("Railway stations")).toBe("Railway station");
    expect(singularLabel("Libraries")).toBe("Library");
    expect(singularLabel("Churches")).toBe("Church");
    expect(singularLabel("Places of worship")).toBe("Place of worship");
    expect(singularLabel("Police")).toBe("Police station");
    expect(singularLabel("Swimming pools")).toBe("Swimming pool");
  });
});
