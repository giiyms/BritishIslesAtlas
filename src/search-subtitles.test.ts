import { describe, expect, it } from "vitest";
import type { Place } from "./geo";
import { placeSubtitles } from "./search";

const place = (name: string, region: Place["region"], lon: number, lat: number, pop: number): Place =>
  ({ id: name.toLowerCase(), name, region, lon, lat, pop });

describe("place search subtitles", () => {
  const all = [
    place("Cardiff", "Wales", -3.18, 51.48, 447_000),
    place("Newport", "Wales", -3.0, 51.59, 145_000),
    place("Telford", "England", -2.45, 52.68, 142_000),
    place("Newport", "England", -2.38, 52.77, 11_000),
    place("Leeds", "England", -1.55, 53.8, 455_000),
  ];

  it("names a nearby larger town only when results share a name", () => {
    const newports = all.filter((p) => p.name === "Newport");
    expect(placeSubtitles(newports, all)).toEqual(["Wales · near Cardiff", "England · near Telford"]);
    expect(placeSubtitles([all[4]], all)).toEqual(["England"]);
  });
});
