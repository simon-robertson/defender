# Engineer handoff: landscape runtime, 18 October 2026

Implemented against the current [design doc](../design-doc.md#current-landscape-composition). Assignment used `gpt-6.1-sol` with `high` effort for the bounded cross-module lifecycle change; no delegation.

## Runtime and ownership

The main game resolves `actorsForPreview(level)` only after fetching and validating the actual level source, before requesting models. `previewMode: "landscape"` selects zero enemies and zero missiles. Sources without that flag retain the historical combat behaviour. Landscape validation requires an empty primary path, no additional routes/actor assignments, scenery-only placements and scenery-only runtime actors. It does not impose the new footprint on historical fixtures.

The landscape frame branch advances cosmetic wildlife and renders. It skips enemy, defence, planner, damage, shot, Arc and plasma updates, with renderer shot/damage pools detached. Empty diagnostic controllers expose reliable zero states without projectile pools or target planners. F is unavailable, R performs no enemy work, and selection/lifecycle controls remain intact. The non-landscape branch preserves the preceding effects → damage → enemies → wildlife → firing order; this final ordering correction was parse checked.

`previewWildlife.habitatPoints` optionally records three exact world-space ground seeds alongside their existing habitat boxes. This preserves populated scenery without carving box-centre clearings. Metadata is copied, checked against its box and validated against flat dry ground; the existing controller chooses a safe node on its 4-unit navigation grid. Three supported local-space perch points retain the existing bird contract. Landscapes without authored wildlife metadata create no legacy fallback wildlife.

`loadWorld(id, {sourceLevel})` supports explicit historical review sources through the same validation, actor and model path. The supplied source ID must equal the requested ID; a routed source mislabeled as a landscape is rejected before model fetch. `tools/archived-preview-world.js` validates its ID and fetches only the explicit archived source under `previous-levels/`. Five existing combat review pages use it; the main game continues to fetch current `/api/levels/` sources.

No renderer, shader, pipeline or capacity changes. Tests measure six cosmetic actors per current scene, zero enemy/defence states, no missile flight pool/planner, exact scenery/cosmetic model requests and complete CPU world release before replacement fetch. Browser GPU resource evidence belongs to the lead's [main-scene review](browser-review.json) and [controls review](controls-review.json).

## Touched files

Runtime: `engine/world.js`; `shared/level.js`, `shared/enemy-roster.js`, `shared/preview-levels.js`; `game/app.js`, `game/enemy-preview.js`, `game/missile-preview.js`, `game/wildlife-preview.js`; new `game/preview-actors.js`.

Review tools: new `tools/archived-preview-world.js`; `tools/damage-review.js`, `tools/missile-review.js`, `tools/arc-effect-review.js`, `tools/enemy-impact-review.js`, `tools/power-link-review.js`. The two relative engine imports in damage/impact pages were corrected during final integration; all five were then inspected together.

New current-source coverage: `tests/landscape-preview-runtime.test.js`. Updated catalogue coverage: `tests/preview-levels.test.js`. The saved-source assertion in `tests/world.test.js` now compares current A1 with `fixedLandscapeFor('A', 1)`; its historical route/model assertions remain.

Archived combat source readers: `tests/level-rebuild-layouts.test.js`, `tests/level-rebuild-runtime.test.js`, `tests/enemy-expansion-preview.test.js`, `tests/enemy-expansion-combat.test.js`, `tests/renderer.test.js`, `tests/enhancer-integration.test.js`, `tests/animation-maintenance.test.js`, `tests/target-planner.test.js`, `tests/path-edges.test.js`, `tests/weather-preview.test.js`, `tests/arc-spire-levels.test.js`, `tests/missile-launcher-levels.test.js`, `tests/zones.test.js`, `tests/zone-a-four-layout.test.js`, `tests/zone-a-four-runtime.test.js`, `tests/plasma-anchors.test.js`, `tests/zone-enemies.test.js`, `tests/arc-spire-runtime.test.js`; measurement helpers `tests/helpers/world-maintenance-probe.js`, `tests/helpers/animation-maintenance-probe.js`. Existing combat assertions were retained; mocked loaders distinguish archived levels from current model sources. Relevant wildlife consumers use loaded authored seeds.

## Focused verification

No full suite was run. Exact successful commands:

```sh
bun test tests/landscape-preview-runtime.test.js tests/preview-levels.test.js tests/scene-loader.test.js
```

17 pass, 0 fail; 10,345 assertions; 4.98 seconds. Covers all sixteen actual 20×16 sources, exact model requests, six real wildlife actors, supported bird soles, ground/scenery clearance, bounded navigation over eight simulated seconds per scene, zero combat ownership, safe reset, F no-op, source immutability and disposal before replacement loading. Also covers guarded archived source injection and malformed mode/seed inputs.

```sh
bun test --timeout 20000 tests/world.test.js tests/enemy-expansion-preview.test.js tests/enhancer-integration.test.js tests/renderer.test.js tests/animation-maintenance.test.js tests/preview-levels.test.js
```

50 pass, 0 fail; 2,216,873 assertions; 13.66 seconds. Representative retained combat, effects/resource ownership, motion, generator, rendering and source checks.

```sh
bun test tests/zone-enemies.test.js tests/arc-spire-runtime.test.js
```

6 pass, 0 fail; 130,730 assertions; 3.81 seconds. Archived source loading preserves enemies, cosmetic movement, combat and teardown.

```sh
bun build game/app.js tools/damage-review.js tools/enemy-impact-review.js tools/missile-review.js tools/arc-effect-review.js tools/power-link-review.js tools/archived-preview-world.js --external '*' --outdir /tmp/defender-landscape-parse
```

Seven entry points parse successfully after the final loop-order and review-import corrections. This is a syntax check; external imports are inspected separately and browser checks belong to the lead.

All sixteen archived source byte hashes were compared with `docs/level-rebuild-2026-10-18/<id>.manifest.json` using the existing `sourceHash` helper; all match `manifest.source.sha256` exactly. This proves the source-read migration retains the prior completed combat fixtures. The remaining archive readers received source-location substitutions, not a full rerun of historical audits.

## Inherited test corrections and limits

The renderer eye-lifecycle test retained a pre-Monowheel-removal expectation of four expansion sensors in D. It now expects the two Lantern sensors, while A/B retain four. Enemy eye, death/reset, light packing, resource and maximum-capacity assertions remain intact. The representative renderer run above passes with the corrected current roster.

The existing twelve-scene complete-flyer sweep exceeded Bun's default five-second timeout (measured 5.2–5.6 seconds) without a correctness failure. It now has an explicit 20-second timeout; every pose/clearance assertion remains. The final focused run passes.

No browser tab was opened by Engineer, to avoid competing with the lead's sixteen-scene and control verification. No performance/FPS claim is inferred from CPU test durations. Approved combat models and effects remain available for future routed levels and explicit archived review scenes.
