# Walker and Spider

## Current runtime integration

Latest material follow-up: the user approved emission 1 and `castsLight: true` on enemy eyes. Walker uses only eye slots 9/10; Spider only 6/7. All other materials remain nonemissive and every material remains nonreflective. See the eye-lighting section below; source geometry and the four-leg gait are unchanged.

Walker in B and Spider in D each have three moving, targetable actors, with 300 HP and the existing smoke/explosion lifecycle. `game/enemy-preview.js` shares combat ownership; `engine/articulated-gait.js` solves their distinct bind-vector legs. Dog remains unchanged at 12 units/second. Walker uses **18 units/second, six-unit strides and a one-third-second cycle**; its small turn-only foot separation keeps its broad toes clear. The user's latest revision removes Spider's middle leg pair. Its four remaining legs now use **12 units/second, 2.88-unit strides and a 0.24-second cycle**, with a constant 0.75-unit body lift, 0.2-unit swing lift and a maximum 0.5-unit inward foot correction on turns.

Preview starting route distances are A 72/232/392, B 72/232/720 and D 72/232/624 units so all three preview guns see activity. These are test actor positions, not wave rules. Enemy states expose actual movement velocity, route distance, lap and provisional threat 1. C has no combat enemy. Wildlife uses a separate controller and never acquires health or a target role.

The gait checks cover actual transformed geometry, planted contacts, both turn parities, bind-vector FK/IK agreement, frame/stall consistency and disposal. The current Spider's maximum sampled footprint radius is **11.96022 units**, within the 12-unit path half-width; Walker's earlier measured 11.850-unit result is historical and was not rerun for this adjustment. Model contracts below preserve the remaining geometry and record the approved middle-leg removal. Deferred-animation wording in the historical static review is superseded by this runtime section.

## Four-legged Spider — 18 October 2026

The user explicitly requested removal of the middle leg on both sides to give the remaining legs room for longer strides. The generator and canonical source now omit `upper-ml`/`lower-ml`/`foot-ml` and the corresponding `mr` chain. Every remaining part, pivot, cell and face material is exactly unchanged. The model has **13 parts, 740 cells and 339 greedy quads**, down from 19/932/471. Walker and Dog designs and movement are preserved.

Front-left/rear-right move together, alternating with front-right/rear-left. The 0.55 stance fraction guarantees at least one planted diagonal pair, with brief four-foot overlap. At unchanged speed 12, increasing cycle duration from 0.192 to **0.24 seconds** makes each stride **25% longer** and reduces cadence from about 5.21 to **4.17 cycles/second**. The existing two-link IK, cached world contacts and shared 12-unit turn blend remain intact. A **0.2-unit swing lift**, **0.75-unit constant support lift** and **0.5-unit turn-only inward correction** keep the original folded housings separate; the correction is zero on straight headings and follows `abs(sin(2*yaw))` at each cached contact. No constant stance narrowing or new solver was retained.

The initial 3.84-unit target exceeded the turn footprint or folded-knee clearance. The bounded 2.88-unit choice passes strict geometry checks while producing a slower, longer step. This is an animation tuning decision, not a speed reduction or altered path contract.

Fresh checks: `bun test tests/enemy-models.test.js` passes **6 checks, 20,225 assertions**; `bun test tests/articulated-gait.test.js --test-name-pattern spider` passes **5 checks, 3,187 assertions**, with 5 unrelated cases filtered. Coverage includes flat planted feet, at least two grounded diagonal supports, 12-unit radius and ground clearance through both turn directions, **3,120 actual-part SAT poses**, frame/stall/wrap agreement and fixed storage/death/disposal. `bun scripts/compile.js assets/models/spider.json` regenerates only Spider's 339-quad compiled model. No full suite or Walker-only gait SAT was run. Lead owns production integration and browser review.

Fine sampling around the worst radius, in 0.0005-unit route increments, found **11.9602148** at distance 191.7635 on `upper-rr`. Minimum transformed Y was 23.9999982, within the existing floating-point ground tolerance at Y24. Another **602** SAT samples at 0.01-unit spacing around the 72- and 192-unit corners found no overlap. These finite samples do not prove every possible continuous pose.

## Historical six-legged stride adjustment — 18 October 2026

The following milestone preceded the explicit middle-leg removal above; its settings and test counts are historical.

The user requested a longer stride so Spider moves faster. Its travel speed and stride now increase **20%**, from 10 to 12 units/second and from 1.92 to 2.304 units, while cadence stays at 0.192 seconds per cycle. The unchanged 0.55 stance fraction and alternating tripod phasing keep planted support. The body retains its 0.9-unit constant support lift; swing lift reduces from 0.5 to **0.35 units** so the accepted folded knee housings remain separate.

At bends, the four front/rear feet now move at most **0.25 units inward**, multiplied by `abs(sin(2*yaw))` at the cached contact heading. This reaches its maximum at diagonal headings and becomes zero on straight path segments. The middle feet retain their original width because narrowing them would close their knee housings during swing. Contacts remain fixed during stance; the existing anchor interpolation handles the correction during swing. There are no new allocations, geometry changes, phasing changes or changes to the two-link IK solver. Walker retains its existing 0.35-unit outward correction and all previous settings; Dog is untouched.

Larger provisional increases were rejected by the unchanged checks: the 15-unit/second, 2.88-unit stride exceeded the 12-unit radius and intersected a middle knee housing. A 25% trial also failed separation or left inadequate footprint clearance. Broader turn blending was not used because the shared path contract caps its turn distance at 12 units. The final 20% increase is a bounded movement adjustment within the accepted geometry, not a change to that contract.

Fresh verification: `bun test tests/articulated-gait.test.js --test-name-pattern spider` passes **4 selected checks, 3,904 assertions**, with **5 unrelated cases filtered out**. These cover dense planted-foot/footprint sampling through both turn directions, every pair of rigid voxel parts over full strides and bends, frame/stall/wrap consistency, source immutability, storage reuse, death and disposal. No full suite or Walker-only SAT was run.

An additional bounded inspection refined the worst footprint interval in 0.0005-unit route-distance steps: maximum radius **11.9922493** at distance 148.7695, on `lower-rl`; minimum transformed Y was 23.999998, within the existing floating-point ground tolerance around 24. Another **602** fine SAT poses at 0.01-unit spacing around the previously problematic 72- and 192-unit corners found no intersections. These are sampled checks, not a proof of every possible continuous pose. Lead owns production-route/live combat verification and user-facing review.

Previous motion feedback on 17 October increased speed 25% from 8 to 10 units/second by shortening the cycle from 0.24 to 0.192 seconds (about 5.21 cycles/second), preserving the then-proven 1.92-unit stride, 0.5-unit foot lift, 0.9-unit support height and 12-unit turn distance. That milestone passed its four selected Spider checks. The 18 October stride/lift/corner settings above supersede those values. Earlier Walker feedback is already reflected in its 18-unit/second, six-unit-stride tuning.

On 17 October 2026 the user selected the B and D designs from the [enemy concept sheet](concepts/enemy-lineup-v1.png) for modelling. A and C were set aside as too similar to the dog. After viewing the exported first-pass models, the user accepted both and named them **Walker** (Zone B) and **Spider** (Zone D). That acceptance rejected an internal proportions change; the explicit 18 October middle-leg removal now supersedes the six-leg portion of Spider's design.

The accepted [first-pass review capture](screenshots/enemy-models-first-pass.png) has the earlier working labels Dunewalker and Spindle. Only IDs/names changed after that capture. The existing dog and turret designs remain intact. That initial model-only milestone is superseded by the user's approval to add walking Walker actors to B and Spider actors to D for the same combat testing as A's dogs. Their designs remain unchanged; no new abilities or waves are included.

## Runtime preview integration

The latest approved follow-up adds three Walker actors to Zone B and three Spider actors to Zone D. Both use provisional 300 HP, existing turret ranges/strengths and hitscan line-of-sight checks, smoke below 50%, and the existing lit explosion/debris/shockwave effects. Death removes every rendered part and stops that actor's animation; switching away unloads its rigs/meshes and resets transient effects. Reloading the zone resets the finite test group. This describes the original roster; the later [eight-model expansion](enemy-expansion.md) adds mixed ground/air actors to every zone, including C.

`shared/enemy.js` keeps combat/effect tuning separate from source geometry. Walker effects originate at body-local `[12,22.5,12]` and use a14-unit blast with28 fragments; Spider uses `[12,9.5,11.5]`,12 units and24 fragments. These are provisional preview values, not campaign balance. Fragments use actual exposed model colours. The original bind-pose contracts below remain authoritative for geometry.

## Sources and authoring

- [Generator](../scripts/enemy-models.js): pure `walkerModel()`, `spiderModel()` and `enemyModels()` exports, plus `ENEMY_RIG_CONTRACTS` for integration.
- Editable sources: [Walker](../assets/models/walker.json), [Spider](../assets/models/spider.json). Artist exported and compiled the approved four-legged Spider revision; Lead owns the [side-by-side review tool](../tools/enemy-review.html) and user-facing review.
- `bun scripts/enemy-models.js` creates missing source files only; it never overwrites authored files. Importing the module performs no writes.
- Model version 3, `role: 'enemy'`, `colorMode: 'authored'`. Only `base` contains geometry; upgrade slots remain empty for format compatibility.
- Integer-cell authoring, no textures, all material reflectiveness zero. Only the approved eye materials use emission 1 and `castsLight: true`; all armour and other accents remain nonemissive. Top-face colour overrides preserve the same material contract.
- Cells are unioned within each part and validated across parts. There are no overlapping cells or shared coplanar faces between rigid parts. Recesses and mechanical gaps are actual empty space. Every individual rigid part is a connected solid.

| Model | Parts | Cells | Greedy quads | Canvas | Occupied bounds, max exclusive |
| --- | ---: | ---: | ---: | --- | --- |
| Walker | 7 | 926 | 372 | 24 × 28 × 24 | X5–19, Y0–27, Z4–20 |
| Spider | 13 | 740 | 339 | 24 × 15 × 24 | X4–20, Y0–14, Z4–20 |

The maximum bind-pose vertex radius about XZ `[12,12]` is **10.6302 units** for Walker and **11.3138** for Spider (rounded up). Thus the resting models can yaw inside a 24-unit-wide circle. This does not prove the full animated footprint or route-turn clearance.

## Eye lighting — 18 October 2026

Walker slots **9 (`Turquoise sensor`, `#429F9F`)** and **10 (`Sensor highlight`, `#7FC7BD`)** are exclusive to the four-unit front eye surface. Spider slots **6 (`Coral sensor`, `#CC786D`)** and **7 (`Coral highlight`, `#E8A08B`)** are exclusive to the two-unit front eye surface. Each model now uses emission **1** and **`castsLight: true`** on these slots, producing **two exposed local-light clusters per actor** because the base eye colour and highlight stay distinct. Spider's slot 8 joint accents remain nonemissive. No material split or recolouring was needed.

All geometry, hierarchy, pivots and face assignments are byte-for-byte unchanged from the completed four-legged Spider milestone. Walker remains 372 quads; Spider remains 339. Fresh `bun test tests/enemy-eyes.test.js tests/enemy-models.test.js` verification passes **9 checks, 29,499 assertions**. The new three-model eye checks validate exact allowed face locations, matte non-eye materials, compiled emission/local-light metadata, surface area and cluster counts. All three enemy sources are regenerated and compiled; a before/after comparison confirms only the eye emission/light flags changed. Engineer owns scene-wide capacity and moving-light/death/reset checks, and Lead owns final browser review. Earlier gait evidence remains applicable because those sources and settings were preserved.

## Shared rig conventions

Both face **−Z**. Navigation origin is `[12,0,12]`, with Y up. Part pivots and cells use model bind coordinates, as in the existing dog rig. Soles touch Y0 in the bind pose; separate foot parts permit future counter-rotation for planted contacts. Each foot occupies Y0–2, with a deliberate clearance gap to its lower leg.

The root `body` part parents every upper leg. Upper leg → lower leg → foot is a three-part chain. There are no skinned vertices, dynamic mesh changes, animation clips or constraints hidden in the model JSON. Rigid-part source names remain stable for the future controller.

The folded rest vectors are **not** the dog's straight vertical bones. A future IK/controller must account for each rest vector and its length before applying rotations. Do not substitute the dog gait unchanged.

## Walker contract

The accepted silhouette is a narrow tall biped: stepped ochre/terracotta chest, pale collars, dark petrol legs, broad split-toe feet and a turquoise front sensor. The body pivot is `[12,20,12]`.

| Part | Parent | Left pivot | Right pivot |
| --- | --- | --- | --- |
| `thigh-l`, `thigh-r` | `body` | `[8.5,18.5,13.5]` | `[15.5,18.5,13.5]` |
| `shin-l`, `shin-r` | matching `thigh-*` | `[8.5,10.5,17.5]` | `[15.5,10.5,17.5]` |
| `foot-l`, `foot-r` | matching `shin-*` | `[8.5,1,11.5]` | `[15.5,1,11.5]` |

Hip-to-knee rest vector is `[0,−8,+4]`, length `sqrt(80)` ≈ **8.9443**. Knee-to-ankle is `[0,−9.5,−6]`, length `sqrt(126.25)` ≈ **11.2362**. The opposite Z directions establish the reverse-knee posture. Hip and knee bearings use square cell-built collars with clear axle cavities. The principal inspection hinge axis is X.

## Spider contract

The silhouette retains a small pale segmented central shell, aubergine raised folded outriggers, pale lower-leg panels and restrained coral sensors. The latest approved revision has four independent legs after removing the middle pair; their wide raised geometry remains distinct from Dog. The body pivot is `[12,8,12]`.

For each suffix below, part IDs are `upper-*` → `lower-*` → `foot-*`; `upper-*` parents to `body`.

| Suffix | Hip pivot | Knee pivot | Ankle pivot |
| --- | --- | --- | --- |
| `fl` | `[8,8,9]` | `[5.5,11.5,6.5]` | `[5.5,1,5.5]` |
| `fr` | `[16,8,9]` | `[18.5,11.5,6.5]` | `[18.5,1,5.5]` |
| `rl` | `[8,8,15]` | `[5.5,11.5,17.5]` | `[5.5,1,18.5]` |
| `rr` | `[16,8,15]` | `[18.5,11.5,17.5]` | `[18.5,1,18.5]` |

Front/rear upper links measure `sqrt(24.75)` ≈ **4.9750**; lower links measure `sqrt(111.25)` ≈ **10.5476**. Left/right and front/rear signs differ; use the actual pivot differences rather than applying one signed rest vector to all four legs. The production gait above solves these bind vectors.

## Focused checks and limits

`bun test tests/enemy-models.test.js` passes **six checks**: exact equality to the accepted saved designs, deterministic independent generation, schema/material/bounds, grounded feet and hierarchy/pivots, connected solids with no inter-part coplanar faces, finite exposed meshes and retained material indices, plus a bounded articulation check grouped with the geometry checks. No full suite was run.

The static articulation check uses the existing `PoseRig` and an independent oriented-cell separating-axis test. With four Spider legs it now samples **24 isolated poses**: each hip and knee separately at ±4° X pitch for Walker or ±3° X pitch for Spider, testing the moved subtree against all fixed parts. Those samples have no penetration. They are inspection limits, **not certified continuous joint ranges or a full gait**. Runtime planting and gait clearance are checked separately as recorded above.

At the initial static milestone, full strides and runtime behaviour were deferred. The subsequent approved runtime and four-leg work above supersede that limitation; no body bob or uneven-terrain following has been added. Lead owns the current built-in-browser review.
