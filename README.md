# British Isles Atlas

An interactive atlas of Great Britain, Ireland and the surrounding islands. Pick one **surface** (a choropleth, hexbin or distance map), up to five **point layers**, and a **basemap**. A separate **Election** mode maps the 632 GB Westminster seats.

## Run

Requires Node.js 20+ and [pnpm](https://pnpm.io/).

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm test         # vitest
pnpm build && pnpm preview
```

The map state lives in the URL hash (e.g. `#s=seat:pharmacies&p=hospitals,castles&b=light`), so every view is shareable.

## What's on the map

**Atlas mode**

| Role | Choices |
|---|---|
| Surface (pick one) | **Count per seat**: any layer, per 2024 seat. Seats were drawn to an electorate quota of 69,724–77,062, so this is roughly a per-73k-voters rate. **Hex density**: equal-area 7 km hexes (127 km²). **Distance to nearest**: hospitals, pharmacies, railway stations, EV chargers, post offices or dentists (straight line, not travel time). |
| Points (up to 5) | 49 OpenStreetMap layers in six groups (transport, health, culture, leisure, faith & community, services). Clustered to z10, individual icons from z11, live "in view" counts. |
| Basemap | Relief (grey hillshade), Light, Dark, Mono; toggles for main roads and place names. |

Every surface's legend is generated from the same `Classes` object that writes its MapLibre `step` expression (`src/classify.ts`), and the class breaks and palettes live in `src/surfaces.json`, which the tile build reads too. The legend can't drift from the map.

**Election mode**: projected winner (Electoral Calculus, More in Common fallback) drawn as value-by-alpha, where faded means marginal. Also Reform UK projected vote share, and **Our pick**, the editorial Reform / Restore Britain endorsement. Every view can be shown as a geographic map or an equal-area hex cartogram (one hexagon per seat). Search a postcode to open your seat.

### Our pick (editorial)

Our pick never endorses Labour or the Conservatives. Daniel's per-seat overrides win first. If any trusted seat poll (Electoral Calculus or More in Common) has Restore strictly ahead of Reform, the seat is **Restore**; otherwise Reform is the anti-split default. See `src/endorse.ts` and `SOURCES.md`.

## Data pipeline

```
scripts/osm_extract.py   OSM Overpass → data/osm/<layer>.geojson          (raw, not served)
scripts/build_tiles.py   data/ → public/tiles/*.pmtiles, distance-*.png,
                         public/data/seat-stats.json, seat-index.json      (served)
```

```bash
python3 scripts/osm_extract.py pharmacies     # or --all / --list
brew install tippecanoe                       # once
python3 scripts/build_tiles.py                # or --only points|seats|seatdata|hex|distance
```

Point layers are served as one PMTiles archive per layer and loaded only when switched on. MapLibre reads them with HTTP range requests, so no tile server is needed. Voting data refreshes daily via `scripts/refresh_voting_data.py`. See `scripts/README.md`.

`docs/map-style-lab.html` is the standalone design study behind v2 (heatmap pitfalls, surfaces, basemaps).

## Not shipped yet

Pubs, schools, population density and census layers were sample geometry and have been removed until real extracts exist. Northern Ireland seats are not in the ONS GB boundary file.

## Credits

Hillshade © Esri, USGS, NOAA. Basemap, roads and place names © OpenStreetMap contributors via OpenMapTiles / OpenFreeMap. Points of interest © OpenStreetMap contributors (ODbL 1.0). Constituencies: contains OS data © Crown copyright and database right 2024; contains National Statistics data © Crown copyright and database right 2024 (OGL v3.0). Hex layout © Open Innovations (MIT). Full detail in `SOURCES.md`.
