# Nearby airborne missile interception — 21 October 2026

Implemented for review in `engine/missile-flight.js`. No browser or active player tab was opened/reloaded. No damage, range, economy, model, flight-rate or effect resource change was made.

## Diagnosis and paired encounters

The old flight did predict, but committed once at 0.9 seconds using an instantaneous 180-unit/s intercept. It omitted the remaining eased turn and acceleration from upward launch momentum. Entering the 22-unit nose radius then cut the engine even while that momentum carried the missile past the point. A straight tangent prediction also became stale through the newly smooth airborne corners.

The paired native fixture loads the real silo, missile and all four flyer meshes. It uses the exact first base socket `[7,7,12]`, production `EnemyPreview` curves/bank/torso velocities, `launchClear`, the production flight controller, and actual nose-to-exposed-face damage. There is no synthetic contact radius or substituted hit decision. The four starting encounters are close crossing, receding, approaching and a banked corner; initial horizontal range is within the base silo's 72 units. Failed admissions retain the loaded round and retry as the real target moves.

| Native encounter set | Before | After |
| --- | --- | --- |
| Four flyers × four encounters at 120 Hz | 2 physical hits / 16 launches; 14 ground impacts | 16 physical hits / 16 launches; zero scenery impacts |
| Four flyers × four encounters at 30/60/120 Hz | Paired baseline above, at 120 Hz | 48 physical hits / 48 launches |
| Slow/fast accepted turn factors, crossing/corner, four flyers at 60 Hz | Not sampled in the paired baseline | 16 physical hits / 16 launches |

Across the 64 final encounters, each launch damages its assigned target exactly once and produces one actual surface impact. There are zero scenery impacts, expired flights, off-map releases, lost targets or passed empty points. Flight takes 1.25–1.40 seconds after launch. Actual launch range never exceeds 64.622 units. Ordinary-factor admission can wait up to 0.70 seconds; the slowest 0.85 factor needs up to 2.933 seconds at a tight corner. This is a real reachability delay with the accepted turn/acceleration limits: ammunition remains loaded during that wait.

Before, the premature cutoff samples range from 129.725 to 179.054 units/s. The fix requires at least 98% of cruise speed and a forward inertial line passing within one world unit of the predicted destination before cutoff. That unit is a guidance condition, not damage or proximity detonation. Some close contacts occur while the motor is still on because the missile has not yet established a safe terminal coast. Once cutoff does occur it still latches; a new regression deliberately turns the target afterward and verifies a real miss with unchanged inertial attitude/velocity.

## Changed guidance and ownership

- Coast attitude anticipates the actual origin at reignition, including the remaining ballistic rise/gravity. Coast duration and momentum remain unchanged.
- Steering compensates sideways launch/turn velocity as well as looking toward the intercept. The existing eased angular acceleration, caps and per-round turn factor still control actual attitude.
- Four bounded refinements account for current velocity and finite acceleration when estimating intercept time. Powered flight refreshes that prediction until safe cutoff; the target identity and lap remain fixed.
- Undisturbed airborne predictions sample their immutable authored curve and calculate its actual yaw/banked torso point. They do not extend a corner tangent. An active hit reaction falls back to the existing complete analytic torso velocity, which includes bank/impact derivatives.
- Admission uses the same flight integration and can end at predicted real enemy contact before a later ground contact. For undisturbed flyers it tests the actual body faces at future route yaw/bank. Ground/impact forecasts retain translated current articulated faces. Actual flight still uses every current enemy part and compares the first nose contact with full-missile scenery/defence clearance.
- A shared local quad-contact routine serves predicted and actual face tests. Existing contact normals, claims, callbacks, orphan destinations and reset/scene ownership remain tested.

The 64-unit/s, 0.50-second boost; 0.40-second coast; 180-unit/s attack; 630-unit/s² acceleration; angular tuning; 22-unit maximum terminal distance; fixed 36-round pool; and 8-second lifetime remain unchanged. There is no braking phase, retargeting, splash, guaranteed damage or obstacle routing.

Admission retains its earlier may-miss policy: a forecast enemy-body hit is an early successful endpoint, not a universal mandatory gate. An earlier forecast terrain/scenery/defence hit rejects the launch; reaching an empty terminal plane, leaving the map, or reaching the forecast horizon without an obstruction can still admit it. In the demonstrated poor close turns, the predicted ground contact rejects the round until the moving target becomes reachable. This change does not claim that every admitted flight must hit.

## Verification and cost

`bun test tests/missile-flight.test.js tests/missile-interception.test.js tests/missile-integration.test.js tests/missile-effects.test.js tests/play-engine.test.js`

**63 tests pass, 5,504 assertions.** This includes all-four-zone integration, exact phase timings, launch/reload/claims, world/defence collision, two-impulse jet/light limits, orphan/death/reset/stall handling, physical near-flyer encounters, exact curve/bank aim forecast versus actual poses, and the active-impact fallback. It also verifies airborne forecast poses within 0.00003 units of the real future torso samples. The final native encounter evidence separately includes all 64 cases, rather than only aim-point arithmetic.

Five retained scratch arrays add **144 bytes of typed CPU payload per flight pool**. No per-step object/array is allocated; target body references reuse the existing part/quad records. Each guidance prediction evaluates one constant-speed intercept quadratic followed by four acceleration-time refinements; an undisturbed flyer uses at most five curve/bank samples. Flight remains bounded at 120-Hz substeps, and launch admission retains its 962-step/lifetime bound and same-time result cache. Admission adds two future body-space endpoint transforms/quad queries per tested segment. No GPU buffer, image, pipeline, light capacity or render pass is added.

The final saved native sample reports a **0.191-ms median cumulative admission time per encounter**, with a **29.945-ms maximum accumulated over 43 retries** spanning a Lantern crossing's 0.70-second wait. The longest wait uses 177 retries over 2.933 seconds. Its 1,052 admission calls total 249.551 ms; the largest individual observed call is 12.767 ms. These are local CPU observations including JIT/scheduling noise, not GPU or whole-game performance claims. A full campaign and visual review are lead-owned; neither is claimed here.

## Evidence and reproduction

- [Encounter harness](missile-encounters.mjs)
- [Frozen pre-fix module](missile-flight-before.mjs), with only its import paths adjusted for this evidence directory
- [Paired 120-Hz baseline](missile-before.json)
- [Final 64 native encounters](missile-after.json)
- [Targeted test output](missile-tests.log)

Run `bun docs/combat-camera-follow-up-2026-10-21/missile-encounters.mjs` for the current 16-case 120-Hz sample. The exported `runEncounter` accepts the frozen baseline `MissileFlightPool` as its fourth argument for a paired run, without changing production source. Its fifth argument permits the bounded test fixture to select an accepted turn-factor extreme before seating.

## Limits and design handoff

The clean native fixtures establish physical interception of these reachable nearby flyers, not universal hit probability. Later hit reactions, route exit/removal, changing defence obstruction and post-cutoff target turns can still cause misses. Airborne admission uses body contact rather than relying on a future wing/rotor pose; this is conservative and can defer a shot. Active-impact and ground forecasts still use constant torso velocity/current articulation. Exact future ordinary flight predictions must track future changes to the shared banking contract; the forecast-versus-actual regression guards the current formula.

The design document's older “one fixed point at reignition” and 120/420 flight table need an amendment: powered predictive guidance now updates until a safe terminal coast, with the already accepted 180/630 attack values. Central design/brief/diary files are lead-owned. Appearance remains for user review; the active player session is untouched.
