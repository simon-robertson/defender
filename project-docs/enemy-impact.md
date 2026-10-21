# Missile impact stagger

**Wounded-enemy stagger TODO, 20 October (queued):** at 50% maximum health or below, enemies should stagger briefly then catch up smoothly to their expected path position. Amount/cadence and bounded recovery remain to prototype; check route traffic, animation clearance and targeting rather than teleporting. This does not restore the withdrawn escape-running/gallop system. No runtime movement change or active playthrough reload. [Current TODO](../TODO.md).

On 18 October the user requested a clear stagger instead of the earlier slight loss of balance. The current response produces a larger, slower lurch, with torso tilt and a brace where the rig permits it. Accepted models, canonical route progress, ordinary gait timing and damage remain unchanged. There is no stun, ragdoll, extra damage or new visual effect.

## Response

`EnemyPreview.takeHit(state, strength, vx, vy, vz)` applies damage before a survivor’s reaction. Existing two-argument hits remain ordinary damage. The incoming horizontal bearing determines the stumble direction; a nearly vertical strike uses the enemy’s forward facing. A minimum 65% push prevents steep missiles and guarded Dog corners from producing an invisible response.

| Setting | Current value |
| --- | ---: |
| Velocity impulse | 32 units/second |
| Minimum steep-impact fraction | 0.65 |
| Critical damping | 4/second |
| Maximum displacement | 3 units |
| Maximum accumulated reaction velocity | 40 units/second |
| Recovery duration | 2 seconds |

With unrestricted open-ground clearance, a full horizontal hit peaks at **2.943 units after 0.25 seconds**, with 1.195 units still displaced at 0.75 seconds. An unrestricted purely downward hit peaks at **1.913 units**, including at Dog corners. This replaces the old Dog maximum of roughly 0.245 units and the old motionless downward corner case. At two seconds the remaining small tail clears to exact neutral. Closed-form critical damping provides one forceful lurch and a smooth recovery without repeated wobble. Repeated hits add velocity continuously within the complete-trajectory bounds; rejection leaves the earlier safe recovery intact.

| Model | Maximum forward pitch / side roll | Body brace |
| --- | --- | --- |
| Dog, safe straight corridor | 8° / 8° | −0.35 units |
| Walker | 10° / 8° | −0.75 units |
| Spider | 10° / 2° | +0.65 units |

Spider pitch is reduced by `1 − 0.5 × abs(local lateral tilt)` on diagonal responses, protecting its folded housings. Its positive brace extends grounded support legs rather than launching the body. Dog adds up to 0.8 units of lift to its recovery swing. The one larger Dog trial, 10° with −0.5 compression, intersected an upper leg and paw at a specific phase; its safe 8° articulation was retained. The much larger displacement supplies the stronger Dog stagger.

If a Dog’s complete two-second recovery corridor reaches a yaw-blended corner, its relative gait remains the accepted pose and the whole actor skids with flat soles. It does not tilt at those tight corners. A forward stumble now makes even downward hits visible there. A repeated hit cannot extend an active straight-corridor tilt into an unsafe corner or switch modes abruptly.

## Feet, targeting and lifecycle

The root retains yaw and local centre `[12,0,12]`; the body tilts around its actual torso pivot. Each gait solves against the canonical route root, with full inverse-body IK and foot counter-rotation. The render root and reported foot positions then receive the same horizontal impact offset. This supported foot skid prevents a larger shove from stretching legs or forcing their narrow joints into one another. Soles remain flat; their complete displaced support area is checked before accepting the hit. There is no corrective widening or displaced landing scheme, and the normal gait remains unchanged after recovery.

`state.x/z` publish the displaced navigation/range centre. `aimX/Y/Z` are the transformed body effect-origin point. `aimVelocityX/Y/Z` include normal travel, push, brace and angular motion; `velocityY` is root brace velocity. Accepted hits refresh derivatives immediately without jumping the pose. Death freezes the last pose and zeros every public velocity and balance rate before the death callback. Reset, route wrap and disposal clear the response. Recovering targets still receive no speculative route-profile damage credit.

Diagnostics retain `impact.active`, `balanceAllowed`, `hits`, `restricted`, offsets, velocities, pitch/roll/bob, brace and rates. No additional public fields were needed; `balanceAllowed` distinguishes torso balancing from the guarded Dog skid.

## Clearance and work bounds

Hit-time clearance certifies the entire two-second recovery corridor, split at route corners and intervals no longer than 0.1 seconds. Analytic spring extrema bound every span. Both body and sole-support envelopes include the horizontal displacement. Sole radius remains below 12 units about the displaced root; the upper body has a conservative 13.5-unit envelope and two extra height units. Ground under the shifted soles must stay dry and at path height. Raised banks, map bounds, scenery and full yaw/pitch/recoil defence bounds remain excluded.

Seven bounded bisection steps can reduce an obstructed response. Missing visibility suppresses it. At most 32 spans × 9 candidates gives 288 footprint queries per hit; no clearance work runs during ordinary frame updates. The existing lazy scene-owned terrain grid, defence list and scratch arrays are reused. There are no new runtime allocations, GPU resources, dependencies or model changes.

## Focused verification

All **15 distinct affected impact checks** are verified. The latest non-phase run passed **12 tests / 1,659 assertions**. The three phase checks each pass **3,024 poses**, giving **9,072 sampled poses** across the final model settings. Walker/Spider passed in the full trial run; after reverting the unsafe Dog angle and moving the future-obstacle test wall to account for the longer horizon, the selected Dog/repeat run passed **2 tests / 39 assertions**. No full project suite was run. The earlier eight unchanged-gait checks belong to the preceding balance pass and were not rerun unnecessarily.

```sh
bun test tests/enemy-impact.test.js
bun test tests/enemy-impact.test.js --test-name-pattern 'rejected repeat|IK \(dog\)'
bun test tests/enemy-impact.test.js --test-name-pattern '^(?!impact phase)'
```

The durable [actual-cell probe](../tests/helpers/enemy-balance-probe.js) samples hit starts 24 through 277 at 11-unit spacing, eight compass directions plus pure down, both turn directions, and 14 inspected poses over each 120-frame response, including the new 0.25-second peak. It verifies link reach, oriented-cell separation, no floor penetration beyond floating-point tolerance, flat soles and foot-position error below 0.0001 units. Sole radius stays below 12 and all geometry below 13.5 about the displaced root. Contact checks subtract the intended skid before testing stance stability.

Walker/Spider check all rigid-part pairs. Dog excludes accepted adjacent joint interfaces and pairs already intersecting in the simultaneous unhit pose; new body/cross-chain interference is still rejected. These are sampled regressions, not a continuous proof over every possible pose. Exact metrics can be reproduced with `bun tests/helpers/enemy-balance-probe.js dog 11`, substituting `walker` or `spider` as required.

Other checks cover visible displacement/recovery thresholds, downward Dog corner motion, analytic aim derivatives, repeated-hit continuity, the full future clearance corridor, shifted terrain support, no per-frame queries, and death/reset/wrap. Lead owns production browser review and the timing controls in [the impact viewer](../tools/enemy-impact-review.html). Earlier `enemy-balance-*-peak.jpg` images show the previous weaker response and are historical.
