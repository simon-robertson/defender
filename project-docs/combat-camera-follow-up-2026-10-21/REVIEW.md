# Independent review — missile guidance and deployment order

21 October 2026. Read-only source review; no production source or active browser was changed. No blocking correctness finding in the reviewed changes.

## Missile guidance

Reviewed the final `engine/missile-flight.js` against the frozen pre-fix module, the new interception regressions, changed flight regressions and [specialist report](missile-interception.md).

- Future aim and body-local transforms match `EnemyPreview`'s root-centre yaw, body pivot and bounded bank. Active impact reactions select the velocity fallback. Independent inverse-transform sampling checked 128 actual future body-bounds corners across all four flyers and four forecast times: maximum local-coordinate discrepancy **0.000011809 units**, below the existing 0.00003-unit pose tolerance.
- Route forecasts offset the current route distance by forecast time; the live substep offset refers back from the already-finalized current target pose. Future face contact is used for launch clearance only; actual damage still tests every current articulated part and compares nose contact against scenery/defence contact.
- Powered aim refresh does not change target identity/lap. Terminal cutoff remains a latch; its new speed/forward-line conditions prevent cutting off while launch momentum still carries the round across the destination. After cutoff, attitude and velocity remain inertial. Death preserves an independent final destination without damage or retargeting; reset, invalidation, stalls and expiry retain bounded release paths.
- Four prediction refinements, 962 admission steps, 123 per-frame flight steps and the 36-slot pool remain explicit bounds. The five retained scratch arrays total **144 bytes**. Their storage is reused; no new GPU resource or effect capacity is introduced. Existing same-time admission caching and defence-query `finally` cleanup remain intact.

The saved [64-case evidence](missile-after.json) contains 64 assigned-target hits, exactly one impact per case and zero collision/expiry/off-map/lost-target/passed-point failures. Maximum launch distance is 64.622 units; the slowest accepted turn factor can wait 2.933 seconds for a clear reachable launch. These are controlled nearby encounters, not universal hit or whole-campaign performance claims. Body-only future admission is conservative; future wing poses, impact motion and target removal remain the documented limits.

## Deployment order

Reviewed `play/roster-order.js`, `play/roster.js`, `play/session.js`, their tests and the `commitArrangement`/`placeAt` call path in `play/app.js`.

`RosterGroups.sync` and `nextUnplaced` use the same family traversal. Family order matches the displayed groups; within-family ownership order and original unit identities remain intact. Selection starts after the placed row, skips deployed units, wraps once and returns null when all units are deployed. Empty rosters, unknown starting IDs, recalled units, legacy gun units and mixed purchase order are covered. Selection follows the successfully adopted session; failed placement validation does not advance it. Grouping allocates only during ordinary UI/deployment work, outside combat simulation.

## Fresh verification

```sh
bun test tests/missile-interception.test.js tests/missile-flight.test.js tests/play-session.test.js tests/play-roster.test.js
```

**57 passed, 0 failed, 4,001 assertions.** This independently rechecks flight timing, claims, orphan/terminal behavior, surface normals, defence obstruction, pool limits, real nearby flyer hits at 30/60/120 Hz, grouped DOM order/focus preservation, deployment wrapping and session lifecycle.

No browser/GPU timing, appearance acceptance or full-campaign balance result is inferred from this review.

## Camera follow-up review

Reviewed the low-opportunity/composition changes in `play/drone-camera.js`, the relevant new tests and saved [camera witnesses](camera-review-poses.json). One actionable lifecycle finding was reproduced and fixed by the camera owner: an interrupted low approach could complete its substituted high emergency/retreat route and incorrectly increment `lowShots`. Both high-retreat paths now clear low arrival intent without consuming the pending opportunity; the arrival latch additionally requires a real low goal and pose. The new regression completes both substitute routes and separately rejects the old stale-flag state.

An independent ordinary A4 wave-4 replay also reproduced a real bird-camera hull overlap at 36.25 seconds (frame 2,175). The camera left a low hold near Y82.8 and climbed through Y90.3 into `wildlife-bird-3`'s crossing body; stopping after physical encroachment could not undo the overlap. This was reported immediately. The owner now gives only the camera-owned analytic obstacle cache a three-second horizon, allowing the bounded climb to start early; the combat Drone's shared default remains one second. Low holding drift and its alternative directions additionally retain a static clear sky column.

The exact previously failing A4 scene completes at 30/60/120 Hz with zero actual actor/static contacts and zero blocked moves; each replay achieves two genuine low arrivals. Maximum per-frame travel remains below `34/hz`, with no teleport. A fresh 60-Hz replay against the final production class, with no camera-instance override, reproduces the same clean outcome. [Independent safety/cadence evidence](camera-review-safety.json) retains the original failure and corrected bounds. **No unresolved blocker remains in the independently reviewed cases.** The owner's broader replay suite remains separate; these finite cases do not prove universal dynamic navigation safety.

- Low filming destinations retain complete static, water, future-air-lane and open-sky-column checks. Direct and three-leg routes remain certified; every actual eased step still passes the live swept-hull gate. Low holding drift also validates its static sky column. Returning from a low station keeps the lower safety floor until the camera continuously climbs back into its normal high profile.
- Normal station layers and airborne floors remain high. Low opportunities have bounded simulation-clock windows and route-length-based approach leases; actual low arrival, rather than merely planning a low candidate, closes the opportunity. The unprimed production witnesses separately record low arrival height/hold and a majority of time high, so they do not rely on the corrected counter alone.
- Composition uses up to twelve retained live model envelopes, eight AABB corners each, with at most 120 station candidates and 66 subject pairs per candidate. The new typed payload is 960 bytes and is reused. The 2.5-second settled hold, material-improvement margin and committed route lease resist repeated reframing. This scores hypothetical settled, focus-facing shots with the production Camera perspective/FOV/aspect; smoothed current gimbal orientation and small cosmetic roll may temporarily differ.
- Pause leaves the simulation-derived camera clock, movement and opportunity lifetime frozen. Leaving clears composition actor references; entering a same-level next wave rebuilds obstacle references against its new enemy controller, and bind/dispose release the scene caches.

Fresh bounded review checks, deliberately avoiding the owner's full replay sweep:

```sh
bun test tests/play-drone-camera.test.js -t 'low holding drift|interrupting a low|composition projects|drone lifecycle|same-level next wave|occasional clock'
```

**Six passed, zero failed, 562 assertions.** These cover Camera-VP projection at wide/tall/narrow aspects, pause/lifecycle release, next-wave reference replacement, safe low windows/water/future-lane rejection, both interrupted-approach cases and canopy-safe low drift. The saved production screenshot was inspected; final appearance acceptance and the owner's broader native replay remain separate evidence.

## Lead integration follow-up

The lead's sixteen-file core run reports 159 passes, one floating-point assertion failure and three known historical exclusions. Changed missile launch timing made an exact one-second subtraction evaluate to `0.9999999999999999` in `enhancer-integration.test.js`. The lead changed only that assertion to `toBeCloseTo(...,12)`, retaining the actual one-second requirement; its three focused tests then pass. This test correction changes no runtime behavior or combat statistic. No redundant broad core rerun was requested.
