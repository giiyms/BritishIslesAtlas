import bakeRaw from "../public/data/endorsements-gb.json?raw";
import geoRaw from "../public/data/constituencies-gb-2024.geojson?raw";
import { describe, expect, it } from "vitest";
import { ENDORSE_COLORS } from "./endorse";
import {
  canonicalParty,
  constituencyPopupHtml,
  enrichConstituencies,
  formatShortDate,
  restoreCallouts,
  type EndorsementsFile,
  type FeatureCollection,
} from "./voting";

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [lo, hi] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (hi + 0.05) / (lo + 0.05);
}

const bake = JSON.parse(bakeRaw) as EndorsementsFile;
const gy = bake.seats.E14001256;

describe("style roast palette", () => {
  it("uses the roast pick colours and opacities", () => {
    expect(ENDORSE_COLORS.reform.fill).toBe("#12B6CF");
    expect(ENDORSE_COLORS.reform.fillOpacity).toBe(0.34);
    expect(ENDORSE_COLORS.restore.fill).toBe("#051D3F");
    expect(ENDORSE_COLORS.restore.fillOpacity).toBe(0.88);
    expect(ENDORSE_COLORS.none.fillOpacity).toBe(0.45);
  });

  it("keeps every white-text CTA badge at WCAG AA (≥4.5:1)", () => {
    for (const key of ["reform", "restore", "none", "override"] as const) {
      expect(contrast(ENDORSE_COLORS[key].badge, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    }
    expect(ENDORSE_COLORS.reform.badge).toBe("#0B6E7D");
    expect(ENDORSE_COLORS.restore.badge).toBe("#051D3F");
  });
});

describe("canonicalParty", () => {
  it("normalises messy poll labels", () => {
    expect(canonicalParty("Reform")).toBe("Reform UK");
    expect(canonicalParty("Reform UK")).toBe("Reform UK");
    expect(canonicalParty("Scottish National Party (SNP)")).toBe("SNP");
    expect(canonicalParty("Nationalist", "S14000001")).toBe("SNP");
    expect(canonicalParty("Nationalist", "W07000081")).toBe("Plaid Cymru");
    expect(canonicalParty("The Green Party")).toBe("Green");
    expect(canonicalParty("Minor")).toBe("Other");
    expect(canonicalParty("Liberal Democrat")).toBe("Liberal Democrat");
  });
});

describe("constituencyPopupHtml (Great Yarmouth)", () => {
  const html = constituencyPopupHtml(gy, bake.retrieved_at);

  it("is still a Restore seat in the bake", () => {
    expect(gy.endorse).toBe("restore");
    expect(bake.counts.restore).toBe(1);
    expect(html).toContain("VOTE RESTORE");
    expect(html).toContain(`--vote:${ENDORSE_COLORS.restore.badge}`);
  });

  it("drops dev notes, Minor and duplicate disclaimers", () => {
    expect(html).not.toMatch(/\bMinor\b/);
    expect(html).not.toContain("2024 winner");
    expect(html).not.toContain("CBP-10009");
    expect(html.match(/Electoral Commission/g)?.length).toBe(1);
    expect(html).toContain("projects an <em>Other</em> win here");
  });

  it("renders a polls grid with tabular cells and a short updated date", () => {
    expect(html).toContain('class="vp-polls" role="table"');
    expect(html).toContain('<span class="vp-num vp-lead">28.2%</span>');
    expect(html).toContain("Fieldwork ");
    expect(html).toContain(`Updated ${formatShortDate(bake.retrieved_at)}</span>`);
    expect(html).toContain('class="popup-title"');
  });
});

describe("restoreCallouts", () => {
  it("emits one centroid inside East Anglia for Great Yarmouth", () => {
    const geo = JSON.parse(geoRaw) as FeatureCollection;
    const enriched = enrichConstituencies(geo, bake.seats);
    const callouts = restoreCallouts(enriched);
    expect(callouts.features).toHaveLength(1);
    const f = callouts.features[0] as unknown as { properties: { pcon24nm: string }; geometry: { coordinates: [number, number] } };
    expect(f.properties.pcon24nm).toBe("Great Yarmouth");
    const [lon, lat] = f.geometry.coordinates;
    expect(lon).toBeGreaterThan(1.5);
    expect(lon).toBeLessThan(1.8);
    expect(lat).toBeGreaterThan(52.5);
    expect(lat).toBeLessThan(52.75);
  });
});

describe("formatShortDate", () => {
  it("formats ISO dates as day + month", () => {
    expect(formatShortDate("2026-10-05T08:23:00Z")).toBe("5 Oct");
    expect(formatShortDate("")).toBe("");
  });
});
