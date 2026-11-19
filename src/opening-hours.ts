/**
 * A small parser for the common subset of the OSM `opening_hours` syntax:
 * `24/7`, rules such as `Mo-Fr 09:00-17:30; Sa 10:00-16:00; Su off`, day lists
 * (`Mo,We,Fr`), several spans (`12:00-14:30,17:00-23:00`) and spans past midnight
 * (`18:00-02:00`). Anything else (public holidays, months, week numbers, sunrise…)
 * makes the parser give up: the popup then shows the raw value with no badge,
 * rather than a wrong "Open now".
 */
const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

/** minutes from Monday 00:00, half-open [start, end) */
type Span = [number, number];
export interface Week { spans: Span[]; always: boolean }

function dayIndex(token: string): number {
  return DAYS.indexOf(token as (typeof DAYS)[number]);
}

function parseDays(text: string): number[] | null {
  const out: number[] = [];
  for (const part of text.split(",")) {
    const range = part.split("-");
    if (range.length === 1) {
      const d = dayIndex(range[0]);
      if (d < 0) return null;
      out.push(d);
    } else if (range.length === 2) {
      const a = dayIndex(range[0]), b = dayIndex(range[1]);
      if (a < 0 || b < 0) return null;
      for (let d = a; ; d = (d + 1) % 7) { out.push(d); if (d === b) break; }
    } else return null;
  }
  return out;
}

function parseTime(text: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}

export function parseOpeningHours(raw: string): Week | null {
  const value = raw.trim();
  if (!value) return null;
  if (value === "24/7") return { spans: [], always: true };
  // Each rule replaces earlier rules for the days it names (OSM "normal rule" semantics).
  const perDay: Array<Array<[number, number]> | null> = Array(7).fill(null);
  // `Mo-Th 11:00-23:00, Fr-Sa 11:00-24:00` uses "," as the additional-rule separator:
  // a comma after a time and before a day token starts a rule that adds to, not replaces, earlier days.
  const rules: Array<{ text: string; additive: boolean }> = [];
  for (const chunk of value.split(";").map((s) => s.trim()).filter(Boolean)) {
    chunk.split(/(?<=\d|off|closed),\s*(?=(?:Mo|Tu|We|Th|Fr|Sa|Su)\b)/).forEach((text, i) => rules.push({ text: text.trim(), additive: i > 0 }));
  }
  for (const { text: ruleText, additive } of rules) {
    const m = /^([A-Za-z,-]+)?\s*(.*)$/.exec(ruleText);
    if (!m) return null;
    let days: number[] | null = [0, 1, 2, 3, 4, 5, 6];
    let rest = ruleText;
    if (m[1] && /^[A-Z][a-z]/.test(m[1]) && m[1] !== "off" && m[1] !== "closed") {
      days = parseDays(m[1]);
      rest = m[2].trim();
    }
    if (!days) return null;
    let spans: Array<[number, number]>;
    if (rest === "off" || rest === "closed") spans = [];
    else if (rest === "24/7" || rest === "00:00-24:00") spans = [[0, 1440]];
    else {
      spans = [];
      for (const span of rest.split(",").map((s) => s.trim())) {
        const [a, b, ...extra] = span.split("-");
        if (extra.length || b === undefined) return null;
        const start = parseTime(a), end = parseTime(b);
        if (start === null || end === null) return null;
        spans.push([start, end <= start ? end + 1440 : end]);
      }
    }
    for (const d of days) perDay[d] = additive ? [...(perDay[d] ?? []), ...spans] : spans;
  }
  const spans: Span[] = [];
  perDay.forEach((list, d) => {
    for (const [a, b] of list ?? []) spans.push([d * 1440 + a, d * 1440 + b]);
  });
  return { spans, always: false };
}

/** Local wall-clock minute-of-week in a time zone (the atlas covers UK and Ireland, both on London time). */
export function minuteOfWeek(date: Date, timeZone = "Europe/London"): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const day = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday"));
  return day * 1440 + Number(get("hour")) * 60 + Number(get("minute"));
}

function fmt(minute: number): string {
  const m = ((minute % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export interface OpenState { open: boolean; label: string }

export function openState(week: Week, nowMinute: number): OpenState {
  if (week.always) return { open: true, label: "Open 24/7" };
  const WEEK = 7 * 1440;
  // Spans can run past Sunday midnight, so test each span shifted by one week either way.
  for (const [a, b] of week.spans) {
    for (const shift of [-WEEK, 0, WEEK]) {
      if (nowMinute >= a + shift && nowMinute < b + shift) {
        return { open: true, label: b - a >= 1440 ? "Open now" : `Open now · closes ${fmt(b)}` };
      }
    }
  }
  let next: number | null = null;
  for (const [a] of week.spans) {
    for (const shift of [0, WEEK]) {
      const start = a + shift;
      if (start > nowMinute && (next === null || start < next)) next = start;
    }
  }
  if (next === null) return { open: false, label: "Closed" };
  const sameDay = Math.floor(next / 1440) === Math.floor(nowMinute / 1440);
  const day = DAYS[Math.floor(next / 1440) % 7];
  return { open: false, label: `Closed · opens ${sameDay ? "" : `${day} `}${fmt(next)}` };
}
