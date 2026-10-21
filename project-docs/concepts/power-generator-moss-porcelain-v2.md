# Approved power generator concept — 18 October 2026

The user approved initial design work for placeable defence enhancers, which improve defence units within range. The first item is a power generator that increases attack strength. Fire-rate enhancement was an example of a possible later item, not an implementation request.

The user accepted the revised green-highlight concept on18 October2026 (“That looks good!”), and subsequently approved all three finished [source models](../power-generator-model.md). Green maximum-emission local-light accents are implemented. Immutable `shared/enhancer.js` records carry approved strength increases .2/.3/.4, with zero fire-rate increase and cooldown decrease. The base is now placed in A1 and applies its20% bonus to edge-adjacent attacking defences. Upgrade activation ranges and costs remain unset. The later approved [plasma link](power-generator-plasma-link-v1.md) is also implemented and verified.

## Approved visual direction

[Approved concept sheet](power-generator-moss-porcelain-v2.png), generated with the built-in imagegen tool using [the saved full prompt](power-generator-moss-porcelain-v2.prompt.txt).

The sealed reactor has a broad forest-green plinth, porcelain cap, moss cooling banks and a recessed bright-green power meter. Its low, solid silhouette distinguishes support equipment from turret barrels, Arc Spire terminals and open missile wells. The sheet includes close and overview-scale views of all three arsenal stages.

- **Base:** squat central core, shallow lid and small cooling banks; proposed height about14 units.
- **Upgrade1:** deeper cooling banks, reinforced corner posts and raised cap; proposed height about18 units.
- **Upgrade2:** heavier integrated radiators and tiered casing; proposed height about22 units.

The completed models fit22×22 units in X/Z. The illustration is a shape and palette reference; its small bevels became orthogonal steps in the texture-free, matte source. Enhancers use green highlights across zone palettes at emission1 with castsLight:true. Armour and cooling surfaces stay nonemissive and all model reflectiveness stays0. This family concept originally implied no effect or animation. The separate later plasma approval permits its specific connecting effect; it does not authorise smoke or an influence ring.

## Approved data and completed base activation

The strength values are user-approved data. Only base activation has been assigned and implemented:

| Stage | Strength bonus | Activation |
| --- | ---: | ---: |
| Base | +20% | Four cardinal edge-adjacent placement boxes |
| Upgrade1 | +30% | Unassigned; inactive |
| Upgrade2 | +40% | Unassigned; inactive |

Generator and recipients must stand on dry ground at the same path height with route clearance. Diagonal neighbours and two-box gaps do not qualify; activation requires at least one attacking recipient. The earlier proposed48/72/96-unit radii were never implemented: direct adjacency supersedes the base proposal, while upgrade ranges remain unassigned. Purchase and upgrade costs remain unset.

The runtime applies only the strongest applicable generator: `effectiveStrength = baseStrength × (1 + strongestBonus)`. Overlap neither multiplies nor adds bonuses. Fractional damage is retained internally. Only attacking player defences receive the bonus; generators do not strengthen themselves or other enhancers. A zero-strength inactive weapon stays inactive.

Hitscan pulses and gun forecasts use effective strength. Missiles capture it at launch and retain it through flight; the in-flight damage ledger counts that captured value exactly once. Reset derives the bonus again from original strength without compounding. A modifier refresh clears unsupported planner reservations when strength changes; static placement edits require scene reload.

This generator changes strength only. Range, firing cadence, magazines, reloads and projectile speed are unchanged. No fuel or power-management system is included. Fire-rate enhancers remain a later design consideration.

## Review and next step

Lead inspected the sheet for three coherent stages, readable labels, palette and small-scale silhouette. The user accepted all finished models after production-renderer review; model/data checks and captures are recorded in [model notes](../power-generator-model.md). Base combat is complete with37 affected checks/1,567 assertions. Live A1 verifies first-turret10→12 and hit12, unchanged middle/late12/10, noncompounding reset and clean A1→A2→A1 lifecycle without browser errors. [Combat evidence](../power-generator-combat-browser-review.json), [active capture](../screenshots/power-generator-a1-active.jpg). Upgrade activation and costs remain open. The separate plasma effect is complete, including the user's smaller-wave/double-speed follow-up; its [concept record](power-generator-plasma-link-v1.md) links the distinct visual, test and lifecycle evidence.
