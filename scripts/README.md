# Extract scripts

## `ingest_ons_pcon2024.py`

Downloads ONS July 2024 Westminster PCON **BGC** boundaries (WGS84 GeoJSON) from
the ArcGIS FeatureServer, drops Northern Ireland (18 seats), and writes
`data/constituencies-gb-2024.geojson` (632 GB features) plus a
`constituencies` entry in `public/data/extract-meta.json`.

```bash
python3 scripts/ingest_ons_pcon2024.py
```

License: Open Government Licence v3.0 (OS + ONS Crown copyright attribution
required). See `SOURCES.md`.

## `osm_extract.py` (all OpenStreetMap point layers)

One generic Overpass -> admin-polygon-clip -> GeoJSON pipeline replaces the
former ~49 copy-pasted `extract_osm_<layer>.py` scripts. Per-layer differences
(tag, `name=*` requirement, relations, tile span, sanity thresholds, meta
caveats, and the rationale notes with the count probes behind each tag choice)
live in the `LAYERS` table in [`osm_layers.py`](osm_layers.py).

```bash
# first run refreshes Nominatim admin polygons into scripts/cache/
python3 scripts/osm_extract.py --refresh-polygons castles
python3 scripts/osm_extract.py castles museums petrol ev   # one or more layer ids
python3 scripts/osm_extract.py --all                       # every layer
python3 scripts/osm_extract.py --list                      # ids and tags
```

Outputs:

- `data/osm/<layer>.geojson` (override with `--out-dir`).
- `public/data/extract-meta.json`: the per-layer record is merge-updated
  (override with `--meta-path`).
- Overpass/Nominatim caches under `scripts/cache/` (`<region>.geojson`
  polygons; `<layer>-tiles/` tile caches for the dense layers marked below).

Flags (defaults are per layer from `osm_layers.py` unless stated): `--endpoint`
(default `overpass.openstreetmap.fr`), `--timeout` (180; 120 for memorials,
ruins), `--retries` (6), `--pause` (6.0 s between Overpass calls; raise it if
the endpoint rate-limits), `--max-span` (bbox tile size in degrees, 1.5-2.5),
`--refresh-polygons`, `--out-dir`, `--meta-path`.

Coverage is the British Isles admin areas: England, Scotland, Wales, Northern
Ireland, Ireland, Isle of Man, Guernsey, Jersey. Queries are per-region bbox
tiles (`out center tags`, so ways and relations become centre points),
de-duplicated by OSM type/id and clipped to OSM admin polygons (+~200 m buffer)
so mainland France is not included. Requires `shapely` and `curl`.

After each run the script refuses to finish (non-zero exit, GeoJSON already
written) if a layer's count is below its `min_count`, is a multiple of 1000,
or has more than 5 northern-France bleed points; counts ending in 00 (>= 500)
warn that the result may be capped. `power`, `petrol` and `ev` have no gate.
A layer with `name=*` required adds `["name"]` to the Overpass query and drops
unnamed objects; otherwise unnamed objects keep the layer's generic name.

Licence: OpenStreetMap data is ODbL 1.0 (attribution in the app and in
`SOURCES.md`).

### Layers

Max span is the default tile size in degrees; min count is the sanity gate.

| Layer id | OSM tag | Generic name | Max span | Min count | Notes |
| --- | --- | --- | --- | --- | --- |
| `aerodromes` | `aeroway=aerodrome` | Aerodrome | 2.5 | 50 |  |
| `aquariums` | `tourism=aquarium` | Aquarium | 2.5 | 40 |  |
| `arts-centres` | `amenity=arts_centre` | Arts centre | 2.5 | 50 |  |
| `battlefields` | `historic=battlefield` | Battlefield | 2.5 | 50 |  |
| `beaches` | `natural=beach` | Beach | 2 | 20 |  |
| `camp-sites` | `tourism=camp_site` | Camp site | 2 | 20 |  |
| `caravan-sites` | `tourism=caravan_site` | Caravan site | 2 | 20 |  |
| `castles` | `historic=castle` | Castle | 2.5 | 50 | nodes+ways only |
| `cinemas` | `amenity=cinema` | Cinema | 2.5 | 50 |  |
| `clinics` | `amenity=clinic` | Clinic | 2 | 20 | tile cache + fallback endpoints |
| `community-centres` | `amenity=community_centre` | Community centre | 2 | 20 | name=* required |
| `courthouses` | `amenity=courthouse` | Courthouse | 2 | 20 | tile cache + fallback endpoints |
| `dentists` | `amenity=dentist` | Dentist | 2 | 20 | tile cache + fallback endpoints |
| `ev` | `amenity=charging_station` | EV charging | 2.5 | - | nodes+ways only; no count gate |
| `ferry-terminals` | `amenity=ferry_terminal` | Ferry terminal | 2.5 | 50 |  |
| `fire-stations` | `amenity=fire_station` | Fire station | 2.5 | 50 | nodes+ways only |
| `fitness-centres` | `leisure=fitness_centre` | Fitness centre | 2 | 20 |  |
| `galleries` | `tourism=gallery` | Gallery | 2 | 40 |  |
| `golf-courses` | `leisure=golf_course` | Golf course | 2 | 40 |  |
| `hospitals` | `amenity=hospital` | Hospital | 2.5 | 50 | nodes+ways only |
| `libraries` | `amenity=library` | Library | 2.5 | 50 | nodes+ways only |
| `lighthouses` | `man_made=lighthouse` | Lighthouse | 2 | 20 | tile cache + fallback endpoints |
| `marinas` | `leisure=marina` | Marina | 2.5 | 50 |  |
| `marketplaces` | `amenity=marketplace` | Marketplace | 2 | 20 |  |
| `memorials` | `historic=memorial` | Memorial | 1.5 | 40 | name=* required |
| `museums` | `tourism=museum` | Museum | 2.5 | 50 | nodes+ways only |
| `nature-reserves` | `leisure=nature_reserve` | Nature reserve | 2 | 20 |  |
| `nightclubs` | `amenity=nightclub` | Nightclub | 2 | 20 | tile cache + fallback endpoints |
| `petrol` | `amenity=fuel` | Petrol station | 2.5 | - | nodes+ways only; no count gate |
| `pharmacies` | `amenity=pharmacy` | Pharmacy | 2 | 20 | name=* required; tile cache + fallback endpoints |
| `piers` | `man_made=pier` | Pier | 2.5 | 40 | name=* required |
| `places-of-worship` | `amenity=place_of_worship` | Place of worship | 2 | 20 | name=* required; tile cache + fallback endpoints; copies `religion` |
| `playgrounds` | `leisure=playground` | Playground | 2 | 20 | name=* required |
| `police` | `amenity=police` | Police station | 2.5 | 50 | nodes+ways only |
| `post-offices` | `amenity=post_office` | Post office | 2 | 20 | name=* required |
| `power` | `power=plant` | Power plant | 2.5 | - | nodes+ways only; no count gate |
| `prisons` | `amenity=prison` | Prison | 2 | 20 | tile cache + fallback endpoints |
| `railway-stations` | `railway=station` | Railway station | 2.5 | 50 | nodes+ways only |
| `ruins` | `historic=ruins` | Ruins | 1.5 | 40 | name=* required |
| `sports-centres` | `leisure=sports_centre` | Sports centre | 2 | 20 |  |
| `stadiums` | `leisure=stadium` | Stadium | 2.5 | 50 |  |
| `swimming-pools` | `leisure=swimming_pool` | Swimming pool | 2 | 20 | name=* required |
| `theatres` | `amenity=theatre` | Theatre | 2.5 | 50 |  |
| `theme-parks` | `tourism=theme_park` | Theme park | 2.5 | 50 |  |
| `townhalls` | `amenity=townhall` | Town hall | 2 | 20 | tile cache + fallback endpoints |
| `universities` | `amenity=university` | University | 2.5 | 50 | nodes+ways only |
| `viewpoints` | `tourism=viewpoint` | Viewpoint | 2.5 | 50 |  |
| `windmills` | `man_made=windmill` | Windmill | 2 | 20 | tile cache + fallback endpoints |
| `zoos` | `tourism=zoo` | Zoo | 2.5 | 50 |  |
