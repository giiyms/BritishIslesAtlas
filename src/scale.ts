import type { Map } from "maplibre-gl";

const STEPS_METERS = [
  10, 20, 50, 100, 200, 500, 1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000, 200_000,
  500_000, 1_000_000, 2_000_000,
];

export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    const km = meters / 1000;
    return `${Number.isInteger(km) ? km : km.toFixed(1)} km`;
  }
  return `${meters} m`;
}

/** Pick a nice round length whose bar sits near the target pixel width. */
export function chooseScale(metersPerPixel: number, targetPx = 128, minPx = 64, maxPx = 196): { meters: number; px: number } {
  if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) {
    return { meters: 100_000, px: targetPx };
  }

  let best = STEPS_METERS[0];
  let bestScore = Number.POSITIVE_INFINITY;
  for (const meters of STEPS_METERS) {
    const px = meters / metersPerPixel;
    if (px < minPx || px > maxPx) continue;
    const score = Math.abs(px - targetPx);
    if (score < bestScore) {
      bestScore = score;
      best = meters;
    }
  }

  if (!Number.isFinite(bestScore)) {
    for (const meters of STEPS_METERS) {
      const px = meters / metersPerPixel;
      const score = Math.abs(px - targetPx);
      if (score < bestScore) {
        bestScore = score;
        best = meters;
      }
    }
  }

  return { meters: best, px: best / metersPerPixel };
}

function haversineMeters(
  a: { lng: number; lat: number },
  b: { lng: number; lat: number },
): number {
  const R = 6_371_008.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Classic segmented ruler: four alternating ink/paper segments of a round length,
 * labelled "0" and the total. Its width is the true distance, not a progress fill.
 */
export function mountScale(el: HTMLElement, map: Map): void {
  const ruler = document.createElement("div");
  ruler.className = "scale-ruler";
  const zero = document.createElement("span");
  zero.className = "scale-zero";
  zero.textContent = "0";
  const label = document.createElement("span");
  label.className = "scale-label";
  el.replaceChildren(zero, ruler, label);

  const update = () => {
    const container = map.getContainer();
    const mapRect = container.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const y = Math.min(container.clientHeight - 8, Math.max(8, rect.top - mapRect.top + rect.height / 2));
    const x = container.clientWidth / 2;
    const metersPerPixel = haversineMeters(map.unproject([x, y]), map.unproject([x + 100, y])) / 100;
    const scale = chooseScale(metersPerPixel, 110, 70, 150);
    ruler.style.width = `${Math.max(1, Math.round(scale.px))}px`;
    label.textContent = formatDistance(scale.meters);
    const spoken = scale.meters >= 1000 ? `${scale.meters / 1000} kilometres` : `${scale.meters} metres`;
    el.setAttribute("aria-label", `Scale bar, ${spoken}`);
  };

  map.on("move", update);
  map.on("resize", update);
  update();
}
