# CPU simulation audit and cleanup — 20 October 2026

Assigned model/effort: gpt-6.1-sol/high, retained for simulation, numerical identity, navigation and allocation reasoning. Parent owns renderer/effects/world/scene-loading/apps, consolidated documentation, browser evidence and independent review. The five-file CPU scope was proposed before implementation and explicitly agreed by the parent.

The changes remove repeat scheduling/pose checks, duplicate Moth trigonometry and typed-vector iterator requests. Four actual accepted scene witnesses retain byte-identical gameplay, poses and camera state against the immutable `/private/tmp/defender-engine-20261020-euzacphu` snapshot recorded in `baseline.json`. No assets, layouts, config, economy, gameplay policy, clock, visual quality, running feature, dependencies, GPU resources or capacities change.

## Broad audit and chosen scope

Reviewed path sampling and turns, PoseRig dirty propagation and zero-axis handling, Dog/articulated/expansion gaits, impact/obstacle/visibility queries, target reservations and weapon readiness, finite play lifecycle, player cameras/anticipation, and preview actor simulation. The existing code already reuses matrices/IK/navigation buffers, keeps exact static cuboid BVHs and per-frame attack/flight guards, and bounds planner ownership. The 18 October performance review's earlier changes remain intact.

The following low-risk changes were selected:

- `play/enemies.js`: validated wave schedules are already ordered. A scene-owned scalar `spawnIndex` consumes due slots in that order instead of scanning every future/resolved actor twice per tick; `nextSpawn()` reads the next scheduled slot rather than finding a minimum over the whole wave. Each simultaneous batch retains source callback order and one final pose call. `prepare()` resets the cursor for restart. Resolved slots remain in the full roster for statistics/effects/exit accounting; `resolveExits` retains its original full-roster order and stop-at-threshold behaviour.
- `game/enemy-preview.js`: `pose(deltaSeconds=0, states=this.states)` can use the existing finite `activeTargets` array. `PlayEnemies` passes that reused view during active movement and spawn poses. Its surviving order matches source order; scheduled/resolved slots no longer need to be checked. Existing preview, reset and explicit pose calls retain the default full roster and unchanged behaviour. No second actor list or copied view is allocated.
- `engine/enemy-expansion-gait.js`: paired Moth wings reuse the two identical front/rear sine samples instead of computing each side separately. The original `+0` and multiplication order are retained, including signed-zero reset behaviour. Joint channels, phase, flap geometry, body motion and all other gaits remain unchanged.
- `play/drone-camera.js`: fixed three-component positions, focus, goal and velocity vectors use explicit indexed arguments for existing clearance/hypot calls. This removes repeated typed-vector iterator requests without changing values or arithmetic order. The accepted higher flight floor, continuous drift, easing, framing, forecasts, optical zoom, pause and safety policies are unchanged.
- `play/camera-anticipation.js`: the fixed source vector likewise uses three indexed arguments for its existing visibility ray. Forecast budgets, route samples, eligibility approximations, commitment and combat immutability remain unchanged.

Broader changes were deliberately not selected. Caching planner commitments across mutable health/reservation/missile updates requires careful invalidation; conservative flight envelopes and collision/LOS guards must not be simplified; static-defence bounds share queries with articulated/current geometry; and duplicate preparation-time controller construction has UI/coverage lifecycle implications. None offers the same bounded, readily verified scope as the changes above. This is an audit conclusion, not an assertion that those systems cannot be improved later.

## Measurements and exact traces

Reproduce with:

`bun docs/engine-cleanup-2026-10-20/cpu-probe.mjs`

The probe uses accepted A1 wave 3, A2 wave 3, merged A3 wave 4 and A4 wave 4, with the retained mixed strategy's actual validated placements. It runs 2,400 outer 60 Hz frames per scene, includes real guns/Arcs/physical missiles, enemy health/impacts, wildlife, Drone or Cam man, exact pause, presentation-only settling and a same-wave restart. The four current SHA-256 digests match their baseline counterparts. Records hash all pose callbacks/matrix bytes in order, per-frame engine/camera state, active membership, actor transforms/channels/velocities/health, weapon targets/reservations/cycles/ammo and wildlife state. The unchanged callback total is **710,172** across **9,600 outer frames**.

`cpu-baseline.json` captures the snapshot-only pre-edit measurement; `cpu-results.json` records the final before/after equality and operation counts. Counts use property getters, scoped sine instrumentation and a scoped Float64 iterator hook. Instrumentation is restored after every run. The probe's diagnostic elapsed times include instrumentation and hashing and are **not CPU performance benchmarks**. No browser heap-allocation, GPU-time or frame-rate improvement is inferred.

| Operation across the four witnesses | Before | After |
| --- | ---: | ---: |
| Spawn scheduling phase reads | 392,068 | 29,593 |
| Spawn scheduling time reads | 208,808 | 29,593 |
| Next-spawn phase reads | 195,988 | 14,762 |
| Next-spawn time reads | 104,358 | 14,762 |
| Pose lifecycle phase reads | 333,416 | 204,834 |
| Moth gait sine calls | 67,132 | 33,566 |
| Camera Float64 iterator requests | 53,032 | 345 |
| Submitted pose callbacks | 710,172 | 710,172 |

The three Drone witnesses reduce their measured typed-vector iterator requests to zero. The remaining 345 requests belong to unchanged Cam man code; only its shared anticipation ray was in this agreed scope. Iterator-request reductions are reported as observed operations, not as measured heap allocation bytes or a guaranteed JIT speedup. No retained typed buffer is added; the scheduling cursor is one scalar per finite wave controller.

## Focused tests and review handoff

`cpu-tests.log`: **40 tests pass across five affected files, 2,131,760 assertions, 41.26 seconds**:

- `tests/play-engine.test.js` — finite scheduling/health, event order, 30/60/120 Hz, long-frame carry, exit-kill precedence, reset, real complete loops, source preservation and the added simultaneous spawn/single-pose-batch/callback-order/exhaustion/restart regression.
- `tests/play-mixed-combat.test.js` — actual mixed species/routes, Arc attachments, delayed physical missile damage, fair magazines, wave reuse and current-wave light membership.
- `tests/enemy-expansion-preview.test.js` — accepted expansion rigs and animation/lifecycle coverage.
- `tests/play-drone-camera.test.js` — current camera motion, min/max optical zoom, continuous held/settling translation, actual finite-difference easing, floor/posed actor/static swept clearance, clock and scene lifecycle.
- `tests/play-camera-anticipation.test.js` — route/readiness forecasts, idle defence families, pre-range movement, fixed commitments, immutability, pose-depth focus and real first-shot advance coverage.

No whole-suite run was performed. Parent's renderer/effect/loading checks remain separate. Independent review should focus on the sorted-spawn invariant and cursor reset, unchanged callback order for simultaneous spawns, use of the active view only where it cannot mutate during pose, signed-zero preservation, exact vector argument order and scene ownership. The source snapshot and assets were read only. All five implementation files and this focused evidence are ready for independent review; the parent owns any combined final status and living design/project/diary updates.
