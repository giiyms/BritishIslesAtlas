import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mapLinks, otherTags, photoSources, pickFsa, poiCardHtml, ratingKind, tagRows, wikipediaUrl } from "./rich-popup";

const pub = {
  amenity: "pub", name: "Sheep Heid Inn", opening_hours: "Mo-Su 11:00-23:00", wheelchair: "limited",
  "addr:street": "The Causeway", "addr:housenumber": "43", "addr:postcode": "EH15 3QA", website: "https://www.thesheepheidedinburgh.co.uk/",
  wikidata: "Q7492541", real_ale: "yes",
};

describe("rich popup rows", () => {
  it("turns tags into ordered rows with a live hours badge", () => {
    const rows = tagRows(pub, new Date("2026-07-06T12:00:00Z"));
    expect(rows.map((r) => r.label)).toEqual(["Hours", "Wheelchair", "Address", "Website", "Reference"]);
    expect(rows[0].html).toContain("Open now · closes 23:00");
    expect(rows[2].html).toBe("43 The Causeway, EH15 3QA");
    expect(rows[3].html).toContain('href="https://www.thesheepheidedinburgh.co.uk/"');
  });
  it("shows no badge when the hours cannot be parsed", () => {
    const [row] = tagRows({ opening_hours: "Mo-Fr 09:00-17:00; PH off" });
    expect(row.html).not.toContain("pr-badge");
    expect(row.html).toContain("PH off");
  });
  it("covers faith, heritage, fee and capacity", () => {
    const rows = tagRows({ religion: "christian", denomination: "anglican", heritage: "2", listed_status: "Grade I", HE_ref: "1084910", fee: "yes", capacity: "400" });
    const html = rows.map((r) => r.html).join("|");
    expect(html).toContain("Christian · Anglican");
    expect(html).toContain("Grade I");
    expect(html).toContain("list-entry/1084910");
    expect(html).toContain("Yes");
    expect(html).toContain("400");
  });
  it("lists every remaining tag except names and bookkeeping", () => {
    const rows = tagRows(pub);
    const rest = otherTags(pub, rows).map(([k]) => k);
    expect(rest).toEqual(["amenity", "real_ale"]);
  });
  it("escapes tag values", () => {
    expect(tagRows({ operator: "<b>x</b>" })[0].html).toBe("&lt;b&gt;x&lt;/b&gt;");
  });
});

describe("photo sources", () => {
  it("prefers explicit Commons and Geograph tags, then Wikidata and Wikipedia", () => {
    expect(photoSources({ image: "https://commons.wikimedia.org/wiki/File:Edinburgh_Castle.jpg", wikidata: "Q212065", wikipedia: "en:Edinburgh Castle" })).toEqual([
      { kind: "commons", file: "File:Edinburgh Castle.jpg", via: "OSM image" },
      { kind: "wikidata", id: "Q212065" },
      { kind: "wikipedia", lang: "en", title: "Edinburgh Castle" },
    ]);
    expect(photoSources({ image: "https://www.geograph.org.uk/photo/1000000" })).toEqual([{ kind: "geograph", id: "1000000", via: "OSM image" }]);
  });
  it("never uses an arbitrary image URL", () => {
    expect(photoSources({ image: "https://example.com/pub.jpg" })).toEqual([]);
  });
  it("builds Wikipedia URLs", () => {
    expect(wikipediaUrl("en:St Paul's Cathedral")).toBe("https://en.wikipedia.org/wiki/St%20Paul's_Cathedral".replace("%20", "_"));
  });
});

describe("ratings", () => {
  it("routes layers to open rating sources", () => {
    expect(ratingKind("pubs", {})).toBe("fsa");
    expect(ratingKind("hospitals", {})).toBe("cqc");
    expect(ratingKind("museums", { amenity: "cafe" })).toBe("fsa");
    expect(ratingKind("castles", {})).toBeNull();
  });
  it("only accepts an FSA record whose name agrees", () => {
    const list = [
      { BusinessName: "Tesco Express", FHRSID: 1, RatingValue: "5", RatingDate: "2025-01-01T00:00:00", SchemeType: "FHRS", Distance: 0.01 },
      { BusinessName: "The Red Lion", FHRSID: 2, RatingValue: "4", RatingDate: "2024-03-02T00:00:00", SchemeType: "FHRS", Distance: 0.05 },
    ];
    const r = pickFsa(list, "Red Lion")!;
    expect(r.value).toBe("4 / 5 · Good");
    expect(r.date).toBe("2024-03-02");
    expect(r.href).toBe("https://ratings.food.gov.uk/business/2");
    expect(pickFsa(list, "The Crown")).toBeNull();
    expect(pickFsa([{ BusinessName: "Sheep Heid Inn", FHRSID: 3, RatingValue: "Pass", RatingDate: null, SchemeType: "FHIS" }], "Sheep Heid Inn")!.label)
      .toContain("Scotland");
  });
  it("ships a CQC table keyed by OSM id with real rating words and dates", () => {
    const table = JSON.parse(readFileSync("public/data/ratings-cqc.json", "utf8")) as Record<string, string[]>;
    const entries = Object.entries(table);
    expect(entries.length).toBeGreaterThan(800);
    for (const [id, [rating, date, loc]] of entries) {
      expect(id).toMatch(/^(node|way|relation)\/\d+$/);
      expect(["Outstanding", "Good", "Requires improvement", "Inadequate"]).toContain(rating);
      expect(date).toMatch(/^20\d\d-\d\d-\d\d$/);
      expect(loc).toMatch(/^[\w-]+$/);
    }
  });
});

describe("card shell", () => {
  it("has accent header, photo skeleton, copy button and three map links", () => {
    const html = poiCardHtml({ layerId: "castles", name: "Edinburgh Castle", typeLine: "Castle · Edinburgh", accent: "#7a4b2a", tint: "#f4ece6", icon: "<svg></svg>",
      props: { osm_id: "way/1", osm_url: "https://www.openstreetmap.org/way/1" }, lngLat: [-3.2008, 55.9486] });
    expect(html).toContain("--poi-accent:#7a4b2a");
    expect(html).toContain("poi-skeleton");
    expect(html).toContain('data-coords="55.94860, -3.20080"');
    expect(mapLinks("X", [-3.2, 55.9], "https://osm.org/n/1").match(/<a /g)).toHaveLength(3);
  });
});
