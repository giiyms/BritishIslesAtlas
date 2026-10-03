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
`scripts/extract_osm_galleries.py`; marketplaces by
`scripts/extract_osm_marketplaces.py`; nature reserves by
`scripts/extract_osm_nature_reserves.py`; camp sites by
`scripts/extract_osm_camp_sites.py`; memorials by
`scripts/extract_osm_memorials.py`; sports centres by
`scripts/extract_osm_sports_centres.py`; caravan sites by
`scripts/extract_osm_caravan_sites.py`; fitness centres by
`scripts/extract_osm_fitness_centres.py`; community centres by
`scripts/extract_osm_community_centres.py`; post offices by
`scripts/extract_osm_post_offices.py`; playgrounds by
`scripts/extract_osm_playgrounds.py`; beaches by
`scripts/extract_osm_beaches.py`; swimming pools by
`scripts/extract_osm_swimming_pools.py`; pharmacies by
`scripts/extract_osm_pharmacies.py`; town halls by
`scripts/extract_osm_townhalls.py`; places of worship by
`scripts/extract_osm_places_of_worship.py`; lighthouses by
`scripts/extract_osm_lighthouses.py`; courthouses by
`scripts/extract_osm_courthouses.py`; nightclubs by
`scripts/extract_osm_nightclubs.py`.
Westminster constituencies (GB) are ingested separately by
`scripts/ingest_ons_pcon2024.py` from the ONS ArcGIS FeatureServer (not Overpass).
Shared OSM pipeline:

1. Load OSM admin polygons for England, Scotland, Wales, Northern Ireland,
   Ireland, Isle of Man, Guernsey, and Jersey (via Nominatim; cached under
   `scripts/cache/`, regenerable with `--refresh-polygons`).
2. Query Overpass **per-region bounding-box tiles** (not one British Isles-wide
   bbox) on `https://overpass.openstreetmap.fr/api/interpreter`.
3. **Clip** results to the admin polygon (+ ~200 m buffer) so mainland France
   and cross-border spill are dropped.
4. Deduplicate by OSM `type/id`. Ways are stored as **centre points**
   (`out center`). The aerodromes, ferry-terminals, marinas, zoos, theatres, battlefields, cinemas, stadiums, theme-parks, viewpoints, arts-centres, aquariums, piers, ruins, golf-courses, galleries, marketplaces, nature-reserves, camp-sites, memorials, sports-centres, caravan-sites, fitness-centres, community-centres, post-offices, playgrounds, beaches, swimming-pools, pharmacies, townhalls, places-of-worship, lighthouses, courthouses, and nightclubs extractors
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



## Marketplaces (`marketplaces`)

| | |
|---|---|
| **File** | `public/data/marketplaces.geojson` |
| **Features** | 943 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 747, Scotland 44, Wales 45, Northern Ireland 13, Ireland 90, Isle of Man 1, Guernsey 1, Jersey 2. **Northern France bleed ≈ 0**. |
| **Sample vs full** | Admin-area extract of OSM `amenity=marketplace` at extract time (nodes, ways, **and relations**). `shop=marketplace` without `amenity=marketplace`, `highway=street_vendor` / street-vendor amenities, `shop=convenience`, and farmers markets / car-boot sales **not** tagged `amenity=marketplace` are **not** included. Disused markets that remain tagged `amenity=marketplace` **are** included. Unnamed marketplaces keep the generic label `"Marketplace"`. **Feature counts are OSM objects, not distinct markets** (a complex may appear as several nodes/ways/relations). Large sites mapped as multipolygon / site relations are included via Overpass centre points (Heathrow lesson — markets are often multipolygon). Default regional tiling `--max-span 2.0`. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `amenity=marketplace` nodes, ways, and relations (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-01T15:39:44Z |
| **Method** | Same admin-area pipeline as aerodromes/ferry terminals/marinas/zoos/theatres/battlefields/cinemas/stadiums/theme parks/viewpoints/arts centres/aquariums/piers/ruins/golf courses/galleries (`scripts/extract_osm_marketplaces.py`), including OSM relations; default tile span 2.0° |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as petrol/EV/power/hospitals/fire/police/castles/libraries/universities/museums/railway stations/aerodromes/ferry terminals/marinas/zoos/theatres/battlefields/cinemas/stadiums/theme parks/viewpoints/arts centres/aquariums/piers/ruins/golf courses/galleries (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Marketplace"`. Ways as centre points: 538 of 943; relations as centre points:
15 of 943. Pipeline-filled generic names: 80 (~8.5%).


## Nature reserves (`nature-reserves`)

| | |
|---|---|
| **File** | `public/data/nature-reserves.geojson` |
| **Features** | 4185 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 3512, Scotland 283, Wales 213, Northern Ireland 37, Ireland 115, Isle of Man 14, Guernsey 10, Jersey 1. **Northern France bleed ≈ 0**. |
| **Sample vs full** | Admin-area extract of OSM `leisure=nature_reserve` at extract time (nodes, ways, **and relations**). `boundary=protected_area` alone, `leisure=park`, `boundary=national_park`, `leisure=wildlife_hide`, and `tourism=attraction` without `leisure=nature_reserve` are **not** included. Disused reserves that remain tagged `leisure=nature_reserve` **are** included. Unnamed reserves keep the generic label `"Nature reserve"` (no `name=*` filter — raw admin-clipped density ~4.2k is under the ~8–10k named-only threshold). **Feature counts are OSM objects, not distinct reserves** (a complex may appear as several nodes/ways/relations). Large sites mapped as multipolygon / site relations are included via Overpass centre points (Heathrow lesson — nature reserves are often multipolygon). Default regional tiling `--max-span 2.0`. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `leisure=nature_reserve` nodes, ways, and relations (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-01T15:55:38Z |
| **Method** | Same admin-area pipeline as aerodromes/ferry terminals/marinas/zoos/theatres/battlefields/cinemas/stadiums/theme parks/viewpoints/arts centres/aquariums/piers/ruins/golf courses/galleries/marketplaces (`scripts/extract_osm_nature_reserves.py`), including OSM relations; default tile span 2.0° |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as petrol/EV/power/hospitals/fire/police/castles/libraries/universities/museums/railway stations/aerodromes/ferry terminals/marinas/zoos/theatres/battlefields/cinemas/stadiums/theme parks/viewpoints/arts centres/aquariums/piers/ruins/golf courses/galleries/marketplaces (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Nature reserve"`. Ways as centre points: 3339 of 4185; relations as centre points:
641 of 4185; nodes: 205 of 4185. Pipeline-filled generic names: 449 (~10.7%).


## Camp sites (`camp-sites`)

| | |
|---|---|
| **File** | `public/data/camp-sites.geojson` |
| **Features** | 4155 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 2844, Scotland 468, Wales 575, Northern Ireland 57, Ireland 174, Isle of Man 20, Guernsey 11, Jersey 6. **Northern France bleed ≈ 0**. |
| **Sample vs full** | Admin-area extract of OSM `tourism=camp_site` at extract time (nodes, ways, **and relations**). `tourism=caravan_site`, `tourism=camp_pitch`, `tourism=hostel`, and `amenity=shelter` without `tourism=camp_site` are **not** included — caravan sites are a separate OSM tag and are excluded. Disused sites that remain tagged `tourism=camp_site` **are** included. Unnamed sites keep the generic label `"Camp site"` (no `name=*` filter — raw admin-clipped density ~4.2k is under the ~8–10k named-only threshold). **Feature counts are OSM objects, not distinct campsites** (a complex may appear as several nodes/ways/relations). Large sites mapped as multipolygon / site relations are included via Overpass centre points (Heathrow lesson — camp sites are often ways/relations). Default regional tiling `--max-span 2.0`. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `tourism=camp_site` nodes, ways, and relations (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-01T16:08:59Z |
| **Method** | Same admin-area pipeline as aerodromes/ferry terminals/marinas/zoos/theatres/battlefields/cinemas/stadiums/theme parks/viewpoints/arts centres/aquariums/piers/ruins/golf courses/galleries/marketplaces/nature reserves (`scripts/extract_osm_camp_sites.py`), including OSM relations; default tile span 2.0° |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as petrol/EV/power/hospitals/fire/police/castles/libraries/universities/museums/railway stations/aerodromes/ferry terminals/marinas/zoos/theatres/battlefields/cinemas/stadiums/theme parks/viewpoints/arts centres/aquariums/piers/ruins/golf courses/galleries/marketplaces/nature reserves (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Camp site"`. Ways as centre points: 3020 of 4155; relations as centre points:
78 of 4155; nodes: 1057 of 4155. Pipeline-filled generic names: 870 (~20.9%).


## Memorials (`memorials`)

| | |
|---|---|
| **File** | `public/data/memorials.geojson` |
| **Features** | 14 851 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 8 919, Scotland 4 156, Wales 426, Northern Ireland 117, Ireland 1 056, Isle of Man 61, Guernsey 43, Jersey 73. **Northern France bleed ≈ 0** (hard bbox checks: IoM ≈ 61, GG ≈ 40, JE ≈ 73). |
| **Sample vs full** | Admin-area extract of OSM `historic=memorial` at extract time (nodes, ways, **and relations**) with `name=*` required. Unnamed plaques and memorial noise, `historic=monument`, `historic=war_memorial` without `historic=memorial`, `memorial=yes` on other keys, and `tourism=attraction` without `historic=memorial` are **not** included. War memorials tagged `historic=memorial` **are** included. Disused sites retaining `historic=memorial` and `name=*` are included. **Feature counts are OSM objects, not distinct memorials** (a complex may appear as several nodes/ways/relations). Relations use Overpass centre points. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `historic=memorial` nodes, ways, and relations with `name=*` (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-01T16:23:37Z |
| **Method** | Same admin-area pipeline as camp sites and ruins (`scripts/extract_osm_memorials.py`), including OSM relations; default tile span `--max-span 1.5°` |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as the other OSM layers (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). The extractor requires a non-empty
`name=*` tag; the five pipeline generic-name fallbacks in the metadata are retained as
a pipeline diagnostic. Ways as centre points: 792 of 14 851; relations as centre points:
20 of 14 851; pipeline generic names: 5.


## Sports centres (`sports-centres`)

| | |
|---|---|
| **File** | `public/data/sports-centres.geojson` |
| **Features** | 10 726 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 6536, Scotland 973, Wales 394, Northern Ireland 322, Ireland 2435, Isle of Man 26, Guernsey 11, Jersey 29. **Northern France bleed ≈ 0** (hard bbox checks: IoM ≈ 26, GG ≈ 9, JE ≈ 29). |
| **Sample vs full** | Admin-area extract of OSM `leisure=sports_centre` at extract time (nodes, ways, **and relations**). `leisure=stadium` (already a separate layer), `leisure=pitch` alone, `leisure=fitness_centre`, and `leisure=sports_hall` without `leisure=sports_centre` are **not** included. Disused sites that remain tagged `leisure=sports_centre` **are** included. Unnamed sites keep the generic label `"Sports centre"` (no `name=*` filter — density ~10.7k is at the soft ~8–10k named-only guideline, but Overpass completed without timeouts so unnamed centres are retained). **Feature counts are OSM objects, not distinct centres** (a complex may appear as several nodes/ways/relations). Large sites mapped as multipolygon / site relations are included via Overpass centre points (Heathrow lesson — sports centres are often ways/relations). Default regional tiling `--max-span 2.0`. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `leisure=sports_centre` nodes, ways, and relations (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-02T19:25:05Z |
| **Method** | Same admin-area pipeline as camp sites / nature reserves / memorials (`scripts/extract_osm_sports_centres.py`), including OSM relations; default tile span 2.0° |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as the other OSM layers (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Sports centre"`. Ways as centre points: 8786 of 10 726; relations as centre points:
203 of 10 726; nodes: 1737 of 10 726. Pipeline-filled generic names: 1604 (~15.0%).



## Caravan sites (`caravan-sites`)

| | |
|---|---|
| **File** | `public/data/caravan-sites.geojson` |
| **Features** | 5017 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 3319, Scotland 454, Wales 886, Northern Ireland 91, Ireland 265, Isle of Man 2, Guernsey 0, Jersey 0. **Northern France bleed ≈ 0** (hard bbox checks: IoM ≈ 2, GG ≈ 0, JE ≈ 0). |
| **Sample vs full** | Admin-area extract of OSM `tourism=caravan_site` at extract time (nodes, ways, **and relations**). `tourism=camp_site` (already a separate camp-sites layer), `tourism=camp_pitch`, `tourism=hostel`, and `amenity=shelter` without `tourism=caravan_site` are **not** included — this layer **complements** camp sites, which already excludes `tourism=caravan_site`. Disused sites that remain tagged `tourism=caravan_site` **are** included. Unnamed sites keep the generic label `"Caravan site"` (no `name=*` filter — density ~5.0k is under the ~8–10k named-only threshold). **Feature counts are OSM objects, not distinct caravan sites** (a complex may appear as several nodes/ways/relations). Large sites mapped as multipolygon / site relations are included via Overpass centre points (Heathrow lesson — caravan sites are often ways/relations). Default regional tiling `--max-span 2.0`. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `tourism=caravan_site` nodes, ways, and relations (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-02T19:41:52Z |
| **Method** | Same admin-area pipeline as sports centres / camp sites / nature reserves / memorials (`scripts/extract_osm_caravan_sites.py`), including OSM relations; default tile span 2.0° |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as the other OSM layers (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Caravan site"`. Ways as centre points: 4454 of 5017; relations as centre points:
89 of 5017; nodes: 474 of 5017. Pipeline-filled generic names: 1639 (~32.7%).


## Fitness centres (`fitness-centres`)

| | |
|---|---|
| **File** | `public/data/fitness-centres.geojson` |
| **Features** | 6463 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 4184, Scotland 411, Wales 191, Northern Ireland 102, Ireland 1544, Isle of Man 17, Guernsey 6, Jersey 8. **Northern France bleed ≈ 0** (hard bbox checks: IoM ≈ 17, GG ≈ 6, JE ≈ 8). |
| **Sample vs full** | Admin-area extract of OSM `leisure=fitness_centre` at extract time (nodes, ways, **and relations**). `leisure=sports_centre` (already a separate sports-centres layer), `leisure=stadium`, `leisure=pitch` alone, and `amenity=gym` without `leisure=fitness_centre` are **not** included — this layer **complements** sports centres, which already excludes `leisure=fitness_centre` without `leisure=sports_centre`. Disused sites that remain tagged `leisure=fitness_centre` **are** included. Unnamed sites keep the generic label `"Fitness centre"` (no `name=*` filter — density ~6.5k is under the ~8–10k named-only threshold). **Feature counts are OSM objects, not distinct centres** (a complex may appear as several nodes/ways/relations). Large sites mapped as multipolygon / site relations are included via Overpass centre points (Heathrow lesson — fitness centres are often ways/relations). Default regional tiling `--max-span 2.0`. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `leisure=fitness_centre` nodes, ways, and relations (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-02T19:57:20Z |
| **Method** | Same admin-area pipeline as caravan sites / sports centres / camp sites (`scripts/extract_osm_fitness_centres.py`), including OSM relations; default tile span 2.0° |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as the other OSM layers (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Fitness centre"`. Ways as centre points: 2134 of 6463; relations as centre points:
17 of 6463; nodes: 4312 of 6463. Pipeline-filled generic names: 312 (~4.8%).


## Community centres (`community-centres`)

| | |
|---|---|
| **File** | `public/data/community-centres.geojson` |
| **Features** | 16909 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 12598, Scotland 1510, Wales 770, Northern Ireland 852, Ireland 1117, Isle of Man 30, Guernsey 23, Jersey 9. **Northern France bleed ≈ 0** (hard bbox checks: IoM ≈ 30, GG ≈ 22, JE ≈ 9). |
| **Sample vs full** | Admin-area extract of OSM `amenity=community_centre` at extract time (nodes, ways, **and relations**). `amenity=arts_centre` (already an arts-centres layer), `amenity=social_facility` alone, `leisure=fitness_centre` / `leisure=sports_centre`, and `tourism=attraction` without `amenity=community_centre` are **not** included. Disused sites that remain tagged `amenity=community_centre` **are** included. **Named-only** (`name=*` required) because England-alone density exceeded the ~8–10k threshold; unnamed community centres are omitted. **Feature counts are OSM objects, not distinct centres** (a complex may appear as several nodes/ways/relations). Large sites mapped as multipolygon / site relations are included via Overpass centre points (Heathrow lesson — community centres are often ways/relations). Default regional tiling `--max-span 2.0`. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `amenity=community_centre` + `name=*` nodes, ways, and relations (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-02T20:20:01Z |
| **Method** | Same admin-area pipeline as fitness centres / caravan sites / sports centres (`scripts/extract_osm_community_centres.py`), including OSM relations; default tile span 2.0° |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as the other OSM layers (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Community centre"`. Ways as centre points: 14489 of 16909; relations as centre points:
75 of 16909; nodes: 2345 of 16909. Pipeline-filled generic names: 0 (named-only extract).




## Post offices (`post-offices`)

| | |
|---|---|
| **File** | `public/data/post-offices.geojson` |
| **Features** | 9784 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 7062, Scotland 902, Wales 522, Northern Ireland 469, Ireland 799, Isle of Man 11, Guernsey 8, Jersey 11. **Northern France bleed ≈ 0** (hard bbox checks: IoM ≈ 11, GG ≈ 6, JE ≈ 11). |
| **Sample vs full** | Admin-area extract of OSM `amenity=post_office` at extract time (nodes, ways, **and relations**). `amenity=parcel_locker`, `shop=convenience` with a post_office role alone, Royal Mail collection points without `amenity=post_office`, and `amenity=post_box` are **not** included. Disused sites that remain tagged `amenity=post_office` **are** included. **Named-only** (`name=*` required) because UK Geofabrik density is already ~9.4k at the ~8–10k soft guideline (full BI with Ireland would blow past it); unnamed post offices are omitted. **Feature counts are OSM objects, not distinct offices** (a complex may appear as several nodes/ways/relations). Large sites mapped as multipolygon / site relations are included via Overpass centre points (Heathrow lesson — post offices are often ways/relations). Default regional tiling `--max-span 2.0`. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `amenity=post_office` + `name=*` nodes, ways, and relations (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-02T21:31:26Z |
| **Method** | Same admin-area pipeline as community centres / fitness centres / caravan sites (`scripts/extract_osm_post_offices.py`), including OSM relations; default tile span 2.0° |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as the other OSM layers (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Post office"`. Ways as centre points: 1461 of 9784; relations as centre points:
4 of 9784; nodes: 8319 of 9784. Pipeline-filled generic names: 0 (named-only extract).



## Playgrounds (`playgrounds`)

| | |
|---|---|
| **File** | `public/data/playgrounds.geojson` |
| **Features** | 5372 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 4236, Scotland 352, Wales 229, Northern Ireland 228, Ireland 308, Isle of Man 10, Guernsey 2, Jersey 7. **Northern France bleed ≈ 0** (hard bbox checks: IoM ≈ 10, GG ≈ 1, JE ≈ 7). |
| **Sample vs full** | Admin-area extract of OSM `leisure=playground` at extract time (nodes, ways, **and relations**). `leisure=pitch`, `leisure=park`, `amenity=school` playgrounds without `leisure=playground`, and `tourism=attraction` alone are **not** included. Disused sites that remain tagged `leisure=playground` **are** included. **Named-only** (`name=*` required) because an England-alone Overpass count without `name=*` was ~44k (nodes 2788 + ways 41490 + relations 153; bbox roughly 49.9–55.8°N, −6.5–2.0°E, not admin-clipped), far past the ~8–10k soft guideline; the same England bbox with `name=*` was ~4.8k. Unnamed playgrounds are omitted. **Feature counts are OSM objects, not distinct playgrounds** (a complex may appear as several nodes/ways/relations). Large sites mapped as multipolygon / site relations are included via Overpass centre points (Heathrow lesson — playgrounds are often ways/relations). Default regional tiling `--max-span 2.0`. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `leisure=playground` + `name=*` nodes, ways, and relations (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-02T22:13:12Z |
| **Method** | Same admin-area pipeline as post offices / community centres / fitness centres (`scripts/extract_osm_playgrounds.py`), including OSM relations; default tile span 2.0° |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as the other OSM layers (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names would fill as
`"Playground"`. Ways as centre points: 4858 of 5372; relations as centre points:
63 of 5372; nodes: 451 of 5372. Pipeline-filled generic names: 0 (named-only extract).




## Beaches (`beaches`)

| | |
|---|---|
| **File** | `public/data/beaches.geojson` |
| **Features** | 8846 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 2711, Scotland 3346, Wales 680, Northern Ireland 197, Ireland 1615, Isle of Man 129, Guernsey 114, Jersey 54. **Northern France bleed ≈ 0**. The hard bbox heuristic flags **1** feature (`relation/20327663`, unnamed multipolygon centre −1.928, 49.291) just east of the Channel Islands exclusion box (lon −1.95). That centre is inside the **Jersey** admin polygon (Écréhous reef), not mainland France. Hard main-island bbox checks: IoM ≈ 129, GG ≈ 86, JE ≈ 53 (admin GG 114 includes the rest of the Bailiwick; the extra Jersey feature is the Écréhous hit). |
| **Sample vs full** | Admin-area extract of OSM `natural=beach` at extract time (nodes, ways, **and relations**). `natural=coastline`, `natural=sand` alone, `leisure=beach_resort` without `natural=beach`, and `tourism=hotel` are **not** included. Disused sites that remain tagged `natural=beach` **are** included. **No `name=*` filter.** A loose British Isles bbox probe (49–61°N, −11–2.2°E, not admin-clipped, includes some northern France coast) was ~9.1k (nodes 357 + ways 8216 + relations 567), inside the ~8–10k soft band rather than past it. The same bbox with `name=*` was ~2.0k (nodes 201 + ways 1607 + relations 197); requiring names would drop most beaches, so unnamed sites are kept with the generic label `Beach`. Admin-clipped result is **8846** (nodes 324 / ways 7975 / relations 547). **Feature counts are OSM objects, not distinct beaches** (a stretch may appear as several nodes/ways/relations). Large sites mapped as multipolygon / site relations are included via Overpass centre points (Heathrow lesson — beaches are often ways/relations). Default regional tiling `--max-span 2.0`. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `natural=beach` nodes, ways, and relations (`out center tags`); no `name=*` filter |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-02T23:03:13Z |
| **Method** | Same admin-area pipeline as playgrounds / post offices / community centres (`scripts/extract_osm_beaches.py`), including OSM relations; default tile span 2.0° |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as the other OSM layers (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Beach"`. Ways as centre points: 7975 of 8846; relations as centre points:
547 of 8846; nodes: 324 of 8846. Pipeline-filled generic names: 6902 (unnamed
beaches kept).




## Swimming pools (`swimming-pools`)

| | |
|---|---|
| **File** | `public/data/swimming-pools.geojson` |
| **Features** | 552 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 419, Scotland 41, Wales 25, Northern Ireland 5, Ireland 55, Isle of Man 1, Guernsey 4, Jersey 2. **Northern France bleed = 0** (hard bbox heuristic flags 0). Southernmost points are Jersey (Havre des Pas Pool, Aquasplash) and Guernsey tidal pools (La Vallette), inside those admin polygons — not mainland France. Easternmost points (~1.7°E, ~52.6°N, e.g. node/2408014563) are the Suffolk coast, not France. Hard main-island bbox checks match the admin clip: IoM ≈ 1, GG ≈ 4, JE ≈ 2. |
| **Sample vs full** | Admin-area extract of OSM `leisure=swimming_pool` at extract time (nodes, ways, **and relations**). `leisure=water_park`, `amenity=public_bath`, `sport=swimming` without `leisure=swimming_pool`, and `natural=water` are **not** included. Disused sites that remain tagged `leisure=swimming_pool` **are** included. **Named-only** (`name=*` required) because an England-alone Overpass count without `name=*` was 23698 (nodes 366 + ways 23312 + relations 20; bbox roughly 49.9–55.8°N, −6.5–2.0°E, not admin-clipped), far past the ~8–10k soft guideline — mostly unnamed private backyard pools. The same England bbox with `name=*` was 478 (nodes 151 + ways 324 + relations 3). Unnamed pools are omitted. Admin-clipped named result is **552** (nodes 188 / ways 361 / relations 3). **Feature counts are OSM objects, not distinct pools** (a site may appear as several nodes/ways/relations). Large sites mapped as multipolygon / site relations are included via Overpass centre points (Heathrow lesson). Default regional tiling `--max-span 2.0`. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `leisure=swimming_pool` + `name=*` nodes, ways, and relations (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-02T23:22:52Z |
| **Method** | Same admin-area pipeline as beaches / playgrounds / post offices (`scripts/extract_osm_swimming_pools.py`), including OSM relations; default tile span 2.0° |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as the other OSM layers (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names would fill as
`"Swimming pool"`. Ways as centre points: 361 of 552; relations as centre points:
3 of 552; nodes: 188 of 552. Pipeline-filled generic names: 0 (named-only extract).



## Pharmacies (`pharmacies`)

| | |
|---|---|
| **File** | `public/data/pharmacies.geojson` |
| **Features** | 10310 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 7390, Scotland 866, Wales 381, Northern Ireland 208, Ireland 1405, Isle of Man 22, Guernsey 14, Jersey 24. **Northern France bleed = 0** (hard bbox heuristic flags 0). Southernmost point is Boots in St Helier, Jersey (`node/8861081402`, 49.180°N, 2.084°W), inside the Jersey admin polygon — not mainland France. Easternmost point (~1.76°E, ~52.49°N, High Street Pharmacy `node/12954176556`) is the Suffolk coast, not France. Hard main-island bbox checks match the admin clip: IoM ≈ 22, GG ≈ 14, JE ≈ 24. |
| **Sample vs full** | Admin-area extract of OSM `amenity=pharmacy` at extract time (nodes, ways, **and relations**). `amenity=clinic`, `amenity=doctors`, `shop=chemist` without `amenity=pharmacy`, and `healthcare=pharmacy` alone without `amenity=pharmacy` are **not** included. Disused sites that remain tagged `amenity=pharmacy` **are** included. **Named-only** (`name=*` required) because an England-alone Overpass count without `name=*` was 9235 (nodes 6554 + ways 2673 + relations 8; bbox roughly 49.9–55.8°N, −6.5–2.0°E, not admin-clipped), at the upper edge of the ~8–10k soft guideline for England alone, and a loose British Isles bbox (49.8–61.0°N, −10.8–1.9°E, not admin-clipped, includes some northern France) was 11051 (nodes 8110 + ways 2932 + relations 9), past ~10k. The same England bbox with `name=*` was 8739 (nodes 6139 + ways 2592 + relations 8); the loose BI bbox with `name=*` was 10452 (nodes 7610 + ways 2834 + relations 8) before admin clip. Unnamed pharmacies are omitted. Admin-clipped named result is **10310** (nodes 7476 / ways 2826 / relations 8). **Feature counts are OSM objects, not distinct pharmacies** (a site may appear as several nodes/ways/relations). Large sites mapped as multipolygon / site relations are included via Overpass centre points (Heathrow lesson). Default regional tiling `--max-span 2.0`. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `amenity=pharmacy` + `name=*` nodes, ways, and relations (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-03T00:26:01Z |
| **Method** | Same admin-area pipeline as swimming pools / beaches / post offices (`scripts/extract_osm_pharmacies.py`), including OSM relations; default tile span 2.0° |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as the other OSM layers (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names would fill as
`"Pharmacy"`. Ways as centre points: 2826 of 10310; relations as centre points:
8 of 10310; nodes: 7476 of 10310. Features whose `name` is exactly `"Pharmacy"`: 12
(these still carry OSM `name=*`, which is the string Pharmacy, so they match the
pipeline generic label; they are not unnamed fills). Pipeline `note` repeats brand
or operator on 4335 of 10310.



## Town halls (`townhalls`)

| | |
|---|---|
| **File** | `public/data/townhalls.geojson` |
| **Features** | 1330 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 899, Scotland 188, Wales 79, Northern Ireland 36, Ireland 112, Isle of Man 5, Guernsey 1, Jersey 10. **Northern France bleed = 0** (hard bbox heuristic flags 0). Southernmost point is Parish Hall (`node/1783493217`, 49.184°N, 2.052°W), inside the Jersey admin polygon — not mainland France. Easternmost point (~1.73°E, ~52.61°N, Greyfriars House `way/175586161`) is the Norfolk coast, not France. Hard main-island bbox checks match the admin clip: IoM ≈ 5, GG ≈ 1, JE ≈ 10. |
| **Sample vs full** | Admin-area extract of OSM `amenity=townhall` at extract time (nodes, ways, **and relations**). `amenity=community_centre` (already its own layer), `amenity=public_building` alone, `office=government`, and `building=civic` without `amenity=townhall` are **not** included. Disused sites that remain tagged `amenity=townhall` **are** included. **No `name=*` filter** because an England-alone Overpass count without `name=*` was 1539 (nodes 302 + ways 1190 + relations 47; bbox roughly 49.9–55.8°N, −6.5–2.0°E, not admin-clipped), well inside the ~8–10k soft guideline, and a loose British Isles bbox (49.8–61.0°N, −10.8–1.9°E, not admin-clipped, includes some northern France) was 1826 (nodes 411 + ways 1365 + relations 50), also well under ~8k. The same England bbox with `name=*` was 1423 (nodes 266 + ways 1113 + relations 44); the loose BI bbox with `name=*` was 1675 (nodes 362 + ways 1266 + relations 47) before admin clip. Unnamed town halls are kept (114 pipeline-filled `"Town hall"`). Admin-clipped result is **1330** (nodes 274 / ways 1009 / relations 47). **Feature counts are OSM objects, not distinct town halls** (a site may appear as several nodes/ways/relations; e.g. St Lawrence, Jersey, has a parish-hall way plus a nearby node, and St John has two overlapping ways). Large sites mapped as multipolygon / site relations are included via Overpass centre points (Heathrow lesson). Default regional tiling `--max-span 2.0`. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `amenity=townhall` nodes, ways, and relations (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-03T01:18:32Z |
| **Method** | Same admin-area pipeline as pharmacies / swimming pools / post offices (`scripts/extract_osm_townhalls.py`), including OSM relations; default tile span 2.0° |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as the other OSM layers (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Town hall"`. Ways as centre points: 1009 of 1330; relations as centre points:
47 of 1330; nodes: 274 of 1330. Pipeline-filled generic names: 114 (no OSM `name=*`).
None of the retained OSM `name=*` values are exactly the string `"Town hall"`
(capitalisation such as `"Town Hall"` is kept as mapped). Pipeline `note` repeats brand
or operator on 201 of 1330.


## Places of worship (`places-of-worship`)

| | |
|---|---|
| **File** | `public/data/places-of-worship.geojson` |
| **Features** | 43032 points (not a round cap; ~13 MB minified GeoJSON) |
| **Coverage** | Same admin-area footprint: England 32260, Scotland 3136, Wales 2699, Northern Ireland 1627, Ireland 3114, Isle of Man 94, Guernsey 43, Jersey 59. **Northern France bleed = 0** (hard bbox heuristic flags 0). Southernmost point is St. Peter de La Rocque (`way/179754051`, 49.170°N, 2.036°W), inside the Jersey admin polygon — not mainland France. Easternmost point (~1.76°E, ~52.48°N, Christ Church `node/12521358331`) is the East Anglian coast, not France. Hard main-island bbox checks: IoM ≈ 94, GG ≈ 37, JE ≈ 59. Guernsey Bailiwick admin-clip is 43 vs hard main-island bbox ≈ 37 (Alderney, Sark, and Brecqhou chapels included in the Bailiwick polygon). |
| **Sample vs full** | Admin-area extract of OSM `amenity=place_of_worship` at extract time (nodes, ways, **and relations**). `building=church` without `amenity=place_of_worship`, `amenity=monastery` alone, and `tourism=attraction` alone are **not** included. Not filtered by `religion=*` (when present, `religion` is copied onto properties). Disused sites that remain tagged `amenity=place_of_worship` **are** included. **`name=*` filter is on** because an England-alone Overpass count without `name=*` was 39954 (nodes 4454 + ways 35340 + relations 160; bbox roughly 49.9–55.8°N, −6.5–2.0°E, not admin-clipped), far past the ~8–10k soft guideline. The same England bbox with `name=*` was 37859 (nodes 4028 + ways 33673 + relations 158) — still dense; the filter drops only unnamed objects. Unnamed places of worship are omitted (0 pipeline-filled `"Place of worship"`). Admin-clipped result is **43032** (nodes 4638 / ways 38190 / relations 204). **Feature counts are OSM objects, not distinct places of worship** (a site may appear as several nodes/ways/relations). Large sites mapped as multipolygon / site relations are included via Overpass centre points (Heathrow lesson). Default regional tiling `--max-span 2.0`. Preview layers `churches`, `mosques`, and `other-religious` are unchanged scaffold geometry and are not this extract. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `amenity=place_of_worship` + `name=*` nodes, ways, and relations (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-03T01:39:22Z |
| **Method** | Same admin-area pipeline as town halls / pharmacies (`scripts/extract_osm_places_of_worship.py`), including OSM relations; default tile span 2.0° |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as the other OSM layers (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`), plus `religion` when OSM `religion=*`
is set (42687 of 43032). Generic missing names would fill as `"Place of worship"`;
none do, because `name=*` is required. Ways as centre points: 38190 of 43032;
relations as centre points: 204 of 43032; nodes: 4638 of 43032. Pipeline-filled
generic names: 0. Pipeline `note` repeats brand or operator on 755 of 43032.
Religion tags present are mostly `christian` (40381), then `muslim` (1367),
`jewish` (202), `sikh` (201), `hindu` (162), `buddhist` (130), and smaller
denominations; 345 features have a name but no `religion=*`.



## Lighthouses (`lighthouses`)

| | |
|---|---|
| **File** | `public/data/lighthouses.geojson` |
| **Features** | 582 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 170, Scotland 228, Wales 41, Northern Ireland 16, Ireland 88, Isle of Man 22, Guernsey 13, Jersey 4. **Northern France bleed = 0** (hard bbox heuristic flags 0). Southernmost point is an unnamed lighthouse (`node/1543875461`, 49.169°N, 2.085°W), inside the Jersey admin polygon — not mainland France. Easternmost point (~1.76°E, ~52.49°N, Lowestoft Lighthouse `node/1538513948`) is the East Anglian coast, not France. Hard main-island bbox checks: IoM ≈ 22, GG ≈ 9, JE ≈ 4. Guernsey Bailiwick admin-clip is 13 vs hard main-island bbox ≈ 9 (Alderney / Sark lights included in the Bailiwick polygon). |
| **Sample vs full** | Admin-area extract of OSM `man_made=lighthouse` at extract time (nodes, ways, **and relations**). `man_made=beacon`, `seamark:type=light_major` alone without `man_made=lighthouse`, and `historic=yes` without `man_made=lighthouse` are **not** included. Disused sites that remain tagged `man_made=lighthouse` **are** included. **No `name=*` filter** because an England-alone Overpass count without `name=*` was 314 (nodes 180 + ways 132 + relations 2; bbox roughly 49.9–55.8°N, −6.5–2.0°E, not admin-clipped), well inside the ~8–10k soft guideline, and a loose British Isles bbox (49.8–61.0°N, −10.8–1.9°E, not admin-clipped, includes some northern France) was 585 (nodes 337 + ways 246 + relations 2), also well under ~8k. The same England bbox with `name=*` was 234 (nodes 122 + ways 110 + relations 2); the loose BI bbox with `name=*` was 452 (nodes 246 + ways 204 + relations 2) before admin clip. Unnamed lighthouses are kept (127 pipeline-filled `"Lighthouse"`). Admin-clipped result is **582** (nodes 340 / ways 240 / relations 2). **Feature counts are OSM objects, not distinct lighthouses** (a site may appear as several nodes/ways/relations). Large sites mapped as multipolygon / site relations are included via Overpass centre points (Heathrow lesson). Default regional tiling `--max-span 2.0`. No prior lighthouse preview chip existed; this layer does not replace any scaffold geometry. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `man_made=lighthouse` nodes, ways, and relations (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-03T03:21:32Z |
| **Method** | Same admin-area pipeline as town halls / places of worship (`scripts/extract_osm_lighthouses.py`), including OSM relations; default tile span 2.0° |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as the other OSM layers (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Lighthouse"`. Ways as centre points: 240 of 582; relations as centre points:
2 of 582; nodes: 340 of 582. Pipeline-filled generic names: 127 (no OSM `name=*`).
Pipeline `note` repeats brand or operator on 52 of 582.




## Courthouses (`courthouses`)

| | |
|---|---|
| **File** | `public/data/courthouses.geojson` |
| **Features** | 514 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 326, Scotland 46, Wales 28, Northern Ireland 20, Ireland 91, Isle of Man 1, Guernsey 1, Jersey 1. **Northern France bleed = 0** (hard bbox heuristic flags 0). Southernmost point is Magistrate's Court (`relation/7358557`, 49.187°N, 2.109°W), inside the Jersey admin polygon — not mainland France. Easternmost point (~1.72°E, ~52.61°N, Great Yarmouth Magistrate's Court `way/175898114`) is the East Anglian coast, not France. Hard main-island bbox checks: IoM ≈ 1, GG ≈ 1, JE ≈ 1 (match the admin-clip counts). |
| **Sample vs full** | Admin-area extract of OSM `amenity=courthouse` at extract time (nodes, ways, **and relations**). `office=lawyer`, `amenity=police`, `amenity=prison`, and `building=civic` without `amenity=courthouse` are **not** included. Disused sites that remain tagged `amenity=courthouse` **are** included. **No `name=*` filter** because an England-alone Overpass count without `name=*` was 412 (nodes 85 + ways 308 + relations 19; bbox roughly 49.9–55.8°N, −6.5–2.0°E, not admin-clipped), well inside the ~8–10k soft guideline, and a loose British Isles bbox (49.8–61.0°N, −10.8–1.9°E, not admin-clipped, includes some northern France) was 518 (nodes 104 + ways 393 + relations 21), also well under ~8k. The same England bbox with `name=*` was 394 (nodes 82 + ways 295 + relations 17); the loose BI bbox with `name=*` was 485 (nodes 100 + ways 367 + relations 18) before admin clip. Unnamed courthouses are kept (34 pipeline-filled `"Courthouse"`). Admin-clipped result is **514** (nodes 105 / ways 387 / relations 22). **Feature counts are OSM objects, not distinct courthouses** (a site may appear as several nodes/ways/relations). Large sites mapped as multipolygon / site relations are included via Overpass centre points (Heathrow lesson). Default regional tiling `--max-span 2.0`. No prior courthouse preview chip existed; this layer does not replace any scaffold geometry. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `amenity=courthouse` nodes, ways, and relations (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-03T03:40:00Z |
| **Method** | Same admin-area pipeline as lighthouses / town halls (`scripts/extract_osm_courthouses.py`), including OSM relations; default tile span 2.0° |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as the other OSM layers (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Courthouse"`. Ways as centre points: 387 of 514; relations as centre points:
22 of 514; nodes: 105 of 514. Pipeline-filled generic names: 34 (no OSM `name=*`).
Pipeline `note` repeats brand or operator on 80 of 514.




## Nightclubs (`nightclubs`)

| | |
|---|---|
| **File** | `public/data/nightclubs.geojson` |
| **Features** | 1182 points (not a round cap) |
| **Coverage** | Same admin-area footprint: England 933, Scotland 103, Wales 44, Northern Ireland 16, Ireland 82, Isle of Man 1, Guernsey 2, Jersey 1. **Northern France bleed = 0** (hard bbox heuristic flags 0). Southernmost point is Rojo (`node/1804838655`, 49.185°N, 2.103°W), inside the Jersey admin polygon — not mainland France. Easternmost point (~1.74°E, ~52.61°N, Mandarin `node/8879454630`) is the East Anglian coast, not France. Hard main-island bbox checks: IoM ≈ 1, GG ≈ 2, JE ≈ 1 (match the admin-clip counts). |
| **Sample vs full** | Admin-area extract of OSM `amenity=nightclub` at extract time (nodes, ways, **and relations**). **Tag choice:** Atlas preferred `amenity=theatre`, already shipped as LayerId `theatres`. Fallbacks `amenity=cinema`, `leisure=stadium`, and `amenity=ferry_terminal` are already LayerIds (`cinemas`, `stadiums`, `ferry-terminals`). Next unused tag in the civic/leisure entertainment family is `amenity=nightclub`. `amenity=bar`, `amenity=pub`, `amenity=theatre`, `amenity=casino`, and `leisure=dance` without `amenity=nightclub` are **not** included. The existing preview pubs chip is separate scaffold geometry and is **not** replaced or duplicated by this layer. Disused sites that remain tagged `amenity=nightclub` **are** included. **No `name=*` filter** because an England-alone Overpass count without `name=*` was 1023 (nodes 607 + ways 414 + relations 2; bbox roughly 49.9–55.8°N, −6.5–2.0°E, not admin-clipped), well inside the ~8–10k soft guideline, and a loose British Isles bbox (49.8–61.0°N, −10.8–1.9°E, not admin-clipped, includes some northern France) was 1190 (nodes 744 + ways 444 + relations 2), also well under ~8k. The same England bbox with `name=*` was 1006 (nodes 598 + ways 406 + relations 2); the loose BI bbox with `name=*` was 1167 (nodes 730 + ways 435 + relations 2) before admin clip. Unnamed nightclubs are kept (23 pipeline-filled `"Nightclub"`). Admin-clipped result is **1182** (nodes 738 / ways 442 / relations 2). **Feature counts are OSM objects, not distinct nightclubs** (a site may appear as several nodes/ways/relations). Large sites mapped as multipolygon / site relations are included via Overpass centre points (Heathrow lesson). Default regional tiling `--max-span 2.0`. No prior nightclub preview chip existed; this layer does not replace any scaffold geometry. |
| **Source** | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API |
| **Query** | `amenity=nightclub` nodes, ways, and relations (`out center tags`) |
| **Endpoint used** | `https://overpass.openstreetmap.fr/api/interpreter` |
| **Extract date (UTC)** | 2026-10-03T03:54:38Z |
| **Method** | Same admin-area pipeline as courthouses / lighthouses (`scripts/extract_osm_nightclubs.py`), including OSM relations; default tile span 2.0° |
| **License** | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap contributors |
| **Attribution** | © OpenStreetMap contributors |

### Property semantics (pipeline)

Same pipeline fields as the other OSM layers (`name`, optional `brand`/`operator`, `osm_id`,
`osm_url`, pipeline `note`, `layer`, `source`). Generic missing names fill as
`"Nightclub"`. Ways as centre points: 442 of 1182; relations as centre points:
2 of 1182; nodes: 738 of 1182. Pipeline-filled generic names: 23 (no OSM `name=*`).
Pipeline `note` repeats brand or operator on 79 of 1182.



## Constituencies (`constituencies`)

| | |
|---|---|
| **File** | `public/data/constituencies-gb-2024.geojson` |
| **Features** | **632** polygons (GB Westminster only) |
| **Coverage** | England 543 + Scotland 57 + Wales 32 = **632**. Northern Ireland 18 seats **dropped** for v1 (different party system; deferred). Republic of Ireland, Isle of Man, and Channel Islands have no Westminster seats and are out of scope. Source download is the full UK set (650); ingest filters to GB. |
| **Sample vs full** | Full ONS July 2024 Westminster Parliamentary Constituency boundaries (BGC), filtered to Great Britain. BGC is generalised (~20 m) and clipped to Mean High Water — suitable for web MapLibre; not survey-grade cadastral edges. |
| **Source** | [Office for National Statistics](https://www.ons.gov.uk/) Open Geography Portal — Westminster Parliamentary Constituencies (July 2024) Boundaries UK **BGC** |
| **As-of** | 4 July 2024 (post-2023 Boundary Commission review; used for the 2024 general election) |
| **Endpoint used** | ArcGIS FeatureServer GeoJSON (WGS84 `outSR=4326`): `https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Westminster_Parliamentary_Constituencies_July_2024_Boundaries_UK_BGC/FeatureServer/0/query` |
| **Hub** | [data.gov.uk BGC](https://www.data.gov.uk/dataset/7165b3a0-a1f2-40ff-a8e0-cfc2a573be30/westminster-parliamentary-constituencies-july-2024-boundaries-uk-bgc) · [Open Geography Portal](https://geoportal.statistics.gov.uk/datasets/ons::westminster-parliamentary-constituencies-july-2024-boundaries-uk-bgc-2/about) |
| **Extract date (UTC)** | 2026-10-02T19:21:57Z |
| **Method** | `scripts/ingest_ons_pcon2024.py` — download FeatureServer GeoJSON with `resultOffset` pagination, keep `PCON24CD` / `PCON24NM`, drop NI codes (`PCON24CD` starting with `N`), assert exactly 632 GB features |
| **File size** | ~20.5 MB GeoJSON (minified). Prefer GeoJSON for v1; TopoJSON/PMTiles deferred if mobile load becomes painful |
| **License** | [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/) — contains Ordnance Survey **and** ONS IPR |
| **Attribution** | Contains Ordnance Survey data © Crown copyright and database right 2024. Contains National Statistics data © Crown copyright and database right 2024. |

### Property semantics (pipeline)

| Property | Meaning |
|---|---|
| `name` / `PCON24NM` | Official constituency name |
| `PCON24CD` | ONS constituency code (stable join key) |
| `layer` / `source` | App metadata (`constituencies` / `ONS`) |

Popup shows **name + PCON24CD only** in this PR — no candidates, polls, or endorse UI.

### Honest caveats

- Boundaries are **BGC** (~20 m generalisation), not full-resolution BFC/BFE.
- **GB-only**: NI 18 seats deferred; Ireland / IoM / CI out.
- No party colours, endorse badges, candidates, or polling in this layer yet.


## Remaining honest caveats

- Constituencies layer is ONS BGC GB-only (632); NI deferred; no endorse/polling UI yet.
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
- Marketplaces layer is `amenity=marketplace` only (not `shop=marketplace`
  without the amenity tag, street vendors, `shop=convenience`, or farmers
  markets / outdoor markets that lack `amenity=marketplace`). Disused markets
  still tagged `amenity=marketplace` are included. Unnamed marketplaces keep
  the generic label `"Marketplace"`. Extract includes **nodes, ways, and
  relations**; ways and relations are Overpass centre points, not footprints
  (Heathrow lesson — markets are often multipolygon). A site may appear both
  as a relation and as member ways/nodes if both carry `amenity=marketplace`
  (dedupe by OSM `type/id` only). Counts are OSM objects, not distinct
  markets. Isle of Man admin-clip is 1; Channel Islands GG 1 / JE 2
  (hard main-island bbox ≈ GG 1 / JE 2).
- Nature reserves layer is `leisure=nature_reserve` only (not
  `boundary=protected_area` alone, `leisure=park`, `boundary=national_park`,
  `leisure=wildlife_hide`, or `tourism=attraction` without
  `leisure=nature_reserve`). Disused reserves still tagged
  `leisure=nature_reserve` are included. Unnamed reserves keep the generic
  label `"Nature reserve"` (no `name=*` filter at this density). Extract
  includes **nodes, ways, and relations**; ways and relations are Overpass
  centre points, not footprints (Heathrow lesson — nature reserves are often
  multipolygon). A site may appear both as a relation and as member ways/nodes
  if both carry `leisure=nature_reserve` (dedupe by OSM `type/id` only).
  Counts are OSM objects, not distinct reserves. Isle of Man admin-clip is 14;
  Channel Islands GG 10 / JE 1 (hard main-island bbox ≈ GG 10 / JE 1).
- Camp sites layer is `tourism=camp_site` only (not `tourism=caravan_site`,
  `tourism=camp_pitch`, `tourism=hostel`, or `amenity=shelter` without
  `tourism=camp_site`). Caravan sites are a separate OSM tag and are excluded.
  Disused sites still tagged `tourism=camp_site` are included. Unnamed sites
  keep the generic label `"Camp site"` (no `name=*` filter at this density).
  Extract includes **nodes, ways, and relations**; ways and relations are
  Overpass centre points, not footprints (Heathrow lesson — camp sites are
  often ways/relations). A site may appear both as a relation and as member
  ways/nodes if both carry `tourism=camp_site` (dedupe by OSM `type/id` only).
  Counts are OSM objects, not distinct campsites. Isle of Man admin-clip is 20;
  Channel Islands GG 11 / JE 6 (hard main-island bbox ≈ GG 7 / JE 6).
- Memorials layer is `historic=memorial` **with `name=*` required** (not
  unnamed plaques or memorial noise, `historic=monument`, `historic=war_memorial`
  without `historic=memorial`, `memorial=yes` on other keys, or
  `tourism=attraction` without `historic=memorial`). War memorials tagged
  `historic=memorial` are included; disused named memorials are included.
  Extract includes **nodes, ways, and relations**; ways and relations are
  Overpass centre points, not footprints, and counts are OSM objects rather
  than distinct memorials. Isle of Man admin-clip is 61; Channel Islands GG 43 /
  JE 73 (hard main-island bbox ≈ GG 40 / JE 73). The fine regional tiling
  default is `--max-span 1.5°` because raw unfiltered memorials are dense.
- Sports centres layer is `leisure=sports_centre` only (not `leisure=stadium`
  — already a separate layer — `leisure=pitch` alone, `leisure=fitness_centre`,
  or `leisure=sports_hall` without `leisure=sports_centre`). Disused sites still
  tagged `leisure=sports_centre` are included. Unnamed centres keep the generic
  label `"Sports centre"` (no `name=*` filter; density ~10.7k sits at the soft
  ~8–10k guideline but Overpass completed without timeouts). Extract includes
  **nodes, ways, and relations**; ways and relations are Overpass centre points,
  not footprints (Heathrow lesson — sports centres are often ways/relations).
  A site may appear both as a relation and as member ways/nodes if both carry
  `leisure=sports_centre` (dedupe by OSM `type/id` only). Counts are OSM objects,
  not distinct centres. Isle of Man admin-clip is 26; Channel Islands GG 11 /
  JE 29 (hard main-island bbox ≈ GG 9 / JE 29).
- Caravan sites layer is `tourism=caravan_site` only (not `tourism=camp_site`
  — already a separate camp-sites layer — `tourism=camp_pitch`, `tourism=hostel`,
  or `amenity=shelter` without `tourism=caravan_site`). Complements camp sites,
  which already excludes `tourism=caravan_site`. Disused sites still tagged
  `tourism=caravan_site` are included. Unnamed sites keep the generic label
  `"Caravan site"` (no `name=*` filter at this density). Extract includes
  **nodes, ways, and relations**; ways and relations are Overpass centre points,
  not footprints (Heathrow lesson — caravan sites are often ways/relations).
  A site may appear both as a relation and as member ways/nodes if both carry
  `tourism=caravan_site` (dedupe by OSM `type/id` only). Counts are OSM objects,
  not distinct sites. Isle of Man admin-clip is 2; Channel Islands GG 0 / JE 0
  (hard main-island bbox ≈ GG 0 / JE 0) — likely under-tagged on GG/JE.
- Fitness centres layer is `leisure=fitness_centre` only (not `leisure=sports_centre`
  — already a separate sports-centres layer — `leisure=stadium`, `leisure=pitch`
  alone, or `amenity=gym` without `leisure=fitness_centre`). Complements sports
  centres, which already excludes `leisure=fitness_centre` without
  `leisure=sports_centre`. Disused sites still tagged `leisure=fitness_centre`
  are included. Unnamed centres keep the generic label `"Fitness centre"` (no
  `name=*` filter unless density forces it). Extract includes **nodes, ways, and
  relations**; ways and relations are Overpass centre points, not footprints
  (Heathrow lesson — fitness centres are often ways/relations). A site may
  appear both as a relation and as member ways/nodes if both carry
  `leisure=fitness_centre` (dedupe by OSM `type/id` only). Counts are OSM
  objects, not distinct centres. Isle of Man admin-clip is 17; Channel Islands
  GG 6 / JE 8 (hard main-island bbox ≈ GG 6 / JE 8). Unnamed centres keep the
  generic label (no `name=*` filter; density ~6.5k under the soft ~8–10k guideline).
- Community centres layer is `amenity=community_centre` only (not `amenity=arts_centre`,
  `amenity=social_facility` alone, `leisure=fitness_centre` / `leisure=sports_centre`,
  or `tourism=attraction` without the amenity tag). Disused centres still tagged
  `amenity=community_centre` are included. Extract includes **nodes, ways, and
  relations**; ways and relations are Overpass centre points, not footprints. A
  site may appear both as a relation and as member ways/nodes if both carry
  `amenity=community_centre` (dedupe by OSM `type/id` only). Counts are OSM
  objects, not distinct centres. **Named-only** (`name=*` required) due to
  density above the ~8–10k threshold; unnamed centres are omitted.

- Post offices layer is `amenity=post_office` only (not `amenity=parcel_locker`,
  `shop=convenience` with a post_office role alone, Royal Mail collection points
  without `amenity=post_office`, or `amenity=post_box`). Disused offices still tagged
  `amenity=post_office` are included. Extract includes **nodes, ways, and
  relations**; ways and relations are Overpass centre points, not footprints. A
  site may appear both as a relation and as member ways/nodes if both carry
  `amenity=post_office` (dedupe by OSM `type/id` only). Counts are OSM
  objects, not distinct offices. **Named-only** (`name=*` required) due to
  density at/above the ~8–10k soft guideline; unnamed offices are omitted.

- Playgrounds layer is `leisure=playground` only (not `leisure=pitch`,
  `leisure=park`, `amenity=school` playgrounds without `leisure=playground`,
  or `tourism=attraction` alone). Disused sites still tagged
  `leisure=playground` are included. Extract includes **nodes, ways, and
  relations**; ways and relations are Overpass centre points, not footprints. A
  site may appear both as a relation and as member ways/nodes if both carry
  `leisure=playground` (dedupe by OSM `type/id` only). Counts are OSM
  objects, not distinct playgrounds. **Named-only** (`name=*` required) because
  England-alone density without `name=*` is ~44k, far above the ~8–10k soft
  guideline; unnamed playgrounds are omitted.

- Beaches layer is `natural=beach` only (not `natural=coastline`,
  `natural=sand` alone, `leisure=beach_resort` without `natural=beach`,
  or `tourism=hotel`). Disused sites still tagged `natural=beach` are
  included. Extract includes **nodes, ways, and relations**; ways and
  relations are Overpass centre points, not footprints. A site may appear
  both as a relation and as member ways/nodes if both carry `natural=beach`
  (dedupe by OSM `type/id` only). Counts are OSM objects, not distinct
  beaches. **No `name=*` filter**: a loose BI bbox probe (including some
  northern France coast) was ~9.1k, inside the ~8–10k soft band, and the
  same bbox with `name=*` was only ~2.0k, so unnamed beaches are kept.
  Hard France-bleed heuristic flags 1 feature (`relation/20327663` at
  −1.928, 49.291) which is the Jersey Écréhous, inside the Jersey admin
  polygon — mainland France bleed is 0. Isle of Man admin-clip is 129;
  Channel Islands GG 114 / JE 54 (hard main-island bbox ≈ GG 86 / JE 53;
  the Bailiwick polygon includes Alderney / Sark / Herm, and the extra
  Jersey point is the Écréhous).

- Swimming pools layer is `leisure=swimming_pool` only (not `leisure=water_park`,
  `amenity=public_bath`, `sport=swimming` without `leisure=swimming_pool`,
  or `natural=water`). Disused sites still tagged `leisure=swimming_pool`
  are included. Extract includes **nodes, ways, and relations**; ways and
  relations are Overpass centre points, not footprints. A site may appear
  both as a relation and as member ways/nodes if both carry
  `leisure=swimming_pool` (dedupe by OSM `type/id` only). Counts are OSM
  objects, not distinct pools. **Named-only** (`name=*` required) because
  England-alone density without `name=*` is ~23.7k (nodes 366 + ways 23312
  + relations 20), far above the ~8–10k soft guideline (mostly unnamed
  private backyard pools); the same England bbox with `name=*` was 478
  (nodes 151 + ways 324 + relations 3). Unnamed pools are omitted.

- Pharmacies layer is `amenity=pharmacy` only (not `amenity=clinic`,
  `amenity=doctors`, `shop=chemist` without `amenity=pharmacy`, or
  `healthcare=pharmacy` alone). Disused sites still tagged
  `amenity=pharmacy` are included. Extract includes **nodes, ways, and
  relations**; ways and relations are Overpass centre points, not footprints.
  A site may appear both as a relation and as member ways/nodes if both carry
  `amenity=pharmacy` (dedupe by OSM `type/id` only). Counts are OSM objects,
  not distinct pharmacies. **Named-only** (`name=*` required) because an
  England-alone Overpass count without `name=*` was 9235 (nodes 6554 + ways
  2673 + relations 8), at the upper edge of the ~8–10k soft guideline, and a
  loose British Isles bbox (not admin-clipped, includes some northern France)
  was 11051, past ~10k. The same England bbox with `name=*` was 8739 (nodes
  6139 + ways 2592 + relations 8). Unnamed pharmacies are omitted. Admin-clipped
  named result is 10310 (nodes 7476 / ways 2826 / relations 8). Mainland France
  bleed is 0. Isle of Man admin-clip is 22; Channel Islands GG 14 / JE 24.


- Town halls layer is `amenity=townhall` only (not `amenity=community_centre`,
  `amenity=public_building` alone, `office=government`, or `building=civic`
  without `amenity=townhall`). Disused sites still tagged `amenity=townhall`
  are included. Extract includes **nodes, ways, and relations**; ways and
  relations are Overpass centre points, not footprints. A site may appear
  both as a relation and as member ways/nodes if both carry `amenity=townhall`
  (dedupe by OSM `type/id` only). Counts are OSM objects, not distinct town
  halls. **No `name=*` filter** because an England-alone Overpass count
  without `name=*` was 1539 (nodes 302 + ways 1190 + relations 47), well
  inside the ~8–10k soft guideline, and a loose British Isles bbox (not
  admin-clipped, includes some northern France) was 1826, also well under
  ~8k. The same England bbox with `name=*` was 1423 (nodes 266 + ways 1113
  + relations 44). Unnamed town halls are kept (114 pipeline-filled
  `"Town hall"`). Admin-clipped result is 1330 (nodes 274 / ways 1009 /
  relations 47). Mainland France bleed is 0. Isle of Man admin-clip is 5;
  Channel Islands GG 1 / JE 10 (Guernsey is likely under-tagged: only
  Castel Douzaine Room carries `amenity=townhall`).

- Places of worship layer is `amenity=place_of_worship` only (not
  `building=church` without that amenity, `amenity=monastery` alone, or
  `tourism=attraction` alone). Not filtered by `religion=*`; the tag is
  copied onto properties when present. Disused sites still tagged
  `amenity=place_of_worship` are included. Extract includes **nodes, ways, and
  relations**; ways and relations are Overpass centre points, not footprints.
  A site may appear both as a relation and as member ways/nodes if both carry
  `amenity=place_of_worship` (dedupe by OSM `type/id` only). Counts are OSM
  objects, not distinct places of worship. **Named-only** (`name=*` required)
  because an England-alone Overpass count without `name=*` was 39954 (nodes
  4454 + ways 35340 + relations 160), far past the ~8–10k soft guideline. The
  same England bbox with `name=*` was 37859 (nodes 4028 + ways 33673 +
  relations 158) — still dense; unnamed objects only are omitted. Admin-clipped
  named result is 43032 (nodes 4638 / ways 38190 / relations 204). Mainland
  France bleed is 0. Isle of Man admin-clip is 94; Channel Islands GG 43
  (hard main-island bbox ≈ 37; Alderney / Sark / Brecqhou included in the
  Bailiwick polygon) / JE 59. Preview `churches`, `mosques`, and
  `other-religious` layers are still scaffold geometry, not this extract.
  The static file is large (~13 MB) because named density stays high.

- Lighthouses layer is `man_made=lighthouse` only (not `man_made=beacon`,
  `seamark:type=light_major` alone without `man_made=lighthouse`, or
  `historic=yes` without that tag). Disused sites still tagged
  `man_made=lighthouse` are included. Extract includes **nodes, ways, and
  relations**; ways and relations are Overpass centre points, not footprints.
  A site may appear both as a relation and as member ways/nodes if both carry
  `man_made=lighthouse` (dedupe by OSM `type/id` only). Counts are OSM
  objects, not distinct lighthouses. **No `name=*` filter** because an
  England-alone Overpass count without `name=*` was 314 (nodes 180 + ways
  132 + relations 2), well inside the ~8–10k soft guideline. A loose British
  Isles bbox was 585 (nodes 337 + ways 246 + relations 2), also well under
  ~8k. Unnamed lighthouses are kept (127 pipeline-filled `"Lighthouse"`).
  Admin-clipped result is 582 (nodes 340 / ways 240 / relations 2). Mainland
  France bleed is 0 (Channel coast risk checked; southernmost retained point
  is Jersey). Isle of Man admin-clip is 22; Channel Islands GG 13 (hard
  main-island bbox ≈ 9; Alderney / Sark included in Bailiwick polygon) /
  JE 4. No prior lighthouse preview chip existed.

- Courthouses layer is `amenity=courthouse` only (not `office=lawyer`,
  `amenity=police`, `amenity=prison`, or `building=civic` without
  `amenity=courthouse`). Disused sites still tagged `amenity=courthouse`
  are included. Extract includes **nodes, ways, and relations**; ways and
  relations are Overpass centre points, not footprints. A site may appear
  both as a relation and as member ways/nodes if both carry
  `amenity=courthouse` (dedupe by OSM `type/id` only). Counts are OSM
  objects, not distinct courthouses. **No `name=*` filter** because an
  England-alone Overpass count without `name=*` was 412 (nodes 85 + ways
  308 + relations 19), well inside the ~8–10k soft guideline. A loose
  British Isles bbox was 518 (nodes 104 + ways 393 + relations 21), also
  well under ~8k. Unnamed courthouses are kept (34 pipeline-filled
  `"Courthouse"`). Admin-clipped result is 514 (nodes 105 / ways 387 /
  relations 22). Mainland France bleed is 0 (Channel coast risk checked;
  southernmost retained point is Jersey). Isle of Man admin-clip is 1;
  Channel Islands GG 1 / JE 1 (hard main-island bbox matches). No prior
  courthouse preview chip existed.

- Nightclubs layer is `amenity=nightclub` only (not `amenity=bar`,
  `amenity=pub`, `amenity=theatre`, `amenity=casino`, or `leisure=dance`
  without `amenity=nightclub`). Atlas preferred `amenity=theatre` (already
  LayerId `theatres`); fallbacks `amenity=cinema`, `leisure=stadium`, and
  `amenity=ferry_terminal` are already LayerIds `cinemas`, `stadiums`, and
  `ferry-terminals`. The preview pubs chip is not this extract and is not
  replaced. Disused sites still tagged `amenity=nightclub` are included.
  Extract includes **nodes, ways, and relations**; ways and relations are
  Overpass centre points, not footprints. A site may appear both as a
  relation and as member ways/nodes if both carry `amenity=nightclub`
  (dedupe by OSM `type/id` only). Counts are OSM objects, not distinct
  nightclubs. **No `name=*` filter** because an England-alone Overpass
  count without `name=*` was 1023 (nodes 607 + ways 414 + relations 2),
  well inside the ~8–10k soft guideline. A loose British Isles bbox was
  1190 (nodes 744 + ways 444 + relations 2), also well under ~8k. Unnamed
  nightclubs are kept (23 pipeline-filled `"Nightclub"`). Admin-clipped
  result is 1182 (nodes 738 / ways 442 / relations 2). Mainland France
  bleed is 0 (Channel coast risk checked; southernmost retained point is
  Jersey). Isle of Man admin-clip is 1; Channel Islands GG 2 / JE 1
  (hard main-island bbox matches). No prior nightclub preview chip existed.

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
  admin-clip is 1; Channel Islands GG 3 / JE 7. Marketplaces IoM
  admin-clip is 1; Channel Islands GG 1 / JE 2. Nature reserves IoM
  admin-clip is 14; Channel Islands GG 10 / JE 1. Camp sites IoM
  admin-clip is 20; Channel Islands GG 11 / JE 6.
  Memorials admin-clip is IoM 61; Channel Islands GG 43 / JE 73.
  Sports centres IoM admin-clip is 26; Channel Islands GG 11 / JE 29.
  Caravan sites IoM admin-clip is 2; Channel Islands GG 0 / JE 0.
  Playgrounds IoM admin-clip is 10; Channel Islands GG 2 / JE 7 (hard bbox GG ≈ 1).
  Beaches IoM admin-clip is 129; Channel Islands GG 114 / JE 54 (hard main-island bbox ≈ GG 86 / JE 53).
- Extract uses polygon clip + buffer; features extremely close to a land border
  could in theory be included or excluded by the ~200 m buffer.

## Basemap (unchanged)

- Hillshade tiles © Esri, USGS, NOAA
- Water / boundaries © OpenStreetMap contributors via OpenMapTiles / OpenFreeMap
