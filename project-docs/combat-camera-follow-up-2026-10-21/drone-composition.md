# Drone composition and occasional low shots — 21 October 2026

Implemented in `play/drone-camera.js` for the user's two camera requests. The camera now scores projected enemy/participating-defence separation and offers occasional safe lower stations. Existing camera translation, acceleration, jerk, gimbal and zoom limits remain. No assets, renderer resources, combat/economy data or wildlife behaviour changed. The active player was not reloaded.

## Composition

The bounded planner gathers the primary subject, up to seven nearest living enemies within 144 horizontal units of its focus, and up to four defences actually engaging that local encounter. This preserves space for the guns in crowded waves. The existing obstacle cache supplies current posed model AABBs; custom fixtures without rigs have bounded fallback boxes. A dead/stale subject, no subject, repeated gun references and missing current bounds stay finite.

Each candidate projects all eight corners through the same perspective basis, current vertical FOV and actual canvas aspect as `Camera.update()`. It penalizes clipped bounds, silhouette-rectangle overlap, nearby vertically aligned centres and insufficient horizontal spread. The primary subject's pairs carry more weight. Model AABBs are conservative composition proxies, not exact rendered silhouettes; the settled projection score excludes transient pan roll.

A readable view still holds. Persistent poor composition may request a new angle after at least 2.5 seconds of settled low-speed holding, and a composition-only reframe must improve its score by at least 0.08. Current journeys remain committed while useful. Existing 5–8-second timed angle refreshes retain their displacement/angular gate. Low descents may use a nearby angle because the height change itself supplies a different perspective.

The reproducible native A2 wave-4 snapshot uses two Upgrade II guns and unmodified `PLAY_CONFIG`. At 24 seconds, seven nearby enemies and two participating guns were projected from the real posed bounds. The selected angle changed the score from **0.27527 to 0.17614**. Independent production `Camera.vp` projection changed nearby vertically aligned centre pairs from **8 to 6**, and separated the primary/nearest enemy horizontally from approximately zero to **0.23355 NDC**, about 175 pixels on a 1500-pixel-wide view. The entire group's mean horizontal separation need not increase: the policy balances the local action, guns, travel, clipping and visibility instead of promising separation of every actor. The frozen comparison recipe and poses are in [camera-review-poses.json](camera-review-poses.json).

## Low-shot frequency and safety

The first opportunity starts after 24 simulation seconds in a wave. Further opportunities start at least 40 seconds apart. An opportunity can retry for at most 24 seconds when a subject changes or a previously chosen low approach becomes unusable; a successful arrival also keeps the next opportunity at least 24 seconds away. No low candidate is forced when clearance or visibility fails. Short or obstructed waves can therefore remain entirely high.

Normal stations retain path+120/152/184, raised to the existing flyer floor where applicable, with 176–192 horizontal standoff. Low opportunities additionally consider path+40/56: Y64/80 on the normal Y24 path. The lower continuous flight floor is path+32. Candidate distance/separation, static scenery/terrain/water/world bounds, full reserved future airborne lanes, a clear sky column, current posed solids and actor forecasts remain mandatory. Below-normal holding drift also preserves its static sky column at every actual step and checks alternate drift directions against that invariant. Certified transit retains its existing corridor/three-leg route checks.

A finite route-length lease, `max(10, length / 34 * 1.6 + 6)` seconds, replaces the old ten-second commitment that could cancel a valid climb/cruise/descent before arrival. Actual movement still uses the original speed34, acceleration24 and jerk48 limits and swept gates. Useful low approaches can survive a cosmetic anticipation/subject change; unsafe or unreadable ones are replaced. `lowPlans` counts selected low destinations, while `lowShots` counts only actual arrivals at a low destination. Emergency and blocked-view high retreats clear the low-arrival latch without consuming a still-valid pending opportunity.

The final ordinary production witness uses the frozen earned-token mixed A1 wave-4 deployment and cosmetic random sample0.7, without counter priming, subject/pose mutation or combat overrides. It reaches the low station at **29.6 seconds**, Y**82.6908** approaching Y80, and holds/drifts low for **3.083 seconds**. Across the complete 71.808-second, zero-escape wave, **77.953%** of frames remain at normal high altitude; there is **one achieved low shot from three safe low plans**. Minimum Y is81.7859. Exact saved position, orientation, FOV, focus, target, 1776-step recipe and placements are in [camera-review-poses.json](camera-review-poses.json); [native witness log](drone-ordinary-low.log).

## Bird clearance correction

The extended actual A4 low-camera replay initially exposed a real contact at36.25 seconds: `wildlife-bird-3` reached the camera while its smooth emergency climb was still near Y90.3. The old one-second known-flight cache warned too late. The camera-owned `DroneObstacles` instance now analytically forecasts **three seconds**; the shared module and combat Drone retain their one-second default. This reuses the same bounded buffers and analytic bird/route bounds and changes no bird movement.

The exact A4 case now completes at30/60/120Hz with no observed static or posed-actor contact and no blocked movement. Maximum actual steps remain below34/hz. The production-source60Hz replay independently confirms the fix. [Independent safety evidence](camera-review-safety.json) records the old collision, all cadence results and limits; [review closure](REVIEW.md) closes the interrupted-low and bird-contact findings for these checked cases.

The forecast contains known current routes/flight arcs, including intervening extrema. A perched bird's next unchosen destination is unknown, so this evidence is not a universal proof for every future wildlife choice, deployment or cosmetic seed. Physical clearance and useful view take precedence over completing a low shot; aborted opportunities are expected.

## Bounded work and validation

Composition adds **960 bytes of typed storage** and12 fixed reference slots, allocated with the camera and reused. It adds no GPU resources or per-plan object/array construction. There are72 normal station candidates and at most120 during a low opportunity. Candidate composition is bounded by11,520 corner projections and7,920 pair checks, plus the current-view projection. The three-second actor forecast uses the existing scene-owned cache; low drift adds only bounded static-BVH queries.

A local warmed 100-sample native A2 planner comparison measured median0.2116ms/p950.2301ms with composition disabled and median0.2573ms/p950.2686ms enabled, recorded in [drone-checks.log](drone-checks.log). These are synchronous planner measurements on this host, not GPU/full-frame timings or an agreed performance budget; scene queries and host jitter affect the tail. Storage identity checks verify reuse, and the crowded-scene test retains its12-subject bound.

Final affected command:

```sh
bun test tests/play-drone-camera.test.js tests/play-camera-anticipation.test.js tests/play-camera-views.test.js tests/drone-obstacles.test.js
```

**53 affected tests pass, zero fail, with235,793 assertions** across those four files. The checks cover actual projection at tall/normal/wide aspects and both lens ends; stale/dead subjects; stack improvement and route commitment; opening placement; low scheduling and blocked low fallback; water/canopy/future-flight-lane rejection; interrupted low approaches; low drift below an overhang; real low arrival/hold; 30/60/120Hz A1/A2 simulation identity; current A2/A3/A4 flyer/merged scenes; pause, preparation, next-wave rebuilding, smooth travel and the unchanged obstacle/anticipation/view integration. The independent A4 cadence replay extends the specific bird-contact regression at all three rates. No full-suite run or browser/player reload was performed by this specialist; the lead owns actual-renderer visual review.
