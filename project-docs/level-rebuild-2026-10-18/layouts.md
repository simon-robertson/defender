# Sixteen landscape-first preview layouts

18 October 2026. The latest [design doc](../design-doc.md) and user water/visibility decisions govern this rebuild. These are development previews with measured attack opportunities, not a balanced campaign. Five-wave scheduling, player deployment, economy and exit consequences are unchanged and remain unimplemented where previously undecided.

Artist authored populated, path-free landscapes before tactical carving. The revised set varies dry ground, tiny cisterns, long tarns, broad lakes, rivers and shallow streams. The initial compact-pool batch and its evidence are preserved under [initial-landscapes](initial-landscapes/); it is historical and is not included in final verification counts. The accepted A4 terrain and route remain intact, with three additional tree removals exposing its generator ground.

## Reproduce and inspect

- [Tactical definitions](../../scripts/level-rebuild-layouts.js), [C definitions](../../scripts/level-rebuild-c.js), [D definitions](../../scripts/level-rebuild-d.js), and [subtractive factory](../../scripts/rebuild-level-layouts.js). Each definition pins the exact reviewed landscape hash; changed landscapes require an explicit new handoff.
- `bun run seed:previews` creates missing levels only. `bun run rebuild:previews` explicitly rebuilds the final sources. For one source use `bun scripts/rebuild-level-layouts.js --level moss-02 --write`.
- `LEVEL_REBUILD_ZONE=A LEVEL_AUDIT_WRITE=1 bun test tests/level-rebuild-layouts.test.js` runs one zone's geometry, opportunity and production-combat checks. `LEVEL_REBUILD_ID=moss-02` narrows this to one level. These are offline authoring checks, not runtime work.
- [Audit implementation](../../scripts/level-layout-audit.js) and [summary generator](../../scripts/summarize-level-rebuild.js). `bun scripts/summarize-level-rebuild.js --write` reads successful saved audits, verifies their source hashes, and produces [coverage-summary.json](coverage-summary.json) without rerunning simulation.
- Each `<level>.manifest.json` records frozen baseline hash, retained/removed scenery, removal reason, added preview equipment, routes, tactical sites, complete visibility sites and wildlife anchors. Each `<level>.audit.json` records actual per-species opportunity windows and combat/lifecycle outcomes. `previous-levels/` preserves the pre-rebuild saved sources.

The factory never reshapes terrain or water to rescue a route. Retained placements keep their original IDs, model, transform and material settings; no placements are moved. It subtracts route/site occupancy and actual overview obstructions, then adds the approved preview equipment. All three supported perches survive each carve. `previewWildlife` records three dry habitat seeds and the supported local perch points; these seeds do not confine later wildlife movement.

## Preview equipment and routes

Level 1 uses base/upgrade1/base guns, level 2 the three Arc Spire stages, and level 3 the three missile stages. Level 4 uses one base gun, Arc and silo, plus one base generator. A1 also has a base generator. This is a comparison convention, not an arsenal unlock progression. Weapon stats, finite magazines, attack cadence, strength bonuses and rosters are unchanged; weather is authored off.

Selected later levels use two complete immutable routes with one identical directed suffix and common exit. Assigned actors retain their own full chain, route progress, gait, lap and target identity through the merge. The existing finite roster is distributed between approaches rather than doubled. A/B retain seven actors, C four and D five. Neither topology nor route length is a claim of final difficulty.

| Level | Water boxes | Route length, main / branch | Retained scenery | Removed scenery | Attack / visibility areas |
| --- | ---: | ---: | ---: | ---: | ---: |
| [A1 · Limestone Orchard](moss-01.manifest.json) | 0 | 456 | 188 | 36 | 9 / 10 |
| [A2 · The Broadwater Garden](moss-02.manifest.json) | 62 | 768 | 179 | 47 | 9 / 9 |
| [A3 · Cypress Rise](moss-03.manifest.json) | 19 | 696 / 456 | 246 | 55 | 9 / 9 |
| [A4 · The old garden mere](moss-04.manifest.json) | 24 | 672 | 233 | 59 | 10 / 11 |
| [B1 · Sunworn Cistern](ochre-01.manifest.json) | 1 | 480 | 191 | 32 | 9 / 9 |
| [B2 · Broken Aqueduct](ochre-02.manifest.json) | 39 | 720 | 201 | 48 | 9 / 9 |
| [B3 · Three Mesas](ochre-03.manifest.json) | 10 | 624 | 264 | 46 | 9 / 9 |
| [B4 · Petrol Basin](ochre-04.manifest.json) | 80 | 624 / 336 | 195 | 49 | 9 / 10 |
| [C1 · Slate Tarn](ice-01.manifest.json) | 20 | 528 | 163 | 41 | 9 / 9 |
| [C2 · The Meltwater Bend](ice-02.manifest.json) | 41 | 648 | 202 | 45 | 9 / 9 |
| [C3 · White Ridge](ice-03.manifest.json) | 22 | 480 / 264 | 263 | 35 | 9 / 9 |
| [C4 · Shattered Sanctuary](ice-04.manifest.json) | 46 | 648 | 236 | 42 | 9 / 10 |
| [D1 · Mauve Orchard](plum-01.manifest.json) | 12 | 456 | 182 | 30 | 9 / 9 |
| [D2 · Fallen Arches](plum-02.manifest.json) | 15 | 528 | 233 | 40 | 9 / 9 |
| [D3 · Lantern Mere](plum-03.manifest.json) | 71 | 480 | 216 | 33 | 9 / 9 |
| [D4 · Crown Gardens](plum-04.manifest.json) | 42 | 600 / 384 | 234 | 48 | 9 / 10 |

## What the opportunity measurements establish

Coverage windows use distance along a complete journey, in world units. All tactical candidates have positive actual base-gun opportunities against every current species somewhere on the authored routes. The full audit also records upgrade1-gun windows and ideal horizontal range totals at 48/72/96/120 units. Ideal circles are not evidence that an Arc surface contact or missile intercept succeeds.

A real repeat opportunity is distinguished from continuous elbow coverage. For example, the revised A2 court at [5,6] has two separate base-gun Dog windows, [102,186] and [294,378], with a genuine exit and re-entry into range between them. A4's [11,10] court similarly covers [264,330] and [438,522]. Other courts follow continuous bends without leaving range; they are not described as two independent range entries.

Alternative sites are not all strictly better or worse. In A2, early [2,7] covers Dog journey [6,90], whereas [3,5] covers [126,210]; the former acts sooner, the latter reaches the approach to the northern return. Late [13,14] covers [630,714], while [15,14] shifts that window to [678,762]. Some opposite-side alternatives have equivalent unobstructed range windows and provide visible placement flexibility, not a fabricated damage advantage.

A3's branch court at [9,13] has an 84-unit base-gun Dog window on the branch and zero on the main route; late [18,15] has 66 units on each route's common tail. B4's enhanced Arc site [9,16], measured with the same unenhanced base-gun probe for comparison, covers 132 branch units and only 36 main units near the merge; its later [16,16] site covers 66 units on either common tail. These opportunity differences support branch-specific versus shared investment without assuming splash damage, extra spawns or a dominant optimal build.

The complete set has four merged layouts: A3, B4, C3 and D4. Later single-route levels remain, including A4, B3, C4 and D3. In C3, [1,5] offers 66 base-gun Tripod units on the branch and zero on the main route; [1,13] adds 84 units on either common tail. D4’s [17,9] covers 90 branch Spider units and zero main units, while [11,15] covers 84 units on each common tail. No one junction plot is assumed to replace every branch plot.

For the reference ground species in each zone, every complete route has a late candidate adding **66–114 actual eligible units in its final third** beyond the strongest early candidate’s final-third coverage. This is a measured temporal coverage distinction, not a claim that the late defence always fires before other previews finish the finite roster. The [summary](coverage-summary.json) identifies the selected sites and complete intervals; full audits cover the other species too.

## Verification boundaries

Route checks sample canonical movement at one-world-unit intervals, including endpoints, using every current ground/air species on every complete route. Actual occupied-part vertex envelopes are checked against scenery/terrain and complete turret yaw/pitch/recoil or loaded-silo envelopes. This is a conservative sampled motion audit, not a continuous collision theorem or proof of every future animation change. Dry path-box support is validated; the audit does not separately certify the complete moving sole footprint over every shoreline edge.

Attack windows use one-unit midpoint bins, both actual gun muzzle rays, mechanical pitch limits and zero/full recoil. The live production-controller audit runs 7,200 frames at 60 Hz per level, uses the unchanged finite roster, requires attacks on each occupied route, checks physical missile hits and exact launched-damage claims where silos exist, checks one shared thinker per frame, and repeats reset before disposal. A particular tier may legitimately receive no shot because another defence has already killed its target; the test does not force contrived firing order.

Independent Artist proofs cover all intended full 24×24 ground areas, including separate generator support plots. They combine 576 one-unit rays per area with continuous exact occupied-cuboid projection/clipping against every retained scenery placement and terrain at the normal yaw2.45/pitch0.68 overview. Existing defences, moving actors and effects are excluded from that scenery-ground proof. Visibility is separate from physical travel, weapon LOS and aesthetic pixel review.

All **16 focused layout/combat checks pass** against the final saved source hashes. They cover **27,578 route poses, 176,624 occupied-part envelope checks and 115,200 production frames** in total, with **142 physical missile contacts** across the silo/mixed scenes. These quantities describe offline evidence, not a frame-rate claim or exhaustive continuous simulation proof. A/B’s final runs passed four checks each (2,198 and 2,178 assertions); C/D were run by Lead against the same harness, without repeating already-passed zones.

The final sources retain **3,426** exact original scenery placements and remove **686**, preserving all terrain/water and every supported perch. There are **145 tactical attack candidates plus five generator support areas**, for **150** complete visibility areas. All four independent zone visibility proofs pass: **86,400 sampled rays plus continuous full-ground projected-cuboid checks**, with zero blockers across all 150 areas. [A](visibility-a.json), [B](visibility-b.json), [C](visibility-c.json), [D](visibility-d.json). All 16 current source/manifest/audit and frozen-baseline hashes match. Runtime wildlife/pool/lifecycle and live browser records are owned by Engineer/Lead and are separate from these tactical measurements.

The A4 generator-ground correction removes only `a4-land-5-6`, `a4-land-6-6` and `a4-land-4-7` beyond the accepted prior carve. Its original landscape, route, ten tactical sites, three perches and all other retained placements are unchanged. The final A4 therefore has 233 retained scenery placements, 59 removals and four placed defences; its visibility proof covers eleven areas.

No bridge is implemented in these sources: all routes remain on flat dry Y24 ground. The newly approved bridge option can support a future comparison across B2's river, C3's meltwater split or D4's river, but requires explicit deck/support geometry and route validation; it must preserve the water rather than silently fill it. No bridge quota, defence placement on bridges, destructibility or water combat is inferred.
