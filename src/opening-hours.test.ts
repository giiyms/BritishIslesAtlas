import { describe, expect, it } from "vitest";
import { minuteOfWeek, openState, parseOpeningHours } from "./opening-hours";

const at = (day: number, hhmm: string) => day * 1440 + Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

describe("opening hours", () => {
  it("reads a typical pub", () => {
    const w = parseOpeningHours("Mo-Th 12:00-23:00; Fr-Sa 12:00-01:00; Su 12:00-22:30")!;
    expect(openState(w, at(0, "13:00"))).toEqual({ open: true, label: "Open now · closes 23:00" });
    expect(openState(w, at(5, "00:30"))).toEqual({ open: true, label: "Open now · closes 01:00" });
    expect(openState(w, at(0, "10:00"))).toEqual({ open: false, label: "Closed · opens 12:00" });
    expect(openState(w, at(6, "23:00"))).toEqual({ open: false, label: "Closed · opens Mo 12:00" });
  });
  it("lets later rules override days and handles off", () => {
    const w = parseOpeningHours("Mo-Su 09:00-17:00; Su off")!;
    expect(openState(w, at(6, "10:00")).open).toBe(false);
    expect(openState(w, at(5, "10:00")).open).toBe(true);
  });
  it("handles 24/7 and split spans", () => {
    expect(openState(parseOpeningHours("24/7")!, 0)).toEqual({ open: true, label: "Open 24/7" });
    const w = parseOpeningHours("Tu-Sa 12:00-14:30,17:30-22:00")!;
    expect(openState(w, at(1, "15:00")).label).toBe("Closed · opens 17:30");
  });
  it("gives up on syntax it does not understand", () => {
    expect(parseOpeningHours("Mo-Fr 09:00-17:00; PH off")).toBeNull();
    expect(parseOpeningHours("sunrise-sunset")).toBeNull();
    expect(parseOpeningHours("Apr-Oct Mo-Su 10:00-17:00")).toBeNull();
  });
  it("uses London wall-clock time", () => {
    // 2026-07-06 is a Monday; 11:30 UTC is 12:30 BST.
    expect(minuteOfWeek(new Date("2026-07-06T11:30:00Z"))).toBe(at(0, "12:30"));
    expect(minuteOfWeek(new Date("2026-12-07T11:30:00Z"))).toBe(at(0, "11:30"));
  });
});

it("comma-separated additional rules (common in UK pub tags)", () => {
  const week = parseOpeningHours("Mo-Th 11:00-23:00, Fr-Sa 11:00-24:00; Su 12:30-23:00");
  expect(week).not.toBeNull();
  // Friday 23:30 is open (Fr-Sa rule), Thursday 23:30 is closed
  expect(openState(week!, 4 * 1440 + 23 * 60 + 30).open).toBe(true);
  expect(openState(week!, 3 * 1440 + 23 * 60 + 30).open).toBe(false);
  // day lists with commas still parse as one rule
  expect(parseOpeningHours("Mo,We 09:00-17:00")).not.toBeNull();
});
