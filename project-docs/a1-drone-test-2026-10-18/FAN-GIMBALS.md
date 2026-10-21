# Level-body drone fan articulation

18 October 2026. Artist assignment: `gpt-6.1-sol` / `high`, chosen for bounded geometry, hierarchy and mechanical clearance work. This is the model portion of the user's request to smooth drone movement, keep the aircraft level and use the fans for movement and turning, followed by stronger visible fan tilt and 50% faster travel. Engineer owns runtime motion and steering; Lead owns integration, shared documentation and browser verification. See the current [motion record](../drone-motion-2026-10-18/README.md).

## Implemented geometry and rig

All three stages now have **12 connected rigid parts**: stationary pad, level flying body, two existing gun joints, four independent fan housings and four spinning rotors. Each complete 8×8×3 open housing is a separate `fan-*` part, with its matching `rotor-*` as a child. The rotor therefore keeps spinning around its fan's local Y normal when that housing tilts.

The 8×8 fan-ring silhouettes, 6×6 open shafts, rotor geometry, batteries, pad, two-unit pad-hover gap, gun, frozen muzzle centres, palette, materials and all nine accent-light clusters per model are retained. Lower chassis sides and dark suspension-arm ends are recessed one cell on each side (X10–14 below Y13). The stronger-tilt follow-up raises only the two front fan assemblies by one unit; the rear pair stays at its accepted height. This small mounting step clears the gun fork at full steering without changing footprint or the overall 14/16/19-unit neutral stage heights. No other static shape changes are made. Armour stays nonemissive and matte; identity emission remains 1 with `castsLight: true`, reflectiveness remains 0, and no texture/effect is added.

| Rotor | Housing / parent of rotor | Housing parent | Shared bind pivot | Spin sign |
| --- | --- | --- | --- | ---: |
| `rotor-front-left` | `fan-front-left` | `drone` | `[5,11.5,6]` | +1 |
| `rotor-front-right` | `fan-front-right` | `drone` | `[19,11.5,6]` | −1 |
| `rotor-rear-left` | `fan-rear-left` | `drone` | `[5,10.5,18]` | −1 |
| `rotor-rear-right` | `fan-rear-right` | `drone` | `[19,10.5,18]` | +1 |

`DRONE_ROTORS` retains `id`, `pivot`, `spin` and adds `gimbal`. Shared authoring limits are `DRONE_MODEL.fanTiltMax = 20π/180` radians and `minimumFanTiltLift = 6`. **The combined vector must satisfy `hypot(pitch, roll) <= fanTiltMax`**, including after mixing collective translation tilt and differential yaw steering. This is not a separate 20° allowance per axis. Every fan can use a different valid vector. Housing yaw stays zero; independent rotor spin is unrestricted.

Keep the body level, and keep fan housings neutral during pad hover and the first six units of lift. The existing 10-unit body-turn and four-unit gun-aim lift constraints remain separate. The gun sockets and their meaning are unchanged.

## Clearance evidence

Let `a = 20π/180`. Every fan-assembly point is contained in the housing's local box, with X/Z offsets ±4 and Y offset ±1.5. For the production `Rz(roll) Rx(pitch)` transform with `hypot(pitch, roll) <= a`:

- Its vertical displacement is at most `1.5 + 4 sqrt(2) a = 3.4746146392`. The raised front pair therefore stays above bind Y **8.0253853608**, strictly higher than the entire gun-yaw fork at Y8. The declared gun-pitch envelope has a conservative Y maximum **7.7207293091**.
- Rear fans clear the complete aiming gun by longitudinal separation: their frontmost Z is conservatively at least `18 - 4 - 1.5a = 13.4764012244`, while the gun/fork's rearward pitch/yaw envelope is at most **13.3500335717**. Thus the lower rear housings do not need to be raised.
- Its horizontal X reach is at most `4 + 1.5a + 2a² = 4.7672927114`. Left assemblies end before X **9.7672927114**; right assemblies start after X **14.2327072886**. The recessed lower chassis occupies X10–14. Tests assert the source geometry assumptions behind these bounds. The taller upgrade batteries receive the sampled exact-cell audit described below.
- At six units of lift, the lowest possible rear-fan point is **13.0253853608**, above the tallest fixed cabinet at Y13. The shared guard therefore changes from five to six. All neutral vertical departure sweeps remain clear.
- A housing is enclosed by a sphere of radius `sqrt(4² + 1.5² + 4²) = 5.8523499554`. The nearest fan-centre spacing is now `sqrt(12² + 1²)`; two such spheres retain **0.3368946681** clearance. This proves housing separation for independently mixed fan tilts as well as synchronized ones.
- Measured from the body's `[12,9,12]` pivot, the largest full 3D enclosing fan bound is now the front pair: `sqrt(7² + 2.5² + 6²) + sqrt(4² + 1.5² + 4²) = 15.4048365426`, below the existing **16.5** navigation sphere for every yaw/steering/spin pose. The horizontal-only bound remains **15.0718944127**. No navigation-hull expansion is needed, and neutral base top remains Y14.
- Rotor radius remains `sqrt(5)` inside the half-width-3 opening, retaining **0.7639320225** radial clearance for every spin angle. The housing and rotor share every gimbal transform, so tilt cannot change that separation.

In addition to those continuous component bounds, oriented-cell separating-axis checks cover **291 compound fan poses**: all three stages, neutral and four tilt magnitudes (5°, 10°, 15°, 20°), each at 24 pitch/roll-vector bearings. Each housing clears the chassis, batteries, both neutral gun joints and fixed pad at the six-unit lift limit. A further **216 simultaneous fan/gun poses** combine cardinal/diagonal 20° fan vectors with gun yaw −15°/0°/+15° and pitch −35°/0°/+10° across all three stages. The existing **210 gun yaw/pitch poses**, neutral vertical departure sweep, source/hierarchy validation and all-zone palette/light checks also pass. These SAT samples supplement the analytic component bounds; they are not a formal continuous SAT proof of battery clearance.

The follow-up first tested 20° with unchanged mounts: it clipped the fine-yawed gun fork. A one-unit rise of every fan cleared the gun but clipped the upgraded rear batteries. Raising only the front pair solves the measured conflicts with a small mounting adjustment. This supersedes the original 10°/five-unit-lift contract. It does not change weapon or endurance values.

## Counts and validation

| Stage | Rigid parts | Occupied cells | Exposed unit faces | Greedy quads | Vertex/index bytes | Accent lights |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Base | 12 | 1,840 | 2,876 | 366 | 73,200 | 9 |
| Upgrade 1 | 12 | 1,952 | 3,004 | 396 | 79,200 | 9 |
| Upgrade 2 | 12 | 2,112 | 3,122 | 405 | 81,000 | 9 |

`bun scripts/compile.js assets/models/drone-defence.json` compiles all three stages to **1,167 quads**. The deterministic generator reproduces the canonical JSON. `bun test tests/drone-model.test.js` passes **eight tests / 3,892 assertions**, covering source and all-zone palette equality, matte/emissive policy, 27 total review lights with no overflow, finite compiled output, nested gimbal articulation, connected parts, all clearance bounds and sampled poses above. No full suite was run.

## Inspection and handoff

The isolated review's **Animate flight / aim** control now shows twice the previous collective fan tilt for forward/side movement and differential tangential tilt for yaw acceleration/braking. The body rotates around Y while pitch/roll stay zero. Pad-hover mode resets all fan housings and body rotation to neutral; rotor spin continues. Review motion is illustrative and separate from the production flight controller. Diagnostics expose each housing/rotor hierarchy, rotations and matrices, the shared tilt cap and the presentation's meaning. Lead completed browser review; [current model capture](../drone-motion-2026-10-18/fan-steering-models.png).

Changed files owned by Artist: `scripts/drone-defence.js`, `assets/models/drone-defence.json`, `shared/drone-model.js`, `tests/drone-model.test.js`, `tools/drone-review.js`, `tools/drone-review.html`, this handoff and the regenerated drone compiled output. No other model or level source was edited by Artist.

Lead's shared-document updates: record the latest movement/yaw request and 12-part rig in `docs/design-doc.md` and its change record; update `docs/drone-model.md` and the motion record for the 20° cap, six-unit lift guard and raised front mounts; update the relevant current paragraphs of the project brief, visual style, tools, team notes and daily diary. Keep this model contract distinct from Engineer's provisional acceleration, braking, steering and targeting tuning. Existing approved combat timings/damage and upgrade/economy open decisions are unchanged.
