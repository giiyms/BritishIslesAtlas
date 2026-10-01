# British Isles Atlas

A British Isles mega-map website covering Great Britain, Ireland, and the surrounding islands.

The site centers on an ultra-fast interactive map hero. Data layers are combinable and controlled with toggles, so the map can show one layer or many at once.

## Run

Requires Node.js 20+ and [pnpm](https://pnpm.io/).

```bash
pnpm install
pnpm dev
```

Open http://localhost:5173.

```bash
pnpm build
pnpm preview
```

## v0 map

- Full-bleed [MapLibre GL JS](https://maplibre.org/) map, framed on the British Isles
- Cool gray altitude basemap: Esri World Hillshade, lightened, with flat water from [OpenFreeMap](https://openfreemap.org/) / OpenMapTiles
- Multi-select layer chips. Roads, schools, churches, mosques, other religious sites, pubs, post offices, population, and census ship with preview geometry. **Petrol stations, EV charging, power plants, hospitals, fire stations, police, castles, libraries, universities, museums, railway stations, aerodromes, ferry terminals, and marinas are real OpenStreetMap layers** (static GeoJSON, off by default). Cemeteries, immigration, crime, health, weather, wind turbines, nuclear, historic, legends, and mountains remain upcoming stubs
- Fixed-width scale track in round kilometres or metres. The fill tracks the current view; the label only uses nice round distances. Zoom level is not printed on the map
- Place search over the bundled gazetteer, with postcodes.io for UK postcodes and rate-limited OpenStreetMap Nominatim for smaller places

Dense point preview layers cluster at low zoom and reveal individual points as you zoom in. The population glow remains visible independently of its chip. Water shares the OpenFreeMap vector source, so its overzoom follows the provider tile metadata. Mobile attribution is always visible; panel, search, scale, and controls share glass styling tokens.

Petrol stations, EV charging, power plants, hospitals, fire stations, police, castles, libraries, universities, museums, railway stations, aerodromes, ferry terminals, and marinas load once from static OpenStreetMap GeoJSON under `public/data/` (ODbL 1.0; see `SOURCES.md`). Other feature geometry in this version is still preview data for the scaffold, not a live survey.

## Planned stack

- MapLibre for the interactive map
- PMTiles, or an equivalent vector-tile format, for fast tile delivery

## UI direction

Concept 1 is locked:

- Monotone gray altitude and hillshade basemap
- Distinct saturated accent colors for feature layers: roads, schools, churches, mosques, other religious sites, pubs, hospitals, post offices, population, and census
- Light theme and clean cartography
- Continuous scales, clustering, and density, with no fragmented zoom-number labels

## Credits

Hillshade tiles © Esri, USGS, NOAA. Water polygons © OpenStreetMap contributors, rendered via OpenMapTiles and OpenFreeMap. Petrol, EV, power, hospitals, fire stations, police, castles, libraries, universities, museums, railway stations, aerodromes, ferry terminals, and marinas layers © OpenStreetMap contributors (ODbL 1.0); see `SOURCES.md`. Search may query Nominatim and postcodes.io.
