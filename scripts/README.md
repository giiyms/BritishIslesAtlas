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

