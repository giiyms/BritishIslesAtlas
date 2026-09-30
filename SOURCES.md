# Data sources

British Isles Atlas ships static GeoJSON under `public/data/` so the map never
runs live Overpass (or other) queries while panning.

## Extract pipeline

The petrol and EV layers are rebuilt by `scripts/extract_osm_fuel_ev.py`:

1. Load OSM admin polygons for England, Scotland, Wales, Northern Ireland,
   Ireland, Isle of Man, Guernsey, and Jersey (via Nominatim; cached under
   `scripts/cache/`, regenerable with `--refresh-polygons`).
2. Query Overpass **per-region bounding-box tiles** (not one British Isles-wide
   bbox) on `https://overpass.openstreetmap.fr/api/interpreter`.
3. **Clip** results to the admin polygon (+ ~200 m buffer) so mainland France
   and cross-border spill are dropped.
4. Deduplicate by OSM `type/id`. Ways are stored as **centre points**
   (`out center`).

Overpass `area["ISO3166-…"]` filters were preferred, but
`overpass.openstreetmap.fr` currently errors on area queries
(`area_tags_local.bin` missing). Official DE mirrors were TLS / rate-limit
unreliable from the extract host. Polygon-clipped regional tiles are the
practical equivalent; see `scripts/README.md`.

## Petrol stations (`petrol`)

| | |
|---|---|
| **File** | `public/data/petrol.geojson` |
| **Features** | 10 267 points (not a round cap) |
| **Coverage** | Full British Isles admin areas: England 6 599, Scotland 818, Wales 529, Northern Ireland 566, Ireland 1 676, Isle of Man 21, Guernsey 26, Jersey 32. **Northern France bleed ≈ 0** (was ~104 on the prior bbox extract). |
| **Sample vs full** | Admin-area extract intended as a full Isles inventory of OSM `amenity=fuel` at extract time. OSM completeness still varies by region. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `amenity=fuel` nodes and ways (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-09-30T21:43:32Z |
| **Method** | Per-nation/territory Overpass bbox tiles, clipped to OSM admin polygons (Nominatim) |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

| Property | Meaning |
|---|---|
| `name` | OSM `name` when present; otherwise a **pipeline generic** (`"Petrol station"`) — not an OSM-verified name |
| `brand` | OSM `brand` or `operator` when tagged |
| `osm_id` / `osm_url` | Source object id and deep link |
| `note` | **Pipeline field**, not OSM `note=*`. Usually copies `brand`/`operator`, else `"OpenStreetMap"` |
| `layer` / `source` | App metadata (`petrol` / extract provenance) |

Ways are stored as **centre points** (`out center`), not polygons
(5 672 of 10 267). Pipeline-filled generic names: 1 231 (~12%). Pipeline
`note` copies brand/operator on 8 726 features.

## EV charging (`ev`)

| | |
|---|---|
| **File** | `public/data/ev.geojson` |
| **Features** | 9 420 points |
| **Coverage** | Same admin-area footprint as petrol: England 6 564, Scotland 1 123, Wales 318, Northern Ireland 252, Ireland 1 096, Isle of Man 60, Guernsey 1, Jersey 6. **Northern France bleed ≈ 0** (was ~202). |
| **Sample vs full** | Admin-area extract of OSM `amenity=charging_station` at extract time. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `amenity=charging_station` nodes and ways (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-09-30T21:43:32Z |
| **Method** | Same as petrol |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same as petrol, with generic missing names filled as `"EV charging"`.

`amenity=charging_station` objects are sometimes a whole site and sometimes a
single device, so **feature counts are not site counts**. Ways as centre
points: 913. Pipeline-filled generic names: 6 697 (~71%) — many chargers are
untagged for `name` in OSM.

## Power plants (`power`)

| | |
|---|---|
| **File** | `public/data/power.geojson` |
| **Features** | 2 821 points |
| **Coverage** | Same admin-area footprint: England 2 045, Scotland 328, Wales 216, Northern Ireland 84, Ireland 135, Isle of Man 4, Guernsey 5, Jersey 4. **Northern France bleed ≈ 0**. |
| **Sample vs full** | Admin-area extract of OSM `power=plant` at extract time. Individual `power=generator` devices are **not** included. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `power=plant` nodes and ways (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-09-30T21:55:32Z |
| **Method** | Same admin-area pipeline as petrol/EV (`scripts/extract_osm_power.py`) |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as petrol/EV (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Power plant"`. Almost all features are ways stored as centre points
(2 817 of 2 821).

## Remaining honest caveats

- OSM tagging completeness varies; absence of a station on the map is not proof
  it does not exist on the ground.
- Ways are centre points, not footprints.
- `name` / `note` generics are pipeline fills, not OSM-verified labels.
- Guernsey EV count is only 1 in OSM at extract time — likely under-tagged.
- Power layer is `power=plant` sites only (not every turbine/generator).
- Extract uses polygon clip + buffer; stations extremely close to a land border
  could in theory be included or excluded by the ~200 m buffer.

## Basemap (unchanged)

- Hillshade tiles © Esri, USGS, NOAA
- Water / boundaries © OpenStreetMap contributors via OpenMapTiles / OpenFreeMap
