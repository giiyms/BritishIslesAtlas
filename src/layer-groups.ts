import type { LayerId } from "./layers";

/**
 * Panel IA (style roast 2026-10-05 fix 6): Voting is pinned first; the other data
 * layers live in collapsible groups. Every data layer except `constituencies`
 * appears in exactly one section (enforced in layer-groups.test.ts).
 */
export interface LayerSection {
  id: string;
  label: string;
  layers: readonly LayerId[];
}

export const LAYER_SECTIONS: readonly LayerSection[] = [
  {
    id: "transport",
    label: "Transport",
    layers: ["roads", "railway-stations", "aerodromes", "ferry-terminals", "marinas", "petrol"],
  },
  {
    id: "health",
    label: "Health & emergency",
    layers: ["hospitals", "clinics", "dentists", "pharmacies", "fire-stations", "police", "prisons", "courthouses"],
  },
  {
    id: "culture",
    label: "Culture & heritage",
    layers: [
      "museums", "galleries", "theatres", "cinemas", "arts-centres", "castles", "ruins",
      "battlefields", "memorials", "windmills", "lighthouses", "piers", "townhalls", "nightclubs",
    ],
  },
  {
    id: "leisure",
    label: "Leisure & outdoors",
    layers: [
      "zoos", "aquariums", "theme-parks", "stadiums", "viewpoints", "golf-courses", "nature-reserves",
      "camp-sites", "caravan-sites", "sports-centres", "fitness-centres", "playgrounds", "beaches", "swimming-pools",
    ],
  },
  {
    id: "faith",
    label: "Faith & community",
    layers: ["places-of-worship", "churches", "mosques", "other-religious", "community-centres", "pubs", "population"],
  },
  {
    id: "services",
    label: "Services",
    layers: ["schools", "universities", "libraries", "post-offices", "marketplaces", "ev", "power", "census"],
  },
];

/** "Castles" → "Castle", "Railway stations" → "Railway station" (generic POI popup, fix 10). */
const SINGULAR_OVERRIDES: Record<string, string> = {
  "Places of worship": "Place of worship",
  Police: "Police station",
  Power: "Power plant",
  "EV charging": "EV charger",
  "Other religious": "Religious site",
  Population: "Settlement",
  Census: "Census marker",
  Roads: "Road",
  Crime: "Crime marker",
  Health: "Health site",
  Weather: "Weather station",
  Immigration: "Port of entry",
  Nuclear: "Nuclear site",
  Historic: "Historic site",
  Legends: "Legend site",
  Mountains: "Summit",
  "Wind turbines": "Wind turbine",
};

export function singularLabel(label: string): string {
  const override = SINGULAR_OVERRIDES[label];
  if (override) return override;
  const words = label.split(" ");
  const last = words.pop() ?? "";
  let single = last;
  if (/ies$/.test(last)) single = last.replace(/ies$/, "y");
  else if (/(ch|sh|ss|x)es$/.test(last)) single = last.replace(/es$/, "");
  else if (/s$/.test(last) && !/ss$/.test(last)) single = last.replace(/s$/, "");
  return [...words, single].join(" ");
}
