# Drone collision geometry and productive-flight audit

18 October 2026. Engineer reused with `gpt-6.1-sol/high` for the focused geometric audit. Lead owns integration and shared design records; the main Engineer owns navigation/controller changes and the independent reviewer owns sortie evidence. This report distinguishes geometric precision from useful combat behaviour. Zero overlaps against inflated volumes did not establish satisfactory flight.

## Baseline diagnosis and measurements

Read-only baseline: actual A1 at 60 Hz for 120 seconds, actual enemies/wildlife, real damage and death-explosion scares, defence random callback 0.5, no renderer. Once per second, test every one of the 3,387 old statically free navigation nodes against the same one-second dynamic forecasts. Also test every actual airborne aircraft position each frame. Change only the tested aircraft Y bounds from ±16.5 to [−9,+6], preserving X/Z ±16.5 and all obstacle forecasts.

| Measurement | Old cube | Proven asymmetric hull |
| --- | ---: | ---: |
| Dynamic blocks among 406,440 sampled node positions | 14,741 | 12,003 |
| Static free nodes among 5,412 possible positions | 3,387 | 3,533 |
| Drone 2 future-blocked frames at actual positions | 279 | 102 |
| Drone 1 future-blocked frames at actual positions | 67 | 67 |

The 2,738 eliminated candidate blocks all came from birds above/below the aircraft. Drone 2's 177 eliminated actual-position warnings comprised 42 Dog, 13 Moth and 122 bird-3 frames. These are geometric false rejections: the tighter, continuously proven aircraft hull clears the **same** conservative obstacle forecast. They are not claims that every remaining future block represents eventual contact.

Actual versus generic full-angle model heights during this baseline:

| Actor | Current posed world Y over the run | Generic future-articulation world Y, before route/impact expansion |
| --- | --- | --- |
| Either Dog | 23.999998–38 | 13.811458–50.188542 |
| Moth | 59.903582–71.476583 | 44.610801–75.389199 |
| Moss bird body/wing envelope | Current height at most 6.771995 | Existing full permitted-wing height 6.828437 |

The Dog forecast reserves 36.377 vertical units for a currently 14-unit-tall animal. The Moth's unrestricted rotation sphere reserves 30.778 units where observed current poses are at most 9.307 units tall. Bird silhouette inflation is small; much of the bird problem is the aircraft's inflated vertical extent and a whole-window movement union. Observed model maxima alone are **not** safe future caps.

At the initial A1 pad warning, Dog 1 is at [84,23,204], with current part AABB [75,24,197]–[94,38,211]. Drone 1's neutral box is [97,28,217]–[119,38,239], leaving a six-unit current Z gap. The generic Dog forecast [65.811,13.811,185.811]–[114.189,50.189,222.189] intersects it. Shrinking the airborne aircraft's Y does not fix that neutral warning: neutral geometry is unchanged. Warning invalidation and time-matched departure checks are controller responsibilities; this module does not disable genuine collision checks.

## Continuous aircraft hull proof and implemented contract

`shared/drone-model.js` exports immutable `DRONE_HULL`: X/Z radius 16.5, below 9, above 6 for base. Upgrade upper bounds are 7 and 10; upgrade combat remains unassigned. The existing **base** neutral departure remains X/Z ±11, Y ±5. Taller upgrade neutral bounds are not implied by the base neutral contract.

The body stays level, so body yaw and gun fine yaw preserve world Y. For each complete fan assembly, local housing offsets satisfy X/Z ±4 and Y ±1.5. Rotor spin remains inside that box. With compound fan angles satisfying `hypot(pitch, roll) <= a = 20π/180`, the production `Rz(roll) Rx(pitch)` transform gives `|dy| <= 1.5 + 4(|pitch|+|roll|) <= 1.5 + 4√2 a = 3.4746146392`. The raised front mounts therefore reach at most bind Y14.9746146392, or 5.9746146392 above the body pivot at Y9. The rear fans are lower.

The gun-pitch box has Y offsets ±1 and Z offsets −7…3 about [12,5,9]. Its lowest permitted corner is at −35°: `5 − cos35° − 7sin35° = 0.1658129013`, giving 8.8341870987 units below the body pivot. The derivative of `−cos(t)−7sin(t)` is negative throughout 0…35°, so an interior pitch cannot lower it further. The positive 10° endpoint's alternative lower corner remains higher. Gun upper bounds remain below Y8; the fork is within Y5…8. Authored body tops are Y14/Y16/Y19. Consequently [−9,+6], [−9,+7] and [−9,+10] enclose their respective complete airborne variants continuously. X/Z 16.5 is retained.

The focused hull tests validate the source-box assumptions, continuous inequalities, 1,944 compound part-box transforms across the three variants and unchanged base neutral geometry. The independent reviewer separately checks actual occupied corners using production `PoseRig`.

## Dog-only future Y refinement

Lead approved a sound Dog-specific refinement, leaving every other enemy's forecast unchanged. `engine/drone-obstacles.js` derives the bound once from the **loaded source geometry**, current Dog gait settings and the existing eight-degree pitch/roll contract. It is not a hard-coded observed height or a use of the older `enemyImpactHeight` joint-ball estimate.

For the current source, body pivot Y9 and body-local |X|≤5, |Z|≤10, Y≤6 give body top ≤`9+6+15sin8° = 17.0875965144` above the nominal root. Hip offsets satisfy |X|≤5.5, |Z|≤4.5, giving hip top ≤`9+10sin8° = 10.3917310096`. A knee is at most one four-unit upper link above its hip. Every shin corner is at most `sqrt(3²+1.5²+1.5²) = sqrt(13.5)` from the knee. Therefore its top is at most `18.0659656238`. Upper-part reach gives a smaller bound. Flat paw contacts use their source Y extent plus the existing 1.2-unit swing lift and 0.8-unit brace allowance, also lower than this bound. The same inequalities give a conservative lower bound −0.0659656238. Root bob is nonpositive, down to −0.35.

At A1's ground Y24 and crouch 1, the base future geometry therefore occupies Y22.584034–41.065966, replacing Y13.811458–50.188542. Route/impact forecast expansion remains active. Bounds are anchored to the actor's configured ground height and crouch, rather than assuming world ground zero. Current posed bounds are always unioned back in. All existing root displacement, impact/bob forecast padding, separate entrance-wrap regions, dead removal and time-matched queries remain intact. A changed lower-part size enlarges the derived bound; an unrecognised hierarchy disables the special cap and retains the generic conservative fallback.

The contract test exercises 1,728 legal posed cases across eight gait phases, eight horizontal hit directions plus a downward hit, full recovery, eight-degree pitch/roll extrema, brace 1 and displacement above 2.9. It independently transforms occupied voxel corners, checks the analytic range and current-envelope union, and verifies configured geometry growth and unknown-hierarchy fallback. Samples supplement the geometric derivation rather than defining its limits.

## Path sweep empty corners

A separate read-only static A1 experiment compares the same proven X/Z16.5, below9/above6 aircraft box swept along straight lines. Starts are both home-column tops at Y57; destinations are in-bounds diagonal navigation candidates differing by at least 24 units in both X and Z. All existing static BVH leaves and fixed defence boxes remain obstacles.

Among 7,072 queries, the enclosing rectangle rejects 6,696, while a segment intersection against the exact Minkowski-expanded obstacle boxes rejects 2,346. Thus **4,350** rectangle rejections come from empty swept-box corners. Example: [108,57,228]→[300,57,192]. This does not establish that every rejected route candidate should be selected. It establishes that a full bounding rectangle is much coarser than the actual straight swept box.

Lead approved a pure helper for this refinement: `engine/drone-clearance.js` exports `sweptDroneBoxIntersects(bounds, offset, ax, ay, az, bx, by, bz, radius, below, above)`. It performs allocation-free expanded-box slab intersection for straight segments, with the existing 1e−6 contact tolerance. It handles zero-length/reversed segments, packed AABB offsets and thin obstacles without sampling. Quadratic turns still require their own certified curve envelope/subdivision; replacing a curved corridor with its endpoint chord would be unsafe. The main Engineer owns navigation integration and productive-flight evidence; this helper does not itself change route selection.

## Ground wildlife and impossible pad warnings

The existing `WildlifePreview.defences` cache forbids every ground animal's **complete** envelope from the fixed defence volumes during navigation/edge clearance, including the authored stationary drone/pad envelope. The previous unconstrained one-second reachable disk could enter those same forbidden volumes and report a future collision with a parked drone even after combat ended.

Lead approved using that existing contract directly. `setWildlife(states, groundExclusions)` optionally borrows `wildlife.defences` once for the loaded scene. For a future ground query, intersect the aircraft query volume with the predicted animal volume. Only if that **entire intersection** lies inside one fixed forbidden volume, and the current animal envelope does not overlap the query, is the forecast intersection impossible and omitted. Any protruding predicted region remains blocked. Current queries are unchanged, and even a malformed actor currently inside an exclusion still blocks. The same rule handles a launch column: only the low intersection with the animal's reachable height needs to be contained in the forbidden volume, not the whole aircraft's upward corridor.

This is independent of future random destination selection: every permitted ground route obeys the existing defence exclusions. It does not ignore critters generally, alter their navigation or assume an unproved fixed route through a later scare. Missing exclusion data conservatively retains the original reachable disk. Bounds/capacity are checked on binding. The borrowed cache remains immutable and is released on disposal; it adds no new allocation. A1 borrows 96 bytes already owned by wildlife.

## API, resources, validation and limits

Obstacle point/segment queries accept explicit optional final `below, above`; their existing defaults remain symmetric cubes for compatibility. `clearTimedSegment` accepts an optional final `above`, defaulting to its existing vertical half-height, so callers can pass below9/above6 directly or shift the segment centre down 1.5 and use half-height7.5. Neutral 11/5 calls retain their existing interpretation. All query arrays remain reused. Dog proof records add bounded scene-only scalar metadata; typed obstacle storage remains 6,086 bytes in A1, plus its borrowed reference to the existing 96-byte wildlife defence cache. No models, layouts, shaders, GPU allocations, wildlife behaviour or combat timings change.

`bun test tests/drone-hull.test.js tests/drone-obstacles.test.js tests/drone-clearance.test.js`: **24 tests pass, 35,431 assertions**. This includes impossible/protruding/current ground intersections and borrowed-cache teardown, plus exact straight-sweep contacts. It is the owned geometry/query suite, not final integrated sortie validation or a full test suite. The main Engineer and independent reviewer must compare useful engagement, time spent avoiding, warning causes, returns and lifecycle behaviour across frame rates. Later unpredictable wildlife decisions still require refreshed local safety checks. Moth/other enemy shape refinement remains deferred until separately proven.
