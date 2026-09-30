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

const UK_POSTCODE = /^(GIR\s?0AA|(?:[A-Z]{1,2}\d[A-Z\d]?|[A-Z]{1,2}\d{1,2})\s?\d[A-Z]{2})$/i;

async function remoteHits(query: string, signal: AbortSignal): Promise<SearchHit[]> {
  const postcode = query.trim().toUpperCase().replace(/\s+/g, "");
  if (UK_POSTCODE.test(query.trim())) {
    const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`, { signal });
    if (!response.ok) return [];
    const data = await response.json() as { result?: { latitude: number; longitude: number; postcode: string } };
    const result = data.result;
    return result ? [{ title: result.postcode, subtitle: "UK postcode", lon: result.longitude, lat: result.latitude, zoom: 14 }] : [];
  }
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "0");
  url.searchParams.set("countrycodes", "gb,ie,im,gg,je");
  url.searchParams.set("bounded", "1");
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
  let requestSeq = 0;
  let lastNominatimAt = 0;
  form.querySelector("kbd")!.textContent = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) ? "⌘K" : "Ctrl K";
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-expanded", "false");

  const close = () => {
    requestSeq += 1;
    window.clearTimeout(remoteTimer);
    remoteController?.abort();
    list.hidden = true;
    list.replaceChildren();
    hits = [];
    active = -1;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  };

  const paint = () => {
    list.replaceChildren();
    if (hits.length === 0) {
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      return;
    }
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    if (active >= 0) input.setAttribute("aria-activedescendant", `search-option-${active}`);
    else input.removeAttribute("aria-activedescendant");
    hits.forEach((hit, index) => {
      const item = document.createElement("li");
      item.id = `search-option-${index}`;
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", index === active ? "true" : "false");
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
      item.addEventListener("click", () => {
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
    const seq = requestSeq;
    const isPostcode = UK_POSTCODE.test(query.trim());
    const wait = isPostcode ? 600 : Math.max(600, 1000 - (Date.now() - lastNominatimAt));
    remoteTimer = window.setTimeout(() => {
      if (seq !== requestSeq) return;
      if (!isPostcode) lastNominatimAt = Date.now();
      const controller = new AbortController();
      remoteController = controller;
      remoteHits(query, controller.signal)
        .then((remote) => {
          if (seq !== requestSeq || controller.signal.aborted || input.value.trim() !== query) return;
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
    }, wait);
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

  form.addEventListener("focusout", (event) => {
    if (!form.contains(event.relatedTarget as Node)) close();
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
