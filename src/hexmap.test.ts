import { describe, expect, it } from "vitest";
import { layoutHexes } from "./hexmap";
import { projectionFromRow } from "./election";
import hexFile from "../public/data/hexmap-pcon.json";
import seatIndex from "../public/data/seat-index.json";

describe("layoutHexes", () => {
  const cells = layoutHexes(hexFile as Parameters<typeof layoutHexes>[0]);

  it("places one hex per seat with no collisions", () => {
    expect(cells).toHaveLength(650);
    expect(new Set(cells.map((c) => `${c.x.toFixed(3)},${c.y.toFixed(3)}`)).size).toBe(650);
  });

  it("draws Scotland above London", () => {
    const y = (name: string) => cells.find((c) => c.name === name)!.y;
    expect(y("Orkney and Shetland")).toBeLessThan(y("Bermondsey and Old Southwark"));
  });

  it("covers every GB seat in the boundary data", () => {
    const codes = new Set(cells.map((c) => c.code));
    expect(Object.keys(seatIndex).filter((code) => !codes.has(code))).toEqual([]);
  });
});

describe("projectionFromRow", () => {
  it("canonicalises the winner and computes the margin", () => {
    expect(projectionFromRow("S14000060", { projected_winner: "Nationalist", lab_share: 23, snp_share: 32.1, reform_share: 10.9 }))
      .toEqual({ winner: "SNP", margin: 9.1, reform: 10.9 });
    expect(projectionFromRow("E1", { projected_winner: "Speaker" }).winner).toBe("Other");
  });
});
