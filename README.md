# Interstate — a Google-Maps-style highway explorer

An interactive map of the U.S. Interstate system built with **React 19**, **Leaflet**, and
[OpenInterstate](https://openinterstate.org/) exit and place data. Standard OpenStreetMap tiles are
the default basemap, with CARTO Voyager available as an optional style when configured.

![stack](https://img.shields.io/badge/React-19-blue) ![stack](https://img.shields.io/badge/Leaflet-1.9-blue)

## What it does

| Feature | Notes |
| --- | --- |
| **Interstate network** | 643 corridors drawn as cased blue lines over an OSM basemap, with exit and place points rendered on a canvas overlay so 38k exits stay smooth. |
| **Search** | Type `I-95 exit 123`, `Buc-ee's`, `Exit 4A`, or any place name. Exits and places come from the local OpenInterstate snapshot; everything else falls through to Photon (OSM) geocoding. |
| **Exit card** | Services at the exit (gas, food, lodging, EV charging, rest area, park, dog park, travel center), nearby exits with distances, and one-tap directions. |
| **Directions** | OSRM routing with drive / walk / bike profiles, turn-by-turn steps, a **Exits along route** tab, and GPX export. Includes a bundled Miami → Manhattan demo route so the panel works fully offline. |
| **Exit guide** | Corridor picker plus northbound/southbound scrubbing of upcoming exits with per-exit service chips — the "read the road ahead" view. |
| **Layers** | OpenStreetMap / CARTO Voyager / Satellite / Terrain basemaps, corridor, exit, place, rest-area and notable-place toggles, and a place-type filter. |
| **Typography** | Switch between locally bundled Google Fonts (Inter, Manrope, Roboto Flex), or upload a custom WOFF2/WOFF/TTF/OTF font saved in this browser. |
| **Deep links** | `?exit=<id>`, `?place=<id>`, and `?lat/&lon/&zoom` URL parameters restore the exact view. |
| **Saved & recent** | Star exits and places; recent searches persist in `localStorage`. |

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production bundle into dist/
npm run preview    # serve the production build
```

Node 20+ is recommended. Everything runs client-side — there is no backend.

To enable CARTO Voyager, set `VITE_CARTO_API_KEY` in `.env.local` (see `.env.example`). The app
builds the CARTO tile URL automatically and adds it to the map-style selector; OpenStreetMap stays
the default. The key is included in browser requests, so restrict its allowed origins in the CARTO
dashboard. Add the same variable to your deployment's build-time environment (for example,
Vercel) to enable CARTO there.

## Data

The app ships a prebuilt snapshot in `public/data/`:

| File | Contents |
| --- | --- |
| `interstates.eax` | Binary `EAX1` bundle: exits, places, and exit↔place links (12 MB). |
| `corridors.eac` | Binary `EAC1` bundle: corridor geometry (2.3 MB). |
| `restareas.json` | 1,338 rest areas with truck-parking counts (FHWA, public domain). |
| `stations.json` | 19,679 fuel/charging stations keyed by OSM node id. |
| `discover.json` | 1,620 notable places (CC0). |
| `demo-route.json` | Sample Miami → Manhattan route used when OSRM is unreachable. |

The binary parsers live in `src/data/parser.ts`; spatial indexing and search in `src/data/index.ts`.

## Attribution

- **Map data** © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the Open Database License (ODbL).
- **Exit & place data** © [OpenInterstate](https://openinterstate.org/).
- **CARTO Voyager tiles** © [CARTO](https://carto.com/attributions) and [OpenStreetMap contributors](https://www.openstreetmap.org/copyright). Satellite imagery © Esri; terrain tiles © OpenTopoMap.
- **Routing** © OSRM, © OpenStreetMap contributors.
- **Rest-area truck counts** — FHWA, public domain.

## Project layout

```
src/
  App.tsx              root orchestrator: loading, search, panels, routing, share state
  data/                binary parsers, spatial index, search
  lib/                 geo helpers, routing client, corridor logic, shared types
  components/          MapView, SearchBar, SearchResults, ExitCard, PlaceCard,
                       LocationCard, DirectionsPanel, MapControls, FontPicker, DriveMode, overlays
  styles/global.css    design tokens + map, marker, drive-mode and responsive styles
```

## License

Code in this repository is released under the MIT license. Data retains the licenses listed
above.
