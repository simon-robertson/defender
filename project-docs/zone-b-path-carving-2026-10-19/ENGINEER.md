# B1–B4 engineering verification

19 October 2026. Engineer uses `gpt-6.1-sol`, High effort, for independent bounded source/runtime verification. The user authorises B1–B4 carving as layout/wildlife previews. Preserve approved A1–A4, C/D landscapes, all models, original B terrain/water and the frozen pre-carving backup. No further delegation, combat implementation or browser control belongs to this assignment.

## Initial diagnosis and ownership

The existing version-4 route, optional fixed-merge and one-unit wooden bridge contracts cover the proposed B work. No missing runtime feature is currently evidenced. Source-aware loading must continue resolving actors from the loaded preview mode before requesting models; historical B enemy/missile catalogues must remain inactive in layout mode. B wildlife uses the existing lizard and bird models, navigation and finite shared planning/event storage. The route/path camera recognises deck support, while wildlife ground navigation deliberately requires natural dry ground and cannot treat a deck over water as a dry habitat.

The existing noncombat runtime test hardcodes A-only layouts and A3-only extra routes. Engineer owns the bounded expectation update in `tests/landscape-preview-runtime.test.js`, retaining the exact approved A3 route/bridge checks, source immutability, no-combat model/state checks, all fifteen noncombat scene lifecycles and C/D path-free constraints. Lead subsequently extended test ownership to `tests/preview-levels.test.js` and `tests/world.test.js`: catalogue checks now require A1 combat, seven layouts and eight landscapes; canonical equality covers all eight A/B sources including A4. Tactician owns route/source/factory, physical enemy/weapon clearance, coverage and visibility evidence; Lead owns browser review and shared design records.

## Prepared independent probe

`scripts/b-path-runtime-audit.js` is an offline authoring probe, coordinated with Tactician. It loads the active source, requires a 20×16 B layout, verifies that every requested asset is scenery and no archived combat actor is restored, then simulates the actual six wildlife actors for sixty seconds at 30 Hz. Every frame checks each complete rotating/animated envelope against the static BVH and level bounds, equal-height natural dry support for ground animals, supported soles for resting birds and the 512-node planning budget. Once each second it independently transforms every animated voxel corner and checks containment in the tested envelope. It records accepted/completed journeys, visited perch placements and actual displacement; two-box reachable extent and one-box observed ground travel are review diagnostics rather than new movement rules.

The probe checks fixed navigation/queue/parent/event/waypoint storage identities, one scheduled thinker per frame, unchanged source data, cosmetic time surviving combat-reset calls and complete release of world/controller/visibility references. It records model assets, opaque entries, water quads, visibility primitives/bytes, planning bytes, event bytes, navigable nodes and supported tree perches. These counts are storage/work observations, not GPU timings, FPS or final campaign-balance claims.

## Selected source contracts

Lead selected Cistern and Mesa Circuit (B1), Riverfold Crossing (B2), Mesa Confluence (B3) and Aqueduct and Shore Tour (B4) for review. The B sources remain layout/wildlife previews; these are selected implementations, not user acceptance or campaign balance.

| Source | Complete route boxes | Route union | Bridge |
| --- | --- | ---: | --- |
| `ochre-01` | main 44 | 44 | None |
| `ochre-02` | main 45 | 45 | `river-waist`, `[6,6]` and `[7,6]`; top24 over unchanged water20/bed17 |
| `ochre-03` | main45, eastern31 | 52 | None; complete approaches share the tail beginning at `[16,9]` |
| `ochre-04` | main31 | 31 | None |

The updated lifecycle test checks exact selected B route counts/merge IDs and bridge metadata, boundary endpoints/interior journeys, source-aware no-combat model/state loading, both B3 camera routes and deterministic starts directly on both B2 bridge boxes. Bridge starts retain Y36 eye height and exact slab collision support. The approved A3 route/bridge assertions remain unchanged. All eight C/D sources still require empty paths with absent route/bridge metadata.

## Wildlife authoring defect and correction

The first sixty-second probe found **nine confined original ground seeds**: B1 ground1/2, all three B2 actors, all three B3 actors and B4 ground2. Their reachable components held only1–14 nodes and had0–24.33 units of reach. Collision-free spawns and, in several pockets, repeated short journeys did not establish usable roaming ground. All twelve birds already completed supported journeys between multiple actual perch placements. These initial results are preserved as `ochre-0N-original-seeds-runtime.json`; they use the carved geometry with the original wildlife seeds, not untouched pre-carving landscape sources.

Tactician moved the nine confined seeds to independently surveyed existing full-body navigation nodes, and also moved B1 ground3 from its50-node pocket into the broad4,908-node component. No terrain, water, scenery, model or wildlife behaviour change was needed for this correction. B2's ground actors occupy separate connected dry-bank components; its bridge remains outside natural dry-ground navigation. B4 ground1 already had2,932 reachable nodes and travelled223.88 units by60 seconds, but its slow long journey had not finished. A180-second observation confirmed three completions, so its seed stayed unchanged. B4 ground3 also stays on its usable108-node/80-unit-reach ground and completes eleven journeys.

## Fresh final verification

```sh
bun test tests/landscape-preview-runtime.test.js tests/preview-levels.test.js tests/world.test.js
bun scripts/b-path-runtime-audit.js --seconds 180
```

**20 tests pass, 0 fail, 305,524 assertions.** The three affected test files verify current catalogue selection, source/factory agreement for all A1–A4/B1–B4, source-aware cosmetics-only loads, supported routes/camera starts, unchanged sources and release before all fifteen noncombat scene replacements. Explicit archived combat sources retain their established actors and ID guards. No engine or renderer modification was required.

All four independent final wildlife reports pass: every ground actor has useful reachable extent, travels at least one box and completes a real journey; every bird completes flights and rests on at least two distinct supported placement IDs. There are5,400 scheduled thinker turns per source, each at most512 node expansions; fixed storage identities survive. The probe performs **32,406 full-envelope checks and1,086 transformed-voxel pose checks per level** (129,624 and4,344 total), with no observed scenery/terrain/level-boundary overlap or unsupported rest. Cosmetic time survives combat-reset calls, source JSON remains unchanged and world/controller/visibility references release completely.

| Source/report | Ground completions | Ground reachable nodes | Observed ground travel, units | Bird completions |
| --- | --- | --- | --- | --- |
| [B1](ochre-01-runtime.json) | 3 / 3 / 2 | 4,908 / 4,908 / 4,908 | 293.64 / 390.98 / 305.94 | 16 / 16 / 17 |
| [B2](ochre-02-runtime.json) | 5 / 5 / 6 | 2,849 / 1,376 / 1,376 | 178.89 / 229.26 / 253.39 | 13 / 17 / 15 |
| [B3](ochre-03-runtime.json) | 6 / 3 / 3 | 4,271 / 4,271 / 4,271 | 229.82 / 408.33 / 355.26 | 18 / 14 / 16 |
| [B4](ochre-04-runtime.json) | 3 / 2 / 11 | 2,932 / 2,932 / 108 | 324.10 / 248.33 / 80.00 | 20 / 15 / 17 |

| Source | Final SHA-256 |
| --- | --- |
| `ochre-01` | `0f733a25a14d886049ef71716e368316d5496b680682763ddcc562c498ef669e` |
| `ochre-02` | `6e437f27aaac3f8b75212039e6bb3a6f966c25b0a20b41d38aed6c40bf5fb129` |
| `ochre-03` | `01a498d7720489c3837023f6f4183ba4688da1fde814907a5370a8815d874ad8` |
| `ochre-04` | `32516e96472e42605fdc53e74046e2b3164d1ad9549e025521e5919f39d4ed3f` |

## Bounded storage observations

| Source | Model assets | Opaque entries | Water quads | Visibility primitives / bytes | Wildlife planning bytes | Navigable nodes | Tree perches |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| B1 | 12 | 15 | 1 | 4,195 / 234,892 | 277,704 | 5,232 | 34 |
| B2 | 12 | 15 | 43 | 3,702 / 207,284 | 274,536 | 4,454 | 29 |
| B3 | 11 | 14 | 10 | 4,505 / 252,252 | 274,900 | 4,529 | 15 |
| B4 | 12 | 15 | 80 | 3,560 / 199,332 | 269,780 | 3,263 | 25 |

Every level retains the existing320-byte wildlife explosion-event store, six cosmetic actors and no enemy, defence, enhancer, targeting-planner or missile-pool state. These measurements exclude JS object overhead and are CPU geometry/storage observations. They do not measure GPU time or imply a new GPU pass, runtime cache or performance target.

## Independent weapon-envelope review

Lead requested review of Tactician's height-dependent gun clearance refinement in `scripts/b-path-carving-clearance.js`. The earlier whole-height cylinder coupled widest reach with a different pose's maximum height and could reject harmless Twin Fan passages. The replacement remains conservative: each occupied solid gun voxel is bounded over every continuous one-degree interval across the full±35° travel, using all voxel corners, both local+Z recoil endpoints and analyticY/Z critical angles. For a fixed angle, transformedY/Z are linear in the voxel and recoil coordinates, so extrema lie at their endpoints. Horizontal radial norm is convex across each solid voxel, and its angular extrema are included throughZ extrema. Full yaw preservesY, and filling every touched one-unitY band with that interval's maximum radius enlarges the swept volume. The current gun pivots and parent yaw centre match `PoseRig`; all probes use turn0. Head cylinders retain each actual occupiedY layer.

No gap between finite pitch samples or permissive relaxation was found in that construction. Its fixed-model/variant cache is appropriate to these accepted sources, not a general arbitrary-model contract. Exact static cuboids and actual production enemy occupied-part envelopes remain separate tests. An envelope overlap may be conservative rather than an attainable joint collision; affected weapon/stage/site combinations must be reported as exclusions. The automatically generated `declaredSuitabilityPassed` flag only checks that failures were listed, so it is not independent evidence of universal site suitability. The underlying per-combination results and exclusions are the evidence.

Engineer reviewed this approach and its assumptions; Tactician owns final clearance outputs and weapon/site restrictions. Canonical enemy checks use one-unit route poses, not a proof of all continuous enemy motion or unsampled impact reactions. Wildlife checks cover deterministic180-second autonomous runs at30Hz and per-second actual voxel poses; they do not establish every possible future journey. No full suite, browser or new GPU checks were run by Engineer. Lead owns final overview/visual/lifecycle browser evidence and preservation reconciliation.
