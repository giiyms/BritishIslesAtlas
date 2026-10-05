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
- Multi-select layer chips. Roads, schools, churches, mosques, other religious sites, pubs, population, and census ship with preview geometry. **Petrol stations, EV charging, power plants, hospitals, fire stations, police, castles, libraries, universities, museums, railway stations, aerodromes, ferry terminals, marinas, zoos, theatres, battlefields, cinemas, stadiums, theme parks, viewpoints, arts centres, aquariums, piers, ruins, golf courses, galleries, marketplaces, nature reserves, camp sites, memorials, sports centres, caravan sites, fitness centres, community centres, playgrounds, beaches, swimming pools, pharmacies, town halls, places of worship, lighthouses, courthouses, nightclubs, windmills, prisons, clinics, dentists, and post offices are real OpenStreetMap layers** (static GeoJSON, off by default). **Constituencies** is a real ONS July 2024 GB Westminster polygon layer (BGC, OGL v3; off by default). Cemeteries, immigration, crime, health, weather, wind turbines, nuclear, historic, legends, and mountains remain upcoming stubs
- Fixed-width scale track in round kilometres or metres. The fill tracks the current view; the label only uses nice round distances. Zoom level is not printed on the map
- Place search over the bundled gazetteer, with postcodes.io for UK postcodes and rate-limited OpenStreetMap Nominatim for smaller places

Dense point preview layers cluster at low zoom and reveal individual points as you zoom in. The population glow remains visible independently of its chip. Water shares the OpenFreeMap vector source, so its overzoom follows the provider tile metadata. Mobile attribution is always visible; panel, search, scale, and controls share glass styling tokens.

Petrol stations, EV charging, power plants, hospitals, fire stations, police, castles, libraries, universities, museums, railway stations, aerodromes, ferry terminals, marinas, zoos, theatres, battlefields, cinemas, stadiums, theme parks, viewpoints, arts centres, aquariums, piers, ruins, golf courses, galleries, marketplaces, nature reserves, camp sites, memorials, sports centres, caravan sites, fitness centres, community centres, playgrounds, beaches, swimming pools, pharmacies, town halls, places of worship, lighthouses, courthouses, nightclubs, windmills, prisons, clinics, dentists, and post offices load once from static OpenStreetMap GeoJSON under `public/data/` (ODbL 1.0; see `SOURCES.md`). Constituencies load from static ONS BGC GeoJSON (`constituencies-gb-2024.geojson`, OGL v3; GB-only 632 seats). Other feature geometry in this version is still preview data for the scaffold, not a live survey.

## Planned stack

- MapLibre for the interactive map
- PMTiles, or an equivalent vector-tile format, for fast tile delivery

## UI direction

Concept 1 is locked:

- Monotone gray altitude and hillshade basemap
- Distinct saturated accent colors for feature layers: roads, schools, churches, mosques, other religious sites, pubs, hospitals, post offices, population, and census
- Light theme and clean cartography
- Continuous scales, clustering, and density, with no fragmented zoom-number labels


## Voting (editorial)

GB Westminster seats can show an editorial **Reform / Restore Britain** endorsement layer (never Labour or Conservatives). Daniel per-seat overrides win first. If any trusted seat poll (Electoral Calculus or More in Common) has Restore's share strictly ahead of Reform's, the map picks **Restore** even when Democracy Club has no confirmed Restore candidate; otherwise Reform is the anti-split default. See `SOURCES.md` (Voting P1) and `src/endorse.ts`.

## Credits

Hillshade tiles © Esri, USGS, NOAA. Water polygons © OpenStreetMap contributors, rendered via OpenMapTiles and OpenFreeMap. Petrol, EV, power, hospitals, fire stations, police, castles, libraries, universities, museums, railway stations, aerodromes, ferry terminals, marinas, zoos, theatres, battlefields, cinemas, stadiums, theme parks, viewpoints, arts centres, aquariums, piers, ruins, golf courses, galleries, marketplaces, nature reserves, camp sites, memorials, sports centres, caravan sites, fitness centres, community centres, playgrounds, beaches, swimming pools, pharmacies, town halls, places of worship, lighthouses, courthouses, nightclubs, windmills, prisons, clinics, dentists, and post offices layers © OpenStreetMap contributors (ODbL 1.0); see `SOURCES.md`. Constituencies: Contains Ordnance Survey data © Crown copyright and database right 2024; Contains National Statistics data © Crown copyright and database right 2024 (OGL v3.0). Search may query Nominatim and postcodes.io.
