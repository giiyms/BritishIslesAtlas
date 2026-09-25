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
- Multi-select layer chips. Roads, schools, churches, mosques, other religious sites, pubs, hospitals, post offices, population, and census ship with preview geometry. Petrol stations, EV charging, cemeteries, immigration, crime, health, weather, power, wind turbines, nuclear, castles, historic, legends, and mountains are the same kind of stub, grouped as upcoming
- Continuous scale bar in round kilometres or metres. The bar width tracks the current view; the label only uses nice round distances. Zoom level is not printed on the map
- Place search over the bundled gazetteer, with OpenStreetMap Nominatim as a fallback for postcodes and smaller places

Feature geometry in this version is preview data for the scaffold, not a live survey.

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

Hillshade tiles © Esri, USGS, NOAA. Water polygons © OpenStreetMap contributors, rendered via OpenMapTiles and OpenFreeMap. Search may query Nominatim (© OpenStreetMap contributors).
