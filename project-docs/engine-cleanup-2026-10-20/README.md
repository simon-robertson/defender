# Engine cleanup and optimisation — 20 October 2026

The user authorises a full engine cleanup/optimisation pass followed by review. A pre-edit source snapshot and hashes preserve the accepted game. The pass audits rendering/effect/lighting ownership, scene loading and disposal, fixed clocks, finite enemy lifecycle, animation, camera navigation and anticipation, targeting/visibility and projectile interactions. Existing pass invalidation, batched transform uploads, fixed effect pools, lazy weather, exact collision and shared clock were retained after inspection. No visual-quality reduction, gameplay/balance tuning, model/level edit, dependency or running work is introduced.

Nine runtime files change. The independent reviewer authored none of them and reports **no actionable regression or blocker**. [Review and disposition](REVIEW.md) · [CPU handoff](ENGINEER.md) · [Baseline hashes](baseline.json).

## Measured cleanup

| Area | Change | Recorded result |
| --- | --- | --- |
| Finite spawning | Consume the validated ordered schedule once through a resettable cursor; read the next spawn directly. Preserve simultaneous batch/callback order. | Across four real scene witnesses, spawn-phase reads 392,068→29,593 and next-spawn phase reads 195,988→14,762. |
| Animation | Pose the reusable active actor view; keep the general preview’s complete-roster default. Cache the two repeated Moth wing sine values. | Pose-phase reads 333,416→204,834; Moth wing sine calls 67,132→33,566. |
| Aerial cameras | Use explicit three-component arguments instead of repeatedly spreading typed vectors in hot clearance/focus/movement calls. | Camera Float64 iterator requests 53,032→345 across the witnesses; Drone witnesses reach zero. The remaining calls belong to unchanged ground-camera code. This is an iterator-operation reduction, not a measured GC or FPS result. |
| Water effects | Skip empty pool scans, reuse scalar pool fields instead of temporary assignment objects, hoist common drag/trig/root calculations. | 600 idle advance/prepare pairs: 288,000 slot predicates→zero. Seeded active fixture: exp calls 18,172→138, assignment objects 240→zero, slot predicates 392,836→136,228. |

The four 40-second scene traces match baseline byte-for-byte over 9,600 outer frames and 710,172 identical pose callbacks. They include A1/A2/A3/A4, mixed enemies, all three active weapon families, merged routes, both live cameras, pause, settling and restart. [CPU traces and counts](cpu-results.json) · [Reproducer](cpu-probe.mjs). Eight further A–D preview animation traces match exactly, including impact, death and reset. [Animation evidence](animation-results.json).

The water probe uses actual A2 scenery, seeded randomness and exact state/packed-Float32 hashes through idle, pool overflow, expiry/collisions, long/zero deltas and reset. Before/after hashes match. [Measurements](water-results.json) · [Reproducer](water-probe.mjs). Its local Bun 1.4.2 isolated CPU timing uses two warmups and seven alternating-order samples with no hashing/instrumentation inside timed loops. Median 20-repeat fixture time is 147.08→140.14 ms, about 4.7% lower. Timing was repeated after concurrent test/probe processes completed. This is not a whole-game browser/frame-rate or GPU-time claim; animation-probe timings taken alongside validation are not used as performance claims.

No new GPU buffers, render passes, textures or pool capacity are introduced. The camera retains a fixed list of its twelve input registrations for explicit teardown; the spawn cursor and cached values add only scalar state. Accepted shader quality and camera movement remain unchanged.

## Correctness fixes found during the audit

- Explosion bloom starts after **both smoke and water particles**, matching ordinary display packing. Previously a simultaneous splash could replace the intended explosion source in the bloom draw.
- The bloom composite specialises its local-light array and loop to the active renderer capacity. Previously it kept the preview’s 77-light limit when the player renderer supported more. Actual GPU readback verifies a light at slot 101 illuminates water and matches the ordinary composite with zero emission.
- Camera disposal removes its canvas/document listeners, clears input/scene references and suppresses detached mode callbacks. Renderer disposal is idempotent and ignores delayed errors from the retired device. A real EventTarget dispose/recreate test verifies old handlers neither consume input nor invalidate the old view.

## Verification and limits

**150 affected tests pass across 17 files, zero failures, 2,239,025 assertions.** [Final integrated log](tests.log). Focused groups include rendering/lighting/effect/lifecycle, cameras, finite scheduling, mixed combat, Moth/preview animation and bounded splash effects. Engineer’s earlier 40-test group is overlapping evidence, not added to that total. The full unrelated suite was not run, following the standing project instruction.

**25 production WebGPU checks pass**, including unchanged original bloom pixels, smoke/water blast prefixes, expanded player water lights and no validation errors. [GPU readback](gpu-bloom.json) · [Executable harness](../../tools/bloom-check.html). Both player and preview browser bundles build; preview’s existing served-root imports are resolved to project paths for its bundling check.

Actual browser review verifies placement and firing, Drone→Cam man→Auto→Drone, exact pause freeze, and release of the live lens target on Auto. The shared `/game/` preview verifies rain, snow, leaves, day/night and F path view (80°/12 units above ground), then A1→A2→C2→D2→B2→A2→A1 scene changes. Created-minus-destroyed scene buffers equals the active count; returning to A1 restores 27 model lights, clear weather and overview. No browser warnings/errors were recorded. [Browser states](browser.json).

All 85 model/level source hashes remain unchanged. The frozen backup is not touched; tuning, movement rules and the rejected running rollback remain intact. [Verification and final source hashes](verification.json). Finite traces and sampled browser checks do not prove every possible custom level or future deployment; no hardware frame-rate or GPU timing target is claimed.

## Daytime and clear defaults follow-up

After the cleanup and independent review are complete, the user requests removal of the level-start day/night/weather rolls. `LevelConditions` no longer accepts/stores a random source or draws random values. Every level receives frozen `{night:false, weather:false}`, retained through its waves/retries and reset consistently for a fresh game. The existing per-level binding API is preserved. All four active A sources use authored 10.5-hour daytime lighting, which stays unchanged; weather is disabled on the runtime clone. The engine’s explicit night/weather capabilities and development preview controls remain available.

Three focused condition tests pass, 69 assertions, including a throwing `Math.random` witness across all sixteen wave entries/reset plus real A2 runtime preparation/deployment. [Log](conditions-tests.log). The four-world test initially exceeded the default five-second allowance during concurrent validation; its test-only allowance is now fifteen seconds, with unchanged assertions. Final run takes 4.29 seconds. [Independent addendum](REVIEW.md#addendum-fixed-player-conditions). Player bundle rebuilds. Fresh browser A1 reports `night:false`, `weather:false`, no error, and no console warnings/errors. [State](daytime-browser.json) · [Screenshot](daytime.png).

This adds a subsequent condition-policy change after the nine-file engine cleanup; it does not claim that environment selection stayed random. All 85 authored assets remain unchanged. Total distinct affected checks for the cleanup plus this follow-up: **153 tests across 18 files**, plus the 25 GPU checks above.
