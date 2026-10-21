# Smooth drone flight and fan steering

18 October 2026. The user requested smoother movement, a level aircraft body and fan assemblies that tilt to translate and rotate the drone. This supersedes the initial five-degree body lean. The subsequent request adds stronger fan tilt for visual effect and **50% faster movement**. The independently aimed twin gun, flight time, recharge, burst cadence, damage, range and all accepted level layouts remain unchanged.

[Open A1](/game/?inspect&level=moss-01) · [Model review](/tools/drone-review.html) · [Design doc](../design-doc.md#proposed-drone-defence)

## Latest positioning and collision follow-up

The user still finds the movement too reactive and requests predictive interception positions, plus avoidance of other drones and everything solid. The previous station forecast used only `min(2, arrival)` seconds and retained a destination against the current enemy location; this could still produce pursuit rather than occupying useful ground ahead of the enemy. The implemented revision uses the actual complete route at estimated arrival, a useful future firing window and a committed destination/hold policy. A coarse shortlist of twelve stations receives actual rounded-route travel estimates and up to ten future pulse checks. Useful stations are retained; dead targets, unsafe positions, range/pitch loss or a materially more urgent threat release them.

Static terrain/scenery and other drones were already checked. Living enemies, cosmetic wildlife and articulated non-drone defences now use cached current animated envelopes and short predicted movement in drone navigation. The drones avoid those actors; this does not change wildlife into combat actors or add physical pushing, collision damage, weather/effect obstacles or projectile collision mechanics. Engineer (`gpt-6.1-sol/high`) owns a bounded dynamic-obstacle module alongside the main controller Engineer (`gpt-6.1-sol/xhigh`); the independent reviewer remains `gpt-6.1-sol/high`.

The earlier 72/48-speed, 20-degree-fan browser milestone is preserved in [its browser record](browser-motion-milestone.json). Final interception/collision evidence is recorded separately below.

The subsequent same-target requirement is implemented: an enemy leaving range or passing beneath the gun's pitch limits causes the drone to reposition and prefer that living target again. Invalid remaining burst rounds cancel; the five-second cooldown stays anchored to the last actual shot and runs during movement. A fresh burst requires a settled aircraft, current valid aim/range/LOS, a ready weapon and remaining flight time. Station spacing does not promise damage; existing conservative active-burst commitments remain separate.

## Movement and steering

The original controller travelled at full speed immediately, followed hard right-angle grid corners and frequently replaced the selected firing destination. Stopping to fire set velocity to zero immediately. These produced abrupt acceleration and reversals despite collision-safe positions.

The new controller eases acceleration and braking, retains useful attack destinations, and shortens routes only where the swept aircraft hull clears obstacles. Suitable corners use clearance-certified quadratic curves with continuous tangents, anticipatory braking and curvature speed limits. Uncertified corners retain a deliberate stop. Return travel brakes on the existing route before installing the return corridor. Exact zero-speed joins advance correctly, including short segments created by replanning.

| Provisional control setting | Current value |
| --- | ---: |
| Cruise speed | 72 units/second, up from 48 |
| Launch/descent speed | 48 units/second, up from 32 |
| Acceleration / braking | 96 / 120 units/second² |
| Curved-turn acceleration setting | 84 units/second² |
| Body yaw speed / acceleration | 148.5°/second / 405°/second² |
| Fan response rate | 10.5/second |

The 48-unit cap applies to neutral take-off/landing. Other three-dimensional route segments, including clearance manoeuvres, use the 72-unit path-speed cap with acceleration and braking.

All three models have four independent fan housings, each with its existing rotor as a spinning child. Collective tilt represents translational acceleration and braking; differential tangential tilt represents yaw acceleration and braking. Fan vectors ease toward their targets and are capped at a combined pitch/roll cone of 20°, twice the initial limit. Front fan mounts rise one unit to clear the gun; rear mounts, overall heights and footprint are unchanged. Steering begins at six units of lift to clear the pad cabinet. The body remains level throughout. Return alignment also uses differential steering and waits for neutral fans before descent. Rotor spin stays active over the pad. See [mechanical clearance and model counts](../a1-drone-test-2026-10-18/FAN-GIMBALS.md).

## Ownership and bounded resources

Engineer uses gpt-6.1-sol/xhigh for motion/navigation, Artist gpt-6.1-sol/high for the rig/mechanical envelope, and independent Engineer gpt-6.1-sol/high for review and a controlled before/after trace. No effort exceeds Extra High. Lead owns browser integration and shared records.

The 5,412-node A1 navigation graph, route commands and scratch arrays are created once per loaded scene and reused. Graph/planning/motion typed storage totals 2,609,912 bytes, including 1,125,696 curve-command bytes per aircraft. This deliberately bounded storage covers the graph's maximum command count without arbitrary route rejection. It is larger than the previous graph/search-only allocation; no frame-rate improvement is claimed. Shared delta time remains the only clock, with bounded motion substeps and no replay of missed attacks. No shader or effect system was added.

Safety holds and an available upper lane handle tested fleet conflicts; this is not a general crowd/deadlock solver or force-based flight simulator. Conservative clearance can retain a stop where rounding is unsafe. The CPU probes are finite scene observations, separate from browser appearance and GPU review. The dynamic obstacle cache adds6,086 typed bytes for9 actors/43 parts, with no GPU resources. Its current poses, one-second sweeps and time-matched escape intervals are described in [the obstacle contract](OBSTACLES.md).

## Evidence

Final targeted validation:31 motion/combat/obstacle tests pass (291,073 assertions), plus8 source/noncombat lifecycle checks (9,830 assertions). No full suite was run.

The wider-tilt models pass eight checks /3,892 assertions and compile to1,167 quads. Live model inspection confirms level bodies, independent20-degree fan steering, neutral pad housings,27 model lights and no GPU errors. The speed/fan milestone also passed return/recharge, reset/slow motion and A1→A4→A1 cleanup checks.

The final [150-second A1 integration observation](interception-trace.json) runs actual enemy, wildlife and defence controllers at1/60 second with real damage and death-explosion wildlife scares. Wildlife uses its authored deterministic seed; the defence random callback returns0.5. It includes no renderer or particle simulation. Reproduce locally with `bun docs/drone-motion-2026-10-18/trace-interception.js`.

| Final observation | Drone1 | Drone2 |
| --- | ---: | ---: |
| Maximum path speed |72 |72 |
| Body pitch/roll |0 |0 |
| Maximum combined fan tilt |19.40° |19.47° |
| Stationary frames while target moved |441 |1,122 |
| Shots / launches / returns |28 /3 /3 |50 /3 /3 |
| Current dynamic-envelope overlaps |0 |0 |
| Static-envelope overlaps / emergency stops |0 /0 |0 /0 |
| Final phase |Pad hover |Pad hover |

Both ground and airborne enemies receive hits and all three are destroyed. Friendly-aircraft envelope overlaps are zero; at most one defence thinks per frame. Actual rendered body position agrees with controller position within0.000030 units (matrix precision). Reset clears shots, stations and evasions; disposal releases obstacle actors/storage and navigation storage. Arrival estimates are provisional and can shift during avoidance; the trace records their differences rather than claiming exact arrival times.

Independent review also covers both same-target range/underneath repositioning cases and expiry during an escape: no new expired burst, only one return and the full ten-second recharge. The original failing bird escape is retained in [the first integration trace](interception-first-integration.json). Its endpoint was safe but its climb crossed an incoming bird; matching ten short flight/obstacle intervals and rechecking active escapes fixes the observed failure. Other closed findings include stopped escape replanning, blocked-return creeping and requiring actual home arrival before alignment. [Independent review](REVIEW.md) · [Engineering handoff](ENGINEER.md).

Final browser checks and screenshots are in [the browser record](browser-review.json). A1 renders and attacks with level bodies, no console warnings/errors and no light overflow. Return/recharge, R reset and T0.1×/1× checks pass. A1→A4 destroys all138 old scene buffers and leaves no drone navigation/obstacle objects; returning to A1 restores the two aircraft. The preview is left at normal speed, daytime, weather off. The initial abrupt/smoothed comparison remains in [the earlier motion trace](after-trace.json); do not use its old no-damage fixture as proof of current dynamic avoidance. [Saved asset hashes](before-assets.json) and [original model](drone-before.json) preserve the pre-revision state. [Preservation checks](preservation.json) allow only the drone model to change: all16 levels,66 other models and the frozen landscape backup remain intact.

These checks demonstrate the tested scenes and trajectories, not a universal collision proof or frame-rate claim. Unpredictable future wildlife decisions are refreshed next frame; conservative bounds can cause waits or wider detours. No full test suite was run.

![A1 with the revised drones](predictive-flight-a1.png)
