# Reticle-driven Drone camera, 23 October 2026

The player approved implementation after confirming a board-bounded reticle target and an aircraft allowed outside the board. This replaces the automatic director and the earlier click-to-target control. It changes the spectator camera; combat Drone defences retain their gameplay.

Each wave starts near the board centre, looking at the first participating route's entrance. The initial target persists until the player drags either mouse button. A centred reticle marks the exact world anchor. Rotation intersects cached ground/water/bridge surfaces and their raised sides; rays beyond the board clamp to its edge. The gimbal is derived from the same anchor after every movement step, so neither travel nor enemy activity slides it away from the reticle. Clicking alone has no targeting effect.

The aircraft eases toward a **144-unit horizontal orbit**, with a **64-unit protected minimum offset**, rather than flying directly above the target. Slow angular movement is **0.035 rad/s** (about 5 units/s around the settled orbit). Every 0.8 seconds, nearby clockwise/counterclockwise arcs are scored using real projected enemies and static visibility; a material improvement can reverse direction with a four-second hold. Recent weapon impacts contribute modestly. Remote action cannot change the anchor. This is a local visibility preference, not a guarantee that every enemy will fit a view centred on the player's chosen point.

Altitude is provisional: the floor is the greater of **path height + 200** and **highest static geometry + 32**; normal drift spans floor to floor+12. Occupied central starts can raise that floor. The lens stays at 64°. Maximum flight speed remains 68 units/s, acceleration 96 and jerk 384. Simulation-time substeps, swept terrain/water/scenery/live-actor checks and imminent entrance reservations remain. The aircraft has no board-boundary clamp. Its orbit keeps exterior travel local to the bounded anchor.

Pause freezes the exact pose and orbit clock. Settling continues filming; preparation restores overview and clears the manual choice. New waves reacquire an entrance. The viewfinder and reticle are hidden with screenshot mode and inactive Drone views. No new GPU resource/pass is added; old director/framer modules are no longer production dependencies. Their source and tests remain for historical studies.

## Verification

- 63 distinct focused checks pass across camera/input, camera ownership, former anticipation compatibility, combat Drone coexistence, UI, presentation, screenshot/study and static/audio packaging. The main run passed 62; one additional real projection/scenery scoring regression passed separately.
- Seven native frozen study scenes open safely near centre and leave combat state unchanged.
- Native A2/B4/D4 at 30/60/120 Hz retain identical kills, escapes, shot counts and engine steps against camera-off baselines, with swept static/actor clearance, high altitude, finite poses and exact reticle anchor throughout. These runs include manual corner retargeting and no blocked moves.
- Regressions cover board edges/skyward/large mouse deltas, raised dry ground, lower water, bridge tops, exterior orbits, fixed anchors under remote activity, offset recovery, bounded motion, pause, wave resets and disposal.
- Isolated A1 native browser review on port 4308 confirms visible reticle, drag targeting, stable anchor during subsequent travel and exact paused pose. The captured console reports no warnings/errors. [Recorded poses](browser-review.json).
- Local deployment contains 212 files / 121 modules / 16 levels / 66 models / six mono audio files. Static HTTP/package validation checks freshly gathered bytes, MIME types, root/subpath delivery and all wave roster startups.

The active player session was not reloaded. No push/publication. Camera height, distance and feel remain for the player to assess; no whole-frame performance improvement is claimed.

![A1 reticle orbit after manual aiming](a1-reticle-orbit.png)
