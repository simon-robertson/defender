# Campaign Drone engine integration — 23 October 2026

PlayCombat now owns the same DronePreview controller used by the accepted /game/ preview. Drones join the shared round-robin TargetPlanner through the existing prepare/selection/priority/committed-damage callbacks. They retain independent live aim, range and line-of-sight validation. Mobile weapons remain excluded from generator neighbours.

The campaign supplies a variant's stats, firing rule, flightSeconds and rechargeSeconds. The ordinary preview retains its approved base defaults and continues rejecting unassigned upgrades. The delivered campaign profile is base only: 20-second flights, 10-second recharge, ten 10HP hitscan pulses at four pulses/second, five-second post-burst cooldown, 72-unit horizontal range.

The controller is constructed against all finite enemy states so navigation/contact records and candidate storage exist once. Runtime targeting uses the reused activeTargets array. A fixed identity-to-slot Map keeps cached station records stable when that active array compacts after a kill or escape; scheduled/escaped actors cannot become eligible. Aircraft gun matrices and local Drone muzzle sockets pass through PlayEngine.onShot to the renderer/audio owner.

Settling commands aircraft home, preserves safe return/landing, and prevents fresh launches even when a stopped/defeated wave leaves living enemies. Restart/controller replacement writes neutral aircraft poses into the existing world rig pool. Wildlife continues using actual living enemies as threats, and the Drone controller receives the wildlife states and existing ground exclusions for its collision forecasts.

Load/update deployment validation rejects a Drone fleet above the configured four-pad ownership limit before asset fetching or pool mutation. No renderer, shader, GPU pass or viewport image is introduced here; campaign geometry/light pools are separately accounted for by the lead's configured capacity.

## Validation

- Seven new `tests/play-drone-defence.test.js` cases pass: finite spawn/death/escape indexing, real hits and muzzle delivery, settling/recharge/no relaunch, stopped-wave/restart, unassigned tier and fifth-pad rejection. The fixed-tick battle gives two kills/eight pulses/zero escapes identically at 30/60/120 Hz; sampled live actor clearance remains clear.
- Four native A2 aircraft with a stationary gun and Arc all finish their first roundtrip with clear live hulls at 30/60/120 Hz and matching shot/kill/escape outcomes. This native fleet fixture disables critters; the existing A1 native fixture covers live wildlife.
- Spectator camera separation is bounded: aircraft centre is at most path+105 (including evasion), base hull top path+111; spectator centre is at least path+120 with radius2.5, retaining a 6.5-unit vertical gap. No additional camera fleet obstacle is needed for these base timings/hulls.
- All 44 existing Drone combat, motion, obstacle and hull-sweep checks pass, including native A1 ground/air/wildlife flights, safe return and reset at 30/60/120 Hz.
- Existing campaign-engine checks retain their previous behaviour except intentionally stale assertions that Drone is unavailable and the old Zone A light bound; the lead updates these assertions with the changed roster/capacity.
- `git diff --check` passes.

## Resource observations and limits

For a synthetic 12×10 board with ten finite target slots (2,100 navigation nodes), existing controller flight storage measures: 54,768 shared navigation bytes, 592 shared controller scratch bytes, and 480,448 typed bytes per aircraft for its direct candidate/intent/search/motion arrays. The empty-actor obstacle fixture is 184 bytes; real actor and wildlife records add their existing bounded obstacle storage. These figures exclude PoseRig/aim storage and JS objects/identity Maps, and are not whole-scene memory. A1's native fixture has 5,412 nodes, so its per-aircraft route/search allocation is larger. This controller storage scales with the board grid and is bounded by the four-aircraft campaign limit.

A mixed-placement test identified a conservative-envelope mismatch: the original placement checks permitted A2 pad[1,6] next to gun[3,4], but the runtime turret future AABB reaches the pad neutral footprint and prevents launch. This was reported to the placement owner for certification against the same runtime envelope; no collision bound was weakened here. The passing fleet fixture uses clear mixed placements.

There is no GPU timing or browser appearance claim in this handoff. The lead owns final native UI integration, package refresh and the requested local commit. No remote push or active-player reload was performed.
