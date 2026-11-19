export type Region =
  | "England"
  | "Scotland"
  | "Wales"
  | "Northern Ireland"
  | "Ireland"
  | "Crown dependency";

export interface Place {
  id: string;
  name: string;
  region: Region;
  lon: number;
  lat: number;
  pop: number;
}

type TownRow = [name: string, region: Region, lon: number, lat: number, pop: number];

let places: Place[] = [];
let loading: Promise<Place[]> | null = null;

/** GeoNames towns of 1,000+ (public/data/towns.json, scripts/build_towns.py, CC BY 4.0), fetched once. */
export function loadPlaces(): Promise<Place[]> {
  loading ??= fetch("/data/towns.json")
    .then((response) => (response.ok ? (response.json() as Promise<TownRow[]>) : []))
    .then((rows) => {
      places = rows.map(([name, region, lon, lat, pop]) => ({
        id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name, region, lon, lat, pop,
      }));
      return places;
    })
    .catch(() => places);
  return loading;
}

/** Whatever has loaded so far (empty until loadPlaces resolves). */
export function loadedPlaces(): Place[] {
  return places;
}

export function searchPlaces(query: string): Place[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return places.filter((place) => place.name.toLowerCase().includes(q) || place.id.includes(q))
    .sort((a, b) => {
      const rank = (place: Place) => {
        const name = place.name.toLowerCase();
        if (name === q) return 0;
        if (name.startsWith(q)) return 1;
        return 2;
      };
      const byRank = rank(a) - rank(b);
      if (byRank !== 0) return byRank;
      return b.pop - a.pop;
    })
    .slice(0, 6);
}
