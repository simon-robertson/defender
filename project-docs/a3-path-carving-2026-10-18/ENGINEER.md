# A3 layout integration handoff

18 October 2026. Reused Engineer `gpt-6.1-sol`, High effort, for bounded current-source/runtime integration checks. The user approved A2 Garden Crossing and requested A3 next; only `moss-03` may be carved. A1/A2, other level/model sources and the frozen backup remain outside Engineer's edit scope. No further delegation or browser work.

## Initial read-only inspection

Existing source-owned layout mode supports a valid single route or fixed complete routes merging into one directed tail. Terrain/paving and scenery clearance use the deduplicated route union; camera choice uses complete route identity. Enemy/missile factories remain empty for layout even though the A3 catalogue ID retains its historical missile-study marker. Existing bridge support is available if selected; every using route must cross its complete straight span between dry banks, so merging in the middle of a deck is invalid.

No runtime change is currently evidenced. Final affected tests should update the current catalogue to three layouts/thirteen landscapes, include A3 in canonical source equality, and check actual selected routes and per-route camera support without weakening the path-free landscape contract. The lifecycle test currently assumes only A1/A2 have paths and all production `routes` fields are absent; a selected A3 merge needs a precise topology-aware assertion. Actor-route assignments are unnecessary in this noncombat layout.

## Selected proposal and prepared checks

Lead selected **Garden Confluence** for user review. The stable proposal has 33-box main and 28-box eastern routes, a shared 12-box/264-unit tail beginning at `[12,8]`, and 49 unique route boxes. The eastern approach crosses a one-box wooden deck at `[14,8]`; top24/underside23 retain the original water22 beneath. There are 194 scenery placements and 44 surveyed alternative sites. These are proposal facts, not user acceptance or final campaign balance.

Prepared tests now expect three current layouts and thirteen path-free landscapes, exact selected A3 topology/bridge, supported travel on both complete routes and canonical A1/A2/A3 source equality. Deterministic F/path-camera selection enters each route; the eastern route's midpoint starts directly on the deck at Y36. Camera clear releases route/support data. Source-aware A3 actor checks require no enemies/missiles despite its retained ID-only 36-slot historical missile catalogue. Strict landscape assertions continue requiring empty paths and absent route/bridge metadata.

## Final verification

The active source and `carveMoss03()` factory landed as the selected unchanged Garden Confluence proposal, SHA-256 `e7b3b6dd37d4eb7174936ecd3016b9c8d606e4bf74bfec21e6a6370e61b9d909`. Lead's canonical wrapper and catalogue now include A3.

```sh
bun test tests/landscape-preview-runtime.test.js tests/preview-levels.test.js tests/world.test.js
```

**20 tests pass, 0 fail, 305,873 assertions.** The actual A3 source has the expected main/eastern complete routes and bridge support, and deterministic F selection reaches both approaches, including directly on the eastern bridge at Y36. Camera clear releases route/support references. Source-aware A3 requests contain no enemy or missile models despite its historical ID-only missile marker. All sixteen loaded sources animate six cosmetic wildlife actors safely for 240 frames each, preserve source data, retain zero enemy/defence/enhancer states and no planner/missile pool, and release world/visibility/actor references before replacements. Thirteen landscapes still require empty paths and absent route/bridge metadata. Current A1/A2/A3 sources match their canonical factories; explicit archived combat sources still load their established actors and launchers.

No engine, schema, renderer, asset, catalogue or canonical-wrapper changes were required or made by Engineer for A3. Only `tests/preview-levels.test.js`, `tests/landscape-preview-runtime.test.js`, `tests/world.test.js` and this handoff changed. No full suite, browser check or further test expansion was run; Lead owns browser/GPU verification and Tactician owns actual species/site/weapon evidence. A short stale-Bun-server restart note was also added to A2's previous handoff after Lead diagnosed that separate development-server issue.

## Storage observations and limits

The loaded A3 uses **14 model assets, six cosmetic actors, 17 opaque mesh entries, 21 water quads and 299,964 visibility bytes**. Its one-box bridge contributes 15 wooden quads (**3,000 gross vertex/index bytes** inside the existing ground mesh before accounting for removed bank faces) and one static visibility primitive (**56 bytes**). No new runtime system, GPU pass or game draw group was introduced for this integration. These are storage/work observations, not GPU timings or campaign-balance claims.

Lead owns canonical factory/catalogue/browser/main documentation. Record the implemented A3 review separately from user acceptance; the team's selected proposal is ready for review. Tactician's coverage, clearance and bounded missile experiments are separate evidence and are not rerun or reinterpreted here.
