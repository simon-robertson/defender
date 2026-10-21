# Game performance review — 18 October 2026

The user requested a full review and cleanup of the existing game code to reduce CPU/GPU work. Lead reviewed loading, world construction, camera, clock, scene ownership and preview diagnostics; Engineer reviewed renderer passes, shaders, lighting and effect pools; Tactician reviewed targeting, visibility, weapon timing and missile collision; Artist reviewed rigs, gaits, enemy reactions and wildlife. The changes preserve accepted gameplay, visual settings, models and levels.

## Changes and measured evidence

| Area | Change | Evidence from current scenes |
| --- | --- | --- |
| Animation | Skip wildlife pose writes when root and wing channels are unchanged; skip trigonometry for exactly zero rig axes, preserving signed zero. | Across 2,400 A–D frames, rig visits fall 22,200→13,582 and trig calls 584,194→421,632. Submitted matrices/callbacks are identical. |
| Missile collision | Calculate an enemy's world bounds only on its first collision query in an advance; invalidate on every advance/reset. Keep motion samples and exact swept-surface tests. | Over 2,400 frames: A3 2,166→1,245 builds, B3 2,136→987, D3 2,112→924 (43–56% fewer). |
| Defence planning | Omit route-coverage construction for Arc Spires and silos, whose existing forecast policy always returns zero. Gun forecasting and every-frame shot validation remain. | A2/A3 remove 2,091 unused path samples each; B3 removes 2,451, D3 2,163. A1's useful 2,091 samples remain. |
| Plasma animation | Cache fixed endpoint bases and spatial wave coefficients; factor phase trigonometry. | 133→7 trig calls per link/frame. Actual A1 and full-pool packed Float32 geometry/light data match exactly over 600 frames; largest Float64 point difference is 2.84e−14 units. |
| Tube lighting | Pack a conservative sphere around each Arc/plasma source; reject distant shading samples before its eight segment calculations. | Actual GPU counters over 256 terrain-box samples: A1 2,048→16 segment evaluations, A2 6,144→176. Lighting output matches exactly; this is an operation count, not GPU time. |
| Opaque materials | Skip half-vector/specular calculations when reflectiveness or shadow visibility makes the contribution zero. | Dry, wet stone/mortar, puddle and shadowed samples retain exact GPU results in overview and path modes. Water's separate reflection shader is unchanged. |
| World construction | Reuse immutable bind-pose hierarchies per model/variant during a single build; retain distinct runtime matrices. | A1 hierarchy builds 116→18; A3 151→19. Five scenes retain identical geometry/instance hashes. Cache is released after building. |
| Preview diagnostics | Throttle inspection JSON/DOM snapshots to at most 10 Hz using unscaled time; publish immediately after scene load/reset. | At 60 Hz, 600 per-frame snapshot sets become 100 over ten seconds. Simulation/rendering still run every frame, including T slow motion. Lifecycle reports remain immediate. |

Local Bun 1.4.2 / Apple M3 CPU measurements used two warmups, seven alternating-order samples and no instrumentation/hashing inside timed loops. Enemy/wildlife update medians for 2,400 frames were **17.64→15.92 ms** (about 10% lower). Plasma advance/preparation over 30,000 calls was **55.27→27.69 ms** for one link and **892.45→441.01 ms** for sixteen, including new bounds packing. These are isolated CPU fixtures, not whole-game timings, browser frame rates or GPU timings. Whole-world build measurements were noisy/mixed; no general loading-speed improvement is claimed.

The small storage tradeoff is explicit: plasma pool +1,536 CPU bytes, a shared 1,848-byte wave table, renderer merge array +352 bytes and merged GPU storage +352 bytes. Each active tube adds 16 upload bytes for its bounds. Existing fixed capacities, lazy resources, passes, draw counts, active-prefix uploads and scene-release ownership remain. No recurring allocation was added to these simulation paths.

## Verification and review

Affected checks passed: 53 combat/planner/flight tests, 18 selected animation/rig/gait/impact/lifecycle checks, 26 selected plasma/bounds/Arc/renderer checks, and 22 clock/sampler/world/lifecycle checks. These groups can overlap and are not a full-suite total. The full test suite was not run, following the standing test-scope instruction.

Five production scenes match baseline every-frame combat, health, target, flight and actor-matrix digests over 2,400 frames each. Eight animation traces match byte-for-byte, including impact, death and reset. World geometry hashes and instance ownership checks pass. Artist independently reviewed the rendering changes; Tactician reviewed loading/inspection and cross-system collision ownership. Neither found a blocking issue.

**177/177 actual WebGPU checks pass**, covering plasma 48, specular 17, Arc 34, rain 9, snow 13, leaves 17, damage 17 and bloom 22, with no validation errors. The new plasma test initially mapped a readback range twice; its test code was corrected to reuse one mapping, then the complete harness passed. This was a test-harness issue, not a production rendering failure.

Ten production browser checks pass across A1/A2/A3/B3/C3/D3: combat, T/R, rain/snow/leaves, shared snapshot timing and balanced scene resources. Returning to A1 restores three enemies, one plasma connection,25 model lights and12 effective base-gun strength. No production browser warnings/errors were recorded. [Browser evidence](performance/browser-checks.json), [final capture](screenshots/performance-review-game.jpg). The refreshed existing tab is left open in A1 at normal speed, with weather off and night lighting retained. The shared clock, camera, visibility acceleration, exact collision tests, fixed effect pools, weather-off behavior, batching and render-pass invalidation already avoid the larger obvious repeat work; those implementations were retained. No new culling quality setting, animation simplification, gameplay limit or visual tradeoff was introduced. GPU timing and hardware/frame-rate budgets remain unassigned.

## Reproducible records

- [Animation counts, traces and timings](performance/animation-maintenance.json), [probe](../tests/helpers/animation-maintenance-probe.js).
- [Combat operation counts and exact traces](performance/combat-operations.json), [probe](performance/combat-operations.mjs).
- [Plasma counts, storage and timings](performance/render-operations.json), [probe](performance/render-operations.mjs).
- [World geometry, ownership counts and load samples](performance/world-maintenance.json), [probe](../tests/helpers/world-maintenance-probe.js).
- [All GPU outputs and operation counters](performance/gpu-checks.json).

The before/after probes accept a pre-change source root. This run used `/private/tmp/defender-perf-20261018-jl1q_hdw`, captured before edits; source hashes and durable measured results are retained in the records above. No assets were rebuilt or changed.
