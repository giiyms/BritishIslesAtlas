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
- Multi-select layer chips. Pubs include a national 3D density extrusion (hex bins) that fades to individual OSM points past ~z12. Roads, schools, churches, mosques, other religious sites, population, and census ship with preview geometry. **Petrol stations, EV charging, power plants, hospitals, fire stations, police, castles, libraries, universities, museums, railway stations, aerodromes, ferry terminals, marinas, zoos, theatres, battlefields, cinemas, stadiums, theme parks, viewpoints, arts centres, aquariums, piers, ruins, golf courses, galleries, marketplaces, nature reserves, camp sites, memorials, sports centres, caravan sites, fitness centres, community centres, playgrounds, beaches, swimming pools, pharmacies, town halls, places of worship, lighthouses, courthouses, nightclubs, windmills, prisons, clinics, dentists, pubs, and post offices are real OpenStreetMap layers** (static GeoJSON, off by default). **Constituencies** is a real ONS July 2024 GB Westminster polygon layer (BGC, OGL v3; off by default). Cemeteries, immigration, crime, health, weather, wind turbines, nuclear, historic, legends, and mountains remain upcoming stubs
- Fixed-width scale track in round kilometres or metres. The fill tracks the current view; the label only uses nice round distances. Zoom level is not printed on the map
- Place search over the bundled gazetteer, with postcodes.io for UK postcodes and rate-limited OpenStreetMap Nominatim for smaller places

Dense point preview layers cluster at low zoom and reveal individual points as you zoom in. The population glow remains visible independently of its chip. Water shares the OpenFreeMap vector source, so its overzoom follows the provider tile metadata. Mobile attribution is always visible; panel, search, scale, and controls share glass styling tokens.

Petrol stations, EV charging, power plants, hospitals, fire stations, police, castles, libraries, universities, museums, railway stations, aerodromes, ferry terminals, marinas, zoos, theatres, battlefields, cinemas, stadiums, theme parks, viewpoints, arts centres, aquariums, piers, ruins, golf courses, galleries, marketplaces, nature reserves, camp sites, memorials, sports centres, caravan sites, fitness centres, community centres, playgrounds, beaches, swimming pools, pharmacies, town halls, places of worship, lighthouses, courthouses, nightclubs, windmills, prisons, clinics, dentists, pubs, and post offices load once from static OpenStreetMap GeoJSON under `public/data/` (ODbL 1.0; see `SOURCES.md`). Constituencies load from static ONS BGC GeoJSON (`constituencies-gb-2024.geojson`, OGL v3; GB-only 632 seats). Other feature geometry in this version is still preview data for the scaffold, not a live survey.

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

The default map colouring is a transparent **tactical-voting pick: who to back to stop Labour** in each of the 632 GB seats. The picks reflect the site owner's tactical goal (Labour should not win seats). The voter decides. Other colourings: 2024 winner, 2024 majority, and the projected winner from each seat-projection provider.

Pick rule (`src/tactical.ts`, tested in `src/tactical.test.ts`). There is no default party, and Labour and Green are never picked (site-owner rule):

1. A site-owner override in `public/data/overrides.json` wins (`{ "pcon24cd", "party", "note", "at" }`).
2. Seat projections (`polls-seats.json`: Electoral Calculus, More in Common). Each provider's pick is its projected winner if that is not Labour; otherwise its highest-projected eligible (not Labour, not Green) party. Both agree → high confidence. One provider only → medium. They disagree → the party with the higher mean projected share, at low confidence. Confidence also drops to low when combined others outpoll the named challenger.
3. No projection → the 2024 result (`results-2024-gb.json`): the strongest eligible (not Labour, not Green) party. Medium confidence with a 10+ point lead over the next eligible (not Labour, not Green) party, otherwise low.

The seat panel shows the pick, its confidence and reason, each provider's projection (shares, plus win probabilities where published), the 2024 result, the confirmed candidate where known (Reform UK and Restore Britain only), fieldwork and retrieval dates, and source links. The side panel shows the latest national polls, the 7-poll average, seat counts per provider and pick counts. The table view is sortable, filterable by pick and confidence, and exports CSV. Election JSON is fetched only when the constituency layer or a seat is opened.

The earlier Reform/Restore endorsement engine (`src/endorse.ts`, `endorsements-gb.json`) is kept for reference but no longer drives the map.

## Credits

Hillshade tiles © Esri, USGS, NOAA. Water polygons © OpenStreetMap contributors, rendered via OpenMapTiles and OpenFreeMap. Petrol, EV, power, hospitals, fire stations, police, castles, libraries, universities, museums, railway stations, aerodromes, ferry terminals, marinas, zoos, theatres, battlefields, cinemas, stadiums, theme parks, viewpoints, arts centres, aquariums, piers, ruins, golf courses, galleries, marketplaces, nature reserves, camp sites, memorials, sports centres, caravan sites, fitness centres, community centres, playgrounds, beaches, swimming pools, pharmacies, town halls, places of worship, lighthouses, courthouses, nightclubs, windmills, prisons, clinics, dentists, pubs, and post offices layers © OpenStreetMap contributors (ODbL 1.0); see `SOURCES.md`. Constituencies: Contains Ordnance Survey data © Crown copyright and database right 2024; Contains National Statistics data © Crown copyright and database right 2024 (OGL v3.0). Search may query Nominatim and postcodes.io.
