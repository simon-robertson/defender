# Arc Spire model family

Created on 18 October 2026 from the user-accepted [Moss & Porcelain concept](concepts/arc-spire-moss-porcelain-v1.png). The user approved modelling all three variants and making their red identity highlights emit light like the gun turret. **The user approved the completed models on 18 October and authorised continuing with the second test levels and selection controls.** Electrical attacks, targeting, damage, ranges, animation and electrical effects are not implemented or assigned by this modelling work.

## Source and authoring

- [Editable model](../assets/models/arc-spire.json), ID `arc-spire`, role `defence`, model schema version 3.
- [Generator](../scripts/arc-spire.js), exporting `arcSpireModel()`.
- [Focused structural and material checks](../tests/arc-spire.test.js).

`bun scripts/arc-spire.js` creates the source only if missing. `bun scripts/arc-spire.js --write` explicitly regenerates it; inspect and preserve any manual edits first. `bun scripts/compile.js assets/models/arc-spire.json` compiles only this model to the ignored derived mesh. There are no external dependencies or runtime generator calls.

The authoring canvas is **24 × 54 × 24 units**. All three variants use a single fixed rigid part named `body`, with root pivot `[12,0,12]`. Every occupied cell uses integer world coordinates. Solid unions yield one cell per location, so the mesher removes all internal faces and merges compatible exposed faces. No separate floating crown, coplanar decorative overlays, rotating mechanism or animation rig has been introduced.

## Concept translation

The common stone mounting pad occupies X/Z `[1,23)`, a **22 × 22-unit** footprint. A compact stepped porcelain pedestal carries a six-unit-wide dark forest mast. Broad 12 × 12 porcelain insulators alternate with three-unit-high exposed core intervals. The base, first upgrade and second upgrade have **three, five and seven insulator tiers** respectively.

The discharge crown is an open square, 18 × 18 units in the first two variants and 20 × 20 in the final upgrade. Four dark terminal blocks remain distinct above it. A recessed forest crossbeam below the crown joins the mast to both sides of the rim, preserving a clear opening from above without unsupported geometry. Pale terminal insets are nonemissive. The concept's illustrated arcs are not part of the model.

Four broad stepped moss braces translate the concept's tapered supports into axis-aligned cells. Upgrade 1 adds low side housings and restrained geometric recesses; upgrade 2 adds taller housings, thicker crown layers and two additional narrow identity panels. The mounting-pad geometry is shared across variants; top-face shading naturally differs where larger housings cover the pad. Extra height carries the progression while all geometry stays within the same placement box horizontally.

| Variant | Height | Occupied cells | Compiled quads | Exposed unit faces | Mesh vertex/index bytes | Light panels |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Base | 32 | 4,212 | 354 | 3,650 | 70,800 | 1 |
| Upgrade 1 | 42 | 5,476 | 449 | 4,522 | 89,800 | 1 |
| Upgrade 2 | 54 | 7,308 | 430 | 5,718 | 86,000 | 3 |

All three total **1,233 quads / 2,466 triangles**, with 246,600 bytes of vertex/index data before runtime instance data. These are measured asset counts, not performance budgets. Upgrade 2's larger, more continuous housings merge into fewer quads than Upgrade 1's separated smaller details. One fixed part keeps the model's draw grouping simple without inventing articulation.

## Materials and identity lights

The 17 slots retain the existing turret's palette roles: porcelain, forest mechanisms, moss, stone and vermilion, followed by their highlight/shade roles and a deep mechanism recess. Zone palette mapping may therefore recolour this family consistently with the turret; there is no explicit `colorMode` override. The source uses the accepted Moss & Porcelain colours, with primary red `#D65D45`.

Every material has **reflectiveness 0**. Only identity slots **4, 14 and 15** have **emission 1** and **`castsLight: true`**. Visible panels use only slot 4, as coherent front-facing surface overrides on actual solid geometry. The unused highlight/shade slots retain the same identity-light contract for later edits. No armour, insulator, crown or terminal light is enabled.

The base and first upgrade each expose one eight-unit-area red panel. Upgrade 2 exposes that same front panel plus two five-unit-area side-housing strips, for 18 square units in total. Each panel compiles to one exposed light quad and one connected emitter cluster. Comparing all three variants together produces **five local-light clusters, with zero overflow** against the existing 16-light capacity; this is verified across A–D palettes. Existing light and bloom rendering belongs to the integration review, not a new effect added by the model generator.

## Verification and accepted review

Artist ran `bun test tests/arc-spire.test.js`: **4 tests pass, 2,075 assertions**. The checks cover schema validation, single connected solids, footprint/common-pad geometry, exact height and tier progression, genuinely open crowns, four separate upper terminals, generator/source agreement, greedy mesh reduction, exact exposed red-light area, all 17 zone colour roles, unchanged shared geometry, matte surfaces and bounded local-light clustering.

The lead compiled `build/models/arc-spire.mesh.json` using `bun scripts/compile.js assets/models/arc-spire.json` and verified create-missing seeding preserves the authored source. The four existing model-light tests and the existing zone-palette test also pass: **nine affected tests in total**, with no full suite.

The [isolated model review](http://127.0.0.1:4173/tools/arc-spire-review.html) fetches only the Arc Spire source and uses the existing production renderer, a neutral matte floor, day/night lighting and A–D palette selection. It supports all three models at common scale or individual inspection, orbit/pan/zoom and reset. Only the active palette's meshes are retained, and its shared frame loop stops at rest. This is an in-memory authoring view, not a saved game level. No engine or shader code was changed.

Built-in Chrome verified all three variants, all four palettes, day/night, orbit/reset, five combined lights (one/one/three individually), zero light overflow and consistent GPU buffer disposal on selection changes. All-three view uses 12 scene buffers and four draw groups, including the floor. No captured console/WebGPU warnings or errors occurred. [Browser evidence](arc-spire-browser-review.json). Existing saved levels and the accepted turret, dog, Walker and Spider source files retain their pre-task SHA-256 hashes.

Artist reviewed the lead's actual [day comparison](screenshots/arc-spire-models-day.jpg) and [night comparison](screenshots/arc-spire-models-night.jpg). All three retain the concept's open square crown, four terminals, separated porcelain tiers and increasing vertical proportions. Red identity panels cast restrained colour onto the lower housings and review floor, with crisp nonemissive armour and no glow on the crown. There are no blocking visual issues in these captures. The lead reports five active panel lights, zero overflow and no browser warnings/errors during the production-renderer review.

The user approved these production models after this review. The [paired test-level follow-up](arc-spire-levels.md) is authorised; the subsequent combat follow-up is implemented separately from model geometry; see [combat notes](combat.md).

## Future token cost

The user's later 18 October follow-up calls this defence the **Zapper** and assigns **2 tokens to purchase and 2 per upgrade step**. Its stable model/source ID remains arc-spire. Shared family-level DEFENCE_COSTS stores the prices separately from geometry and attack stats; electrical range, strength and firing rules are now recorded in [combat notes](combat.md).
