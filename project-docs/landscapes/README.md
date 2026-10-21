# Landscape-first baselines

These sixteen scenery-only sources precede tactical carving. They contain no route, enemies, defences or reserved placement ground. Every dry box is populated. They use existing approved scenery and zone lighting/palettes, with weather off. Their working names describe places, not campaign difficulty or mechanics.

Import `landscapeFor(zone, number)` and `LANDSCAPE_INFO` from [the authoring API](../../scripts/landscapes/index.js). The factory returns independent plain level data; metadata is keyed by the eventual level ID (`moss-01`, etc.) and records the snapshot hash, landmarks and three supported bird perch anchors. Perch `point` values are in the scenery model's local authoring coordinates. Preserve stable placement IDs in removal manifests. Candidate wildlife ground points are evidence of available baseline habitat, not reserved clearings or final spawn choices.

| Zone | Level 1 | Level 2 | Level 3 | Level 4 |
| --- | --- | --- | --- | --- |
| A | Limestone Orchard, 16×14 | The Broadwater Garden, 18×16 | Cypress Rise, 20×16 | The Old Garden Mere, 18×16 |
| B | Sunworn Cistern, 16×14 | Broken Aqueduct, 18×16 | Three Mesas, 20×16 | Petrol Basin, 18×18 |
| C | Slate Tarn, 16×14 | The Meltwater Bend, 18×16 | White Ridge, 20×16 | Shattered Sanctuary, 18×18 |
| D | Mauve Orchard, 16×14 | Fallen Arches, 18×16 | Lantern Mere, 20×16 | Crown Gardens, 18×18 |

Each factory has explicit landforms, landmark clusters and grove shapes. Deterministic variation populates those shapes; the four levels within each zone have different terrain hashes. Detailed compositions, model inventories, hashes and verification are in the matching `a`–`d` metadata/validation JSON files. Together the revised baselines contain 4,112 scenery placements, 504 water boxes and 48 supported perch choices. Each has 184–273 dry Y24 boxes in one or more components and 683–1,528 clear small-animal ground samples.

The user requested more varied water after reviewing the first batch. The current landscapes range from the dry A1 orchard and B1's single residual cistern to the substantial A2/B4/D3 lakes. B2/C2/D4 have rivers reaching opposite boundaries; A3/C3/D2 have narrower winding streams. Other ponds and tarns differ in outline, size and setting. Water surfaces range from Y12 to Y22, with coherent shallower shoreline beds and deeper interiors where appropriate. Streams may divide the dry land; component sizes are reported, without a connectivity or percentage quota. Current tactical carving uses dry supported ground; possible future bridge crossings remain separate design work.

The superseded initial snapshots, metadata and factory sources are preserved in [the initial-landscapes archive](../level-rebuild-2026-10-18/initial-landscapes/). The accepted original A4 is the deliberate unchanged counterpoint to the larger water forms.

A4 is byte-identical to the [accepted frozen precursor](../zone-a-four-landscape.json), SHA-256 `6a2a373612c98805bc0ebb2609f835ff0f6fb6c33fc30baf3b5a1815d1aaeab9`. That original file remains unchanged.

Run `bun scripts/landscapes/build.js A --check` (substitute B/C/D) to check saved snapshots against their fresh factories and actual source cells. Checks cover overlaps, bounds, dry support, water/terrain intersection, dry-component reporting, supported bird soles and clear bird/ground-animal envelopes. Models load once per batch; no new meshes or runtime checks are generated. Running without `--check` creates missing snapshots; replacement requires explicit `--write`.

Tactician and Lead own final routes, supported defence sites and documented scenery removals. After carving, all placement areas, including generator ground, require a separate complete-ground visibility audit from the normal overview, as well as movement and combat checks. Run `bun scripts/verify-level-rebuild-visibility.js A --write` (substitute B/C/D) against stable final sources; it compares fresh factories, frozen snapshots and saved carves before recording the independent visibility result. Baseline validation does not certify those later decisions. Lead owns production-renderer review and the shared design-doc/brief/diary updates; these authoring checks alone do not establish user approval of final layouts.
