import { describe, expect, it } from "vitest";
import { CROME_ATTRIBUTION, CROP_PALETTE, cropPopupHtml, cropPaletteKey, rankCropFeatures } from "./crops";

describe("CROME crop contract", () => {
  it("keeps the requested attribution and theme palette", () => {
    expect(CROME_ATTRIBUTION).toBe("Contains data © Rural Payments Agency copyright and/or database right 2024");
    expect(CROP_PALETTE).toMatchObject({
      greens: "#7CD97C",
      brassica: "#5BBDF4",
      berries: "#FF6E91",
      grain: "#FFD369",
      flowers: "#C8A6FF",
      nuts: "#FF6EA7",
    });
    expect(cropPaletteKey("AC27 Strawberry")).toBe("berries");
    expect(cropPaletteKey("AC66 Winter Wheat")).toBe("grain");
  });

  it("deduplicates tile copies before calculating ranked percentages", () => {
    const ranking = rankCropFeatures([
      { id: "north:AC66", properties: { feature_id: "north:AC66", crop_code: "AC66", crop_name: "Winter Wheat", area_ha: 60 } },
      { id: "north:AC66", properties: { feature_id: "north:AC66", crop_code: "AC66", crop_name: "Winter Wheat", area_ha: 60 } },
      { id: "north:AC27", properties: { feature_id: "north:AC27", crop_code: "AC27", crop_name: "Strawberry", area_ha: 40 } },
    ]);
    expect(ranking.map((item) => [item.label, item.percent])).toEqual([
      ["Winter Wheat", 60],
      ["Strawberry", 40],
    ]);
  });

  it("escapes field names in the popup and shows acreage/calendar context", () => {
    const html = cropPopupHtml({ crop_code: "AC27", crop_name: "<Strawberry>", area_ha: 2, prob: 0.85 });
    expect(html).toContain("&#60;Strawberry&#62;");
    expect(html).toContain("acres");
    expect(html).toContain("Classification confidence 85%");
    expect(html).toContain("Indicative harvest · J–D");
    expect(html).toContain("CROME 2024 · England only");
  });
});
