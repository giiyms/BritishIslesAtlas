# Extract scripts

## `ingest_ons_pcon2024.py`

Downloads ONS July 2024 Westminster PCON **BGC** boundaries (WGS84 GeoJSON) from
the ArcGIS FeatureServer, drops Northern Ireland (18 seats), and writes
`public/data/constituencies-gb-2024.geojson` (632 GB features) plus a
`constituencies` entry in `public/data/extract-meta.json`.

```bash
python3 scripts/ingest_ons_pcon2024.py
```

License: Open Government Licence v3.0 (OS + ONS Crown copyright attribution
required). See `SOURCES.md`.


## `extract_osm_fuel_ev.py`

Rebuilds `public/data/petrol.geojson`, `public/data/ev.geojson`, and
`public/data/extract-meta.json` from OpenStreetMap via Overpass.

```bash
# first run refreshes Nominatim admin polygons into scripts/cache/
python3 scripts/extract_osm_fuel_ev.py --refresh-polygons
python3 scripts/extract_osm_fuel_ev.py
```

Coverage is the British Isles admin areas: England, Scotland, Wales, Northern
Ireland, Ireland, Isle of Man, Guernsey, Jersey. Queries are per-region bbox
tiles against `overpass.openstreetmap.fr`, then clipped to OSM admin polygons
so mainland France is not included. Requires `shapely` and `curl`.

Be polite: default pause between Overpass calls is 6s; raise `--pause` if the
endpoint rate-limits.

## `extract_osm_power.py`

Rebuilds `public/data/power.geojson` (and merges into `extract-meta.json`) using
the same admin-area Overpass + polygon-clip pipeline, querying `power=plant`.

```bash
python3 scripts/extract_osm_power.py
```

## `extract_osm_hospitals.py`

Rebuilds `public/data/hospitals.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`amenity=hospital` (not clinics or GPs).

```bash
python3 scripts/extract_osm_hospitals.py
```

## `extract_osm_fire_stations.py`

Rebuilds `public/data/fire-stations.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`amenity=fire_station` (not hydrants or ambulance stations).

```bash
python3 scripts/extract_osm_fire_stations.py
```

## `extract_osm_police.py`

Rebuilds `public/data/police.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`amenity=police` (not police boxes or cameras).

```bash
python3 scripts/extract_osm_police.py
```

## `extract_osm_castles.py`

Rebuilds `public/data/castles.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`historic=castle` (not forts, manors, or ruins without the castle tag).

```bash
python3 scripts/extract_osm_castles.py
```

## `extract_osm_libraries.py`

Rebuilds `public/data/libraries.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`amenity=library` (not universities, colleges, schools, or bookshops).

```bash
python3 scripts/extract_osm_libraries.py
```

## `extract_osm_universities.py`

Rebuilds `public/data/universities.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`amenity=university` (not colleges or schools).

```bash
python3 scripts/extract_osm_universities.py
```


## `extract_osm_museums.py`

Rebuilds `public/data/museums.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`tourism=museum` (not galleries, attractions, or arts centres).

```bash
python3 scripts/extract_osm_museums.py
```


## `extract_osm_railway_stations.py`

Rebuilds `public/data/railway-stations.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`railway=station` (not halts, subway entrances, or tram stops).

```bash
python3 scripts/extract_osm_railway_stations.py
```


## `extract_osm_aerodromes.py`

Rebuilds `public/data/aerodromes.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`aeroway=aerodrome` on **nodes, ways, and relations** (`out center tags`;
not helipads, airstrips tagged `aeroway=airstrip`, runways, taxiways,
hangars, or terminals). Relations are required for major sites mapped only
as multipolygons (e.g. Heathrow).

```bash
python3 scripts/extract_osm_aerodromes.py
```

## `extract_osm_ferry_terminals.py`

Rebuilds `public/data/ferry-terminals.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`amenity=ferry_terminal` on **nodes, ways, and relations** (`out center tags`;
not piers, harbours, `route=ferry` ways, or `public_transport=station` without
the amenity tag). Relations included for large terminals mapped as multipolygons
(Heathrow lesson).

```bash
python3 scripts/extract_osm_ferry_terminals.py
```


## `extract_osm_marinas.py`

Rebuilds `public/data/marinas.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`leisure=marina` on **nodes, ways, and relations** (`out center tags`;
not harbours, slipways, boat rentals, or piers without `leisure=marina`).
Relations included for large marinas mapped as multipolygons
(Heathrow lesson).

```bash
python3 scripts/extract_osm_marinas.py
```

## `extract_osm_zoos.py`

Rebuilds `public/data/zoos.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`tourism=zoo` on **nodes, ways, and relations** (`out center tags`;
not aquariums, wildlife parks, animal shelters/boarding, or theme parks
without `tourism=zoo`).
Relations included for large zoos mapped as multipolygons
(Heathrow lesson).

```bash
python3 scripts/extract_osm_zoos.py
```

## `extract_osm_theatres.py`

Rebuilds `public/data/theatres.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`amenity=theatre` on **nodes, ways, and relations** (`out center tags`;
not cinemas, arts centres, community centres, nightclubs, or attractions
without `amenity=theatre`).
Relations included for large theatres mapped as multipolygons
(Heathrow lesson).

```bash
python3 scripts/extract_osm_theatres.py
```

## `extract_osm_battlefields.py`

Rebuilds `public/data/battlefields.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`historic=battlefield` on **nodes, ways, and relations** (`out center tags`;
not memorials, ruins, castles, or sites without `historic=battlefield`).
Relations included for large battlefields mapped as multipolygons
(Heathrow lesson).

```bash
python3 scripts/extract_osm_battlefields.py
```

## `extract_osm_cinemas.py`

Rebuilds `public/data/cinemas.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`amenity=cinema` on **nodes, ways, and relations** (`out center tags`;
not theatres, arts centres, community centres, nightclubs, or attractions
without `amenity=cinema`).
Relations included for large cinemas mapped as multipolygons
(Heathrow lesson).

```bash
python3 scripts/extract_osm_cinemas.py
```

## `extract_osm_stadiums.py`

Rebuilds `public/data/stadiums.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`leisure=stadium` on **nodes, ways, and relations** (`out center tags`;
not sports centres, pitches, tracks, or `building=stadium` without
`leisure=stadium`).
Relations included for large stadiums mapped as multipolygons
(Heathrow lesson).

```bash
python3 scripts/extract_osm_stadiums.py
```

## `extract_osm_theme_parks.py`

Rebuilds `public/data/theme-parks.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`tourism=theme_park` on **nodes, ways, and relations** (`out center tags`;
not generic attractions, zoos, water parks, amusement arcades, or fairgrounds
without `tourism=theme_park`). OSM sometimes tags indoor soft-play / activity
centres as theme parks — those are included when so tagged.
Relations included for large parks mapped as multipolygons
(Heathrow lesson).

```bash
python3 scripts/extract_osm_theme_parks.py
```

## `extract_osm_viewpoints.py`

Rebuilds `public/data/viewpoints.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`tourism=viewpoint` on **nodes, ways, and relations** (`out center tags`;
not peaks without `tourism=viewpoint`, attractions, benches with a view, or
guideposts). Relations included for rare multipolygon viewpoints
(Heathrow lesson).

```bash
python3 scripts/extract_osm_viewpoints.py
```

## `extract_osm_arts_centres.py`

Rebuilds `public/data/arts-centres.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`amenity=arts_centre` on **nodes, ways, and relations** (`out center tags`;
not theatres, cinemas, community centres, museums, galleries, or attractions
without `amenity=arts_centre`). Relations included for large centres mapped
as multipolygons (Heathrow lesson).

```bash
python3 scripts/extract_osm_arts_centres.py
```

## `extract_osm_aquariums.py`

Rebuilds `public/data/aquariums.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`tourism=aquarium` on **nodes, ways, and relations** (`out center tags`).

```bash
python3 scripts/extract_osm_aquariums.py
```

## `extract_osm_piers.py`

Rebuilds `public/data/piers.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`man_made=pier` **with `name=*`** on **nodes, ways, and relations**.

```bash
python3 scripts/extract_osm_piers.py
```

## `extract_osm_ruins.py`

Rebuilds `public/data/ruins.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`historic=ruins` **with `name=*`** on **nodes, ways, and relations**
(tighter `--max-span 1.5`).

```bash
python3 scripts/extract_osm_ruins.py
```

## `extract_osm_golf_courses.py`

Rebuilds `public/data/golf-courses.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`leisure=golf_course` on **nodes, ways, and relations**.

```bash
python3 scripts/extract_osm_golf_courses.py
```

## `extract_osm_galleries.py`

Rebuilds `public/data/galleries.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`tourism=gallery` on **nodes, ways, and relations**.

```bash
python3 scripts/extract_osm_galleries.py
```

## `extract_osm_marketplaces.py`

Rebuilds `public/data/marketplaces.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`amenity=marketplace` on **nodes, ways, and relations**.

```bash
python3 scripts/extract_osm_marketplaces.py
```

## `extract_osm_nature_reserves.py`

Rebuilds `public/data/nature-reserves.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`leisure=nature_reserve` on **nodes, ways, and relations**.

```bash
python3 scripts/extract_osm_nature_reserves.py
```

## `extract_osm_camp_sites.py`

Rebuilds `public/data/camp-sites.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`tourism=camp_site` on **nodes, ways, and relations** (not caravan sites).

```bash
python3 scripts/extract_osm_camp_sites.py
```

## `extract_osm_memorials.py`

Rebuilds `public/data/memorials.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`historic=memorial` **with `name=*`** on **nodes, ways, and relations**
(tighter `--max-span 1.5`).

```bash
python3 scripts/extract_osm_memorials.py
```

## `extract_osm_sports_centres.py`

Rebuilds `public/data/sports-centres.geojson` (and merges into `extract-meta.json`)
from OSM `leisure=sports_centre` (nodes, ways, and relations; `out center`).
Does **not** include `leisure=stadium` (separate layer), `leisure=pitch` alone,
`leisure=fitness_centre`, or `leisure=sports_hall` without `leisure=sports_centre`.
Unnamed sites keep the generic label "Sports centre" (no `name=*` filter unless
density / timeouts force it). Same admin-area pipeline as camp sites.

```bash
python3 scripts/extract_osm_sports_centres.py
```


## `extract_osm_caravan_sites.py`

Rebuilds `public/data/caravan-sites.geojson` (and merges into `extract-meta.json`)
from OSM `tourism=caravan_site` (nodes, ways, and relations; `out center`).
Does **not** include `tourism=camp_site` (separate camp-sites layer),
`tourism=camp_pitch`, `tourism=hostel`, or `amenity=shelter` without
`tourism=caravan_site`. Complements the camp-sites layer which already
excludes caravan sites. Unnamed sites keep the generic label "Caravan site"
(no `name=*` filter unless density / timeouts force it). Same admin-area
pipeline as sports centres / camp sites.

```bash
python3 scripts/extract_osm_caravan_sites.py
```

## `extract_osm_fitness_centres.py`

Rebuilds `public/data/fitness-centres.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`leisure=fitness_centre` (nodes, ways, and relations; `out center`). Does **not**
include `leisure=sports_centre`, `leisure=stadium`, `leisure=pitch` alone, or
`amenity=gym` without `leisure=fitness_centre`. Complements sports centres, which
already excludes `fitness_centre` without `sports_centre`.

```bash
python3 scripts/extract_osm_fitness_centres.py
```

Default `--max-span 2.0`. Unnamed sites keep the generic label `"Fitness centre"`
unless density forces `--` named-only via `require_name` in the script config.


## `extract_osm_community_centres.py`

Rebuilds `public/data/community-centres.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`amenity=community_centre` (nodes, ways, and relations; `out center`). Does **not**
include `amenity=arts_centre` (already an arts-centres layer),
`amenity=social_facility` alone, `leisure=fitness_centre` / `leisure=sports_centre`,
or `tourism=attraction` without `amenity=community_centre`.

```bash
python3 scripts/extract_osm_community_centres.py
```

Default `--max-span 2.0`. **Named-only** (`name=*` required) because England-alone
density exceeds the ~8–10k threshold; unnamed community centres are omitted.


## `extract_osm_post_offices.py`

Rebuilds `public/data/post-offices.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`amenity=post_office` (nodes, ways, and relations; `out center`). Does **not**
include `amenity=parcel_locker`, `shop=convenience` with a post_office role alone,
Royal Mail collection points without `amenity=post_office`, or `amenity=post_box`.

```bash
python3 scripts/extract_osm_post_offices.py
```

Default `--max-span 2.0`. **Named-only** (`name=*` required) because UK Geofabrik
density is already ~9.4k at the ~8–10k soft guideline (full BI with Ireland would
blow past it); unnamed post offices are omitted.


## `extract_osm_playgrounds.py`

Rebuilds `public/data/playgrounds.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`leisure=playground` (nodes, ways, and relations; `out center`). Does **not**
include `leisure=pitch`, `leisure=park`, `amenity=school` playgrounds without
`leisure=playground`, or `tourism=attraction` alone.

```bash
python3 scripts/extract_osm_playgrounds.py
```

Default `--max-span 2.0`. **Named-only** (`name=*` required) because England-alone
density without `name=*` is ~44k (far past the ~8–10k soft guideline); unnamed
playgrounds are omitted.
