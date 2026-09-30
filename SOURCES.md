# Data sources

British Isles Atlas ships static GeoJSON under `public/data/` so the map never
runs live Overpass (or other) queries while panning.

## Known limitations (this extract — re-extract planned)

This is a **partial** Overpass extract, **not** a complete British Isles survey.
Until a country-area re-extract lands:

| Issue | Petrol | EV |
|---|---|---|
| Feature count | **exactly 10 000** (a round number — **suspected hard cap / truncation**) | 9 202 |
| Isle of Man | **0** features | **0** |
| Channel Islands (GG/JE) | **0** | **0** |
| Northern France bleed (bbox spill) | **~104** | **~202** |
| Ways represented as centre points | 5 484 | 891 |
| Pipeline-filled generic names (`"Petrol station"` / `"EV charging"`) | 778 (~7.8%) | 2 369 (~25.7%) |
| Pipeline `note` that repeats `brand` (or falls back to `"OpenStreetMap"`) | 2 297 | 2 249 |

The extractor script is **not** in this repo yet. Counts and coverage claims
below describe what is on disk today, measured against the GeoJSON files.

## Petrol stations (`petrol`)

| | |
|---|---|
| **File** | `public/data/petrol.geojson` |
| **Features** | 10000 points (**suspected ~10k cap** — not proven complete) |
| **Coverage** | Partial bbox extract over British Isles `HOME_BOUNDS` (~[[-12.2,49.35],[2.35,61.15]]). Spans much of England, Wales, Scotland, Northern Ireland, and Ireland, but **excludes Isle of Man and Channel Islands**, and **includes ~100 points in northern France**. |
| **Sample vs full** | **Partial extract** — do not treat as a full Isles inventory. Merged from regional Overpass tiles; overlapping tile duplicates removed by OSM id. Truncation at a round 10k is suspected. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `amenity=fuel` nodes and ways (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-09-28T15:55:19Z |
| **Method** | `regional Overpass via overpass.openstreetmap.fr` (bbox tiles; not ISO3166 country areas) |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

| Property | Meaning |
|---|---|
| `name` | OSM `name` when present; otherwise a **pipeline generic** (`"Petrol station"`) — not an OSM-verified name |
| `brand` | OSM `brand` when tagged |
| `osm_id` / `osm_url` | Source object id and deep link |
| `note` | **Pipeline field**, not OSM `note=*`. Usually copies `brand`, else `"OpenStreetMap"` |
| `layer` / `source` | App metadata (`petrol` / extract provenance) |

Ways are stored as **centre points** (`out center`), not polygons.

## EV charging (`ev`)

| | |
|---|---|
| **File** | `public/data/ev.geojson` |
| **Features** | 9202 points |
| **Coverage** | Same partial bbox footprint as petrol: **no Isle of Man / Channel Islands**, **~200 points in northern France**. |
| **Sample vs full** | **Partial extract** — same caveats as petrol (no suspected hard 10k cap on this file). |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `amenity=charging_station` nodes and ways (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-09-28T15:55:19Z |
| **Method** | `regional Overpass via overpass.openstreetmap.fr` (bbox tiles; not ISO3166 country areas) |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same as petrol, with generic missing names filled as `"EV charging"`.

`amenity=charging_station` objects are sometimes a whole site and sometimes a
single device, so **feature counts are not site counts**.

## Basemap (unchanged)

- Hillshade tiles © Esri, USGS, NOAA
- Water / boundaries © OpenStreetMap contributors via OpenMapTiles / OpenFreeMap
