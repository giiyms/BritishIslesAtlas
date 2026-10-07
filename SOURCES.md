# Data sources

British Isles Atlas never queries Overpass (or any other live source) while the
map is in use. Raw extracts live in `data/` (not served); a build step turns them
into the static files the app loads from `public/`.

## Pipeline

```
Overpass / ONS  --extract-->  data/osm/<layer>.geojson, data/constituencies-gb-2024.geojson
                --build_tiles-->  public/tiles/*.pmtiles, public/tiles/distance-*.png,
                                  public/data/seat-stats.json, public/data/seat-index.json
```

```bash
python3 scripts/osm_extract.py <layer-id>...   # or --all | --list
python3 scripts/build_tiles.py                 # or --only distance hex
```

- `scripts/osm_extract.py` is the single generic OSM extractor. Per-layer specs
  (tag, `require_name`, relation handling, tiling, sanity gates) are in
  `scripts/osm_layers.py`. It also (re)writes `public/data/extract-meta.json`
  (per-layer count, extract date, region counts, limitations).
- `scripts/ingest_ons_pcon2024.py` writes `data/constituencies-gb-2024.geojson`.
- `scripts/build_tiles.py` (needs tippecanoe >= 2.17, numpy, scipy, Pillow) writes
  everything served:

| Served file | Content |
|---|---|
| `public/tiles/<layer>.pmtiles` | One per OSM layer, tippecanoe-clustered up to z10 |
| `public/tiles/constituencies.pmtiles` | GB seat polygons (`PCON24CD`, `PCON24NM`) |
| `public/tiles/hex.pmtiles` | 7 km equal-area hexes with per-layer counts |
| `public/tiles/distance-<layer>.png` | Distance-to-nearest rasters (see Derived surfaces) |
| `public/data/seat-stats.json` | Per-seat counts per layer, plus hex class breaks |
| `public/data/seat-index.json` | Seat name, pole-of-inaccessibility label point, bbox |

Class breaks and palettes shared with the app are in `src/surfaces.json`.
Other static data files: `hexmap-pcon.json`, `candidates-gb.json`,
`polls-national.json`, `polls-seats.json`, `overrides.json`,
`endorsements-gb.json`, `voting-meta.json` (all under `public/data/`).

## OSM layers (49)

Counts and dates are from `public/data/extract-meta.json` (extract date is UTC;
`name` = `require_name`, i.e. unnamed objects are dropped).

| Layer id | OSM tag | require_name | Features | Extracted |
|---|---|---|---|---|
| `aerodromes` | `aeroway=aerodrome` | no | 910 | 2026-10-01 |
| `aquariums` | `tourism=aquarium` | no | 52 | 2026-10-01 |
| `arts-centres` | `amenity=arts_centre` | no | 870 | 2026-10-01 |
| `battlefields` | `historic=battlefield` | no | 159 | 2026-10-01 |
| `beaches` | `natural=beach` | no | 8,846 | 2026-10-02 |
| `camp-sites` | `tourism=camp_site` | no | 4,155 | 2026-10-01 |
| `caravan-sites` | `tourism=caravan_site` | no | 5,017 | 2026-10-02 |
| `castles` | `historic=castle` | no | 2,265 | 2026-09-30 |
| `cinemas` | `amenity=cinema` | no | 924 | 2026-10-01 |
| `clinics` | `amenity=clinic` | no | 3,723 | 2026-10-03 |
| `community-centres` | `amenity=community_centre` | yes | 16,909 | 2026-10-02 |
| `courthouses` | `amenity=courthouse` | no | 514 | 2026-10-03 |
| `dentists` | `amenity=dentist` | no | 7,135 | 2026-10-03 |
| `ev` | `amenity=charging_station` | no | 9,420 | 2026-09-30 |
| `ferry-terminals` | `amenity=ferry_terminal` | no | 834 | 2026-10-01 |
| `fire-stations` | `amenity=fire_station` | no | 2,338 | 2026-09-30 |
| `fitness-centres` | `leisure=fitness_centre` | no | 6,463 | 2026-10-02 |
| `galleries` | `tourism=gallery` | no | 1,390 | 2026-10-01 |
| `golf-courses` | `leisure=golf_course` | no | 3,759 | 2026-10-01 |
| `hospitals` | `amenity=hospital` | no | 1,946 | 2026-09-30 |
| `libraries` | `amenity=library` | no | 4,293 | 2026-10-01 |
| `lighthouses` | `man_made=lighthouse` | no | 582 | 2026-10-03 |
| `marinas` | `leisure=marina` | no | 1,198 | 2026-10-01 |
| `marketplaces` | `amenity=marketplace` | no | 943 | 2026-10-01 |
| `memorials` | `historic=memorial` | yes | 14,851 | 2026-10-01 |
| `museums` | `tourism=museum` | no | 3,315 | 2026-10-01 |
| `nature-reserves` | `leisure=nature_reserve` | no | 4,185 | 2026-10-01 |
| `nightclubs` | `amenity=nightclub` | no | 1,182 | 2026-10-03 |
| `petrol` | `amenity=fuel` | no | 10,267 | 2026-09-30 |
| `pharmacies` | `amenity=pharmacy` | yes | 10,310 | 2026-10-03 |
| `piers` | `man_made=pier` | yes | 1,340 | 2026-10-01 |
| `places-of-worship` | `amenity=place_of_worship` | yes | 43,032 | 2026-10-03 |
| `playgrounds` | `leisure=playground` | yes | 5,372 | 2026-10-02 |
| `police` | `amenity=police` | no | 2,298 | 2026-09-30 |
| `post-offices` | `amenity=post_office` | yes | 9,784 | 2026-10-02 |
| `power` | `power=plant` | no | 2,821 | 2026-09-30 |
| `prisons` | `amenity=prison` | no | 203 | 2026-10-03 |
| `railway-stations` | `railway=station` | no | 3,822 | 2026-10-01 |
| `ruins` | `historic=ruins` | yes | 4,801 | 2026-10-01 |
| `sports-centres` | `leisure=sports_centre` | no | 10,726 | 2026-10-02 |
| `stadiums` | `leisure=stadium` | no | 662 | 2026-10-01 |
| `swimming-pools` | `leisure=swimming_pool` | yes | 552 | 2026-10-02 |
| `theatres` | `amenity=theatre` | no | 1,765 | 2026-10-01 |
| `theme-parks` | `tourism=theme_park` | no | 209 | 2026-10-01 |
| `townhalls` | `amenity=townhall` | no | 1,330 | 2026-10-03 |
| `universities` | `amenity=university` | no | 986 | 2026-10-01 |
| `viewpoints` | `tourism=viewpoint` | no | 5,823 | 2026-10-01 |
| `windmills` | `man_made=windmill` | no | 571 | 2026-10-03 |
| `zoos` | `tourism=zoo` | no | 309 | 2026-10-01 |

## OSM layer semantics (shared by all 49 layers)

- **Source and licence:** [OpenStreetMap](https://www.openstreetmap.org/) via the
  Overpass API (`https://overpass.openstreetmap.fr/api/interpreter`, with fallback
  endpoints for dense layers). Licence [ODbL 1.0](https://opendatacommons.org/licenses/odbl/).
  Attribution: **© OpenStreetMap contributors**.
- **Footprint:** OSM admin polygons for England, Scotland, Wales, Northern Ireland,
  Ireland, Isle of Man, Guernsey and Jersey (ENG/SCT/WLS/NIR/IE/IM/GG/JE; via
  Nominatim, cached under `scripts/cache/`). Overpass is queried per region in
  bbox tiles (not one Isles-wide bbox) and results are **clipped to the admin
  polygon plus ~200 m**, so mainland France and cross-border spill are dropped
  (northern France bleed is 0 in every layer). Features within ~200 m of a land
  border could in theory be kept or dropped by that buffer.
  `overpass.openstreetmap.fr` errors on `area[...]` queries, so polygon-clipped
  tiles are the practical equivalent.
- **Geometry:** `out center` — ways and relations are stored as **centre points**,
  not footprints. Every layer queries nodes and ways; relations are included
  unless the layer spec has `include_relations=False` (castles, ev, fire-stations,
  hospitals, libraries, museums, petrol, police, power, railway-stations,
  universities). Deduplication is by OSM `type/id` only, so one site can appear as
  a relation plus member ways/nodes.
- **Counts are OSM objects**, not distinct institutions/sites (a campus, multiplex
  or terminal may be several objects). OSM completeness varies; absence of a
  feature is not proof it does not exist.
- **Names:** unnamed objects get a pipeline generic (e.g. `"Hospital"`) unless the
  layer is `require_name` (see table), which drops them instead. Generics are
  pipeline fills, not OSM-verified labels.
- **Properties kept in tiles:** `name`, `osm_id`, `brand` (from `brand`/`operator`
  when tagged) and, for places of worship only, `religion`.
- **Disused objects** still carrying the layer's tag are included. Tags outside
  the layer's single `key=value` are never included (e.g. `building=*` without
  the amenity tag); see `notes`/`limitations` per layer in `scripts/osm_layers.py`
  and `public/data/extract-meta.json` for the exact exclusions and probe counts.

### Per-layer notes

Only caveats specific to one layer; everything else follows the shared rules above.

- **petrol** (`amenity=fuel`) and **ev** (`amenity=charging_station`): node + way
  only, no count sanity gate. `ev` objects are sometimes a whole site and
  sometimes one device, so counts are not site counts; Guernsey has just 1 EV
  object (likely under-tagged). Petrol: 10,267 (England 6,599, Scotland 818,
  Wales 529, NI 566, Ireland 1,676, IoM 21, GG 26, JE 32).
- **power** (`power=plant`): plant sites only; individual `power=generator`
  devices (turbines etc.) are excluded. 2,817 of 2,821 are ways.
- **hospitals**: `amenity=hospital` only (not clinics, GPs, `healthcare=hospital`
  alone). IoM has only 2 OSM hospitals, likely under-tagged.
- **clinics** / **dentists**: `amenity=clinic` / `amenity=dentist` only; neither
  includes `amenity=doctors`. No name filter (unnamed kept). Dentists: 7,135.
- **pharmacies**: `require_name`; England-alone count without the filter was 9,235
  (loose Isles bbox 11,051, past the ~10k guideline). Named result 10,310.
- **fire-stations**: no hydrants or ambulance stations. **police**: no police boxes
  or cameras. **libraries**: not bookshops, schools or colleges.
- **castles** (`historic=castle`): includes ruins still tagged castle; excludes
  forts, manors, towers. Ireland's 1,059 is high because many tower houses are
  tagged as castles; not an inventory of "great castles".
- **universities**: campus/site objects, not institutions. Wales has only 5 (likely
  under-tagged); Channel Islands 0.
- **museums**: `tourism=museum` only; galleries are the separate `galleries` layer.
- **railway-stations** (`railway=station`): not halts, tram stops, subway entrances
  or bus stations. Heritage/disused stations still tagged are included (IoM 13).
- **aerodromes**: not helipads, `aeroway=airstrip`, runways or terminals. Major
  airports mapped only as relations (e.g. Heathrow `relation/14001268`) are
  included via centre points.
- **ferry-terminals**: not piers, harbours or `route=ferry`. **marinas**: not
  `leisure=harbour`/slipways. **piers**: `require_name`; raw `man_made=pier` is
  ~20k+ mostly unnamed linear noise.
- **zoos**: petting/children's farms tagged `tourism=zoo` are included.
  **theme-parks**: indoor soft-play tagged `tourism=theme_park` is included;
  major parks tagged only `tourism=attraction` are missed. **aquariums**: koi /
  ornamental-fish shops tagged `tourism=aquarium` are included.
- **battlefields**: 0 relations survived the admin clip at this extract; OSM is
  incomplete vs Historic England / HES / Cadw / NIEA registers.
- **memorials** and **ruins**: `require_name` and finer tiling (`max_span` 1.5)
  because the unfiltered tags are dense and timeout-prone. War memorials tagged
  `historic=memorial` are included.
- **beaches**: no name filter (loose-bbox probe ~9.1k vs ~2.0k named). One
  France-bleed heuristic hit (`relation/20327663`, Écréhous) is inside the Jersey
  polygon; mainland bleed is 0. IoM 129, GG 114, JE 54.
- **camp-sites** vs **caravan-sites**: separate tags (`tourism=camp_site` /
  `tourism=caravan_site`); neither includes the other. **sports-centres** vs
  **fitness-centres** likewise (`leisure=sports_centre` / `leisure=fitness_centre`).
- **community-centres**, **post-offices**, **playgrounds**, **swimming-pools**:
  `require_name` because unfiltered density is far past the ~8-10k guideline
  (England-alone playgrounds ~44k; swimming pools ~23.7k, mostly unnamed private
  pools vs 478 named).
- **places-of-worship**: `require_name` (England-alone 39,954 unfiltered, 37,859
  named); not filtered by religion, but `religion=*` is copied to the `religion`
  tile property. 43,032 features, the densest layer.
- **townhalls**: Guernsey likely under-tagged (only one object).
  **windmills**: `man_made=windmill` only, 0 relations matched; not wind turbines.
- **prisons**: `amenity=prison` only (chosen because `amenity=embassy` is
  deprecated with 0 hits in the Isles); no `office=diplomatic`/consulates.
- **lighthouses**: not `man_made=beacon` or seamark-only objects.
- **nightclubs**: not bars, pubs or casinos. **courthouses**: not `office=lawyer`.
- Channel Islands admin-clip counts include Alderney/Sark/Herm (the Bailiwick
  polygon), so Guernsey can exceed a main-island-only bbox check.

## Derived surfaces

All built by `scripts/build_tiles.py` from the raw extracts; parameters in
`src/surfaces.json`.

- **Per-seat counts** (`public/data/seat-stats.json`): each OSM point is assigned to
  a seat via a ~250 m seat raster. 2024 seats were drawn to an electorate quota of
  **69,724-77,062**, so per-seat counts are roughly **per 73k voters**; that is
  why raw per-seat counts are comparable between seats. Seat names, label points
  (pole of inaccessibility) and bboxes are in `public/data/seat-index.json`.
- **Hexes** (`public/tiles/hex.pmtiles`): 7 km radius hexagons on a Lambert
  azimuthal equal-area grid (about 127 km2 each), with a count per layer
  (`n_<layer>`). Class breaks are stored in `seat-stats.json` (`hexBreaks`).
- **Distance rasters** (`public/tiles/distance-<layer>.png`): hospitals, pharmacies,
  railway-stations, ev, post-offices, dentists. Web Mercator, bounds
  11W-2E / 49.8-61N, 0.8 km pixels. Value is **straight-line distance to the
  nearest feature, not travel time**. Class breaks (km) are in
  `src/surfaces.json` (e.g. hospitals 5/10/20/30; the rest 1/2/5/10 or 2/5/10/20).
  Continental France / Cotentin pixels are made transparent so land outside the
  Isles is not shaded.
- **Hex cartogram layout** (`public/data/hexmap-pcon.json`): 650 GB+NI seats,
  `odd-r` layout, derived from `maps/uk-constituencies-2023.hexjson` in
  [odileeds/hexmaps](https://github.com/odileeds/hexmaps) (positions identical to
  their 2024 layout). **MIT licence, © Open Innovations.**
- **Place-name labels** come from the OpenFreeMap / OpenMapTiles `place` layer.

## Constituencies (`constituencies`)

| | |
|---|---|
| **Raw file** | `data/constituencies-gb-2024.geojson` (served as `public/tiles/constituencies.pmtiles`) |
| **Features** | **632** polygons (GB Westminster only) |
| **Coverage** | England 543 + Scotland 57 + Wales 32 = **632**. Northern Ireland's 18 seats are **dropped** from the choropleth data (different party system; deferred; the hex layout does include NI). Ireland, IoM and Channel Islands have no Westminster seats. The source download is the full UK set (650); ingest filters to GB. |
| **Source** | [Office for National Statistics](https://www.ons.gov.uk/) Open Geography Portal, Westminster Parliamentary Constituencies (July 2024) Boundaries UK **BGC** |
| **As-of** | 4 July 2024 (post-2023 Boundary Commission review; used for the 2024 general election) |
| **Endpoint** | ArcGIS FeatureServer GeoJSON (`outSR=4326`): `https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Westminster_Parliamentary_Constituencies_July_2024_Boundaries_UK_BGC/FeatureServer/0/query` |
| **Hub** | [data.gov.uk BGC](https://www.data.gov.uk/dataset/7165b3a0-a1f2-40ff-a8e0-cfc2a573be30/westminster-parliamentary-constituencies-july-2024-boundaries-uk-bgc) · [Open Geography Portal](https://geoportal.statistics.gov.uk/datasets/ons::westminster-parliamentary-constituencies-july-2024-boundaries-uk-bgc-2/about) |
| **Extracted** | 2026-10-02 (UTC) |
| **Method** | `scripts/ingest_ons_pcon2024.py`: download with `resultOffset` pagination, keep `PCON24CD` / `PCON24NM`, drop NI codes (`PCON24CD` starting `N`), assert exactly 632 GB features |
| **Licence** | [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/), contains Ordnance Survey **and** ONS IPR |
| **Attribution** | Contains Ordnance Survey data © Crown copyright and database right 2024. Contains National Statistics data © Crown copyright and database right 2024. |

Properties: `name` / `PCON24NM` (official name), `PCON24CD` (ONS code, stable join
key). Caveat: boundaries are **BGC** (~20 m generalised, clipped to Mean High
Water), suitable for web maps, not survey-grade BFC/BFE.

## Basemap and roads

- Hillshade tiles © Esri, USGS, NOAA.
- Water, boundaries, place-name labels and roads (OpenMapTiles motorway / trunk /
  primary) © OpenStreetMap contributors via OpenMapTiles / OpenFreeMap.

## Not shipped / roadmap

Sample/preview layers were removed: roads stubs, pubs, schools, churches,
mosques, other-religious, population, census, and all "upcoming" stubs. None is
part of the shipped data. Known gaps: 2024 results join (below) and NI seats.

## Voting: candidates, polls, endorsements

Editorial **Reform / Restore Britain** endorsement map over GB Westminster seats (632).
Never endorses Labour or Conservatives. Daniel per-seat overrides always win.
**Restore-ahead rule (locked 2026-10-05):** any trusted seat poll (EC or More in Common)
with Restore share strictly ahead of Reform → Vote Restore, even without a Democracy Club
confirmed Restore candidate (hard example: Great Yarmouth `E14001256`, MIC 28.2% vs Ref 26.9%).
This is an **editorial endorsement map**, not Electoral Commission advice. Seat MRP
figures are **projections**, not results. Restore Britain candidate coverage in
Democracy Club is **sparse** — most seats are presumed Reform under locked anti-split rules.

### Candidates (`candidates-gb`)

| Field | Value |
|---|---|
| **File** | `public/data/candidates-gb.json` |
| **Source** | [Democracy Club Candidates](https://candidates.democracyclub.org.uk/) CSV export (`party_id` PP7931 Reform UK, PP18382 Restore Britain; `election_id=^parl.*`) |
| **License** | **CC-BY-SA** |
| **Script** | `scripts/fetch_candidates.py` (idempotent; writes `retrieved_at`) |
| **Join** | DC `post_label` → ONS `PCON24NM` via name normalisation; keyed by `PCON24CD` |
| **Caveats** | Names only when present in DC — **never invented**. Standing=`unknown` when no confirmed Westminster candidacy in scope. Restore lists are sparse (~2 recent parl candidacies as of refresh). Local / PCC Restore candidacies are out of this GB Westminster file. |

### National polls (`polls-national`)

| Field | Value |
|---|---|
| **File** | `public/data/polls-national.json` |
| **Source** | [Wikipedia — Opinion polling for the next UK general election](https://en.wikipedia.org/wiki/Opinion_polling_for_the_next_United_Kingdom_general_election) |
| **Secondary** | [Mark Pack VI scorecard](https://www.markpack.org.uk/155623/voting-intention-opinion-poll-scorecard/) (cited, not scraped as primary) |
| **Script** | `scripts/fetch_polls_national.py` |
| **Rolling average** | Arithmetic mean of latest 7 GB polls with numeric Lab/Con/Ref. Restore Britain (`rb`) averaged only over polls that break it out (need ≥3 in window; else null). Documented in-file. |
| **Caveats** | Not affiliated with any pollster. National VI must **not** alone flip seat endorsements. |

### Seat polls (`polls-seats`)

| Field | Value |
|---|---|
| **File** | `public/data/polls-seats.json` |
| **Electoral Calculus** | Public [`electdata_pred.txt`](https://www.electoralcalculus.co.uk/electdata_pred.txt) + [prediction page](https://www.electoralcalculus.co.uk/prediction_main.html). Loaded when fetch succeeds. **Does not break out Restore Britain** (`restore_share=null`). Attribution + retrieval date per [EC FAQ](https://www.electoralcalculus.co.uk/faq.html) Overview republication notes. |
| **More in Common** | Public [Sep 2026 MRP XLSX](https://www.moreincommon.org.uk/wp-content/uploads/2026/09/Sep26-MRP.xlsx) linked from [research page](https://www.moreincommon.org.uk/research/more-in-commons-september-2026-mrp/). Includes Restore Britain column. |
| **Script** | `scripts/fetch_polls_seats.py` |
| **App use** | Election mode "Projected winner" and "Reform share" views read this file: Electoral Calculus first, More in Common as fallback. |
| **Caveats** | If a provider cannot be fetched, **keep the last good provider block** and set `status=stale` (with `stale_error`); only use `link_out` + empty `seats` when there is no prior good block — **never invent numbers**, never blank a loaded strip on a transient failure. Projections ≠ results. |

### Overrides (`overrides`)

| Field | Value |
|---|---|
| **File** | `public/data/overrides.json` |
| **Owner** | Daniel |
| **Format** | `{ "overrides": [ { "pcon24cd", "endorse", "note?", "by?", "at?" } ] }` |
| **Rule** | Overrides always win. Lab/Con values are rejected by the engine. |

### Endorse engine

| Field | Value |
|---|---|
| **Code** | `src/endorse.ts` (pure functions) + `scripts/build_endorsements.py` (map index) |
| **Output** | `public/data/endorsements-gb.json` (632 seats coloured for the map) |
| **Locked decision (2026-10-05)** | (1) Daniel overrides win first (Lab/Con override values → `none`). (2) **Restore-ahead rule:** if **any** trusted seat poll (Electoral Calculus or More in Common) has Restore share **strictly greater** than Reform share → pick **Restore**, even when Democracy Club has **no confirmed Restore candidate**. If one trusted provider has Restore ahead and another has Reform ahead → **Restore still wins**; reason notes that sources disagree. (3) Otherwise existing tree: neither standing → `none`; Restore unknown/not standing → Reform (presumed when Reform unknown); only Restore standing → Restore; both standing without Restore-ahead → Reform. **Never Lab/Con.** |
| **Reason copy** | Example: `More in Common projects Restore ahead of Reform here (28.2% vs 26.9%); Vote Restore to avoid splitting.` When polls clearly favour Reform (e.g. Holborn, Makerfield), say so — do not say "inconclusive". When Restore standing is `unknown`, say "not confirmed", not "not standing". |
| **Tests** | `src/endorse.test.ts` via `npm test` (vitest) — covers override, Restore-ahead without DC candidate, providers disagree→Restore, Great Yarmouth-style MIC numbers, neither standing, restore-only, reform-default, both+polls favour Reform, tie→reform, presumed Reform, never Lab/Con |
| **Refresh** | `scripts/refresh_voting_data.py` + workflow template `scripts/github-workflows/refresh-voting-data.yml` (copy to `.github/workflows/` on merge — box `gh` token lacks `workflow` scope to push that path directly). Cron **skips commit** when only timestamps would change / content is identical after stripping `retrieved_at`. |

### 2024 results

Commons Library [CBP-10009](https://commonslibrary.parliament.uk/research-briefings/cbp-10009/) join is **deferred** (source fetch blocked by Cloudflare from this environment). Popup notes follow-up; no invented winners.

### Postcode → seat

Uses [postcodes.io](https://postcodes.io/) `parliamentary_constituency_2024` + ONS code — clean join, no client-side point-in-polygon required.

