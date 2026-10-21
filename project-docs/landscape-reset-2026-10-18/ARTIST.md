# Fixed-footprint landscape authoring

The active sixteen previews are populated landscapes with no paths, enemies, player defences or reserved tactical clearings. All use the user-locked **20 × 16 placement boxes / 480 × 384 world units**, matching Zone D level 3. Weather defaults off. These are current landscape compositions for review; no future path carve is approved by this source set.

Authoritative API: `fixedLandscapeFor(zone, number)` and `fixedLandscapeInfo(zone, number)` in `scripts/fixed-landscapes.js`. The new configuration layer reuses the existing matte scenery and historical landscape core without changing the historical configs or frozen sources. Each call returns independently owned deterministic level data.

Reproduce all active sources, snapshots and per-zone metadata/validation:

```sh
bun scripts/fixed-landscapes/build.js --write
```

Check canonical active sources and snapshots against actual scenery geometry:

```sh
bun scripts/fixed-landscapes/build.js --check
```

An optional `A`, `B`, `C` or `D` selects one zone; `ALL` or no zone selects all. No flag seeds missing files and refuses to replace a different existing source. `--write` explicitly replaces generated sources and reports. `--check` writes nothing.

The four existing level-3 compositions already match the locked footprint: their complete terrain and placement arrays remain identical. A4 preserves every original placement and terrain record within its historical 18 × 16 area; the added eastern two columns extend the cypress and southeast oak planting. The first landscapes gain coherent outer groves and low understory. The 18 × 16 second landscapes extend their outer planting, with C2's western/eastern river extended to the new eastern edge. The fourth B/C/D landscapes adapt their masses to the new aspect ratio: B keeps its substantial western oasis and moves its eastern mesa group; C moves the full glacial basin one box north/east and relocates its eastern fir mass; D retains an edge-to-edge river while its eastern groves use the extra width. No individual model is stretched.

| Zone | Scenery placements, levels 1–4 | Water boxes, levels 1–4 |
| --- | --- | --- |
| A | 320, 258, 301, 324 | 0, 62, 19, 24 |
| B | 319, 281, 310, 240 | 1, 39, 10, 80 |
| C | 300, 275, 298, 274 | 20, 45, 22, 46 |
| D | 308, 305, 249, 282 | 12, 15, 71, 38 |

Validation checks each actual source voxel for placement overlap, bounds, terrain and water intersections; rejects non-scenery, wildlife placements and reflective/emissive scenery materials; compiles each source through `buildWorld`; and records deterministic hashes, population, terrain components and geometry counts. Every dry box is populated. Ground connectivity is reported without imposing a gameplay route requirement on these uncarved landscapes.

Cosmetic wildlife uses existing available space. Each source embeds three exact `previewWildlife.habitatPoints` with a clear radius of six units and eleven-unit height on flat dry Y24 terrain, plus their containing `habitats` boxes. Three perch records reference actual scenery placement IDs and supported local model points, each with a clear radius of six units and eight-unit height. No scenery was cleared for wildlife. Runtime behavior is separately verified by Engineer and Lead.

Historical `scripts/landscapes`, `docs/landscapes` and the original frozen A4 source remain unchanged for previous proofs. The preceding carved previews and hashes are archived alongside this document under `previous-levels/` and `previous-level-hashes.json`. Historical route, coverage and placement-visibility results describe those archived previews, not these current landscapes. No full test suite or browser session was run by Artist; Lead owns visual review and final runtime integration.
