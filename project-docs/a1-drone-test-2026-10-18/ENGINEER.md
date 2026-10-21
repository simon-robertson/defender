# A1 drone runtime integration

18 October 2026. Engineer used `gpt-6.1-sol / xhigh` for the bounded flight/combat integration. Read-only architecture work preceded A4 completion; implementation began only after Lead's A4-complete signal. Lead owns A1 source/roster/schema, shared design records and browser verification. No model, scenery, terrain or route source was edited by Engineer.

The governing design is [docs/design-doc.md](../design-doc.md#proposed-drone-defence). Two base drones are now controlled through the existing shared defence coordinator. Upgrade combat values, costs and generator interaction remain unassigned; mobile drones are excluded from static generator adjacency.

## Behaviour and ownership

- [`shared/drone.js`](../../shared/drone.js) separates approved base values from provisional `DRONE_PREVIEW` tuning. Base: 20 seconds from launch excluding return, 10 HP per round, ten rounds at minimum .25-second intervals, five-second cooldown after the last actual round, and ten-second pad recharge. A valid active burst finishes after flight expiry, then returns immediately without waiting for weapon cooldown. Invalid/dead/obstructed targets cancel the remaining rounds; expiry never forces an unsafe shot or a new burst.
- [`game/drone-preview.js`](../../game/drone-preview.js) owns pad-hover, launch, interception/attack, return, pad alignment, descent and recharge. The placement root and pad matrix stay fixed. The separate aircraft root follows the world trajectory correctly under authored quarter turns, with small flight attitude, counter-rotating fans in every phase and bounded fine yaw/pitch. Aircraft diagnostic XYZ is its body pivot; nominal flight Y is path height +9+24.
- [`engine/drone-navigation.js`](../../engine/drone-navigation.js) owns a static 12-unit lattice, nominal additional lift24 and transit lifts48/72/96. Four-connected horizontal edges and explicitly checked vertical edges use conservative swept hull boxes enclosing all body headings, gun poses and rotors. Exact static BVH geometry and fixed defence/pad bounds obstruct flight. Neutral vertical launch/descent uses the narrower authored mechanical envelope. No diagonal corner cutting is permitted.
- The fleet validates each movement segment against current aircraft envelopes. A blocked returning pair replans around the other aircraft; stable ID chooses one upper passing lane while its peer holds. The regression explicitly forces opposing return journeys through a shared corridor and checks both complete their own return.
- [`engine/target-planner.js`](../../engine/target-planner.js) retains one round-robin candidate thinker per frame. Drone preparation/selection/priority and active-burst certification are optional shared hooks. Navigation work is cached between .4-second planning opportunities and skipped through valid bursts. Every weapon still validates current shots each frame.
- [`game/defence-preview.js`](../../game/defence-preview.js) owns the drone controller alongside the existing gun/Arc/missile controllers, with one planner. [`game/app.js`](../../game/app.js) passes the actual moving gun matrix and two authored muzzle sockets to existing pooled shot effects, publishes `dataset.drones` and resets all drone cycles/poses/diagnostics with R. Reset also clears old flashes while preserving their shared time origin. Scene unload disposes navigation, state/rig/target references and callbacks.

The test tuning is horizontal weapon range72 from the aircraft centre, travel speed48, vertical speed32 and nominal additional lift24. These are provisional, not user-set final balance. Existing hitscan muzzle/spark/light and enemy damage/death effects are reused; no renderer, GPU buffer/pass, projectile, audio or new effect was introduced.

Priority starts from threat divided by time to each enemy's actual complete route exit. An uncovered enemy at or below100 HP outside other active defences' current ranges receives a provisional finish preference rising toward2× urgency as HP decreases. Existing target holds, valid-burst stability and incoming missile accounting remain active. Pursuit and loaded rounds promise zero damage. Only an already active burst against a certified route-centred ground actor may contribute conservative remaining-round capacity: every credited future round must precede this lap's exit and pass future range, mechanical pitch and paired-muzzle scenery checks. Unknown, off-centre/banking and displaced poses receive zero mobile forecast. The explicit outward range-edge regression verifies a target leaving72-unit range before the next round receives zero promised damage.

## Focused verification

Fresh final command:

```sh
bun test tests/drone-combat.test.js tests/target-planner.test.js tests/combat.test.js tests/turret-pitch.test.js tests/enhancer-preview.test.js tests/preview-combat-source.test.js
```

**58 tests pass, 88,477 assertions.** The new drone file contains eight checks: a complete settled ten-round burst and cooldown; valid-burst completion after expiry; cooldown/occlusion/death return; exact recharge and R/quarter-turn reuse; one current round after stalls and unreachable-height rejection; conservative range-edge commitments; opposing aircraft return/separation; and120 seconds of the actual A1 scene. Every actual A1 shot checks both rendered muzzle rays, range, aim and single10-HP damage. The long scene checks finite/current body transforms, exact fixed pads, static flight clearance, aircraft separation, reused path arrays, one thinker per frame, both ground/air damage, return/recharge and cleanup. No full suite was run.

The unchanged drone model's six geometry checks also passed during the earlier affected run, including the sampled gun/pad clearance and continuous rotor enclosure. Browser results belong to Lead; these CPU checks do not establish GPU timing or visual acceptance.

### Historical deterministic expectations

The existing archived gun/Arc/silo test had stale exact shot/hit arrays. Engineer first disabled all four new optional planner hooks in memory; outcomes were identical. Engineer then reconstructed the pre-drone planner module **in memory**, removing the new constructor hooks, mobile `capacity`/`commitment` branches and prepare/selected calls, and restoring the exact original `score(target,state)` implementation read before edits. This reconstructed module was imported through a temporary `data:` module; it did not modify project files. It replaced the test scene's planner with the original eligibility/coverage options, reusing current archived geometry, models, stats and the seeded random source232. Each scene ran2400 frames at1/60 second.

Both current and reconstructed pre-drone logic produced:

| Archived scene | Shots by defence | Hits by enemy |
| --- | --- | --- |
| `moss-01` |24 /41 /12 |25 /26 /26 |
| `moss-02` |6 /13 /4 |9 /8 /6 |
| `moss-03` |2 /15 /8 |4 /4 /4 |

These replace the stale arrays in `tests/target-planner.test.js`; all three scenes still kill their three enemies and retain2400 shared thinks and800 thinks per defence. The refreshed expectations do not conceal a drone-induced stationary-weapon change.

## Measured storage and bounded work

The actual A1 graph has **5,412 nodes**, of which **3,387** are statically free. Shared navigation typed storage is **11,016 bytes**. Each aircraft retains **108,300 bytes** of search/path/candidate typed storage; total navigation/planning storage is **227,616 bytes**, plus112 bytes of controller-wide vector scratch and existing rig/weapon storage. These counts exclude JavaScript object/Map overhead and are not total scene memory. No new navigation arrays, matrices, target/event records or path objects are constructed during ordinary updates, replans or shots; fixed typed buffers and existing effect pools are reused.

A final120-second A1 CPU simulation records7200 planner thinks,78 actual hits (34/44 by drone), three launches/returns per drone,124/117 route replans and0/7 held movement frames. Both end in pad hover after killing all three actors. Static navigation records52,827 box queries and2,012,408 BVH node visits over construction and this run. These are bounded scene observations, not an FPS target or GPU speed claim. Browser sampling may differ by frame partitioning while retaining safety and minimum cadence.

Navigation conservatively treats aircraft as a swept sphere enclosed by an axis-aligned box. This can reject physically possible narrow passages. The graph and target motion prediction are for this finite preview, not a full physics/navigation or campaign scheduler. Prediction samples the actual route with a bounded near-term horizon; live safety checks always prevail. Visibility loss or a target outrunning its firing window may shorten a burst. Future upgrade balance, enhancer behaviour, deployment, costs and final targeting weights remain open.
