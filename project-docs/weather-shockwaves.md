# Muzzle pressure and weather — removed experiment

**Superseded 17 October 2026:** the user requested full rollback. All runtime pressure code, dedicated tests and GPU harness have been removed. The notes/readbacks/screenshots below are historical evidence only, not current behavior or approval to restore the effect.

Approved 17 October 2026: firing player defences such as the turrets push nearby weather particles outward with a shockwave. Zone A rain is the primary visual test. Each actual shot in a burst creates a pulse. Current turret attacks remain hitscan; no travelling projectile, damage or death behaviour changes.

## Visual direction

The existing particles show the pressure through their motion. There is no visible ring, added flash, fog/haze, smoke, camera shake, audio or extra particle emitter. Preserve the accepted weather colours/counts, muzzle flashes and light reach. Artist proposed a compact 24–30-unit radius, roughly 0.1-second travel to its edge, and a brief 4–6-unit outward deflection. Keep distant weather falling normally and avoid a lasting empty bubble or snapping particles back to their original path. Values are provisional visual tuning, not weapon balance or a hardware budget.

## Shot events and ownership

`engine/shot-effects.js` samples one pressure origin at the midpoint of the two transformed muzzle sockets after the shot’s yaw/recoil update. It stays in world space as the turret moves. Every actual burst shot gets its own pulse; expired shot callbacks keep the existing discard policy and cannot replay blasts after a long stall.

`engine/weather-shock.js` owns a fixed pool of 12 pulses with reusable typed arrays. Full pools drop new pulses rather than prematurely removing an active pulse. Shared delta seconds advance their ages independently of the shorter muzzle flashes. `prepare()` packs one 400-byte GPU uniform: a four-float header (count, active slot mask, generation mask, reserved), then twelve eight-float entries (origin XYZ, radius, age seconds, strength, stable slot bit, 0/1 generation). Compaction never changes event identity. Alternating generations distinguish reuse; inactive-slot masks synchronize GPU history. No model, rig or level references are stored.

Scene resets clear pulse history with the effects clock. Weather toggles must clear history while preserving `ShotEffects.time`, using `shockwaves.reset(effects.time)`; resetting only this clock to zero would reject subsequent shot timestamps. Existing flashes, sparks and turret state remain independent.

## GPU implementation and verification

Implemented in `engine/weather-motion.js`, `engine/weather-motion-shaders.js` and `engine/renderer.js`. Immutable seeds retain the original flight. Each seed has 48 bytes of GPU state: offset/previous age, velocity/dead status, and pulse identity. One compute dispatch (64 threads per workgroup) runs before the existing instanced draw. There is no per-frame CPU particle loop, particle upload/readback or new render target.

Tuning lives in `shared/weather-shock.js`: radius 30 units, front travel 0.1 seconds, event retention 0.4 seconds, drag 12/second and strongest single-pulse asymptotic push 6 units. Radial impulse fades as `(1-distance²/radius²)²`. Extra speed is capped at 72 units/second; overlap displacement is bounded to 8 units by limiting the remaining velocity integral, never clamping position. Offset persists until respawn, avoiding snapback. Rain streaks align with combined falling/outward velocity. Weather colours/counts, lighting and path treatments are preserved.

Drag is integrated analytically; snow/leaf flutter is split at its turns. Moving-front arrival uses 16 bounded bisections. Each slot/generation applies once; within-frame births receive only remaining frame time. Newborn particles behind an already-passed front get no late kick. Flight wraps, including long deltas covering exact whole cycles, reset state. Only displaced particles query the exact static scenery/terrain BVH and water planes, conservatively expanded for shape and curved movement. A blocked particle stays hidden until its next flight.

Three scene buffers add particle state, a 32-byte-per-node collision packet and 16-byte settings. Weather-off/unload destroys these and the seeds. The shared 400-byte pressure uniform persists across zones; frames upload it only while pulses are active or transitioning to none. CPU pulse storage adds 736 typed-array bytes, allocated once. Shared effect GPU storage is now 9,888 bytes (previously 9,488). No GPU timing claim is made.

| Zone | Seeds | State bytes | Collision bytes | Scene buffers on/off |
| --- | ---: | ---: | ---: | ---: |
| A rain | 1,400 | 67,200 | 231,648 | 91 / 87 |
| C snow | 3,920 | 188,160 | 181,472 | 46 / 42 |
| D leaves | 560 | 26,880 | 244,192 | 49 / 45 |
| B clear | 0 | 0 | 0 | 42 / 42 |

The 16-byte settings buffer is additional in each enabled weather scene. Existing seed/geometry sizes and draw groups are unchanged. Weather-off and B dispatch no compute work. Shots may still record pulses in the fixed CPU pool while weather is off; enabling weather clears that history at the current effects time.

### Verified 17 October 2026

- **154 Bun tests pass**: pool capacity/identity/timing, paired world-space muzzle transforms, bursts, BVH/water packing, state initialization and real-world/mock-GPU toggle ownership.
- **21 production compute GPU checks** at `/tools/weather-shock-check.html`: unchanged rain/snow/leaves without pressure, front arrival/radius, no repeated kicks, frame subdivision, within-frame birth, decay, slot reuse, overlap bounds, long-frame respawns, newborns, swept thin walls/water and real openings. [Readbacks](weather-shock-gpu-check.json).
- Existing **9 rain, 13 snow and 17 leaf GPU checks** pass with identical lighting/depth readbacks: **60 GPU checks total**.
- Built-in Chrome verifies A off/on = 87/91 buffers, restored geometry/state and preserved camera/night/clock. F view remains Y36 above Y24 ground, FOV80. A→C→D→B→A clears all old scene resources/pulses; created-minus-destroyed equals active buffers. [Lifecycle evidence](weather-shock-lifecycle.json).
- Engineer found no actionable renderer integration defect. Artist approved [day](screenshots/moss-weather-pressure-day.png) and [night close-up](screenshots/moss-weather-pressure-night.png): local slanted rain against vertical surrounding streaks, readable models/path, no lasting bubble or extra colour wash. Temporal behavior is covered by GPU checks and the live preview, rather than inferred from stills.

Known scope limit: this is a visual pressure approximation. Static scenery blocks displaced particles; pressure propagation itself ignores obstructions. Conservative bounds can retire particles slightly early, and snow/leaf first-hit lifetimes remain upper bounds. Moving defences and enemies provide screen-depth occlusion, as with existing weather. No fluid simulation or gameplay force is introduced. GPU execution time has not been benchmarked.
