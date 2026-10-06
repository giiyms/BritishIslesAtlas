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


## `extract_osm_beaches.py`

Rebuilds `public/data/beaches.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`natural=beach` (nodes, ways, and relations; `out center`). Does **not**
include `natural=coastline`, `natural=sand` alone, `leisure=beach_resort`
without `natural=beach`, or `tourism=hotel`.

```bash
python3 scripts/extract_osm_beaches.py
```

Default `--max-span 2.0`. **No `name=*` filter**: a loose British Isles bbox
probe (49–61°N, −11–2.2°E, not admin-clipped, includes some northern France
coast) was ~9.1k objects (nodes 357 + ways 8216 + relations 567), inside the
~8–10k soft band rather than past it. The same bbox with `name=*` was ~2.0k
(nodes 201 + ways 1607 + relations 197); dropping unnamed beaches would omit
most of the layer, so unnamed sites keep the generic label `Beach`. Admin
polygons clip coastal France.


## `extract_osm_swimming_pools.py`

Rebuilds `public/data/swimming-pools.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`leisure=swimming_pool` (nodes, ways, and relations; `out center`). Does **not**
include `leisure=water_park`, `amenity=public_bath`, `sport=swimming` without
`leisure=swimming_pool`, or `natural=water`.

```bash
python3 scripts/extract_osm_swimming_pools.py
```

Default `--max-span 2.0`. **Named-only** (`name=*` required) because an
England-alone Overpass count without `name=*` (bbox roughly 49.9–55.8°N,
−6.5–2.0°E, not admin-clipped) was ~23.7k (nodes 366 + ways 23312 + relations
20), far past the ~8–10k soft guideline — mostly unnamed private backyard
pools. The same England bbox with `name=*` was 478 (nodes 151 + ways 324 +
relations 3). Unnamed pools are omitted.


## `extract_osm_pharmacies.py`

Rebuilds `public/data/pharmacies.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`amenity=pharmacy` (nodes, ways, and relations; `out center`). Does **not**
include `amenity=clinic`, `amenity=doctors`, `shop=chemist` without
`amenity=pharmacy`, or `healthcare=pharmacy` alone without `amenity=pharmacy`.

```bash
python3 scripts/extract_osm_pharmacies.py
```

Default `--max-span 2.0`. **Named-only** (`name=*` required) because an
England-alone Overpass count without `name=*` (bbox roughly 49.9–55.8°N,
−6.5–2.0°E, not admin-clipped) was 9235 (nodes 6554 + ways 2673 + relations
8), at the upper edge of the ~8–10k soft guideline for England alone, and a
loose British Isles bbox (49.8–61.0°N, −10.8–1.9°E, not admin-clipped,
includes some northern France) was 11051 (nodes 8110 + ways 2932 + relations
9), past ~10k. The same England bbox with `name=*` was 8739 (nodes 6139 +
ways 2592 + relations 8); the loose BI bbox with `name=*` was 10452 (nodes
7610 + ways 2834 + relations 8) before admin clip. Unnamed pharmacies are
omitted. Most UK pharmacies are named (Boots, Lloyds, and independents).

## `extract_osm_townhalls.py`

Rebuilds `public/data/townhalls.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`amenity=townhall` (nodes, ways, and relations; `out center`). Does **not**
include `amenity=community_centre` (already a separate layer),
`amenity=public_building` alone, `office=government`, or `building=civic`
without `amenity=townhall`.

```bash
python3 scripts/extract_osm_townhalls.py
```

Default `--max-span 2.0`. **No `name=*` filter.** An England-alone Overpass
count without `name=*` (bbox roughly 49.9–55.8°N, −6.5–2.0°E, not
admin-clipped) was 1539 (nodes 302 + ways 1190 + relations 47), well inside
the ~8–10k soft guideline. A loose British Isles bbox (49.8–61.0°N,
−10.8–1.9°E, not admin-clipped, includes some northern France) was 1826
(nodes 411 + ways 1365 + relations 50), also well under ~8k. The same
England bbox with `name=*` was 1423 (nodes 266 + ways 1113 + relations 44);
the loose BI bbox with `name=*` was 1675 (nodes 362 + ways 1266 + relations
47). Unnamed town halls are kept.

## `extract_osm_places_of_worship.py`

Rebuilds `public/data/places-of-worship.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`amenity=place_of_worship` (nodes, ways, and relations; `out center`). Does **not**
include `building=church` without `amenity=place_of_worship`, `amenity=monastery`
alone, or `tourism=attraction` alone. Does **not** filter by `religion=*`
(when `religion=*` is present it is copied onto the feature). Preview layers
`churches`, `mosques`, and `other-religious` stay as scaffold geometry and are
not replaced by this extract.

```bash
python3 scripts/extract_osm_places_of_worship.py
```

Default `--max-span 2.0`. **Named-only** (`name=*` required) because an
England-alone Overpass count without `name=*` (bbox roughly 49.9–55.8°N,
−6.5–2.0°E, not admin-clipped) was 39954 (nodes 4454 + ways 35340 + relations
160), far past the ~8–10k soft guideline. The same England bbox with `name=*`
was 37859 (nodes 4028 + ways 33673 + relations 158) — still dense, but the
filter drops unnamed objects only. Unnamed places of worship are omitted.
Disused sites that remain tagged `amenity=place_of_worship` are included.

## `extract_osm_lighthouses.py`

Rebuilds `public/data/lighthouses.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`man_made=lighthouse` (nodes, ways, and relations; `out center`). Does **not**
include `man_made=beacon`, `seamark:type=light_major` alone without
`man_made=lighthouse`, or `historic=yes` without `man_made=lighthouse`. No prior
lighthouse preview chip existed.

```bash
python3 scripts/extract_osm_lighthouses.py
```

Default `--max-span 2.0`. **No `name=*` filter** because an England-alone
Overpass count without `name=*` (bbox roughly 49.9–55.8°N, −6.5–2.0°E, not
admin-clipped) was 314 (nodes 180 + ways 132 + relations 2), well inside the
~8–10k soft guideline. A loose British Isles bbox (49.8–61.0°N, −10.8–1.9°E,
not admin-clipped, includes some northern France) was 585 (nodes 337 + ways
246 + relations 2), also well under ~8k. The same England bbox with `name=*`
was 234 (nodes 122 + ways 110 + relations 2); the loose BI bbox with `name=*`
was 452 (nodes 246 + ways 204 + relations 2). Unnamed lighthouses are kept.
Disused sites that remain tagged `man_made=lighthouse` are included.

## `extract_osm_courthouses.py`

Rebuilds `public/data/courthouses.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`amenity=courthouse` (nodes, ways, and relations; `out center`). Does **not**
include `office=lawyer`, `amenity=police`, `amenity=prison`, or `building=civic`
without `amenity=courthouse`. No prior courthouse preview chip existed.

```bash
python3 scripts/extract_osm_courthouses.py
```

Default `--max-span 2.0`. **No `name=*` filter** because an England-alone
Overpass count without `name=*` (bbox roughly 49.9–55.8°N, −6.5–2.0°E, not
admin-clipped) was 412 (nodes 85 + ways 308 + relations 19), well inside the
~8–10k soft guideline. A loose British Isles bbox (49.8–61.0°N, −10.8–1.9°E,
not admin-clipped, includes some northern France) was 518 (nodes 104 + ways
393 + relations 21), also well under ~8k. The same England bbox with `name=*`
was 394 (nodes 82 + ways 295 + relations 17); the loose BI bbox with `name=*`
was 485 (nodes 100 + ways 367 + relations 18). Unnamed courthouses are kept.
Disused sites that remain tagged `amenity=courthouse` are included.

## `extract_osm_nightclubs.py`

Rebuilds `public/data/nightclubs.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`amenity=nightclub` (nodes, ways, and relations; `out center`). Does **not**
include `amenity=bar`, `amenity=pub` (the preview pubs chip is separate and is
not replaced), `amenity=theatre`, `amenity=casino`, or `leisure=dance` without
`amenity=nightclub`. No prior nightclub preview chip existed.

Tag choice: Atlas preferred `amenity=theatre`, already a LayerId (`theatres`).
Fallbacks `amenity=cinema`, `leisure=stadium`, and `amenity=ferry_terminal` are
already LayerIds (`cinemas`, `stadiums`, `ferry-terminals`). Next unused tag in
the civic/leisure entertainment family is `amenity=nightclub`.

```bash
python3 scripts/extract_osm_nightclubs.py
```

Default `--max-span 2.0`. **No `name=*` filter** because an England-alone
Overpass count without `name=*` (bbox roughly 49.9–55.8°N, −6.5–2.0°E, not
admin-clipped) was 1023 (nodes 607 + ways 414 + relations 2), well inside the
~8–10k soft guideline. A loose British Isles bbox (49.8–61.0°N, −10.8–1.9°E,
not admin-clipped, includes some northern France) was 1190 (nodes 744 + ways
444 + relations 2), also well under ~8k. The same England bbox with `name=*`
was 1006 (nodes 598 + ways 406 + relations 2); the loose BI bbox with `name=*`
was 1167 (nodes 730 + ways 435 + relations 2). Unnamed nightclubs are kept.
Disused sites that remain tagged `amenity=nightclub` are included.

## `extract_osm_windmills.py`

Rebuilds `public/data/windmills.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`man_made=windmill` (nodes, ways, and relations; `out center`). Does **not**
include `generator:source=wind`, `power=generator` alone, `man_made=watermill`,
or `historic=windmill` without `man_made=windmill`. The upcoming wind-turbines
preview chip (LayerId `wind`) is separate and is not replaced. No second
preview chip is added for these points.

Tag choice: Atlas preferred `man_made=windmill`, which is not already a
LayerId. `leisure=marina` is already LayerId `marinas`. Fallbacks
`amenity=embassy` and `amenity=prison` were not needed because
`man_made=windmill` is usable (not empty, and well under ~8–10k).

```bash
python3 scripts/extract_osm_windmills.py
```

Default `--max-span 2.0`. **No `name=*` filter** because an England-alone
Overpass count without `name=*` (bbox roughly 49.9–55.8°N, −6.5–2.0°E, not
admin-clipped; overpass.openstreetmap.fr, OSM base 2026-10-03T04:10:59Z) was
555 (nodes 276 + ways 279 + relations 0), well inside the ~8–10k soft
guideline. A loose British Isles bbox (49.8–61.0°N, −10.8–1.9°E, not
admin-clipped, includes some northern France) was 581 (nodes 283 + ways 298 +
relations 0), also well under ~8k. The same England bbox with `name=*` was
249 (nodes 98 + ways 151 + relations 0); the loose BI bbox with `name=*` was
257 (nodes 100 + ways 157 + relations 0). Unnamed windmills are kept.
Disused mills that remain tagged `man_made=windmill` are included.

## `extract_osm_prisons.py`

Rebuilds `public/data/prisons.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`amenity=prison` (nodes, ways, and relations; `out center`). Does **not**
include `historic=prison`, `building=prison`, or `amenity=police` without
`amenity=prison`. Does **not** include `diplomatic=*`, `office=diplomatic`,
`amenity=embassy`, `amenity=consulate`, or `amenity=clinic`. No second
preview chip is added for these points. Preview pubs and the wind-turbines
chip are untouched.

Tag choice: Atlas preferred `amenity=embassy` is not already a LayerId, but
it is unusable (deprecated; taginfo 60 worldwide as of 2026-10-02; global
Overpass on 2026-10-03 returned 0 inside a rough British Isles box; England
and loose BI bbox counts were 0). Fallback `amenity=prison` is usable (not
empty, and well under ~8–10k). `amenity=clinic` was not needed.

```bash
python3 scripts/extract_osm_prisons.py
```

Default `--max-span 2.0`. **No `name=*` filter** because an England-alone
Overpass count without `name=*` (bbox roughly 49.9–55.8°N, −6.5–2.0°E, not
admin-clipped; overpass.openstreetmap.fr, OSM base 2026-10-03T04:31:51Z) was
178 (nodes 4 + ways 164 + relations 10), well inside the ~8–10k soft
guideline. A loose British Isles bbox (49.8–61.0°N, −10.8–1.9°E, not
admin-clipped, includes some northern France; OSM base 2026-10-03T04:32:51Z)
was 200 (nodes 4 + ways 184 + relations 12), also well under ~8k. The same
England bbox with `name=*` was 166 (nodes 4 + ways 152 + relations 10); the
loose BI bbox with `name=*` was 188 (nodes 4 + ways 172 + relations 12).
Unnamed prisons are kept. Disused sites that remain tagged `amenity=prison`
are included. Guernsey admin-clip includes Sark (`way/420026585`); that is
not mainland France.

## `extract_osm_clinics.py`

Rebuilds `public/data/clinics.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`amenity=clinic` (nodes, ways, and relations; `out center`). Does **not**
include `amenity=doctors`, `amenity=hospital`, `healthcare=*` without
`amenity=clinic`, or `amenity=dentist`. Does **not** include
`amenity=veterinary` or `amenity=supermarket` (not needed; clinic is usable).
Does **not** ship `amenity=pub`, wind turbines, or `amenity=embassy`. No
second preview chip is added for these points. Preview pubs and the
wind-turbines chip are untouched.

Tag choice: Atlas preferred `amenity=clinic` is not already a LayerId and is
usable (not empty, and well under ~8–10k). `amenity=dentist`,
`amenity=veterinary`, and `amenity=supermarket` were not needed.

```bash
python3 scripts/extract_osm_clinics.py
```

Default `--max-span 2.0`. **No `name=*` filter** because an England-alone
Overpass count without `name=*` (bbox roughly 49.9–55.8°N, −6.5–2.0°E, not
admin-clipped; overpass.openstreetmap.fr, OSM base 2026-10-03T04:50:05Z) was
3076 (nodes 1490 + ways 1525 + relations 61), well inside the ~8–10k soft
guideline. A loose British Isles bbox (49.8–61.0°N, −10.8–1.9°E, not
admin-clipped, includes some northern France; OSM base 2026-10-03T04:52:03Z)
was 3714 (nodes 1790 + ways 1838 + relations 86), also well under ~8k. The
same England bbox with `name=*` was 2958 (nodes 1470 + ways 1429 + relations
59; OSM base 2026-10-03T04:51:05Z); the loose BI bbox with `name=*` was 3564
(nodes 1763 + ways 1718 + relations 83; OSM base 2026-10-03T04:53:15Z).
Unnamed clinics are kept. Disused sites that remain tagged `amenity=clinic`
are included. Jersey/Guernsey/Sark points inside the admin polygons are not
mainland France.

## `extract_osm_dentists.py`

Rebuilds `public/data/dentists.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`amenity=dentist` (nodes, ways, and relations; `out center`). Does **not**
include `amenity=doctors`, `amenity=clinic` (already shipped),
`amenity=hospital`, or `healthcare=dentist` alone without `amenity=dentist`.
Does **not** include `amenity=veterinary` or `amenity=supermarket` (not
needed; dentist is usable). Does **not** ship `amenity=pub`, wind turbines,
or `amenity=embassy`. No second preview chip is added for these points.
Preview pubs and the wind-turbines chip are untouched.

Tag choice: Atlas preferred `amenity=dentist` is not already a LayerId and is
usable (not empty, and well under ~8–10k). `amenity=veterinary` and
`amenity=supermarket` were not needed.

```bash
python3 scripts/extract_osm_dentists.py
```

Default `--max-span 2.0`. **No `name=*` filter** because an England-alone
Overpass count without `name=*` (bbox roughly 49.9–55.8°N, −6.5–2.0°E, not
admin-clipped; overpass.openstreetmap.fr, OSM base 2026-10-03T05:09:31Z) was
6270 (nodes 3869 + ways 2396 + relations 5), well inside the ~8–10k soft
guideline. A loose British Isles bbox (49.8–61.0°N, −10.8–1.9°E, not
admin-clipped, includes some northern France and excludes Jersey/Guernsey
south of 49.8°N; OSM base 2026-10-03T05:12:34Z) was 7151 (nodes 4591 + ways
2554 + relations 6), also well under ~8k. The same England bbox with
`name=*` was 5965 (nodes 3698 + ways 2263 + relations 4; OSM base
2026-10-03T05:11:32Z); the loose BI bbox with `name=*` was 6794 (nodes 4390
+ ways 2399 + relations 5; OSM base 2026-10-03T05:13:30Z). Unnamed dentists
are kept. Disused sites that remain tagged `amenity=dentist` are included.
Jersey/Guernsey/Sark points inside the admin polygons are not mainland France.

## `extract_osm_pubs.py`

Rebuilds `public/data/pubs.geojson` (and merges into `extract-meta.json`)
using the same admin-area Overpass + polygon-clip pipeline, querying
`amenity=pub` (nodes, ways, and relations; `out center`). Does **not**
include `amenity=bar`, `amenity=biergarten`, `amenity=nightclub`, or
`amenity=restaurant`. Replaces the preview scatter stub for the pubs chip.
Schools/churches remain stubs. Voting mode is untouched.

```bash
python3 scripts/extract_osm_pubs.py
python3 scripts/build_density_bins.py   # hex density bands for map extrusion
```

Default `--max-span 2.0`. **No `name=*` filter**. Admin-clipped result at
2026-10-06T12:52:55Z: **43184** (England 33182, Scotland 2391,
Wales 2407, NI 554, Ireland 4469,
IoM 75, GG 44, JE 62; France bleed 0).

## `build_density_bins.py`

Builds precomputed flat-top hex density GeoJSON for a point layer (pubs in
this PR) under `public/data/density/`, plus a zoom-band manifest for lazy
load. Generic — pass `--layer` once that layer has a point GeoJSON.

