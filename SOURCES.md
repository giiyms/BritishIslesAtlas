# Data sources

British Isles Atlas ships static GeoJSON under `public/data/` so the map never
runs live Overpass (or other) queries while panning.

## Extract pipeline

The petrol and EV layers are rebuilt by `scripts/extract_osm_fuel_ev.py`; power by
`scripts/extract_osm_power.py`; hospitals by `scripts/extract_osm_hospitals.py`;
fire stations by `scripts/extract_osm_fire_stations.py`; police by
`scripts/extract_osm_police.py`; castles by `scripts/extract_osm_castles.py`; libraries by
`scripts/extract_osm_libraries.py`.
Shared pipeline:

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

## Hospitals (`hospitals`)

| | |
|---|---|
| **File** | `public/data/hospitals.geojson` |
| **Features** | 1 946 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 1 405, Scotland 184, Wales 116, Northern Ireland 39, Ireland 192, Isle of Man 2, Guernsey 4, Jersey 4. **Northern France bleed ≈ 0**. |
| **Sample vs full** | Admin-area extract of OSM `amenity=hospital` at extract time. Clinics (`amenity=clinic`), GPs (`amenity=doctors`), and `healthcare=hospital` without `amenity=hospital` are **not** included. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `amenity=hospital` nodes and ways (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-09-30T23:21:25Z |
| **Method** | Same admin-area pipeline as petrol/EV/power (`scripts/extract_osm_hospitals.py`) |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as petrol/EV/power (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Hospital"`. Ways as centre points: 1 704 of 1 946. Pipeline-filled generic
names: 110 (~6%).

## Fire stations (`fire-stations`)

| | |
|---|---|
| **File** | `public/data/fire-stations.geojson` |
| **Features** | 2 338 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 1 523, Scotland 363, Wales 150, Northern Ireland 74, Ireland 216, Isle of Man 6, Guernsey 2, Jersey 4. **Northern France bleed ≈ 0**. |
| **Sample vs full** | Admin-area extract of OSM `amenity=fire_station` at extract time. Hydrants (`emergency=fire_hydrant`), ambulance stations (`amenity=ambulance_station`), and `building=fire_station` without `amenity=fire_station` are **not** included. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `amenity=fire_station` nodes and ways (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-09-30T23:33:19Z |
| **Method** | Same admin-area pipeline as petrol/EV/power/hospitals (`scripts/extract_osm_fire_stations.py`) |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as petrol/EV/power/hospitals (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Fire station"`. Ways as centre points: 2 033 of 2 338. Pipeline-filled generic
names: 411 (~18%).


## Police stations (`police`)

| | |
|---|---|
| **File** | `public/data/police.geojson` |
| **Features** | 2 298 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 1 265, Scotland 310, Wales 181, Northern Ireland 70, Ireland 460, Isle of Man 7, Guernsey 2, Jersey 3. **Northern France bleed ≈ 0**. |
| **Sample vs full** | Admin-area extract of OSM `amenity=police` at extract time. Police boxes, traffic cameras, and `building=police` without `amenity=police` are **not** included. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `amenity=police` nodes and ways (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-09-30T23:44:09Z |
| **Method** | Same admin-area pipeline as petrol/EV/power/hospitals/fire (`scripts/extract_osm_police.py`) |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as petrol/EV/power/hospitals/fire (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Police station"`. Ways as centre points: 1 589 of 2 298. Pipeline-filled generic
names: 482 (~21%).



## Castles (`castles`)

| | |
|---|---|
| **File** | `public/data/castles.geojson` |
| **Features** | 2 265 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 503, Scotland 458, Wales 126, Northern Ireland 89, Ireland 1 059, Isle of Man 3, Guernsey 19, Jersey 8. **Northern France bleed ≈ 0**. |
| **Sample vs full** | Admin-area extract of OSM `historic=castle` at extract time. Forts (`historic=fort`), manors, towers, archaeological sites, and ruins **without** `historic=castle` are **not** included. Ruined castles that remain tagged `historic=castle` **are** included (common OSM usage). Ireland’s high count reflects many tower houses tagged as castles. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `historic=castle` nodes and ways (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-09-30T23:57:36Z |
| **Method** | Same admin-area pipeline as petrol/EV/power/hospitals/fire/police (`scripts/extract_osm_castles.py`) |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as petrol/EV/power/hospitals/fire/police (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Castle"`. Ways as centre points: 2 017 of 2 265. Pipeline-filled generic
names: 334 (~15%).



## Libraries (`libraries`)

| | |
|---|---|
| **File** | `public/data/libraries.geojson` |
| **Features** | 4 293 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 3 110, Scotland 468, Wales 247, Northern Ireland 109, Ireland 348, Isle of Man 7, Guernsey 3, Jersey 1. **Northern France bleed ≈ 0**. |
| **Sample vs full** | Admin-area extract of OSM `amenity=library` at extract time. Universities, colleges, schools, bookshops (`shop=books`), `building=library` without `amenity=library`, and mobile libraries **without** the tag are **not** included. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `amenity=library` nodes and ways (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-01T00:08:36Z |
| **Method** | Same admin-area pipeline as petrol/EV/power/hospitals/fire/police/castles (`scripts/extract_osm_libraries.py`) |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as petrol/EV/power/hospitals/fire/police/castles (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Library"`. Ways as centre points: 2 591 of 4 293. Pipeline-filled generic
names: 374 (~9%).

## Remaining honest caveats

- OSM tagging completeness varies; absence of a station on the map is not proof
  it does not exist on the ground.
- Ways are centre points, not footprints.
- `name` / `note` generics are pipeline fills, not OSM-verified labels.
- Guernsey EV count is only 1 in OSM at extract time — likely under-tagged.
- Power layer is `power=plant` sites only (not every turbine/generator).
- Hospitals layer is `amenity=hospital` only (not clinics, GPs, or pharmacies).
- Fire stations layer is `amenity=fire_station` only (not hydrants or ambulance stations).
- Police layer is `amenity=police` only (not police boxes or cameras).
- Castles layer is `historic=castle` only (not forts, manors, towers, or
  ruins without the castle tag). Ruined castles still tagged `historic=castle`
  are included. Ireland’s admin-clip count (1 059) is high because many tower
  houses are tagged as castles in OSM — not an inventory of “great castles”.
- Libraries layer is `amenity=library` only (not universities, colleges,
  schools, bookshops, or `building=library` without the amenity tag).
- Isle of Man has only 2 OSM hospitals at extract time — likely under-tagged
  relative to known sites; Channel Islands admin-clip counts are GG 4 / JE 4
  (hard bbox check slightly lower for Guernsey). Castles IoM admin-clip is 3;
  Guernsey Bailiwick admin-clip 19 vs hard main-island bbox ≈ 8 (Alderney /
  Sark / Herm fortifications included in Bailiwick polygon). Libraries IoM
  admin-clip is 7; Channel Islands GG 3 / JE 1.
- Extract uses polygon clip + buffer; stations extremely close to a land border
  could in theory be included or excluded by the ~200 m buffer.

## Basemap (unchanged)

- Hillshade tiles © Esri, USGS, NOAA
- Water / boundaries © OpenStreetMap contributors via OpenMapTiles / OpenFreeMap
