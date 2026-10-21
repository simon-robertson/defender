# Independent flight-control behavior audit

Final bounded source review is complete with no outstanding actionable correctness blocker. Lead retains live appearance and user acceptance. Earlier failed records below are preserved as historical evidence.

18 October2026. Engineer, `gpt-6.1-sol/high`. Runtime code, models, layouts, shared documentation and browser control are read-only for this reviewer. This directory contains independent finite observation evidence; earlier collision-clearance acceptance does not establish useful flight behavior.

## Reproduction and interpretation

Run `bun docs/drone-controls-audit-2026-10-18/probe.js repeat-final` from the repository root. Use a fresh output label to preserve the historical baseline and final traces. The saved A1 source selects two base drones, two Dogs, one Moth and six wildlife actors. Each run advances the actual enemy, wildlife, defence, planner and articulated rig controllers for180 simulated seconds at30/60/120 Hz. Damage and enemy/death-explosion wildlife scares are active; defence random returns0.5 and wildlife retains its deterministic actor seeds. No renderer, GPU or browser runs. JSON records runtime/source hashes, every shot, phase/target transition, warning, escape, sortie and half-second scene sample.

`probe.js reset-repeat` runs60 Hz and applies the real combat reset at45 and90 seconds. Enemies/defences reset; wildlife and scene clocks continue. Epochs distinguish repeated sortie numbers. This is one bounded reset scenario, not an exhaustive seed/reset matrix. The historical `reset-baseline.json` used enemies-first reset; the final probe uses the real application order, defences first and then enemies. Wildlife is retained in both.

Times are simulated seconds; distance is world units; speed is world units/second; fan angles are degrees. A potential firing opportunity means ideal yaw, reachable pitch, horizontal range and static muzzle sight from the current aircraft position. It does not certify current gun alignment, dynamic clearance, cooldown readiness or an actual shot. Collision counters compare conservative current articulated part AABBs with the declared aircraft envelope; they are not exact solid contact proofs. The geometry Engineer separately audits actual3D envelopes.

`baseline.json` is the first capture. `warning-baseline.json` repeats the same unmodified runtime with warning logging and corrected accounting that stops sortie-return totals at first recharge; the initial recorder included later pad-avoidance return phases in the previous sortie's totals. Launch, shot and first-recharge timestamps agree. `diagnostic.json` contains the120 Hz return flags; `thirty.json` identifies the30 Hz overlap actor. No FPS or general collision guarantee is claimed.

## Rejected baseline findings

| Initial sortie / result |30 Hz |60 Hz |120 Hz |
| --- | ---: | ---: | ---: |
| Drone1 first shot (seconds from initial launch) |none |16.00 |17.47 |
| Drone1 rounds in first sortie |0 |1 |10 |
| Drone1 flight time evading or waiting to evade (seconds) |9.73 |11.38 |9.78 |
| All enemies destroyed (seconds) |97.60 |121.03 |77.94 |
| Both aircraft settled after combat (seconds) |132.30 |145.38 |not by180 |
| Measured current actor-envelope overlap frames |24 |0 |0 |

1. **Return deadlock:** at120 Hz, drone2 begins its second return at78.5583 seconds from `[180,57.0007626,252]`. It then travels zero units through180 seconds. At79.0083 its return path has three segments and213.287 units remaining, but `retargetPending=true`, `returnPlanning=false`, `wantEvade=false`, `blocked=false` and speed0. The movement stop condition applies the old attack-retarget flag during return. All enemies are already dead. This is a lifecycle correctness bug, independent of collision tuning.

2. **Stale avoidance causes purposeless takeoff:** initial drone1 gets a future-only warning for Dog1 at time0 while its current pose is clear. The warning remains latched while the aircraft stays at its pad atY33 for about8.4 seconds, with its20-second flight clock running. At8.4333 seconds the escape finally succeeds and climbs toY81 even though both current and one-second future checks are already clear and report no blocker. This repeats at all three rates. At60 Hz another escape at17.2667 seconds similarly starts after the threat has vanished. The pointless warning wait and escape consume useful flight time.

3. **The first returns are budget expiry, not a shorter timer:** drone1 returns at20.0 seconds at30/60 Hz and20.0083 at120 Hz. Drone2 sometimes finishes a valid active burst beyond20 seconds, as approved. The user sees apparently early returns because travel/avoidance leave little useful firing time; the first launch phase also starts the clock while still motionless on the pad. Launch admission and pending-warning semantics require correction without changing the approved20-second value.

4. **30 Hz safety regression:** drone2 has24 current declared-envelope/part-AABB overlaps with bird3 beginning31.4667 seconds while returning/evading at `[375.46,81,228]`. No emergency stop is counted. Physical3D contact and prediction conservatism require the geometry review; the earlier clean60 Hz fixture did not cover this case.

5. **Reset differs from fresh load:** with R at45/90 seconds,60 Hz still has one living enemy at180 seconds, no measured actor/fleet/static overlaps, and23 drone2 escape starts. Initial takeoff is not an adequate lifecycle sample; existing wildlife flight phase matters.

The first three concrete causes were sent directly to Lead and the controller Engineer. The initial Dog warning and bird overlap were sent to the geometry Engineer. Final review remains pending corrections and matching behavior/actual3D-clearance repeats. Passing zero-overlap counters alone will not close this audit, and no blanket obstacle exclusion or arbitrary envelope shrink is accepted as a correction.


Geometry review confirms the initial Dog1 current AABB is `[75,24,197,94,38,211]`, with6 world units ofZ separation from the neutral drone box `[97,28,217,119,38,239]`. The unrestricted rotation forecast expands to `[65.81,13.81,185.81,114.19,50.19,222.19]`, inventing additional space on multiple axes and causing the initial warning. Geometry Engineer is checking the complete next-second allowed poses before changing this bound. Reducing only flight vertical extent cannot fix this neutral-pad warning.


## Independent geometry verification

`geometry-probe.js` transforms actual occupied-cell corners with the production `PoseRig` for all three model stages, eight aircraft headings, sixteen collective/differential fan patterns at the20-degree compound limit, nine gun yaw/pitch endpoint combinations and varying rotor phase. It checks3,456 poses /24,330,240 corner transforms independently of navigation's box construction. Results in `geometry.json`: maximum horizontal radius15.06831<16.5; lowest point−8.83419>−9; highest base point5.83547<6, upgrade1=7 and upgrade2=10. No enclosure violations occur. The geometry Engineer's continuous fan/gun extrema bound intermediate poses; finite sampling alone is not a continuous proof.

The final live-sortie recorder also samples actual moving model corners at10 Hz against the neutral/full hull contract, so a small model enclosure cannot silently pass merely because controller centres remain apart. Revised navigation keeps the16.5-unit horizontal enclosure and uses source-derived−9/+6 vertical bounds for the level base aircraft. This is not an indiscriminate scale reduction or permission to ignore any actor class. Models, weapon timing and level layouts remain unchanged.

A pending-warning revalidation check, accurate R order, asymmetric overlap checks and independent head-on/diagonal-crossing/neutral-launch fleet fixtures are prepared. These preparation notes describe the checkpoint before the final repeat below.


## First controller candidate — not final

The first matching candidate improves drone1's opening sortie to20/21/21 rounds at30/60/120 Hz, with roughly0.8/0.73/0.68 seconds of avoidance. Its launch now starts around8.43 seconds after waiting safely at the pad, so the20-second budget is no longer spent during that initial admission delay. The stale return flag is cleared. Current actor/static/fleet envelope counters are clear, but six to eight later pad avoidance departures remain in the recorded runs while the ground-navigation forecast correction is pending. `candidate.json` is explicitly a checkpoint, not accepted final behavior.

The actual moving-corner check exposed a small transition mismatch at30 Hz: residual fan tilt below0.001 radians was allowed into `descend`, while the already-written pose retained corners up to0.00094 units outside the exact neutral half-width11. The phase changed after the pose write. No contact was observed from this discrepancy, but the declared neutral hull must actually contain the displayed pose. Final probing now checks every phase transition as well as10 Hz samples.

Independent adversarial retained-intent fixtures expose a fleet livelock missed by the existing route-generated test. In `fleet-candidate.json`, at all three rates the head-on winner remains stationary for30 seconds while the lower-priority aircraft repeatedly takes short escapes (about38–43) and travels450–533 units without arriving. A neutral launch followed by its transition to ordinary airborne priority also loops. The diagonal crossing succeeds in about5.8 seconds with one yielding aircraft and no overlap. These fixtures intentionally install two existing straight return commands before a dynamic obstruction is resolved; their endpoints, models and static clearance are valid, and the controller must resolve the conflicting motion instead of merely keeping it collision-free. No runtime source or production level is edited.

The livelock and neutral transition pose mismatch were sent to the controller Engineer. Shortest escapes certified only against a waiting peer's braking position can remain inside that peer's intended travel corridor, then immediately re-enter conflict on resume. Final fleet acceptance remains held pending useful progress and actual clearance together.


## Final independent repeat

All three rates now show useful sorties and complete returns, with the approved model/timing/layout data retained:

| Final A1 measurement |30 Hz |60 Hz |120 Hz |
| --- | ---: | ---: | ---: |
| Drone1 opening rounds (baseline0/1/10) |20 |21 |21 |
| Drone1 opening avoidance/wait seconds during flight |0.80 |0.73 |0.68 |
| All enemies destroyed (simulated seconds) |56.30 |53.97 |51.11 |
| Both aircraft settled after combat (seconds) |80.73 |79.65 |80.23 |
| Current actor / static / friendly envelope overlaps |0 /0 /0 |0 /0 /0 |0 /0 /0 |
| Emergency stops / actual pose enclosure violations |0 /0 |0 /0 |0 /0 |

`final.json` retains every sortie's launch, first/last shot, return reason/time, recharge and travel/idle/opportunity totals. Drone1 now waits at the pad until a safe departure around8.43 seconds, then begins its20-second clock; the initial waiting time is not charged as flight. The first return still occurs on the approved20-second expiry, with a valid active burst allowed to finish. Nearby enemies do not suspend that explicit endurance rule. Weapon cooldown remains five seconds after the last actual shot; recharge remains ten seconds actually on the pad. One30 Hz in-combat bird avoidance pauses recharge, correctly extending elapsed wall-clock completion without changing its assigned recharge value.

The initial120 Hz return deadlock is gone. The final scene has no avoidance departures after all enemies are dead, and both aircraft remain settled through180 seconds. Current-body vertical, actual centre transform and fan articulation are checked; about68.12million moving occupied-cell corner samples across the three rates, including every phase change, remain inside the validated neutral/full hulls. The neutral-descent residual tilt discrepancy is closed by writing the exact neutral pose when admitting descent.

`reset-final.json` follows the real application order, defences before enemies, at45/90 seconds while wildlife and scene clocks continue. It clears the final roster at143.93 seconds and settles both aircraft by169.65 seconds, with zero measured actor/static/fleet overlaps, emergencies or pose-enclosure violations. This improves the historical enemies-first reset baseline, which still had a living enemy at180 seconds; the order difference is disclosed rather than presented as a perfectly controlled comparison.

`fleet-final.json` contains nine independent retained-intent cases at30/60/120 Hz. All head-on cases finish both own-pad returns by5.90 seconds with exactly one escaping aircraft; diagonal crossings finish by5.80 seconds; the return blocked by a prioritized neutral launch finishes by7.24 seconds. The launch fixture independently uses its20-second allowance and lands around20.97 seconds. There are zero overlaps, emergency stops or reciprocal evasion frames. Brief simultaneous braking while the lower-priority aircraft starts clearing the corridor is permitted; it no longer becomes a30-second wait. The yield agreement survives launch-to-flight priority changes, and a yield endpoint clears the other aircraft's remaining intended corridor.

`warning-withdrawal.json` separately injects an obsolete warning into a clear real controller with a living target. At all three rates the flag clears, no escape is triggered, a useful normal launch occurs and the first actual round fires at about1.15 seconds. A point-clear escape during real combat is not automatically stale: the intended moving trajectory may still intersect an incoming actor. Final coordination checks the actual planned trajectory, not only the stationary starting point.

## Safety and scope assessment

Source review confirms that terrain/scenery, solid defences, friendly aircraft, living enemies and wildlife remain collision sources. Straight static sweeps now use slab intersection against obstacle boxes expanded by the proved aircraft extents; this removes unused diagonal bounding-rectangle corners without skipping the swept solid. Curve certification remains conservative. The global route search uses current actor occupancy, while reused ten-by0.1-second intent bins check anticipated movement before and after planner route selection. Every physical movement step retains current static and actor checks.

The aircraft's asymmetric vertical bounds follow actual level-body/fan/gun geometry. The Dog-only height cap is source-derived and unions actual posed parts; unknown/grown hierarchies retain conservative fallback. Ground wildlife is not excluded: only forecast intersection wholly inside its existing fixed-defence navigation exclusion can be rejected as unreachable, and any current actor overlap or protruding forecast region still blocks. This directly addresses impossible pad intrusions while preserving all actor classes and current contact guards. The borrowed exclusion cache is released with scene ownership. No obstacle-ignoring shortcut, blanket size scaling, weapon/endurance retune, model change or level change was used to obtain the result.

The reviewer ran45 focused checks across combat, motion, obstacle, hull and straight-clearance files: all pass,436,834 assertions. `review.json` summarizes results, exact commands and runtime hashes, including `engine/drone-clearance.js`. Final stored hashes match the files reviewed. Failed `baseline*`, `candidate*`, `diagnostic*`, `thirty*` and `fleet-candidate.json` records remain separate from final evidence. No full suite or browser control was performed.

No outstanding actionable correctness blocker remains in these final finite fixtures. This establishes improved useful engagement and3D clearance for the tested scene/rates/reset schedule and deliberately conflicting fleet commands. It is not a proof of every future scene, random disturbance, frame interval, fleet size or mechanical pose; the continuous enclosure derivations complement the sampled transforms. Collision volumes remain conservative, exact balance is provisional, and no FPS/GPU-performance claim is made. Lead owns browser motion/readability and the user's final acceptance.
