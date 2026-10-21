# Drone flight controls audit and correction

18 October 2026. Main Engineer, explicitly reused `gpt-6.1-sol / xhigh` for state, targeting, navigation and collision interactions. Lead owns app inspection, shared records, assets and browser review. Geometry Engineer owns the proven hull/obstacle contracts and straight-sweep helper; the independent reviewer owns the matching sortie probes. No level or model asset changed.

## What was broken

The earlier zero-overlap checks did not demonstrate useful flight. An annotated actual-A1 run at60Hz, with real damage, live wildlife and death scares, reproduced the complaint:

- Drone1 entered launch at t0 but stayed at its pad with a pending avoidance warning for8.4 seconds. The warning could already be clear when its delayed escape finally ran. It first fired at16 seconds and managed only one round before its20-second budget expired.
- A full one-second actor movement union was compared with the drone's current point, even when its intended motion would safely leave that point. The same future union blocked entire global routes. This cancelled targets and encouraged needless replans.
- Always choosing the first upward escape could put the aircraft at Y81/105, requiring another descent before ground targets were within the unchanged gun arc. The old ±16.5 vertical cube exaggerated the problem for a level aircraft.
- A target-invalidating `retargetPending` flag survived `beginReturn`. Return movement interpreted it as a permanent brake. At120Hz the independent baseline held one aircraft motionless for more than101 seconds after all enemies died.
- Short parallel fleet retreats could repeatedly rejoin the same conflict. Priority could change when a neutral launch became ordinary flight. The independent retained-intent fixture exposed this even though the earlier freshly planned head-on test passed.
- Ground wildlife's future reachable disk could enter a fixed defence footprint that its own navigation forbids, causing unexplained pad departures. A tiny residual fan tilt also survived the frame entering descent while its envelope had already switched to neutral.

The [independent baseline](baseline.json), [geometry audit](OBSTACLES.md) and [review](REVIEW.md) preserve the methods and evidence. Baseline opening-sortie Drone1 rounds at30/60/120Hz were0/1/10, with9.7–11.4 seconds of the20-second mission spent avoiding. The baseline also had30Hz current-actor overlap frames. These were correctness and usefulness defects, not accepted finite-scene limitations.

## Final controls

Return now explicitly clears attack-only braking, target/window and commitment state. A minimal regression fails on the old transition and verifies a real moving return reaches its pad after the correction. Actual home XYZ is still required before alignment/descent; no position snap completes a failed path.

`shared/drone.js` consumes the immutable `DRONE_HULL` contract. Base flight remains X/Z ±16.5, with Y−9/+6; neutral base pad travel remains X/Z ±11, Y±5. The continuous fan/gun proof and source-pose tests establish these bounds rather than inferring them from sampled silhouettes. Static, dynamic, fleet, station and target-clearance queries use the same asymmetry. The body's pitch/roll stay exactly zero. Near-neutral fans and gun/body servos are set exactly neutral when descent is admitted, before that rendered frame uses the neutral envelope.

Global route search uses current actors; it does not reserve their entire next-second movement union across a distant path. The complete static route is still certified. Straight path shortening uses exact segment-versus-hull-expanded BVH boxes, removing false collisions in empty corners of a long diagonal's bounding rectangle. Rounded curves retain their conservative complete expanded-box certification. Every actual movement substep retains a live current swept-hull guard.

Each aircraft publishes ten reused0.1-second intended-motion boxes covering its next second. They follow its actual acceleration/braking curve or neutral vertical command. Current motion state and scratch points are restored after forecasting. Live actors are checked over matching time intervals; merely occupying the aircraft's old point later does not cancel safe motion. Intents are refreshed before the planner and after it accepts routes, before physical movement. Launch bins conservatively expand to the steering envelope at the top of departure, for both actor and peer checks.

A pending warning is withdrawn only after the nominal motion is revalidated. A blocked aircraft waiting on its pad does not spend flight endurance before actual launch. A real unsafe approach brakes and selects the shortest certified local escape, with a penalty for unnecessary altitude or loss of useful gun pitch. Neutral pad departures remain vertical. Escape checks include time-matched intermediate actor positions, and are repeated while moving. Existing target preference, useful station holding and actual shot gates remain in force.

Fleet coordination retains station/home reservations and adds a bounded right-of-way agreement. Neutral pad/landing work has priority; stable IDs break ties. Only one aircraft yields. The priority aircraft checks the peer's braking envelope and waits if necessary while the yielding aircraft clears it. A selected passing position must be outside the priority aircraft's remaining intended corridor, preventing repeated short parallel retreats. The agreement survives phase transitions. If the priority aircraft stays at its station, a returning peer replans around its current hull rather than waiting through its full flight budget. No formations or general crowd/physics system is introduced.

The obstacle module receives `setWildlife(wildlife.states, wildlife.defences)`. It removes a future ground-animal overlap only when the entire predicted query intersection is inside a fixed defence exclusion and the current actor is clear. Actual/protruding contacts remain obstacles. Its tighter Dog Y bound follows source mechanics and always includes current posed geometry. No actors are globally ignored and wildlife behaviour is unchanged.

## Productive verification

```sh
bun test tests/drone-combat.test.js tests/drone-motion.test.js tests/drone-obstacles.test.js tests/drone-hull.test.js tests/drone-clearance.test.js
```

Final affected result: **45 tests,436,834 assertions, zero failures**. This is not the full suite. New controls checks require productive opening sorties, useful return progress and reset recovery at30/60/120Hz, not only zero overlaps. Each first sortie fires at least ten actual rounds, first fires within eight seconds of launch, spends less than five seconds avoiding and lands within twelve seconds of return. A further45-second live-wildlife run follows reset. Retained head-on and neutral-launch intents must both make progress without reciprocal escapes, overlaps or emergency stops. Existing timing, same-target range/underneath recovery, corner/station hold, actual rays, recoil-independent damage, lifecycle and fan steering checks remain active.

Matching independent actual-A1 runs use180 seconds, real damage, live wildlife, death scares and deterministic defence random0.5, at the three fixed steps. The [final trace](final.json) records:

| Simulation rate | First-sortie rounds, Drone1 /2 | Drone1 launch→first shot | All enemies dead | Both settled after combat |
| --- | --- | --- | --- | --- |
|30Hz |20 /26 |3.93s |56.30s |80.73s |
|60Hz |21 /27 |3.90s |53.97s |79.65s |
|120Hz |21 /27 |3.90s |51.11s |80.23s |

Drone1 now waits for its initial reserved departure lane **before** launch; its20-second flight duration is unchanged. Opening airborne avoidance falls below0.8 seconds for that aircraft. Current actor/static/fleet overlap frames, emergency stops and actual aircraft-corner enclosure violations are zero in these runs. The retained-intent [fleet scenarios](fleet-final.json) reach both homes in about5.9 seconds head-on,5.8 seconds crossing; a returning peer clears a neutral launch and reaches home in about7.2 seconds. Only one head-on escape occurs. The deliberately targetless launch fixture itself retains its ordinary20-second endurance before landing.

The independent [reset run](reset-final.json) resets enemies/defences at45 and90 seconds while wildlife continues. It remains clear, kills all targets by143.93 seconds and settles by169.65 seconds. The stale-warning injection check withdraws the warning at all three rates with zero escapes and restores the first shot at about1.15 seconds. Lead separately records production-browser flight, damage, returns, recharge, reset, time-control and scene lifecycle observations. Runtime hashes in these evidence records match the tested controller; no later runtime change is planned.

## Inspection, resources and limits

Inspection fields are allocation-free scalar state: `returnReason`, `avoidanceCause`, `avoidanceActorId`, `planningFailure`, `flightAction`, `fleetYieldTo`, `fleetWait` and remembered `yieldOwner`. Return reasons include flight expiry, explicit return and resuming a pad/recharge operation. Avoidance distinguishes an actor trajectory from a fleet conflict. Planning failures distinguish no route, no firing station, no return route and no local escape. Actions expose launch, interception, firing, cooldown, yielding, waiting, evasion, return, alignment, descent and recharge. Reset clears them and reuses the intent storage; unload releases typed buffers and source references.

A1 retains5,412 graph nodes, now3,533 statically free with the proven Y envelope. Navigation/search/motion/candidate and fleet-intent typed storage totals**2,611,352 bytes**: the two60-value intent arrays add960 bytes and the shared braking scratch adds480. Controller vector scratch remains112 bytes. The obstacle cache owns6,086 typed bytes and borrows the existing96-byte wildlife defence cache; the precise straight-sweep helper allocates no storage. No GPU buffer, renderer pass, extra RAF, timer or effect was added. Forecasting and queries reuse fixed scene-bounded buffers; expensive candidate ranking remains on the single shared defence thinker. These figures are storage/work observations, not FPS claims.

Range72, cruise72, launch/descent48, level body,20-degree fan cone and all approved combat/endurance/recharge values are preserved:20 seconds from actual launch excluding return,10 seconds recharge,10HP rounds, ten-round bursts at4 rounds/second and five-second cooldown after the last actual round. Unsafe remaining shots cancel under the existing policy; a valid active burst can finish after endurance expiry. Upgrades, costs and generator interaction remain open.

Safety remains a conservative local forecast with a one-second horizon. It cannot predict a later random wildlife decision before that decision exists, so live swept guards and the emergency fallback remain. Geometry bounds can still cause safe false rejections, including the initial pad wait. They no longer justify accepting a stuck return, repeated aim-breaking escapes or unproductive first sorties. Lead should update the design doc/change record, brief and diary with this corrected implementation and the measured evidence rather than retaining the earlier collision-only acceptance.
