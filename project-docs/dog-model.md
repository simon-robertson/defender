# First enemy: dog

**Running rolled back, 20 October (latest):** the user rejects the isolated gallop and asks to remove all running work. The production Dog uses the original diagonal walking cycle with its accepted thirteen-part model. Removed the bounding/flight/body-lean additions and isolated chest/pelvis/head prototype. Earlier running paragraphs below are historical and superseded; further gallop work is deferred. [Rollback](run-rollback-2026-10-20/README.md).

**Latest running feedback and research, 20 October:** the user finds the first bound insufficiently canine, especially the almost unchanged body altitude, and supplies a greyhound's extended suspension reference. Current full-run `bodyLift` spans only −0.50 to −0.15 units; the one rigid torso/head cannot visibly gather/extend. [Research and staged rig proposal](research/canine-gallop-rigging-2026-10-20.md) cover phase/contact timing, body flight/compression, longer strides, chest/pelvis/head controls and anticipatory corner braking. More controls fit the existing rigid-part renderer, but a segmented production model and controller/IK changes remain proposals. Keep roughly 2× straight pace pending any further speed decision. No model or animation changes in this research pass; earlier physical checks are not visual approval.

**Play-only running, 20 October:** the active Dog now bounds when escape is certain, blending toward 2× pace with front/rear paw pairs, 24% full-run stance, higher swing, body bounce and damped corner lean. All four actual paws leave the route plane; two-link IK retains flat contacts and valid reach. The model, source pivots, geometry and ordinary `/game/` walk are unchanged. Other enemy types with legs are not activated in the Zone A campaign. [Proof, physical checks and browser poses](escape-running-2026-10-20/README.md).

The user approved the small dog-like enemy seen in the [zone concept sheet](concepts/colour-directions-v1.png), with animated walking legs and a few examples on Zone A's path. Internal model ID: `dog`. The initial assignment covered appearance and motion. Subsequent [targeting](defence-targeting.md) and [combat](combat.md) previews now connect turret yaw/firing to 300-HP dogs, with base/upgrade-1 strengths 10/12 and removal on death. Dogs smoke below half health and produce lit, model-coloured cube explosions on death; see [damage effects](damage-effects.md). Waves and final balance remain future work.

## Source and silhouette

- Editable source: `assets/models/dog.json`; deterministic generator: `scripts/dog.js` (`dogModel()`). `bun run seed:dog` creates the file only when missing, preserving workshop edits.
- Model v3, `role: "enemy"`, `colorMode: "authored"`, size `[24,16,24]`. Only the base variant contains geometry; empty upgrade slots maintain the current authoring format. The three-variant arsenal requirement does not imply enemy upgrades.
- Compact dark sensor head and mechanical underbody, stepped pale shell, four separated articulated legs, restrained warm sensor accents. No organic ears or tail. The user-authorised eyes now emit light; every material retains reflectiveness 0 and the model has no textures.
- Bind geometry: 1,100 occupied cells, 302 merged exposed quads; occupied bounds X5–19, Y0–15, Z2–21. Model forward is −Z, route root is the box centre `[12,0,12]`.
- Faces hidden within each rigid part are removed; articulation interfaces remain available as joints move. Parts do not contain overlapping source cells.

## Eye lighting — 18 October 2026

The user approved emission **1** and **`castsLight: true`** for all enemy eyes. Dog's existing eye-only slots **6 (`Sensor orange`, `#E86E3F`)** and **7 (`Sensor highlight`, `#FFA263`)** now carry those flags. They cover the four-unit front sensor and two two-unit side eyes. The rear recess uses slot 8 and stays nonemissive, as do armour, mechanical parts and other accents. No material split, recolouring or geometry change was needed.

The exposed faces form **four local-light clusters per Dog**: front colour and highlight, plus each side eye. All part cells, face assignments, pivots and hierarchy are unchanged. The compiled model remains 302 quads and 13 parts. Existing production lighting and bloom consume the emission/opt-in metadata; Engineer owns active-scene capacity and death/reset verification, and Lead owns live appearance review.

Fresh focused verification: `bun test tests/enemy-eyes.test.js tests/enemy-models.test.js` passes **9 checks, 29,499 assertions** across Dog, Walker and Spider. The eye checks compare the exact allowed eye faces, source/generator equality, emission/reflectiveness and local-light mesh metadata, exposed surface area and cluster counts. `bun scripts/compile.js assets/models/dog.json assets/models/walker.json assets/models/spider.json` rebuilds only these three assets. A before/after source comparison confirms the only changes are the two eye materials' emission and light flags. No gait or geometry tests were repeated for this material-only update; earlier counts below are historical.

## Rig contract

The existing rigid-part hierarchy is sufficient for the implemented walk; no weighted skinning or GPU animation system is needed. The gallop proposal and bounding pass were rolled back at the user's request. Thirteen mesh parts share their geometry across instances:

| Part | Parent | Pivot |
| --- | --- | --- |
| `body` | none | `[12,9,12]` |
| `leg-fl`, `leg-fr` | `body` | `[6.5,9,8.5]`, `[17.5,9,8.5]` |
| `leg-rl`, `leg-rr` | `body` | `[6.5,9,16.5]`, `[17.5,9,16.5]` |
| `shin-*` | matching `leg-*` | same X/Z, Y5 |
| `paw-*` | matching `shin-*` | same X/Z, Y1 |

Hip-to-knee and knee-to-paw lengths are four units each. Paws are three units wide, four long and two high, with their bind soles at Y0. Axis alignment applies to the source mesh; posed limbs may rotate continuously.

## Preview scope

Three reused actors walk Zone A's existing box-centre route. Initial route distances are 72, 232 and 392 units; provisional speed is 12 units/second. This evenly spaces the dogs along the 480-unit path. They reset to the entrance after reaching the exit. These are visual-preview settings, not spawn or enemy-balance rules.

Runtime actors are separate from saved scenery placements, so static obstacle validation remains intact. B–D do not load the dog asset. Actor rigs and animation references are released before the world and its GPU buffers on zone changes. The model editor recognises the enemy role; enemy spawn authoring in the level editor remains future work.

## Walking and resource ownership

`engine/path-motion.js` keeps the root on the exact authored route while blending the shortest yaw through bends. `engine/dog-gait.js` uses the existing `PoseRig` with analytic two-link hip/knee motion and independent paw orientation. Diagonal leg pairs alternate over a 0.4-second cycle; stance occupies 55%, swing lifts 1.2 units, and the body has a fixed one-unit crouch. Feet use world-space contacts during stance, including while turning. All numbers remain provisional visual tuning.

The controller reuses three actor states, all matrices and scratch targets. Each of the thirteen part meshes is instanced across the three dogs; only changed matrices are uploaded. Meshes are never rebuilt to animate. The current renderer redraws its full scene/shadows while actors move; large enemy counts still require measured budgets and profiling.

Clearance refinements inset the lower chassis and remove eight inward upper-leg corner cells, preserving the outer silhouette and hinge centres. The 24-unit box applies in bind space, and the full animated footprint is also checked against the path corridor.

## Verification and handoff

Final validation: **87 Bun tests pass**, all **37 model sources compile**, and the saved dog equals its deterministic generator. The authoring API round-trips the enemy role and complete hierarchy. Six dog regressions cover shared meshes, untouched static route validation, exact path sampling, planted paw transforms through bends, terrain/footprint clearance, frame-rate independence through multiple loops, teardown and moving-limb/chassis clearance.

A dense 2,400-pose sweep measured animated radius at most 11.302 units, leg reach below 8 units and minimum vertex Y23.999998 against ground Y24 (Float32 roundoff). Paw target error remains below 0.00003 units; planted-contact matrix comparisons allow 0.0001. An independent oriented-cell separation test found no moving-limb/chassis intersection in the sampled poses after the approved chassis inset and hip chamfers. The explicit exit-to-entry preview reset is excluded from planted-contact continuity checks.

Built-in Chrome verified three visible walking actors, shared-delta distance progression, day/night appearance, ground-camera rendering, and A→B→A cleanup/reload with no console or WebGPU errors. A has 87 scene buffers, 961,992 geometry/index/instance bytes, 28 opaque groups plus water, and 4,761 stored quads. It submits 86 draws while walking, or 87 with the existing shot particles. B has no dog asset or actors; unloading A reports zero scene buffers, assets, rigs, actors and shot instances. Returning to A restores the same 87 scene-buffer count.

Artist and Tactician signed off the silhouette, scale and day/night contrast; Engineer verified animation and resource ownership; the lead reviewed and integrated the result. [Final preview](screenshots/moss-dogs-final.png), [night review](screenshots/moss-dogs-night.png). Foreground scenery can still occlude individuals, and the night setting compresses small dark details. No new gameplay or environment changes were introduced to address those separate limitations.
