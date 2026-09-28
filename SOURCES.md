# Data sources

British Isles Atlas ships static GeoJSON under `public/data/` so the map never
runs live Overpass (or other) queries while panning.

## Petrol stations (`petrol`)

| | |
|---|---|
| **File** | `public/data/petrol.geojson` |
| **Features** | 10000 points |
| **Coverage** | Full regional extract across British Isles `HOME_BOUNDS` (~[[-12.2,49.35],[2.35,61.15]]), spanning England, Wales, Scotland, Northern Ireland, and Ireland (lon/lat span from the extract). |
| **Sample vs full** | **Full Isles regional extract** (not a random downsample). Merged from regional Overpass tiles; overlapping tile duplicates removed by OSM id. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `amenity=fuel` nodes and ways (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-09-28T15:55:19Z |
| **Method** | `regional Overpass via overpass.openstreetmap.fr` |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

Feature properties include `name`, `brand` (when tagged), `osm_id`, `osm_url`, `note`, `layer`, and `source`.

## EV charging (`ev`)

| | |
|---|---|
| **File** | `public/data/ev.geojson` |
| **Features** | 9202 points |
| **Coverage** | Same British Isles `HOME_BOUNDS` regional coverage as petrol. |
| **Sample vs full** | **Full Isles regional extract** (not a random downsample). Merged from regional Overpass tiles; duplicates removed by OSM id. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `amenity=charging_station` nodes and ways (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-09-28T15:55:19Z |
| **Method** | `regional Overpass via overpass.openstreetmap.fr` |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

Feature properties include `name`, `brand` / `network` when tagged, `osm_id`, `osm_url`, `note`, `layer`, and `source`.

## Basemap (unchanged)

- Hillshade tiles © Esri, USGS, NOAA
- Water / boundaries © OpenStreetMap contributors via OpenMapTiles / OpenFreeMap
