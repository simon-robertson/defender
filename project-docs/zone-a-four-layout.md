# Zone A level 4: the old garden mere

This is the user-approved landscape-first experiment, not a balanced fourth campaign level. Artist created the populated [18 × 16 landscape](zone-a-four-landscape.json) before a route or defence clearings existed. Lead reviewed [the untouched landscape](screenshots/zone-a-four-landscape-before.jpg), then Tactician used the [fresh research](research/landscape-first-levels.md) and that actual composition to propose the carve. The user subsequently said it looked much better and was heading in the right direction. That feedback preserves the route/composition; the later visibility instruction requires removing anything that hides an intended placement area from the normal overview.

## Route and scenery decisions

The ordered corners, in X/Z placement boxes, are:

`[0,8] → [3,8] → [3,10] → [10,10] → [10,13] → [12,13] → [12,7] → [17,7]`

The path contains **29 distinct edge-connected boxes**, with **672 units** of centre-line travel. It enters through the western low apron, passes below the central woodland, turns between the southern groves, then returns beside the lake ruins toward the eastern exit. It does not cross water or alter terrain. Every path and defence-support box stays flat and dry at Y24. Weather remains off.

A shallower return at Z12 was compared before implementation. The selected Z13 turn removed only one additional route placement and gives the upper repeat site a substantial interval outside base range before enemies return. Its purpose is one recognisable repeat opportunity, rather than repeated hairpins throughout the map. The lake, its ruin group, southern stonework, western ridge and distant southeastern grove retain their terrain and anchor placements. Some central inner-edge canopy is deliberately removed to expose the early placement choices; preserving those trees cannot take precedence over the user's visibility requirement.

All surviving scenery retains its exact ID, model, variant, box, rotation and detail offsets. Nothing is moved or replaced; no new scenery/model is introduced. The [audit manifest](zone-a-four-layout-audit.json) lists every removed placement and its reason, all four additions and exact sampled site intervals. `route`, local defence clearings, generator support and `placement-area visibility` are distinct reasons. Camera visibility is reviewed separately from physical collision and attack LOS.

The final level retains **236 of the original 292 scenery placements** and adds four approved defence items, for **240 placements**. Its 56 removals comprise 31 route placements, 13 local candidate-clearing placements, one generator-support placement and 11 placement-area visibility obstructions. All 21 mound boxes, 24 water boxes and seven ruin pieces are unchanged. The visibility pass removes the identified low-edge obstructions as well as canopies, including three tiny boundary occlusions; `[13,8]`/`[13,9]` young oaks remain because they do not obscure any candidate ground area.

| Scenery family | Baseline | Retained |
| --- | ---: | ---: |
| Oaks: ordinary / young / tall | 32 / 37 / 12 | 26 / 34 / 10 |
| Cypresses: ordinary / short | 4 / 14 | 3 / 11 |
| Rocks / shrubs | 50 / 29 | 42 / 22 |
| Grass / pebbles / flowers | 88 / 10 / 9 | 68 / 9 / 4 |
| Ruin pillars / walls | 3 / 4 | 3 / 4 |

## Mixed preview and meaningful alternatives

| Placed item | Box X/Z | Ground centre XYZ | Current attack |
| --- | --- | --- | --- |
| Base gun | [4,9] | [108,24,228] | Range48; strength12.5 after generator |
| Base generator | [4,8] | [108,24,204] | +25% to the adjacent gun only |
| Base Arc Spire | [11,10] | [276,24,252] | Range48; strength30 |
| Base missile silo | [15,8] | [372,24,204] | Range72; captured strength60; two-round magazine |

These are existing approved models and attack rules. Cadence, health, movement, range, effects and targeting remain unchanged. The current A roster stays three Dogs, two Rollers and two Moths. No player placement interface, waves, prices or campaign progression are implemented by this experiment.

There are **ten distinct candidate boxes**, three currently occupied by weapons and seven empty alternatives. These are authoring examples, not fixed build pads or a complete future placement rule. The generator has a separate support box.

| Candidate | Box | Ideal covered route length at R48 / R72 / R96 (units) | Base-gun eligible route-distance intervals (units) |
| --- | --- | --- | --- |
| Early entry | [2,9] | 131.14 / 163.88 / 188.95 | 6–138 |
| Early turn, placed gun | [4,9] | 131.14 / 183.76 / 233.90 | 54–186 |
| Early straight | [5,9] | 83.14 / 183.76 / 233.90 | 126–210 |
| Upper repeat, placed Arc | [11,10] | 148.71 / 251.65 / 375.50 | 264–330 and 438–522 |
| Middle repeat | [11,11] | 166.28 / 279.76 / 329.90 | 270–354 and 414–498 |
| Lower turn | [11,12] | 179.14 / 241.55 / 296.09 | 294–474, continuous |
| Late approach | [14,8] | 83.14 / 193.55 / 227.14 | 558–642 |
| Late middle, placed silo | [15,8] | 83.14 / 115.88 / 207.50 | 582–666 |
| Late exit | [16,8] | 65.57 / 91.88 / 116.95 | 606–672 |
| Late opposite side | [16,6] | 65.57 / 91.88 / 116.95 | 606–672 |

The early choices trade immediate interception for coverage later along the first straight. The upper/middle repeat sites have two distinct windows; the lower site instead covers the connecting turn continuously. The late choices cover the final third (448–672), beyond the early gun's reach. The two exit-side alternatives intentionally offer the same geometric timing on opposite sides; they are counted as two physical choices, not two different tactical roles.

Ideal lengths are exact horizontal circle/route intersections. Eligible intervals use **one-unit midpoint bins**, actual canonical Dog/Roller/Moth poses, the real gun's ±35° pitch limit and both muzzle rays at zero and full recoil. Their rounded edges are not exact continuous boundaries or guaranteed damage. The base intervals above match for all three species; the audit separately records upgrade-1 gun checks at R72. R96 is geometric comparison only: gun upgrade2 remains inactive. A hypothetical gun survey at the Arc/silo sites does not predict their random surface strikes or committed missile contacts; those are verified by actual mixed combat.

## Wildlife and verification

The retained perch trees are `a4-land-1-2`, `a4-land-16-12` and `a4-land-3-14`. Ground habitat seeds use the empty candidate cells [5,9], [11,12] and [16,6]. Lead owns their runtime bindings and navigation checks.

The focused layout checks verify deterministic source reproduction and subtraction, exact retained scenery/terrain, supported clearings, actual occupied-part bounds for Dog/Roller/Moth across 2,019 sampled poses, and clearance from static scenery plus the full gun yaw/pitch/recoil envelope and loaded silo noses. Every candidate has positive live gun LOS/pitch coverage. The mixed simulation observes actual damage from all three weapon families to all three enemy species collectively, captures missile damage claims once, preserves one thinker per frame and resets health/poses/magazines/claims without compounding the generator. Sampled geometry and a fixed combat fixture do not establish final wave balance or continuous collision proof for every possible future placement.

The final source passed all **four focused layout checks, 57,346 assertions**. A subsequent test-only extension places an actual base-gun source in each of the ten candidate boxes and validates occupied-cell overlap/support; that selected source check passed **623 assertions**. No level changed for this extension. All 14 pre-existing level files retain their pre-task SHA-256 hashes. No full-suite run was made.

Final level SHA-256: `de00431c2891bbee449df11fe6fe392801449848e28363f59458b084edd858f1`. Artist's independent [placement-area visibility audit](zone-a-four-visibility-review.json) matches this source and passes for all ten complete 24×24 ground areas at the normal yaw2.45/pitch0.68 overview: zero retained-scenery/terrain obstruction, checked with 5,760 one-unit rays plus continuous occupied-cuboid projection/clipping. It considers all 236 retained scenery placements without a distance filter. Lead owns the final browser/runtime evidence. These checks concern this source and the existing fixed-roster preview, not campaign difficulty.

## Reproduce

`bun scripts/zone-a-four.js` creates only a missing `assets/levels/moss-04.json`; `--write` explicitly rebuilds that one file. It imports Artist's frozen landscape factory and never regenerates the other levels or models. `bun run seed:zone-a-four` is the project alias.

Run the four affected checks with `A4_AUDIT_OUTPUT=docs/zone-a-four-layout-audit.json bun test tests/zone-a-four-layout.test.js`. The optional output contains the full removal manifest, world centres and per-species/variant eligibility intervals. The saved level remains the runtime authority. Lead integrates the A4 selector, missile actors, wildlife, browser review and shared design/diary records.
