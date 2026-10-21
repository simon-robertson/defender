# Layout design response

**Tactician · 17 October 2026 · diagnosis and original Zone A proposal.** The user has authorised rebuilding A first once the team agrees, then reviewing it before deciding anything about B–D. This document proposes geometry; it does not change a level, runtime feature or placement rule.

## What the previous review missed

I assessed clear routes, visible turrets, empty ground and positive range coverage. Those checks established technical usability, but did not establish interesting placement decisions. The prior signoff should have made that distinction explicit.

The [Researcher's study](tower-defence-layouts.md) supports a different starting point. Its inspected Kingdom Rush maps organise land around recognisable bends and returns; the Bloons examples distinguish inner repeated-exposure areas from broader alternatives; Defense Grid's official gallery distinguishes active tower spaces from scenic ground. These are observed examples, not universal rules or evidence of Defender's final balance. The response below adapts the relationships, without copying any map geometry or importing fixed pads, intersections, branches or player-built mazes.

The square boundary is not itself the problem. Our working assumption that activity should be spread across it, with every nominally useful box protected from scenery, produced broad similar lawns and displaced most landscape into peripheral groups. Generous usable space became a target in its own right. Generosity should instead leave multiple understandable alternatives around a few distinct decisions; it cannot guarantee mistake tolerance before deployment budgets and waves exist.

| Current layout | Specific weakness under the 48-unit base range |
| --- | --- |
| A | Each of its three showcase positions has the same single 131.14-unit base-range interval around a right-angle bend. Their timing differs, but their local geometry repeats. There is no compact repeated-exposure pocket. |
| B | The apparent central candidates `[6,6]` through `[9,6]` have no positive base-range interval: the two horizontal lanes are each 48 units away. They look central but need upgrade range. Near the turn, `[10,6]` does gain coverage from the vertical connector; parallel-line arithmetic alone would miss that. |
| C | Its three showcase positions also each have one 131.14-unit base interval. Reorienting the separated bends changes the silhouette more than the local coverage choice. |
| D | `[4,4]` genuinely reaches two journey intervals, but they are separated by about 77.1 seconds at the current dog speed. Total route length and total coverage conceal that long interruption. Whether this becomes useful later depends on waves and targets; the current preview does not demonstrate it. |

These are plausible contributors to the user's reaction, not a claim to have measured their subjective cause. Increasing scenery density alone would not resolve them.

## Original A study: one return, a later turn, a clear exit

Retain the **16 × 16** boundary, **24-unit boxes**, dry path and defence ground at **Y24**. Proposed route corners in `[X,Z]` boxes:

`[0,5] → [8,5] → [8,7] → [4,7] → [4,11] → [15,11]`

This is one nonrepeating, edge-connected route: **30 boxes / 696 centre-line units**. Its current-speed traversal would take 58 seconds. That is a geometric consequence, not an intended wave duration or difficulty target. No crossings or new path system are needed.

The compact return has two-box centreline separation, leaving one row of land whose box-centred defences can positively reach both passes at base range. A separate later bend and exit stretch provide different journey timings. Nearby outer ground remains available for less efficient choices; the narrow shared strip does not become the only permitted placement area.

Schematic of the relevant rows; the full board remains 16 × 16. `E` is entry, `X` exit, arrows show route order, letters are comparison candidates rather than prescribed build pads:

```text
     0123456789012345  X
Z 04 ................
  05 E>>>>>>>v.......
  06 ..a..bcdv.......
  07 ....v<<<<.......
  08 ....v...........
  09 ....v...........
  10 ....ve...f...g..
  11 ....>>>>>>>>>>>X
  12 ................
```

| Candidate | Purpose to compare | Base-range journey intervals, units | Coverage at 48 / 72 / 96 units |
| --- | --- | --- | --- |
| a `[2,6]` | Early contact | 6.43–89.57 | 83.14 / 165.43 / 245.04 |
| b `[5,6]` | Earlier first pass, later return | 78.43–161.57; 270.43–353.57 | 166.28 / 271.53 / 377.90 |
| c `[6,6]` | Two passes with a shorter interruption | 102.43–185.57; 246.43–329.57 | 166.28 / 289.55 / 344.09 |
| d `[7,6]` | Continuous exposure around the turn | 126.43–305.57 | 179.14 / 231.76 / 300.45 |
| e `[5,10]` | Later bend | 366.43–497.57 | 131.14 / 183.76 / 300.45 |
| f `[9,10]` | Later straight | 510.43–593.57 | 83.14 / 135.76 / 246.35 |
| g `[13,10]` | Final catch opportunity | 606.43–689.57 | 83.14 / 115.88 / 140.95 |

The b/c/d comparison is deliberate. At base range, d has slightly more continuous exposure; c instead has two windows separated by about 5.1 seconds and gains more geometric coverage at range 72. The early and final candidates reach different portions of the journey. This establishes distinguishable geometry and timing, **not** a claim that each choice is equally strong or strategically optimal. Upgrade 2 remains inactive; its 96-unit column is geometry only.

### Calculation semantics

Distances begin at the first path-box centre and increase once along the ordered route. A circle is intersected with each finite path segment; adjacent covered intervals are merged along route distance. Each candidate's total sums its own disjoint intervals exactly once. Two covered passes mean two different times in one enemy's journey, not double coverage of the same route section. Do not add different candidates' totals to claim unique team coverage: their intervals can overlap, and combined firing needs the actual combat simulation.

Tangent-only contact has zero positive route length, although the engine's inclusive boundary can allow a shot at the exact instant. The values above assume unobstructed horizontal range, not muzzle clearance, acquisition delays, damage or wave outcomes. The calculations use the current `productionPath`/`productionCoverage` helpers without changing layout data. Researcher's two/three/four-box spacing diagram is correct with its stated straight-segment assumptions; end turns and finite endpoints must still be evaluated explicitly.

## Bounded implementation experiment for team review

1. Agree this one A route and its decision areas before dressing it. Keep B–D, defence/enemy models, stats, cadence and all mechanics unchanged. Use existing terrain and scenery assets only.
2. Reserve connected calm ground around the early approach, the return and the later stretch. Include nearby positive-coverage alternatives on the outer sides; do not regenerate a uniform protected strip around every in-range cell. Zero-base-coverage reserve ground must not be presented in our design review as equivalent to a useful alternative. No new placement overlay or fixed-pad system is proposed.
3. Artist should compose one dominant grove/ruin anchor around the return, an asymmetric water edge, and a quieter late area. Large scenery must frame the pockets and keep the actual oblique view readable. Avoid matching corner clusters and a decorative perimeter fence.
4. Engineer should check the proposed candidates with actual paired muzzle-to-torso rays, rotating/recoiling turret bounds and dog gait. The narrow return must not require a new range or collision exception. Review one candidate at a time before assuming adjacent defence sites can all be occupied together.
5. Compare a few preview arrangements with the same dogs and existing combat values, recording acquisition, firing and journey intervals. The team selected `[2,6]` base, `[5,6]` upgrade 1 and `[9,10]` base after Engineer's geometry and flat-ground simulation review. Unlike `[6,6]`, whose range-72 coverage joins into one continuous interval, `[5,6]` retains two 135.76-unit windows separated by 56.24 units. The selected arrangement demonstrates reacquisition and spreads the preliminary simulation's shots 16/52/14 across the turrets. Actual dressed-scene validation subsequently reproduced that result; these remain preview placements, not final deployment advice.
6. Review A with the user before applying the design principles elsewhere. Success means the main engagement areas and nearby alternatives are understandable at gameplay scale, with measurably distinct exposure patterns and no blocked route or accidental visual trap. Empty-box totals remain a clearance diagnostic, not the definition of success.

## Implementation status

After this proposal, lead, Artist and Engineer approved the A-only authoring pass. `scripts/production-layouts.js` now implements the route, selected showcase turrets, explicit courts, one eastern woodland/ruin mass and the asymmetric western water margin. Its per-plan reservation switch leaves generated B/C/D JSON byte-identical. The revised A source validates. Artist and Tactician reviewed [the implemented overview](../screenshots/zone-a-research-overview.png) and confirmed the stated pocket/late-area hierarchy and visible route, with no further placement correction requested before user review. Actual scenery/LOS tests and browser operation belong to lead/Engineer. No new mechanics, assets or runtime code were added by this layout edit. [Current counts and review state](../production-levels.md).

Deployment budgets, wave composition, repair/upgrade economics and the eventual tolerance for poor placements remain unresolved.

Final lead/Engineer closeout: [51 affected checks and geometric/LOS limits](../zone-a-layout-review-engine.json) and [browser review](../zone-a-layout-review-browser.json) are complete. The implemented A study is ready for user review. B–D remain unchanged pending that decision.
