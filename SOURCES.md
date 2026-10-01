# Data sources

British Isles Atlas ships static GeoJSON under `public/data/` so the map never
runs live Overpass (or other) queries while panning.

## Extract pipeline

The petrol and EV layers are rebuilt by `scripts/extract_osm_fuel_ev.py`; power by
`scripts/extract_osm_power.py`; hospitals by `scripts/extract_osm_hospitals.py`;
fire stations by `scripts/extract_osm_fire_stations.py`; police by
`scripts/extract_osm_police.py`; castles by `scripts/extract_osm_castles.py`; libraries by
`scripts/extract_osm_libraries.py`; universities by
`scripts/extract_osm_universities.py`; museums by
`scripts/extract_osm_museums.py`; railway stations by
`scripts/extract_osm_railway_stations.py`; aerodromes by
`scripts/extract_osm_aerodromes.py`; ferry terminals by
`scripts/extract_osm_ferry_terminals.py`; marinas by
`scripts/extract_osm_marinas.py`; zoos by
`scripts/extract_osm_zoos.py`; theatres by
`scripts/extract_osm_theatres.py`; battlefields by
`scripts/extract_osm_battlefields.py`; cinemas by
`scripts/extract_osm_cinemas.py`; stadiums by
`scripts/extract_osm_stadiums.py`; theme parks by
`scripts/extract_osm_theme_parks.py`; viewpoints by
`scripts/extract_osm_viewpoints.py`; arts centres by
`scripts/extract_osm_arts_centres.py`; aquariums by
`scripts/extract_osm_aquariums.py`; piers by
`scripts/extract_osm_piers.py`; ruins by
`scripts/extract_osm_ruins.py`; golf courses by
`scripts/extract_osm_golf_courses.py`; galleries by
`scripts/extract_osm_galleries.py`.
Shared pipeline:

1. Load OSM admin polygons for England, Scotland, Wales, Northern Ireland,
   Ireland, Isle of Man, Guernsey, and Jersey (via Nominatim; cached under
   `scripts/cache/`, regenerable with `--refresh-polygons`).
2. Query Overpass **per-region bounding-box tiles** (not one British Isles-wide
   bbox) on `https://overpass.openstreetmap.fr/api/interpreter`.
3. **Clip** results to the admin polygon (+ ~200 m buffer) so mainland France
   and cross-border spill are dropped.
4. Deduplicate by OSM `type/id`. Ways are stored as **centre points**
   (`out center`). The aerodromes, ferry-terminals, marinas, zoos, theatres, battlefields, cinemas, stadiums, theme-parks, viewpoints, arts-centres, aquariums, piers, ruins, golf-courses, and galleries extractors
   also query **relations** and store them as centre points the same way;
   other layers remain node+way only unless noted.

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



## Universities (`universities`)

| | |
|---|---|
| **File** | `public/data/universities.geojson` |
| **Features** | 986 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 775, Scotland 84, Wales 5, Northern Ireland 14, Ireland 106, Isle of Man 2, Guernsey 0, Jersey 0. **Northern France bleed ≈ 0**. |
| **Sample vs full** | Admin-area extract of OSM `amenity=university` at extract time. Colleges (`amenity=college`), schools (`amenity=school`), libraries, `building=university` without `amenity=university`, and faculties tagged only as college are **not** included. **Feature counts are campus/site objects, not institution counts** (one university may appear as several campus ways/nodes). |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `amenity=university` nodes and ways (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-01T00:18:50Z |
| **Method** | Same admin-area pipeline as petrol/EV/power/hospitals/fire/police/castles/libraries (`scripts/extract_osm_universities.py`) |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as petrol/EV/power/hospitals/fire/police/castles/libraries (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"University"`. Ways as centre points: 813 of 986. Pipeline-filled generic
names: 60 (~6%).



## Museums (`museums`)

| | |
|---|---|
| **File** | `public/data/museums.geojson` |
| **Features** | 3 315 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 2 233, Scotland 465, Wales 235, Northern Ireland 72, Ireland 256, Isle of Man 24, Guernsey 14, Jersey 16. **Northern France bleed ≈ 0**. |
| **Sample vs full** | Admin-area extract of OSM `tourism=museum` at extract time. Galleries (`tourism=gallery`), generic attractions (`tourism=attraction`), arts centres (`amenity=arts_centre`), antique shops, `historic=*` without `tourism=museum`, and `building=museum` without the tourism tag are **not** included. **Feature counts are OSM objects, not distinct institutions** (one museum may appear as several ways/nodes). |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `tourism=museum` nodes and ways (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-01T00:29:59Z |
| **Method** | Same admin-area pipeline as petrol/EV/power/hospitals/fire/police/castles/libraries/universities (`scripts/extract_osm_museums.py`) |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as petrol/EV/power/hospitals/fire/police/castles/libraries/universities (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Museum"`. Ways as centre points: 1 858 of 3 315. Pipeline-filled generic
names: 92 (~3%).



## Railway stations (`railway-stations`)

| | |
|---|---|
| **File** | `public/data/railway-stations.geojson` |
| **Features** | 3 822 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 2 842, Scotland 412, Wales 329, Northern Ireland 65, Ireland 159, Isle of Man 13, Guernsey 2, Jersey 0. **Northern France bleed ≈ 0**. |
| **Sample vs full** | Admin-area extract of OSM `railway=station` at extract time. Halts (`railway=halt`), subway entrances (`railway=subway_entrance`), tram stops (`railway=tram_stop`), bus stations (`amenity=bus_station`), `public_transport=station` without `railway=station`, and `building=train_station` without the railway tag are **not** included. Heritage / disused stations that remain tagged `railway=station` **are** included. **Feature counts are OSM objects, not distinct stations** (a complex may appear as several ways/nodes). |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `railway=station` nodes and ways (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-01T00:39:16Z |
| **Method** | Same admin-area pipeline as petrol/EV/power/hospitals/fire/police/castles/libraries/universities/museums (`scripts/extract_osm_railway_stations.py`) |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as petrol/EV/power/hospitals/fire/police/castles/libraries/universities/museums (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Railway station"`. Ways as centre points: 14 of 3 822. Pipeline-filled generic
names: 44 (~1%).



## Aerodromes (`aerodromes`)

| | |
|---|---|
| **File** | `public/data/aerodromes.geojson` |
| **Features** | 910 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 654, Scotland 89, Wales 36, Northern Ireland 28, Ireland 96, Isle of Man 4, Guernsey 2, Jersey 1. **Northern France bleed ≈ 0**. |
| **Sample vs full** | Admin-area extract of OSM `aeroway=aerodrome` at extract time (nodes, ways, **and relations**). Helipads (`aeroway=helipad`), airstrips tagged only as `aeroway=airstrip` (not `aerodrome`), runways, taxiways, hangars, terminals (`aeroway=terminal`), and gates are **not** included. Military / disused sites that remain tagged `aeroway=aerodrome` **are** included. **Feature counts are OSM objects, not distinct airports** (a complex may appear as several nodes/ways/relations). Major sites mapped only as multipolygon relations (e.g. London Heathrow Airport `relation/14001268`) are included via Overpass centre points. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `aeroway=aerodrome` nodes, ways, and relations (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-01T01:01:25Z |
| **Method** | Same admin-area pipeline as petrol/EV/power/hospitals/fire/police/castles/libraries/universities/museums/railway stations (`scripts/extract_osm_aerodromes.py`), extended to include OSM relations |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as petrol/EV/power/hospitals/fire/police/castles/libraries/universities/museums/railway stations (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Aerodrome"`. Ways as centre points: 379 of 910; relations as centre points:
25 of 910. Pipeline-filled generic names: 1 (~0%).

## Ferry terminals (`ferry-terminals`)

| | |
|---|---|
| **File** | `public/data/ferry-terminals.geojson` |
| **Features** | 834 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 435, Scotland 242, Wales 29, Northern Ireland 17, Ireland 99, Isle of Man 3, Guernsey 7, Jersey 2. **Northern France bleed ≈ 0**. |
| **Sample vs full** | Admin-area extract of OSM `amenity=ferry_terminal` at extract time (nodes, ways, **and relations**). Piers (`man_made=pier`), harbours, `route=ferry` ways, `public_transport=station` without `ferry_terminal`, and `ferry=*` vehicle tags alone are **not** included. Disused terminals that remain tagged `amenity=ferry_terminal` **are** included. **Feature counts are OSM objects, not distinct terminals** (a complex may appear as several nodes/ways/relations — e.g. Dover berths). Large sites mapped as multipolygon relations are included via Overpass centre points. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `amenity=ferry_terminal` nodes, ways, and relations (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-01T01:09:48Z |
| **Method** | Same admin-area pipeline as aerodromes (`scripts/extract_osm_ferry_terminals.py`), including OSM relations |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as petrol/EV/power/hospitals/fire/police/castles/libraries/universities/museums/railway stations/aerodromes (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Ferry terminal"`. Ways as centre points: 109 of 834; relations as centre points:
3 of 834. Pipeline-filled generic names: 302 (~36%).

## Marinas (`marinas`)

| | |
|---|---|
| **File** | `public/data/marinas.geojson` |
| **Features** | 1 198 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 754, Scotland 135, Wales 61, Northern Ireland 58, Ireland 171, Isle of Man 2, Guernsey 6, Jersey 11. **Northern France bleed ≈ 0**. |
| **Sample vs full** | Admin-area extract of OSM `leisure=marina` at extract time (nodes, ways, **and relations**). Harbours (`harbour=yes` / `leisure=harbour`), slipways, boat rentals, piers without `leisure=marina`, and seamark marina tags without the leisure tag are **not** included. Disused marinas that remain tagged `leisure=marina` **are** included. **Feature counts are OSM objects, not distinct marinas** (a complex may appear as several nodes/ways/relations). Large sites mapped as multipolygon relations are included via Overpass centre points. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `leisure=marina` nodes, ways, and relations (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-01T01:22:39Z |
| **Method** | Same admin-area pipeline as aerodromes/ferry terminals (`scripts/extract_osm_marinas.py`), including OSM relations |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as petrol/EV/power/hospitals/fire/police/castles/libraries/universities/museums/railway stations/aerodromes/ferry terminals (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Marina"`. Ways as centre points: 826 of 1 198; relations as centre points:
31 of 1 198. Pipeline-filled generic names: 286 (~24%).

## Zoos (`zoos`)

| | |
|---|---|
| **File** | `public/data/zoos.geojson` |
| **Features** | 309 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 231, Scotland 31, Wales 16, Northern Ireland 7, Ireland 22, Isle of Man 1, Guernsey 0, Jersey 1. **Northern France bleed ≈ 0**. |
| **Sample vs full** | Admin-area extract of OSM `tourism=zoo` at extract time (nodes, ways, **and relations**). Aquariums (`tourism=aquarium`), wildlife parks without `tourism=zoo`, animal shelters/boarding, theme parks, and safari/farm parks lacking the zoo tag are **not** included. Disused zoos that remain tagged `tourism=zoo` **are** included. OSM often tags petting / children's farms as `tourism=zoo` — those objects are included when so tagged. **Feature counts are OSM objects, not distinct zoos** (a complex may appear as several nodes/ways/relations). Large sites mapped as multipolygon relations are included via Overpass centre points. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `tourism=zoo` nodes, ways, and relations (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-01T01:35:17Z |
| **Method** | Same admin-area pipeline as aerodromes/ferry terminals/marinas (`scripts/extract_osm_zoos.py`), including OSM relations |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as petrol/EV/power/hospitals/fire/police/castles/libraries/universities/museums/railway stations/aerodromes/ferry terminals/marinas (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Zoo"`. Ways as centre points: 237 of 309; relations as centre points:
16 of 309. Pipeline-filled generic names: 20 (~6%).

## Theatres (`theatres`)

| | |
|---|---|
| **File** | `public/data/theatres.geojson` |
| **Features** | 1 765 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 1 340, Scotland 153, Wales 82, Northern Ireland 32, Ireland 152, Isle of Man 3, Guernsey 1, Jersey 2. **Northern France bleed ≈ 0**. |
| **Sample vs full** | Admin-area extract of OSM `amenity=theatre` at extract time (nodes, ways, **and relations**). Cinemas (`amenity=cinema`), arts centres (`amenity=arts_centre`), community centres, nightclubs, and attractions without `amenity=theatre` are **not** included. Disused theatres that remain tagged `amenity=theatre` **are** included. **Feature counts are OSM objects, not distinct theatres** (a complex may appear as several nodes/ways/relations). Large sites mapped as multipolygon relations are included via Overpass centre points. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `amenity=theatre` nodes, ways, and relations (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-01T01:49:57Z |
| **Method** | Same admin-area pipeline as aerodromes/ferry terminals/marinas/zoos (`scripts/extract_osm_theatres.py`), including OSM relations |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as petrol/EV/power/hospitals/fire/police/castles/libraries/universities/museums/railway stations/aerodromes/ferry terminals/marinas/zoos (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Theatre"`. Ways as centre points: 1 156 of 1 765; relations as centre points:
18 of 1 765. Pipeline-filled generic names: 134 (~8%).

## Battlefields (`battlefields`)

| | |
|---|---|
| **File** | `public/data/battlefields.geojson` |
| **Features** | 159 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 87, Scotland 40, Wales 6, Northern Ireland 8, Ireland 17, Isle of Man 1, Guernsey 0, Jersey 0. **Northern France bleed ≈ 0**. |
| **Sample vs full** | Admin-area extract of OSM `historic=battlefield` at extract time (nodes, ways, **and relations**). Memorials, ruins, castles, war memorials, and sites without `historic=battlefield` are **not** included. Commemorative / heritage sites that remain tagged `historic=battlefield` **are** included. **Feature counts are OSM objects, not distinct battles** (a site may appear as several nodes/ways/relations). Large sites mapped as multipolygon relations are included via Overpass centre points (0 relations after admin-clip at this extract; query still includes relations). |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `historic=battlefield` nodes, ways, and relations (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-01T02:03:40Z |
| **Method** | Same admin-area pipeline as aerodromes/ferry terminals/marinas/zoos/theatres (`scripts/extract_osm_battlefields.py`), including OSM relations |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as petrol/EV/power/hospitals/fire/police/castles/libraries/universities/museums/railway stations/aerodromes/ferry terminals/marinas/zoos/theatres (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Battlefield"`. Ways as centre points: 12 of 159; relations as centre points:
0 of 159. Pipeline-filled generic names: 22 (~14%).

## Cinemas (`cinemas`)

| | |
|---|---|
| **File** | `public/data/cinemas.geojson` |
| **Features** | 924 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 681, Scotland 69, Wales 44, Northern Ireland 39, Ireland 87, Isle of Man 1, Guernsey 2, Jersey 1. **Northern France bleed ≈ 0**. |
| **Sample vs full** | Admin-area extract of OSM `amenity=cinema` at extract time (nodes, ways, **and relations**). Theatres (`amenity=theatre`), arts centres (`amenity=arts_centre`), community centres, nightclubs, and attractions without `amenity=cinema` are **not** included. Disused cinemas that remain tagged `amenity=cinema` **are** included. **Feature counts are OSM objects, not distinct cinemas** (a multiplex may appear as several nodes/ways/relations). Large sites mapped as multipolygon relations are included via Overpass centre points. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `amenity=cinema` nodes, ways, and relations (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-01T02:14:42Z |
| **Method** | Same admin-area pipeline as aerodromes/ferry terminals/marinas/zoos/theatres/battlefields (`scripts/extract_osm_cinemas.py`), including OSM relations |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as petrol/EV/power/hospitals/fire/police/castles/libraries/universities/museums/railway stations/aerodromes/ferry terminals/marinas/zoos/theatres/battlefields (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Cinema"`. Ways as centre points: 451 of 924; relations as centre points:
2 of 924. Pipeline-filled generic names: 20 (~2%).

## Stadiums (`stadiums`)

| | |
|---|---|
| **File** | `public/data/stadiums.geojson` |
| **Features** | 662 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 442, Scotland 66, Wales 42, Northern Ireland 24, Ireland 85, Isle of Man 0, Guernsey 2, Jersey 1. **Northern France bleed ≈ 0**. |
| **Sample vs full** | Admin-area extract of OSM `leisure=stadium` at extract time (nodes, ways, **and relations**). Sports centres (`leisure=sports_centre`), pitches (`leisure=pitch`), tracks (`leisure=track`), and `building=stadium` without `leisure=stadium` are **not** included. Disused stadiums that remain tagged `leisure=stadium` **are** included. **Feature counts are OSM objects, not distinct stadiums** (a complex may appear as several nodes/ways/relations). Large sites mapped as multipolygon relations are included via Overpass centre points. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `leisure=stadium` nodes, ways, and relations (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-01T02:28:10Z |
| **Method** | Same admin-area pipeline as aerodromes/ferry terminals/marinas/zoos/theatres/battlefields/cinemas (`scripts/extract_osm_stadiums.py`), including OSM relations |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as petrol/EV/power/hospitals/fire/police/castles/libraries/universities/museums/railway stations/aerodromes/ferry terminals/marinas/zoos/theatres/battlefields/cinemas (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Stadium"`. Ways as centre points: 615 of 662; relations as centre points:
35 of 662. Pipeline-filled generic names: 42 (~6%).

## Theme parks (`theme-parks`)

| | |
|---|---|
| **File** | `public/data/theme-parks.geojson` |
| **Features** | 209 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 160, Scotland 11, Wales 13, Northern Ireland 7, Ireland 18, Isle of Man 0, Guernsey 0, Jersey 0. **Northern France bleed ≈ 0**. |
| **Sample vs full** | Admin-area extract of OSM `tourism=theme_park` at extract time (nodes, ways, **and relations**). Generic attractions (`tourism=attraction`), zoos (`tourism=zoo`), water parks (`leisure=water_park`), amusement arcades (`leisure=amusement_arcade`), and fairgrounds without `tourism=theme_park` are **not** included. Disused parks that remain tagged `tourism=theme_park` **are** included. OSM sometimes tags indoor soft-play / activity centres as `tourism=theme_park` — those objects are included when so tagged. **Feature counts are OSM objects, not distinct parks** (a complex may appear as several nodes/ways/relations). Large sites mapped as multipolygon relations are included via Overpass centre points. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `tourism=theme_park` nodes, ways, and relations (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-01T02:45:37Z |
| **Method** | Same admin-area pipeline as aerodromes/ferry terminals/marinas/zoos/theatres/battlefields/cinemas/stadiums (`scripts/extract_osm_theme_parks.py`), including OSM relations |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as petrol/EV/power/hospitals/fire/police/castles/libraries/universities/museums/railway stations/aerodromes/ferry terminals/marinas/zoos/theatres/battlefields/cinemas/stadiums (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Theme park"`. Ways as centre points: 153 of 209; relations as centre points:
8 of 209. Pipeline-filled generic names: 8 (~4%).

## Viewpoints (`viewpoints`)

| | |
|---|---|
| **File** | `public/data/viewpoints.geojson` |
| **Features** | 5 823 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 3 168, Scotland 1 179, Wales 455, Northern Ireland 192, Ireland 719, Isle of Man 26, Guernsey 43, Jersey 41. **Northern France bleed ≈ 0**. |
| **Sample vs full** | Admin-area extract of OSM `tourism=viewpoint` at extract time (nodes, ways, **and relations**). Peaks / mountain tops without `tourism=viewpoint`, generic attractions (`tourism=attraction`), benches with a view (`amenity=bench`), guideposts (`information=guidepost`), and scenic overlooks lacking the tourism tag are **not** included. Orientation / `direction=*` tags are unused for geometry. **Feature counts are OSM objects, not distinct scenic spots** (a site may appear as several nodes/ways/relations). Rare multipolygon relations are included via Overpass centre points. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `tourism=viewpoint` nodes, ways, and relations (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-01T03:01:07Z |
| **Method** | Same admin-area pipeline as aerodromes/ferry terminals/marinas/zoos/theatres/battlefields/cinemas/stadiums/theme parks (`scripts/extract_osm_viewpoints.py`), including OSM relations |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as petrol/EV/power/hospitals/fire/police/castles/libraries/universities/museums/railway stations/aerodromes/ferry terminals/marinas/zoos/theatres/battlefields/cinemas/stadiums/theme parks (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Viewpoint"`. Ways as centre points: 122 of 5 823; relations as centre points:
1 of 5 823. Pipeline-filled generic names: 4 221 (~72%) — many viewpoints are
untagged for `name` in OSM.

## Arts centres (`arts-centres`)

| | |
|---|---|
| **File** | `public/data/arts-centres.geojson` |
| **Features** | 870 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 601, Scotland 94, Wales 46, Northern Ireland 14, Ireland 111, Isle of Man 3, Guernsey 1, Jersey 0. **Northern France bleed ≈ 0**. |
| **Sample vs full** | Admin-area extract of OSM `amenity=arts_centre` at extract time (nodes, ways, **and relations**). Theatres (`amenity=theatre`), cinemas (`amenity=cinema`), community centres (`amenity=community_centre`), museums (`tourism=museum`), galleries (`tourism=gallery`), and attractions without `amenity=arts_centre` are **not** included. Disused centres that remain tagged `amenity=arts_centre` **are** included. **Feature counts are OSM objects, not distinct centres** (a complex may appear as several nodes/ways/relations). Large sites mapped as multipolygon relations are included via Overpass centre points. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `amenity=arts_centre` nodes, ways, and relations (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-01T03:13:21Z |
| **Method** | Same admin-area pipeline as aerodromes/ferry terminals/marinas/zoos/theatres/battlefields/cinemas/stadiums/theme parks/viewpoints (`scripts/extract_osm_arts_centres.py`), including OSM relations |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as petrol/EV/power/hospitals/fire/police/castles/libraries/universities/museums/railway stations/aerodromes/ferry terminals/marinas/zoos/theatres/battlefields/cinemas/stadiums/theme parks/viewpoints (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Arts centre"`. Ways as centre points: 481 of 870; relations as centre points:
9 of 870. Pipeline-filled generic names: 19 (~2%).


## Aquariums (`aquariums`)

| | |
|---|---|
| **File** | `public/data/aquariums.geojson` |
| **Features** | 52 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 41, Scotland 5, Wales 2, Northern Ireland 1, Ireland 3, Isle of Man 0, Guernsey 0, Jersey 0. **Northern France bleed ≈ 0**. |
| **Sample vs full** | Admin-area extract of OSM `tourism=aquarium` at extract time (nodes, ways, **and relations**). Zoos (`tourism=zoo`), generic attractions (`tourism=attraction`), pet shops, and animal boarding without `tourism=aquarium` are **not** included. Koi / ornamental fish shops that carry `tourism=aquarium` in OSM **are** included (tagging noise). Disused sites that remain tagged `tourism=aquarium` **are** included. **Feature counts are OSM objects, not distinct aquariums** (a complex may appear as several nodes/ways/relations). Large sites mapped as multipolygon relations are included via Overpass centre points. Sparse Isles-wide inventory (~52 objects); major sites may still be tagged only as `tourism=attraction` or `tourism=zoo`. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `tourism=aquarium` nodes, ways, and relations (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-01T03:27:43Z |
| **Method** | Same admin-area pipeline as aerodromes/ferry terminals/marinas/zoos/theatres/battlefields/cinemas/stadiums/theme parks/viewpoints/arts centres (`scripts/extract_osm_aquariums.py`), including OSM relations |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as petrol/EV/power/hospitals/fire/police/castles/libraries/universities/museums/railway stations/aerodromes/ferry terminals/marinas/zoos/theatres/battlefields/cinemas/stadiums/theme parks/viewpoints/arts centres (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Aquarium"`. Ways as centre points: 38 of 52; relations as centre points:
1 of 52. Pipeline-filled generic names: 5 (~10%).

## Piers (`piers`)

| | |
|---|---|
| **File** | `public/data/piers.geojson` |
| **Features** | 1340 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 723, Scotland 161, Wales 71, Northern Ireland 33, Ireland 338, Isle of Man 12, Guernsey 0, Jersey 2. **Northern France bleed ≈ 0**. |
| **Sample vs full** | Admin-area extract of OSM `man_made=pier` **with `name=*`** at extract time (nodes, ways, **and relations**). Unnamed pier / jetty / pontoon segments are **not** included (raw `man_made=pier` is ~20k+ mostly linear coastal noise). `man_made=jetty`, `man_made=breakwater`, `man_made=groyne`, `leisure=marina`, `amenity=ferry_terminal`, and `pier=*` without `man_made=pier` are **not** included. Disused / closed piers that remain tagged `man_made=pier` with a name **are** included. **Feature counts are OSM objects, not distinct piers** (a complex may appear as several nodes/ways/relations). Large sites mapped as multipolygon / site relations are included via Overpass centre points. Named-only filter keeps coastal pleasure / ferry piers while dropping anonymous jetty segments. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `man_made=pier` + `name=*` nodes, ways, and relations (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-01T03:38:55Z |
| **Method** | Same admin-area pipeline as aerodromes/ferry terminals/marinas/zoos/theatres/battlefields/cinemas/stadiums/theme parks/viewpoints/arts centres/aquariums (`scripts/extract_osm_piers.py`), including OSM relations; Overpass and Python both require `name=*` |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as petrol/EV/power/hospitals/fire/police/castles/libraries/universities/museums/railway stations/aerodromes/ferry terminals/marinas/zoos/theatres/battlefields/cinemas/stadiums/theme parks/viewpoints/arts centres/aquariums (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Pier"` (should be rare given the name filter). Ways as centre points: 1317 of 1340; relations as centre points:
14 of 1340. Pipeline-filled generic names: 1 (~0.1%).


## Ruins (`ruins`)

| | |
|---|---|
| **File** | `public/data/ruins.geojson` |
| **Features** | 4801 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 2166, Scotland 1008, Wales 452, Northern Ireland 108, Ireland 981, Isle of Man 73, Guernsey 9, Jersey 4. **Northern France bleed ≈ 0**. |
| **Sample vs full** | Admin-area extract of OSM `historic=ruins` **with `name=*`** at extract time (nodes, ways, **and relations**). Unnamed ruin fragments are **not** included (raw unfiltered `historic=ruins` is timeout-prone / huge Isles-wide). `historic=castle`, `historic=archaeological_site`, `historic=monument`, `ruins=yes` on other keys, and `building=ruins` without `historic=ruins` are **not** included. Disused sites that remain tagged `historic=ruins` with a name **are** included. **Feature counts are OSM objects, not distinct sites** (a complex may appear as several nodes/ways/relations). Large sites mapped as multipolygon / site relations are included via Overpass centre points. Named-only filter + fine regional tiling (`--max-span 1.5`) keep the extract tractable. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `historic=ruins` + `name=*` nodes, ways, and relations (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-01T04:11:18Z |
| **Method** | Same admin-area pipeline as aerodromes/ferry terminals/marinas/zoos/theatres/battlefields/cinemas/stadiums/theme parks/viewpoints/arts centres/aquariums/piers (`scripts/extract_osm_ruins.py`), including OSM relations; Overpass and Python both require `name=*`; tighter default tile span (1.5°) |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as petrol/EV/power/hospitals/fire/police/castles/libraries/universities/museums/railway stations/aerodromes/ferry terminals/marinas/zoos/theatres/battlefields/cinemas/stadiums/theme parks/viewpoints/arts centres/aquariums/piers (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Ruins"` (should be rare given the name filter). Ways as centre points: 2726 of 4801; relations as centre points:
83 of 4801. Pipeline-filled generic names: 1 (~0.02%).


## Golf courses (`golf-courses`)

| | |
|---|---|
| **File** | `public/data/golf-courses.geojson` |
| **Features** | 3759 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 2266, Scotland 603, Wales 207, Northern Ireland 113, Ireland 549, Isle of Man 9, Guernsey 5, Jersey 7. **Northern France bleed ≈ 0**. |
| **Sample vs full** | Admin-area extract of OSM `leisure=golf_course` at extract time (nodes, ways, **and relations**). Driving ranges without `leisure=golf_course`, `leisure=sports_centre`, `leisure=pitch`, `leisure=miniature_golf`, and `golf=*` without the leisure tag are **not** included. Disused courses that remain tagged `leisure=golf_course` **are** included. Unnamed courses keep the generic label `"Golf course"`. **Feature counts are OSM objects, not distinct courses** (a complex may appear as several nodes/ways/relations). Large courses mapped as multipolygon / site relations are included via Overpass centre points (Heathrow lesson). Default regional tiling `--max-span 2.0`. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `leisure=golf_course` nodes, ways, and relations (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-01T05:12:01Z |
| **Method** | Same admin-area pipeline as aerodromes/ferry terminals/marinas/zoos/theatres/battlefields/cinemas/stadiums/theme parks/viewpoints/arts centres/aquariums/piers/ruins (`scripts/extract_osm_golf_courses.py`), including OSM relations; default tile span 2.0° |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as petrol/EV/power/hospitals/fire/police/castles/libraries/universities/museums/railway stations/aerodromes/ferry terminals/marinas/zoos/theatres/battlefields/cinemas/stadiums/theme parks/viewpoints/arts centres/aquariums/piers/ruins (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Golf course"`. Ways as centre points: 3211 of 3759; relations as centre points:
499 of 3759. Pipeline-filled generic names: 275 (~7.3%).


## Galleries (`galleries`)

| | |
|---|---|
| **File** | `public/data/galleries.geojson` |
| **Features** | 1390 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 1014, Scotland 160, Wales 81, Northern Ireland 18, Ireland 106, Isle of Man 1, Guernsey 3, Jersey 7. **Northern France bleed ≈ 0**. |
| **Sample vs full** | Admin-area extract of OSM `tourism=gallery` at extract time (nodes, ways, **and relations**). Museums (`tourism=museum`), arts centres (`amenity=arts_centre`), art shops (`shop=art`) without `tourism=gallery`, and generic attractions (`tourism=attraction`) without `tourism=gallery` are **not** included. This layer is the complement to the museums layer, which already excludes galleries in its sample-vs-full note. Disused galleries that remain tagged `tourism=gallery` **are** included. Unnamed galleries keep the generic label `"Gallery"`. **Feature counts are OSM objects, not distinct galleries** (a complex may appear as several nodes/ways/relations). Large sites mapped as multipolygon / site relations are included via Overpass centre points (Heathrow lesson). Default regional tiling `--max-span 2.0`. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `tourism=gallery` nodes, ways, and relations (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-01T15:24:23Z |
| **Method** | Same admin-area pipeline as aerodromes/ferry terminals/marinas/zoos/theatres/battlefields/cinemas/stadiums/theme parks/viewpoints/arts centres/aquariums/piers/ruins/golf courses (`scripts/extract_osm_galleries.py`), including OSM relations; default tile span 2.0° |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as petrol/EV/power/hospitals/fire/police/castles/libraries/universities/museums/railway stations/aerodromes/ferry terminals/marinas/zoos/theatres/battlefields/cinemas/stadiums/theme parks/viewpoints/arts centres/aquariums/piers/ruins/golf courses (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Gallery"`. Ways as centre points: 434 of 1390; relations as centre points:
3 of 1390. Pipeline-filled generic names: 99 (~7.1%).


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
- Universities layer is `amenity=university` only (not colleges, schools,
  libraries, or `building=university` without the amenity tag). Counts are
  campus/site objects, not distinct institutions. Wales admin-clip is only 5
  at extract time — likely under-tagged relative to known HE providers.
  Channel Islands have 0 tagged universities (expected for GG/JE); IoM has 2.
- Museums layer is `tourism=museum` only (not galleries, generic attractions,
  arts centres, antique shops, or `building=museum` / `historic=*` without the
  tourism tag). Galleries are covered by the separate `tourism=gallery`
  layer (complement). Counts are OSM objects, not distinct institutions.
  Guernsey Bailiwick admin-clip is 14 vs hard main-island bbox ≈ 12
  (Alderney / Sark / Herm sites included in Bailiwick polygon).
- Railway stations layer is `railway=station` only (not halts, subway
  entrances, tram stops, bus stations, or `public_transport=station` /
  `building=train_station` without the railway tag). Heritage / disused
  stations still tagged `railway=station` are included. Counts are OSM
  objects, not distinct stations. Guernsey Bailiwick admin-clip is 2 vs
  hard main-island bbox ≈ 0 (outer Bailiwick sites); Jersey 0 (no active
  mainline; expected). Isle of Man admin-clip is 13 (heritage lines such as
  the Steam Railway / MER are commonly tagged `railway=station`).
- Aerodromes layer is `aeroway=aerodrome` only (not helipads, airstrips
  tagged only `aeroway=airstrip`, runways, taxiways, hangars, terminals, or
  gates). Military / disused sites still tagged `aeroway=aerodrome` are
  included. Extract includes **nodes, ways, and relations**; ways and
  relations are Overpass centre points, not footprints. A site may appear
  both as a relation and as member ways/nodes if both carry
  `aeroway=aerodrome` (dedupe is by OSM `type/id` only — not by name or
  ICAO). Counts are OSM objects, not distinct airports. Isle of Man
  admin-clip is 4; Guernsey Bailiwick admin-clip 2 vs hard main-island bbox
  ≈ 1 (outer Bailiwick, e.g. Alderney); Jersey 1 (Jersey Airport).
- Ferry terminals layer is `amenity=ferry_terminal` only (not piers,
  harbours, `route=ferry` ways, `public_transport=station` without the
  amenity tag, or `ferry=*` vehicle tags alone). Disused terminals still
  tagged `amenity=ferry_terminal` are included. Extract includes **nodes,
  ways, and relations**; ways and relations are Overpass centre points, not
  footprints. A site may appear both as a relation and as member ways/nodes
  if both carry `amenity=ferry_terminal` (dedupe by OSM `type/id` only).
  Counts are OSM objects, not distinct terminals (Dover has multiple berth
  objects). OSM completeness varies — e.g. Larne Harbour area may lack the
  amenity tag at extract time even when Holyhead / Rosslare / Douglas are
  present. Isle of Man admin-clip is 3; Guernsey Bailiwick admin-clip 7 vs
  hard main-island bbox ≈ 5 (outer Bailiwick); Jersey 2.
- Marinas layer is `leisure=marina` only (not harbours, slipways, boat
  rentals, piers without the leisure tag, `leisure=harbour`, or seamark
  marina tags alone). Disused marinas still tagged `leisure=marina` are
  included. Extract includes **nodes, ways, and relations**; ways and
  relations are Overpass centre points, not footprints. A site may appear
  both as a relation and as member ways/nodes if both carry
  `leisure=marina` (dedupe by OSM `type/id` only). Counts are OSM objects,
  not distinct marinas. Isle of Man admin-clip is 2; Guernsey Bailiwick
  admin-clip 6 vs hard main-island bbox ≈ 5 (outer Bailiwick); Jersey 11.
- Zoos layer is `tourism=zoo` only (not aquariums, wildlife parks without
  the zoo tag, animal shelters/boarding, theme parks, or safari/farm parks
  lacking `tourism=zoo`). Petting / children's farms tagged `tourism=zoo`
  in OSM **are** included. Disused zoos still tagged `tourism=zoo` are
  included. Extract includes **nodes, ways, and relations**; ways and
  relations are Overpass centre points, not footprints. A site may appear
  both as a relation and as member ways/nodes if both carry `tourism=zoo`
  (dedupe by OSM `type/id` only). Counts are OSM objects, not distinct
  zoos. Isle of Man admin-clip is 1; Guernsey Bailiwick admin-clip 0;
  Jersey 1 (Jersey Zoo). Hard main-island bbox checks match admin-clip
  for IoM/GG/JE at extract time.
- Theatres layer is `amenity=theatre` only (not cinemas, arts centres,
  community centres, nightclubs, or attractions without the amenity tag).
  Disused theatres still tagged `amenity=theatre` are included. Extract
  includes **nodes, ways, and relations**; ways and relations are Overpass
  centre points, not footprints. A site may appear both as a relation and
  as member ways/nodes if both carry `amenity=theatre` (dedupe by OSM
  `type/id` only). Counts are OSM objects, not distinct theatres. Isle of
  Man admin-clip is 3; Guernsey Bailiwick admin-clip 1; Jersey 2.
- Battlefields layer is `historic=battlefield` only (not memorials, ruins,
  castles, war memorials, or sites without the historic tag). Commemorative
  / heritage sites still tagged `historic=battlefield` are included. Extract
  includes **nodes, ways, and relations**; ways and relations are Overpass
  centre points, not footprints. A site may appear both as a relation and
  as member ways/nodes if both carry `historic=battlefield` (dedupe by OSM
  `type/id` only). Counts are OSM objects, not distinct battles. At this
  extract 0 relations survived admin-clip (bbox probe had ~1 relation in the
  Isles envelope — outside clip or untagged after refresh). Isle of Man
  admin-clip is 1; Channel Islands GG 0 / JE 0 (expected under-tagging).
  OSM inventory is incomplete relative to Historic England / Historic
  Environment Scotland / Cadw / NIEA battlefield registers.
- Cinemas layer is `amenity=cinema` only (not theatres, arts centres,
  community centres, nightclubs, or attractions without the amenity tag).
  Disused cinemas still tagged `amenity=cinema` are included. Extract
  includes **nodes, ways, and relations**; ways and relations are Overpass
  centre points, not footprints. A site may appear both as a relation and
  as member ways/nodes if both carry `amenity=cinema` (dedupe by OSM
  `type/id` only). Counts are OSM objects, not distinct cinemas (multiplex
  complexes may be several objects). Isle of Man admin-clip is 1; Guernsey
  Bailiwick admin-clip 2 vs hard main-island bbox ≈ 1 (outer Bailiwick);
  Jersey 1.
- Stadiums layer is `leisure=stadium` only (not sports centres, pitches,
  tracks, or `building=stadium` without the leisure tag). Disused stadiums
  still tagged `leisure=stadium` are included. Extract includes **nodes,
  ways, and relations**; ways and relations are Overpass centre points, not
  footprints. A site may appear both as a relation and as member ways/nodes
  if both carry `leisure=stadium` (dedupe by OSM `type/id` only). Counts
  are OSM objects, not distinct stadiums. Isle of Man admin-clip is
  0; Channel Islands GG 2 / JE 1.
- Theme parks layer is `tourism=theme_park` only (not generic attractions,
  zoos, water parks, amusement arcades, or fairgrounds without the tourism
  tag). Disused parks still tagged `tourism=theme_park` are included.
  Indoor soft-play / activity centres tagged `tourism=theme_park` in OSM
  **are** included. Extract includes **nodes, ways, and relations**; ways
  and relations are Overpass centre points, not footprints. A site may
  appear both as a relation and as member ways/nodes if both carry
  `tourism=theme_park` (dedupe by OSM `type/id` only). Counts are OSM
  objects, not distinct parks. Sparse Isles-wide inventory (~209 objects);
  major parks may still be tagged only as `tourism=attraction`. Isle of Man
  admin-clip is 0; Channel Islands GG 0 / JE 0 (expected under-tagging).
- Viewpoints layer is `tourism=viewpoint` only (not `natural=peak` /
  mountain tops without the tourism tag, `tourism=attraction`,
  `amenity=bench` with a view, `information=guidepost`, or scenic overlooks
  lacking `tourism=viewpoint`). Orientation / `direction=*` is unused.
  Extract includes **nodes, ways, and relations**; ways and relations are
  Overpass centre points, not footprints. A site may appear both as a
  relation and as member ways/nodes if both carry `tourism=viewpoint`
  (dedupe by OSM `type/id` only). Counts are OSM objects, not distinct
  scenic spots. Many objects lack `name` (~72% pipeline generics at extract).
  Isle of Man admin-clip is 26; Guernsey Bailiwick admin-clip 43 vs hard
  main-island bbox ≈ 30 (outer Bailiwick); Jersey 41.
- Arts centres layer is `amenity=arts_centre` only (not theatres, cinemas,
  community centres, museums, galleries, or attractions without the amenity
  tag). Disused centres still tagged `amenity=arts_centre` are included.
  Extract includes **nodes, ways, and relations**; ways and relations are
  Overpass centre points, not footprints. A site may appear both as a
  relation and as member ways/nodes if both carry `amenity=arts_centre`
  (dedupe by OSM `type/id` only). Counts are OSM objects, not distinct
  centres. Isle of Man admin-clip is 3; Guernsey Bailiwick admin-clip 1;
  Jersey 0 (expected under-tagging).
- Aquariums layer is `tourism=aquarium` only (not zoos, generic attractions,
  pet shops, or animal boarding without the tourism tag). Koi / ornamental
  fish shops that carry `tourism=aquarium` in OSM **are** included. Disused
  sites still tagged `tourism=aquarium` are included. Extract includes
  **nodes, ways, and relations**; ways and relations are Overpass centre
  points, not footprints. A site may appear both as a relation and as member
  ways/nodes if both carry `tourism=aquarium` (dedupe by OSM `type/id` only).
  Counts are OSM objects, not distinct aquariums. Sparse Isles-wide inventory
  (~52 objects); major sites may still lack the tag. Isle of Man admin-clip
  is 0; Channel Islands GG 0 / JE 0 (expected under-tagging).
- Piers layer is `man_made=pier` **with `name=*` only** (not unnamed pier /
  jetty / pontoon segments, `man_made=jetty`, `man_made=breakwater`,
  `man_made=groyne`, marinas, ferry terminals, or `pier=*` without
  `man_made=pier`). Raw unfiltered `man_made=pier` is ~20k+ mostly linear
  coastal noise — the name filter keeps named coastal / pleasure / ferry
  piers. Disused piers still tagged `man_made=pier` with a name are included.
  Extract includes **nodes, ways, and relations**; ways and relations are
  Overpass centre points, not footprints. A site may appear both as a
  relation and as member ways/nodes if both carry `man_made=pier`+name
  (dedupe by OSM `type/id` only). Counts are OSM objects, not distinct
  piers. Isle of Man admin-clip is 12; Channel Islands GG 0 / JE 2
  (Guernsey Bailiwick under-tagged / clip dropped 1 bbox hit).
- Ruins layer is `historic=ruins` **with `name=*` only** (not unnamed ruin
  fragments, `historic=castle` / `archaeological_site` / `monument`,
  `ruins=yes` on other keys, or `building=ruins` without `historic=ruins`).
  Raw unfiltered `historic=ruins` is timeout-prone Isles-wide — the name
  filter plus fine regional tiling (`--max-span 1.5`) keep the extract
  tractable. Disused sites still tagged `historic=ruins` with a name are
  included. Extract includes **nodes, ways, and relations**; ways and
  relations are Overpass centre points, not footprints. A site may appear
  both as a relation and as member ways/nodes if both carry
  `historic=ruins`+name (dedupe by OSM `type/id` only). Counts are OSM
  objects, not distinct sites. Isle of Man admin-clip is 73; Channel
  Islands GG 9 / JE 4 (Guernsey Bailiwick admin-clip 9 vs hard main-island
  bbox ≈ 8).
- Golf courses layer is `leisure=golf_course` only (not driving ranges
  without `leisure=golf_course`, `leisure=sports_centre`, `leisure=pitch`,
  `leisure=miniature_golf`, or `golf=*` without the leisure tag). Disused
  courses still tagged `leisure=golf_course` are included. Unnamed courses
  keep the generic label `"Golf course"`. Extract includes **nodes, ways,
  and relations**; ways and relations are Overpass centre points, not
  footprints (Heathrow lesson — multipolygon courses would be dropped
  without `out center` + relations). A site may appear both as a relation
  and as member ways/nodes if both carry `leisure=golf_course` (dedupe by
  OSM `type/id` only). Counts are OSM objects, not distinct courses. Isle
  of Man admin-clip is 9; Channel Islands GG 5 / JE 7 (Guernsey Bailiwick
  admin-clip 5 vs hard main-island bbox ≈ 4).
- Galleries layer is `tourism=gallery` only (not `tourism=museum`,
  `amenity=arts_centre`, `shop=art` without `tourism=gallery`, or
  `tourism=attraction` without `tourism=gallery`). Complements the museums
  layer, which excludes galleries. Disused galleries still tagged
  `tourism=gallery` are included. Unnamed galleries keep the generic label
  `"Gallery"`. Extract includes **nodes, ways, and relations**; ways and
  relations are Overpass centre points, not footprints (Heathrow lesson).
  A site may appear both as a relation and as member ways/nodes if both
  carry `tourism=gallery` (dedupe by OSM `type/id` only). Counts are OSM
  objects, not distinct galleries. Isle of Man admin-clip is 1; Channel
  Islands GG 3 / JE 7 (Guernsey Bailiwick admin-clip 3 vs hard main-island
  bbox ≈ 1).
- Isle of Man has only 2 OSM hospitals at extract time — likely under-tagged
  relative to known sites; Channel Islands admin-clip counts are GG 4 / JE 4
  (hard bbox check slightly lower for Guernsey). Castles IoM admin-clip is 3;
  Guernsey Bailiwick admin-clip 19 vs hard main-island bbox ≈ 8 (Alderney /
  Sark / Herm fortifications included in Bailiwick polygon). Libraries IoM
  admin-clip is 7; Channel Islands GG 3 / JE 1. Universities IoM
  admin-clip is 2; Channel Islands GG 0 / JE 0. Museums IoM
  admin-clip is 24; Channel Islands GG 14 / JE 16. Railway stations IoM
  admin-clip is 13; Channel Islands GG 2 / JE 0. Aerodromes IoM
  admin-clip is 4; Channel Islands GG 2 / JE 1. Ferry terminals IoM
  admin-clip is 3; Channel Islands GG 7 / JE 2. Marinas IoM
  admin-clip is 2; Channel Islands GG 6 / JE 11. Zoos IoM
  admin-clip is 1; Channel Islands GG 0 / JE 1. Theatres IoM
  admin-clip is 3; Channel Islands GG 1 / JE 2. Battlefields IoM
  admin-clip is 1; Channel Islands GG 0 / JE 0. Stadiums IoM
  admin-clip is 0; Channel Islands GG 2 / JE 1. Theme parks IoM
  admin-clip is 0; Channel Islands GG 0 / JE 0. Viewpoints IoM
  admin-clip is 26; Channel Islands GG 43 / JE 41. Arts centres IoM
  admin-clip is 3; Channel Islands GG 1 / JE 0. Aquariums IoM
  admin-clip is 0; Channel Islands GG 0 / JE 0. Piers IoM
  admin-clip is 12; Channel Islands GG 0 / JE 2. Ruins IoM
  admin-clip is 73; Channel Islands GG 9 / JE 4. Golf courses IoM
  admin-clip is 9; Channel Islands GG 5 / JE 7. Galleries IoM
  admin-clip is 1; Channel Islands GG 3 / JE 7.
- Extract uses polygon clip + buffer; features extremely close to a land border
  could in theory be included or excluded by the ~200 m buffer.

## Basemap (unchanged)

- Hillshade tiles © Esri, USGS, NOAA
- Water / boundaries © OpenStreetMap contributors via OpenMapTiles / OpenFreeMap
