import { searchPlaces, type Place } from "./geo";

export interface SearchHit {
  title: string;
  subtitle: string;
  lon: number;
  lat: number;
  zoom?: number;
  bounds?: [[number, number], [number, number]];
}

interface NominatimItem {
  display_name: string;
  lat: string;
  lon: string;
  boundingbox?: [string, string, string, string];
}

function zoomFor(place: Place): number {
  if (place.pop > 2_000_000) return 10.2;
  if (place.pop > 400_000) return 11;
  if (place.pop > 80_000) return 12;
  return 12.4;
}

function localHits(query: string): SearchHit[] {
  return searchPlaces(query).map((place) => ({
    title: place.name,
    subtitle: place.region,
    lon: place.lon,
    lat: place.lat,
    zoom: zoomFor(place),
  }));
}

async function remoteHits(query: string, signal: AbortSignal): Promise<SearchHit[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "0");
  url.searchParams.set("countrycodes", "gb,ie,im,gg,je");
  url.searchParams.set("viewbox", "-12.6,61.4,2.8,49.0");
  url.searchParams.set("q", query);
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) return [];
  const items = (await response.json()) as NominatimItem[];
  return items.map((item) => {
    const south = Number(item.boundingbox?.[0]);
    const north = Number(item.boundingbox?.[1]);
    const west = Number(item.boundingbox?.[2]);
    const east = Number(item.boundingbox?.[3]);
    const hasBounds = [south, north, west, east].every((value) => Number.isFinite(value));
    const title = item.display_name.split(",")[0] ?? item.display_name;
    return {
      title,
      subtitle: "OpenStreetMap",
      lon: Number(item.lon),
      lat: Number(item.lat),
      zoom: 13,
      bounds: hasBounds ? ([[west, south], [east, north]] as [[number, number], [number, number]]) : undefined,
    };
  });
}

export function mountSearch(
  form: HTMLFormElement,
  go: (hit: SearchHit) => void,
): void {
  const input = form.querySelector<HTMLInputElement>("input");
  const list = form.querySelector<HTMLUListElement>("#search-results");
  if (!input || !list) return;

  let hits: SearchHit[] = [];
  let active = -1;
  let remoteController: AbortController | null = null;
  let remoteTimer = 0;

  const close = () => {
    list.hidden = true;
    list.replaceChildren();
    hits = [];
    active = -1;
  };

  const paint = () => {
    list.replaceChildren();
    if (hits.length === 0) {
      list.hidden = true;
      return;
    }
    list.hidden = false;
    hits.forEach((hit, index) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = index === active ? "is-active" : "";
      const title = document.createElement("span");
      title.className = "hit-title";
      title.textContent = hit.title;
      const subtitle = document.createElement("span");
      subtitle.className = "hit-sub";
      subtitle.textContent = hit.subtitle;
      button.append(title, subtitle);
      button.addEventListener("click", () => {
        go(hit);
        close();
        input.blur();
      });
      item.append(button);
      list.append(item);
    });
  };

  const queueRemote = (query: string) => {
    window.clearTimeout(remoteTimer);
    remoteController?.abort();
    if (query.trim().length < 3) return;
    remoteTimer = window.setTimeout(() => {
      const controller = new AbortController();
      remoteController = controller;
      remoteHits(query, controller.signal)
        .then((remote) => {
          if (controller.signal.aborted || input.value.trim() !== query) return;
          const seen = new Set(hits.map((hit) => hit.title.toLowerCase()));
          for (const hit of remote) {
            if (seen.has(hit.title.toLowerCase())) continue;
            hits.push(hit);
            seen.add(hit.title.toLowerCase());
          }
          hits = hits.slice(0, 8);
          paint();
        })
        .catch(() => {
          /* Local matches still stand if the geocoder is unreachable. */
        });
    }, 280);
  };

  input.addEventListener("input", () => {
    const query = input.value;
    hits = localHits(query);
    active = hits.length ? 0 : -1;
    paint();
    queueRemote(query);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" && hits.length) {
      active = Math.min(hits.length - 1, active + 1);
      paint();
      event.preventDefault();
    } else if (event.key === "ArrowUp" && hits.length) {
      active = Math.max(0, active - 1);
      paint();
      event.preventDefault();
    } else if (event.key === "Escape") {
      close();
      input.blur();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const hit = hits[active] ?? hits[0];
    if (!hit) return;
    go(hit);
    close();
  });

  document.addEventListener("click", (event) => {
    if (!form.contains(event.target as Node)) close();
  });

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      input.focus();
      input.select();
    }
  });
}
