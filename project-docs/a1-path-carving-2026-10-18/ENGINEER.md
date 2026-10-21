# A1 path-layout runtime handoff

18 October 2026. Engineer assignment: `gpt-6.1-sol`, High effort, for bounded source-aware runtime/schema compatibility. Scope is only A1's path and useful defence clearings, with no placed defences, enemies or combat. The user subsequently selected and approved **Southern Hook** after viewing the layout options. The other fifteen production sources and the frozen pre-carving backup are outside this assignment.

## Runtime contract

- `previewMode: "layout"` requires a complete primary route of at least two boxes. Existing route validation still enforces ordered contiguous boxes, dry flat support and scenery clearance. Terrain, paving and path-camera geometry use the existing implementation.
- `previewMode: "landscape"` remains strictly path-free, with no additional routes or actor-route metadata.
- Both explicit modes require every static placement and runtime actor model to have the existing `scenery` role. A shared `isNonCombatPreview(level)` reads the loaded source, never catalogue IDs.
- Enemy and missile factories return no actors in either mode. Wildlife uses explicit authored seeds; absent seeds create no inherited historical wildlife. A1 retains the same cosmetic wildlife ownership and navigation.
- The game reuses the existing empty controllers and diagnostics. Noncombat frames advance only wildlife before rendering; weapon planning, enemy simulation, damage, smoke and weapon effects do no frame work. Enemy reset remains a no-op. Existing undefined-mode combat fixtures retain their update order and historical actor catalogues.
- A1's selector describes a **Path layout preview**, its label is **PATH LAYOUT**, and its valid route enables F/path camera. No enemy-reset instruction appears in either noncombat mode.

The user's later boundary rule (start/end at the level boundary, every intermediate box in the interior) belongs to the new A1 authoring factory and its checks. Generic route validation deliberately retains historical compatibility; this assignment does not retrofit archived fixtures.

## Files

`shared/preview-mode.js`, `shared/level.js`, `shared/enemy-roster.js`, `shared/preview-levels.js`; `game/app.js`, `game/preview-actors.js`, `game/missile-preview.js`, `game/wildlife-preview.js`; `engine/world.js`; affected tests in `landscape-preview-runtime.test.js`, `preview-levels.test.js` and `world.test.js`.

The world-source equality test now uses Lead's `currentPreviewFor('A',1)` contract. Frozen landscape builders and archived combat factories remain independent historical references.

## Verification

Initial focused validation passed 11 tests while the final A1 source was being authored. After Southern Hook landed, the complete affected check ran:

```sh
bun test tests/landscape-preview-runtime.test.js tests/preview-levels.test.js tests/world.test.js
```

**20 tests pass, 0 fail, 305,653 assertions.** The actual Southern Hook source equals `currentPreviewFor('A',1)`. All sixteen sequential source-aware loads request only scenery plus six cosmetic actors, animate wildlife safely for 240 frames per level, preserve source data and release their world/visibility/actor references before replacement loading. Only A1 enters path camera; every other landscape stays in overview. Every loaded preview has zero enemy states, defence states, planner, missile pool or enhancer states. The archived undefined-mode missile combat source still loads its original seven enemies and three launchers/36-slot missile pool.

Synthetic layout checks cover dry route acceptance; empty, incomplete, discontinuous and wet route rejection; forbidden defence/enemy/projectile placements and actors; source-aware roster suppression including the A1 catalogue exception; absent authored wildlife seeds; and path-camera entry/exit. Existing world tests retain route clearance, rig matrix independence, surface coverage without coplanar overlays and fixed-environment validation.

The touched app module also passes a Bun syntax build with external imports. No full suite or browser check was run by Engineer; Lead owns the single built-in browser tab. No new GPU resources, passes or pools were added; no GPU timing or campaign-balance claim is made.

## Shared documentation handoff

Lead should update `docs/design-doc.md` and its change record, current project/team notes and diary to distinguish A1's implemented Southern Hook path-layout preview from the fifteen path-free landscapes. The user's A1 route approval does not authorise combat placement or carving the remaining levels.
