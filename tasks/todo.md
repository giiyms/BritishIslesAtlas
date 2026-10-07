# Atlas v2 — surfaces, PMTiles, panel IA, election mode

Branch `atlas-v2-surfaces` (from `box-codex/voting-style-b-panel-mobile`). Source: style-lab roast 2026-10-06 (`docs/map-style-lab.html`).

## Decisions (captain's call)
- **Three roles:** one *surface* (exclusive), ≤5 *point* layers, one *basemap*. Voting moves to its own **Election** mode.
- **Legend = config:** `Classification {breaks, colors, unit, source}` builds both the MapLibre `step` expression and the legend DOM. Python reads the same `src/surfaces.json` for baked rasters.
- **PMTiles per layer** (`public/tiles/<id>.pmtiles`, tippecanoe clustering ≤ z10): only active layers fetch bytes. Raw GeoJSON moves to `data/` (not served).
- **Surfaces:** per-seat count (seats ≈ equal electorate → free normaliser), 7 km hexbin, distance-to-nearest raster (6 layers). Surfaces sit *under* the water layer so the sea clips them.
- **Election mode:** views = Projected winner (value-by-alpha by margin), Reform share, Our pick (existing editorial endorsement). Map | Hex toggle (odileeds/hexmaps 2023 layout, MIT; identical to the 2024 layout).
- **Sample/fake layers removed** (roads stubs, pubs, schools, churches, mosques, other-religious, population glow, census, upcoming stubs). Roads become real OpenMapTiles motorway/trunk. Population density = roadmap.
- **Basemaps:** Relief (current), Light, Dark, Mono.
- Scale bar → segmented ruler. Mobile panel → bottom sheet with 3 detents.

## Plan
- [x] Branch; move raw GeoJSON to `data/osm/`, seats to `data/`
- [x] (agent) Consolidate 49 extractor scripts → `scripts/osm_extract.py` + `osm_layers.py`, verified equivalent
- [x] `src/surfaces.json` + `src/classify.ts` (breaks → expression + legend) + tests
- [x] `scripts/build_tiles.py`: per-layer PMTiles, seats PMTiles, hex PMTiles, `seat-stats.json`, `seat-index.json`, distance PNGs
- [x] `pmtiles` protocol; map.ts rewrite: sources from PMTiles, surfaces, basemaps, real roads, live counts
- [x] Election mode: feature-state seat fills, 3 views, hex cartogram overlay, popups/search/restore still work
- [x] Panel rewrite: mode switch, surface radio + dataset, points (cap 5, counts), basemap, auto legend; mobile sheet
- [x] Scale ruler; remove fake layers from catalogue + geo.ts
- [x] Tests, typecheck, build; headless screenshots desktop + mobile, each mode
- [x] README dedupe + SOURCES; Obsidian record

## Review (2026-10-07)
- 4 commits on `atlas-v2-surfaces`; typecheck clean, 52 tests pass, `pnpm build` ok.
- Extractors: 24.8k → 2.3k lines, byte-identical on fixtures for all 49 layers (no network run).
- App data on first load: ~64 KB (default) / ~79 KB (4 layers + seat surface) vs ~42 MB GeoJSON before. Election mode adds the 0.9 MB endorsements bundle (lazy).
- Verified headless at 1440×900 and 390×844: every surface, election map + hex, pick view, dark/mono, London z12 icons, seat popup, 5-point cap, mode round-trip.
- Known gaps: distance is straight-line (no OSRM travel time); no population surface (needs ONS mid-year estimates); tiles committed (77 MB) rather than built in CI; continental place labels still show.
