# Zone A level 4 — landscape-first precursor

18 October 2026. The user authorised an experiment in which Artist builds the landscape before Tactician chooses and carves the route and defence spaces. This is the **frozen pre-carving authoring snapshot**, not a playable level or an approved final tactical layout. Lead accepted its production-renderer overview for the tactical handoff; user review of the finished experiment remains separate.

![Uncarved Moss and Porcelain landscape, with no path or reserved defence clearings](screenshots/zone-a-four-landscape-before.jpg)

[Snapshot](zone-a-four-landscape.json) · [deterministic factory](../scripts/zone-a-four-landscape.js) · [before/after viewer](http://127.0.0.1:4173/tools/landscape-review.html)

The 18×16-box landscape measures 432×384 world units. An irregular enclosed mere occupies the northeast, a wooded ridge anchors the west, and a smaller raised grove sits in the southeast. Two unequal limestone ruin groups sit among vegetation, with the larger group beside the lake. Eight overlapping, unequal grove regions create mixed canopy masses; younger trees, shrubs, fractured low rock, flowers and offset grass clusters soften their borders. The factory imports no existing route, tower positions, coverage calculations or reserved-ground data.

Every dry box contains scenery or groundcover. Population is **292 placements from 12 existing approved models**: 99 trees/columns, 50 rocks, 29 shrubs, seven ruin pieces and 107 small groundcover clusters. Weather is off. Lighting, water settings, geometry and material palettes reuse Zone A's existing production assets. No model, enemy, defence, effect or engine feature was added.

Terrain is deliberately carveable without an authored corridor: **243 boxes are dry at Y24**, in one connected terrain component; 21 local mound boxes rise to Y28/30/32. The 24 lake boxes have beds at Y4/Y8 and water at Y12. Neither raised terrain nor water crosses the board. The snapshot has `path: []` and no defence placements or reserved clearing field. Scenery still occupies the flat ground; subsequent tactical work must actually remove it where required.

## Handoff contract

`zoneAFourLandscape()` returns a fresh plain `defender.level` version-4 object, ID `moss-04-landscape`, matching the saved JSON. `ZONE_A_FOUR_LANDSCAPE_INFO` exports dimensions, source location and three natural perch candidates. Clone the snapshot for the later `moss-04` level; preserve this baseline and its IDs for before/after comparisons.

Placement IDs are `a4-land-X-Z`, with `-understory` only for a second low cluster in the same box. Preserve the following trees when selecting wildlife perches:

| Placement ID | Existing model | Box |
| --- | --- | --- |
| `a4-land-1-2` | `scenery-oak-tall` | [1,0,2] |
| `a4-land-16-12` | `scenery-oak-tall` | [16,0,12] |
| `a4-land-3-14` | `scenery-oak` | [3,0,14] |

Tactician owns subsequent path/site selection and a removal manifest. No entry, exit, route, defence position or firing corridor is implied by this landscape. Lead owns final integration, browser comparison and the shared design-doc/brief/diary updates.

## Verification

`bun scripts/zone-a-four-landscape.js --check` reproduces the snapshot and validates it against all referenced **actual source cells** with `validateLevel`: unique placements, in-bounds geometry, no model-to-model overlap, dry support, no ground/water intersection, scenery-only roles, zero emission/reflectiveness, empty path and complete dry-box population. The fresh-factory independence check and a four-neighbour terrain flood-fill also pass; the latter finds one Y24 component containing all 243 flat dry boxes. This certifies terrain connectivity, not a tactical route through the still-present scenery.

Lead's production overview loads all 292 placements with zero path boxes and no browser errors. Artist reviewed the saved image and found no blocking composition issue. Existing sources/levels were not written or compiled. No runtime test suite was needed for this isolated authoring artifact.

Frozen JSON SHA-256: `6a2a373612c98805bc0ebb2609f835ff0f6fb6c33fc30baf3b5a1815d1aaeab9`.

The generator creates a missing snapshot only; `--write` is an explicit authoring overwrite and must not be used to revise this accepted baseline during tactical carving.
