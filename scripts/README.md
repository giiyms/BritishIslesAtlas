# Extract scripts

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
