# Flat slab verification

Verified on `theme/slab-on-main-finish` with a production Vite preview and headless
Chromium (1440 × 1000, device scale 1).

## Fixes

- MapLibre rejected both halo opacity expressions: zoom interpolation was nested
  separately inside each match arm. A single top-level interpolation now fades
  the four bands. The style-spec regression test validates all slab layers.
- Narrow navigation bounds forced a minimum zoom that overrode the padded home
  fit on wide screens. Navigation bounds now match the outside-mask extent,
  allowing the full islands to fit with the requested padding.
- The original voting test passed ten consecutive runs. Neither slab WIP commit
  changed voting logic or tests. Its 20 MB GeoJSON raw import took roughly
  5–6 seconds to transform/collect. Reading the same fixtures with Node's fs
  retains full coverage and reduces isolated runs to 0.4–0.6 seconds; five
  consecutive runs passed afterward. Voting rules are unchanged.
- Simplified only the halo bands, from 342,469 to 248,232 bytes (27.5% smaller).
  Detailed land and islet outlines are unchanged. Regeneration uses
  `python3 scripts/build_isles_mask.py /path/to/ne10.geojson`.

## Results

- `timeout 120s pnpm vitest run`: 7 files, 59 tests passed.
- `pnpm build`: passed (TypeScript and production bundle).
- `git diff --check`: passed.
- GB, London (zoom 11), Snowdonia (zoom 10): tiles loaded, pitch 0,
  no browser console errors. No application camera action sets pitch.
- Northern Shetland projects to y=84.9 px; search ends at y=64 px.
  The full home extent fits, including the Scillies.
- Visually checked the sea glow, southeast slab shadow, white islet outlines,
  cream continental land without continental labels, and mountain relief.
- No crop fields or automatic 3D tilt added.

## Screenshots

The requested `/workspace/atlas-shots/2026-10-14` directory is outside the writable
sandbox roots. Each requested save failed with `EROFS: read-only file system`.
The completed screenshots are available at:

- `/tmp/slab-main-gb.png`
- `/tmp/slab-main-london.png`
- `/tmp/slab-main-snowdonia.png`
- `/tmp/slab-main-vs-ref.png`

The comparison places GB alongside the existing
`/workspace/atlas-shots/2026-10-13/ref-1.png` without cropping either image.
