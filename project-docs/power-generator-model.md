# Power generator model

**Single-version enhancer campaign integration, 21 October (implemented for review):** Power Generator is now purchasable/deployable at a provisional 4-token price, with one +25% version and no upgrades. Four same-height edge neighbours receive a non-stacking strength bonus; guns/Arcs use effective damage and missiles capture it once at launch. Movement/recall/upgrades/waves rebuild cached bindings and existing green links. Only base pools/review options are used; historical taller geometry remains. 133 distinct affected tests, 48 actual GPU checks and real earned-token purchase/deploy/recall/weapon-upgrade flow pass. Plasma capacity128 covers the conservative campaign economy bound; no new pass/viewport image. Active B2 run stays untouched; cost/appearance await review. [Delivery and limits](enhancer-campaign-2026-10-21/README.md).

The user approved modelling the [second concept sheet](concepts/power-generator-moss-porcelain-v2.png) on 18 October 2026, with green identity highlights at emission 1 and `castsLight: true`, then approved all three finished models. The original asset pass excluded gameplay and placement. Subsequent work places and activates the base generator in A1 and each zone’s level 4 as described below; upgrade activation ranges and costs remain unset. The later [plasma-link concept](concepts/power-generator-plasma-link-v1.md) is implemented and verified without model changes.

## Shape and source

The family is a broad sealed reactor: common forest plinth, porcelain stepped cap, moss cooling banks and four green vertical bars facing negative Z. Upgrades add taller corner braces, larger side radiators and an additional capped upper tier. The last stage has dark coupling bands in its ivory corner inlays. One-cell steps replace the concept’s illustrative bevels; fin recesses are actual empty geometry backed by connected solid housings. Every stage has one fixed `body` part, parent `null`, pivot `[12,0,12]`, and `role: "defence"`.

| Variant | Occupied X × Y × Z | Cells | Exposed unit faces | Merged quads | Green area |
| --- | --- | ---: | ---: | ---: | ---: |
| Base | 22 × 14 × 22 | 3,790 | 2,318 | 223 | 16 |
| Upgrade 1 | 22 × 18 × 22 | 5,074 | 2,750 | 311 | 28 |
| Upgrade 2 | 22 × 22 × 22 | 6,070 | 3,114 | 361 | 36 |

All occupied X/Z bounds are `[1,23]`; Y begins at zero. The shared authoring volume is `[24,22,24]`. Geometry is integer-grid, connected, texture-free and matte, with no overlapping cells or separate overlay surfaces.

Canonical source: [power-generator.json](../assets/models/power-generator.json). Generator: [scripts/power-generator.js](../scripts/power-generator.js), exporting `powerGeneratorModel()`. Derived output is `build/models/power-generator.mesh.json`, 895 total quads. The generator creates a missing file and preserves an existing source unless `--write` is explicit.

```sh
bun scripts/power-generator.js
bun scripts/power-generator.js --write
bun scripts/compile.js assets/models/power-generator.json
```

The lead added the equivalent `seed:power-generator` package command and owns the isolated production review page and palette integration.

## Materials and lights

The model retains the existing 17-slot arsenal material meanings. Identity slots 4/14/15 are green instead of vermilion:

| Slot | Name | Source colour |
| --- | --- | --- |
| 4 | Power green | `#5FEA38` |
| 14 | Power green highlight | `#8BFF61` |
| 15 | Power green shade | `#37AD28` |

All three identity materials have emission 1 and `castsLight: true`; all other materials have emission 0. Every material has reflectiveness 0. Only slot 4 is used on the four exposed front meter faces. Their neighbouring housing, upper/side faces, ordinary moss cooling banks and forest mechanisms remain nonemissive.

The four separated bars produce **four local-light clusters per variant**, not one light per green cell. Viewing all three models together uses **12 clusters with zero overflow**. The subsequent A1 placement increases model-light capacity from21 to25 to preserve the existing21 sources plus this generator's four. No hidden connections or alternate green face shades were added to manipulate clustering. The shared A–D palette mapping recolours ordinary arsenal armour while retaining all three green identity colours and their lighting properties.

## Verification

`bun test tests/power-generator.test.js` passed **4 tests / 17,533 assertions**. Checks cover canonical source/generator agreement, model validation, one-part hierarchy, common footprint, increasing dimensions, connected occupancy, real fin gaps, sealed caps, exactly four exposed front bars, independent unit-face/merged-mesh agreement without duplicates, material properties and all-zone runtime light clustering. Selective compilation passed for this model only. Other assets and levels were not changed by the Artist.

Source SHA-256: `9356ddafdabab96dfd2c1c7ef4f61734218e9b3a1bea13c0a700434d314efd79`.

The lead owns production day/night visual review and the user approval gate. Structural checks establish asset correctness; creative acceptance was confirmed separately by the user.

Artist reviewed the lead’s [production day family capture](power-generator-review-day.jpg): the sealed caps, cooling banks and green meters follow the approved concept, and the three heights read clearly at a common scale. Green remains legible in daylight while the ordinary armour stays crisp. The [night capture](power-generator-review-night.jpg) also preserves four distinct bars per model, with green light visible on the front housing and ground ahead of the plinth. Both art reviews found no blocking issue or need for geometry changes.

On 18 October 2026 the user approved all three finished models: “Those models look good to me.” Model approval is complete. All14 pre-existing levels and58 other models retain their source hashes; see [asset proof](power-generator-asset-proof.json). The isolated browser review verified all/individual views, A–D palette switching, day/night,12 combined lights without overflow and balanced scene-buffer replacement. [Browser evidence](power-generator-browser-review.json).

## Shared enhancer data

The subsequent user request adds `ENHANCER_STATS` and `defineEnhancerStats` in [shared/enhancer.js](../shared/enhancer.js), separate from geometry. Each family has base/upgrade1/upgrade2 records requiring `strengthIncrease`, `fireRateIncrease` and `cooldownDecrease`. All are finite numeric fractions from0 through1, inclusive. Zero means no change; .25 denotes a25% increase or decrease. Increase values describe multipliers of1+value; cooldown decrease describes a duration multiplier of1-value. Data remains independent of combat; the later runtime applies the approved base strength modifier below.

The latest user-approved generator strength increases are .25/.5/.75, superseding the original .2/.3/.4; fire-rate increase and cooldown decrease are0 at every stage. Records are defensively copied and frozen. Future approved fields extend the central validation list and family records. The original `bun test tests/enhancer.test.js` run passed3 checks/109 assertions for bounds, malformed inputs, immutability and source-variant alignment. The review cards display these values. Only base coverage has since been assigned; upgrade activation ranges and costs remain unset.

## Historical first placement

At that milestone, A1 contained one base generator (`power-generator-1`) at box[3,0,6],turn0, beside base turret `scene-1` at[2,0,6]. Both sit on dry ground at path height24. The22-unit generator base stays inside its box and its green front faces the path. All106 original placements and other level fields remain intact. `firstLevel()` includes this approved addition; that original production rebuild used the factory for A. The current rebuild supersedes those source IDs and locations. The shared production layout remains the baseline for A2/A3, so the generator does not spread to those studies.

The initial placement milestone created no weapon controller and left10/12/10 turret strengths unchanged. Its eight placement/animation/aiming checks and ten capacity checks passed, alongside25+17 model/damage GPU cases. The browser confirmed25 live model sources after enemy reset, zero overflow and green illumination in day/night. [Historical placement evidence](power-generator-placement-browser-review.json), [source preservation](power-generator-placement-proof.json), [day capture](screenshots/power-generator-a1-day.jpg). The next combat milestone activates its modifier without changing these models.

## Completed base enhancement

The base activates when at least one attacking defence occupies a cardinal edge-adjacent placement box on the same dry path-height ground. It can benefit all four neighbours; diagonals and two-box gaps are excluded. This supersedes the proposed48-unit base radius. `game/enhancer-preview.js` caches valid bindings once, before cooperative planning, then applies `strength = baseStrength × (1 + strongestIncrease)`. Multiple generators cannot add or multiply bonuses, inactive zero-strength weapons remain inactive, and generators do not enhance one another. Original shared stats stay immutable and fractional damage is retained.

Hitscan pulses and gun coverage forecasts consume effective strength. Missile launches capture the effective value in their flight slot; actual contact and incoming-damage accounting use that same value exactly once. Attack range, cadence, cooldown, magazine and reload are unchanged. R reapplies the cached bonus from original strength, never compounding it; changed effective strength invalidates planner reservations. Placement/model edits require scene reload. Disposal restores borrowed weapon strength and clears bindings. No per-frame adjacency search or additional thinker is introduced.

At the initial +20% milestone, **37 affected checks / 1,567 assertions** passed: six enhancer checks /139, three independent integration checks /193 and28 missile/planner checks /1,235. Mixed production geometry verifies actual14.4 gun,36 Arc and72 missile damage, matching forecasts and flight claims. Live A1 confirms `scene-1` strength10→12 and hit12; the middle/late strengths remain12/10. Reset does not compound, A2 has no generator, previous CPU/GPU scene counters clear and returning to A1 restores the modifier without browser errors. [Combat evidence](power-generator-combat-browser-review.json), [active A1 capture](screenshots/power-generator-a1-active.jpg).

## Implemented plasma connection

The accepted [wobbly green plasma link](concepts/power-generator-plasma-link-v1.md) uses fixed faces on the existing models, with copied endpoints and a smooth tube, pale core and whole-length green light. No receiver geometry, branching, sparks or smoke is added. Engineer implemented the effect/renderer, Artist attachment helpers and visual review, and Lead integration/browser verification. Initial 26 affected tests and 44 GPU checks pass. The later smaller-wave/double-speed tuning passes five fresh pool checks and live review; T/R/rain and A1→A2→A1 are clean. The combat verification above predates this separate [plasma evidence](plasma-browser-review.json). [Current tuning and costs](engine.md#generator-plasma-connections-18-october).

## Strength retune (18 October)

The user increased power-generator strength bonuses to **25% / 50% / 75%** for base/upgrade1/upgrade2, replacing 20% / 30% / 40%. Updated shared immutable data, combat expectations and the plasma review label. Fire-rate/cooldown scalars remain zero; base adjacency and strongest-only application are unchanged. Upgraded-generator activation ranges/rules and costs remain unassigned.

All **12 targeted enhancer/unit/integration checks pass (419 assertions)**, covering real gun/Arc/missile damage, forecasts, flight claims and reset/disposal. Enhanced strengths are 15 for the upgrade-1 gun, 37.5 for the base Arc and 75 for the base missile. Browser review displays all three new percentages; live A1 confirms the first base turret at 12.5 strength and an actual 12.5-damage hit, with middle/late turrets unchanged at 12/10, one plasma link and no browser errors or warnings. A1 remains open at normal speed. [Browser evidence](power-generator-strength-browser-review.json).

## Placement after the sixteen-level rebuild

Current A1 places `a1-generator` at `[4,0,5]` beside base gun `a1-defence-1` at `[4,0,6]`, both at dry Y24 ground. Its fixed plasma endpoints are `[107.5,34.5,139]` and `[107.5,35.5,152]`, a span of `sqrt(170)` units. A1 damage remains 12.5/12/10. Each level 4 contains one base generator with exactly one adjacent recipient: A gun, B Arc, C silo and D silo. No geometry or enhancement rules changed.

The final seven affected enhancer/plasma integration checks pass (133,937 assertions), including true fixed-surface endpoints, exact damage, reset without compounding and disposal. These current saved-source checks select units by model/variant/adjacency instead of historical IDs. [Rebuild evidence](level-rebuild-2026-10-18/README.md).
