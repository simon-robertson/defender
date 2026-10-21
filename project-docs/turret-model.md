# Refined gun turret family

Refined on 17 October 2026 from the approved [Moss & Porcelain concept](concepts/gun-turret-moss-porcelain-v1.png). The user approved the 32-unit model appearance, then settled on **24 × 24 × 24-unit boxes**. The current family refits those shapes to the final footprint, preserving the twin barrels, colour variation and rotating top. On 18 October the user approved a small functional redesign so the barrels can pitch independently to track targets. The latest three-part version below supersedes the original two-part rig. It does not set gameplay statistics.

## Files and authoring

- Editable asset: [turret-study.json](../assets/models/turret-study.json). Its existing ID is retained so saved layouts keep their references.
- Reproducible geometry: [scripts/turret.js](../scripts/turret.js), exporting `turretModel()`. The seed script uses this generator for a missing turret asset, and continues to preserve existing library files.
- Approved 32-unit model: [archived source](archive/turret-refined-32-v2.json) and [generator reference](archive/turret-refined-32-generator.js). These preserve the previous version; the archived generator is source history, not an executable module at that location.
- Previous blockout: [archived source](archive/turret-study-blockout-v2.json).
- Actual model preview: [24-unit comparison](screenshots/turret-refined-24.png); [approved 32-unit comparison](screenshots/turret-refined-32.png).
- Interactive review: run `bun run dev`, then open `http://127.0.0.1:4173/tools/turret-review.html` in the built-in Chrome. Compare all three or inspect one; the yaw slider turns the head and its guns, while independent pitch and recoil controls move only the guns. Orbit/pan/zoom and Reset view are available. This page reads source and uses the workshop renderer; it does not save edits.

The canonical JSON remains editable in the model studio. The generator is an authoring aid, not a runtime dependency. Its reference proportions remain in the approved sculpt's 32-unit design coordinates; helpers snap primitive boundaries onto the final 24-unit grid before generating integer cells. These reference coordinates do not define world scale. Small features are explicitly fitted in final units: both barrels are seven units across, their centred openings are three units across and four units deep, and the base roof cap remains one unit thick. Surface fasteners colour existing cells so snapping cannot leave detached geometry. No runtime scaling is used. After hand edits, update it deliberately before regenerating; do not overwrite manual work by blindly calling the generator. `bun run compile` regenerates the derived mesh from saved source.

## Forms and materials

All variants have a layered stone pad, a tapered cream pedestal with moss ribs and a small vermilion inset, an exposed dark rotation collar, and exactly two thick barrel sleeves with recessed muzzle cavities. The base remains compact; upgrade 1 adds longer sleeves, larger cheek panels and the raised observation housing visible in the concept; upgrade 2 gains stepped barrel caps, shoulder armour and a taller reinforced support.

Broad colour blocks and stepped edges translate the illustration into axis-aligned unit cells. Colour variation is intentional, with 17 materials covering warm porcelain highlights and recesses, light/dark greens, stone edging, dark bores, and restrained vermilion. Top-plane variations use face material overrides. No random surface noise or world textures are used. The latest user approval makes the small coloured identity accents **emission 1 with `castsLight: true`**; all other turret materials retain emission 0. **Reflectiveness stays 0 throughout all three variants**, including face overrides. The active source and generator agree. Archived older sources and screenshots retain their historical appearance.

All 17 slots are recoloured through `shared/zone-style.js`, preserving emission, reflectiveness and light-casting flags. B retains A's porcelain armour. The identity accents become teal in B, ember in C and coral in D. C's broader orange secondary armour is material 2 and remains non-emissive.

## Approved identity lights

Only material **4** is used by the narrow coloured pedestal inset and head cheek stripes. Slots **14/15** are the unused highlight/shade members of that same accent family; all three slots carry emission 1 and the opt-in flag so future face overrides retain the intended surface behaviour. No armour, barrels, observation housing, terrain, enemy or wildlife material is enabled by this change.

Source-cell regions below use max-exclusive bounds. The pitch redesign preserves pedestal accents and all material colours/properties. Head stripes move onto intact rear cheeks beside the new square bearing slots; their per-variant light-cluster counts stay unchanged.

| Variant | Pedestal accent | Head accents |
| --- | --- | --- |
| Base | X11–13/Y7–8/Z6–7; X11–13/Y8–9/Z7–8 | X2–3 and X21–22, Y24–27/Z20–21 |
| Upgrade 1 | X11–13/Y7–9/Z6–7; X11–13/Y9–11/Z7–8 | X2–3 and X21–22, Y27–31/Z20–21 |
| Upgrade 2 | X11–13/Y7–10/Z6–7; X11–13/Y10–14/Z7–8 | X2–3/Y29–34/Z20–21 only |

Upgrade 2 retains only its left cheek stripe. Exposed accents now form **11/11/9 greedy quads**, grouped into the same **3/3/2 local-light clusters** across the variants. Pedestal faces point primarily forward (−Z), with tiny upward ledges. Head stripes follow yaw; the guns have no emissive materials. The stationary shell no longer recoils or pitches. Clustering, light strength/radius and shared GPU capacity belong to Engineer integration; the existing approved bloom remains unchanged.

The source flag is an optional boolean, defaulting to false when absent, and is independent of emission. `meshPart`/`meshQuads` and compiled part records provide optional `lightQuads` indices for exposed faces whose effective material has `castsLight === true` and positive emission. Normal meshes omit that metadata; the 11-float vertex layout is unchanged. Face overrides and greedy material boundaries preserve the flag through compilation.

The earlier material handoff passed **21 affected checks** in `tests/assets.test.js`, `tests/turret.test.js` and `tests/zones.test.js`; this includes saved-source agreement, precise accent-only emission, all-zone flag preservation, optional-boolean validation, face overrides and light metadata. At that historical milestone only the turret mesh was recompiled, retaining **2,108 quads**. No full suite was run for this change; runtime lighting verification is separate.

## Geometry and rig — current pitch redesign

The authoring canvas remains **24 × 36 × 24 units** and every bind-pose cell fits its 24-unit X/Z footprint. All three variants now use `base` → `head` → `guns`:

- `base` is the exact prior pedestal, including every cell, pivot and material.
- `head` retains the yaw bearing, porcelain shell, observation housing and identity stripes. It rotates only about Y. Recessed gun bays, connected rear walls and square side bearings provide mechanical clearance.
- `guns` contains both seven-unit barrel sleeves, the recessed bores, a connecting dark cradle and two small trunnions. It pitches about X and recoils along its rotated local +Z axis. Positive X raises the forward −Z barrels.

The bore axes move **four units upward** so full depression clears the unchanged pedestal. This changes only the base variant's total height, from 27 to 28 units; upgrade heights stay 32/35. The upper shell stays level. Recoil-slot clearances allow the existing **1.25-unit** kick while the head and pedestal stay fixed.

| Variant | Cells | Height | Quads | Head yaw pivot | Guns pitch pivot | Muzzle Y / Z |
| --- | ---: | ---: | ---: | --- | --- | --- |
| Base | 4,694 | 28 | 663 | [12,14,12] | [12,24.5,15] | 24.5 / 3 |
| Upgrade 1 | 5,365 | 32 | 779 | [12,17,12] | [12,27.5,15] | 27.5 / 2 |
| Upgrade 2 | 5,884 | 35 | 760 | [12,19,12] | [12,29.5,15] | 29.5 / 1 |

Both muzzles retain X centres **6.5 and 17.5**, three-unit openings and four-unit cavity depths. `shared/arsenal.js` owns these sockets, the `guns` pitch/recoil metadata and runtime bounds. All variants support **−35° depression to +35° elevation**, full yaw and the 1.25-unit recoil envelope. The model family totals **2,202 quads / 4,404 triangles**. Every rigid part is connected; no duplicate source cells or overlapping decorative shells are introduced.

Sampled moving-part horizontal radii remain **14.8661/14.8661/15.5564 units** around the yaw centre, matching the former rounded yaw envelopes. These exceed the bind box half-width, as the original yawing models already did; level clearance must continue to use the motion envelope rather than a 12-unit radius.

Current active A/B/D target heights fit the new pitch range; Tactician measured the tightest active demand at approximately **−32.57°** for D's first upgrade. Upgrade 2 remains inactive; a hypothetical closest-path A/D deployment can require slightly more than 35° depression and must obey runtime reachability checks if later enabled. Pitch approval does not change combat stats or firing cadence.

Fresh model verification: `bun test tests/turret.test.js tests/turret-rig.test.js` passes **7 checks, 470 assertions**. The new independent actual-cell SAT checks sample **2,088 combined poses** across the three variants: eight yaw headings, 29 pitch values including both limits, and recoil 0/0.625/1.25. They cover gun/head/base separation. Additional checks cover connected solids, source/generator equality, bore/socket agreement, full-yaw bearing separation, fixed shell/pedestal transforms, local-axis recoil and material flags. These finite samples are not a proof of every continuous pose. `bun scripts/compile.js assets/models/turret-study.json` compiles only the changed model. The complete pedestal sources and 17-material palette compare exactly with the previous version.

The Artist reviewed the lead's actual [fully depressed barrels](screenshots/turret-pitch-depressed.jpg) and [fully raised/yawed barrels](screenshots/turret-pitch-raised.jpg), both at full recoil: twin-barrel identity, stationary shells and square mounts read clearly, with no blocking visual issue. Lead owns final production tracking/effects and browser verification.

## Historical verification before pitch

`bun test`: **72 tests pass**, including connected solids, footprint bounds, hierarchy, yaw clearance, exactly two front muzzle rings with four-unit-deep cavities, material preservation, and saved-source/generator agreement. Runtime checks also cover burst/cooldown timing, recoil continuity, parent/local transforms and reused instance matrices. Existing mesher, transform, and persistence checks also pass. All model sources compile; this animation change does not alter geometry. Built-in Chrome inspection covers the common-scale comparison, single-variant view, upper-assembly yaw with stationary pedestals, and the new mixed base/stage-2 aiming/firing preview.

## Historical firing recoil preview

The following describes the original two-part milestone. The current rig above moves recoil onto `guns`, adds bounded pitch tracking, and keeps `head` stationary except for yaw. Current runtime details are maintained in the engine and targeting notes.

The first level now uses base turrets at the outer placements and stage 2 (`upgrade1`, the first upgrade) in the middle, with independent random headings selected before firing. Heads accelerate and brake along the shortest yaw arc, with provisional limits of 360°/second and 2400°/second². A 90° turn takes 0.4 seconds; 180° takes 0.65 seconds. Short turns use lower peak speed to preserve easing without overshoot. Heads finish at zero angular speed before firing, then keep that heading through recoil and cooldown. Base fires once then cools down for one second. Upgrade 1 is configured for three shots 0.12 seconds apart, then a one-second cooldown after the final shot, and is now placed in the middle at box [7,0,4]. The burst gap is provisional; upgrade 2 firing and damage/hit/miss rules remain undecided. Turret delivery is now explicitly instant-hit, without a visible projectile. The workshop still retains all variants for authoring.

`shared/arsenal.js` holds the firing, turn and recoil tuning. The existing upper assembly moves backwards along its local +Z axis (the barrels face -Z), by at most 1.25 units. A 0.045-second kick and 0.24-second eased return leave the pedestal stationary. These distances/times are implementation tuning, not final balance. Repeated shots start from the current offset without snapping or accumulating drift. Translation follows head yaw and placement rotation. Y remains unchanged, preserving pedestal clearance; the movement can extend beyond the bind-pose box as existing yaw already can. The later shot-effects approval adds paired muzzle flashes, local sparks and transient lighting through `TURRET_MUZZLES` in `shared/arsenal.js`. Its head-local coordinates match the real bore centres on each variant; update the sockets deliberately if the sculpt changes. Flashes/lights follow the live head matrix; emitted sparks keep their world-space origin. The model mesh and material values remain unchanged. See [engine notes](engine.md#firing-rules-and-rigid-part-animation).
