# Missile launcher development test levels

On 18 October 2026 the user approved the vertical missile-launcher concept, its three model variants, guided missiles with finite magazines and timed reloads, and a third test level in every zone. The subsequent flight direction explicitly requires an initial vertical thrust burst, an engine-off coast while the missile rotates, then reignited guided thrust. Purchase and each upgrade cost **3 tokens**; this remains future-game metadata rather than an enabled spending interface.

**Current verification:** the four saved level sources and their actual-model world builds pass the focused checks below. Lead also verified the integrated A/B/D combat previews, C's idle full magazines, reset, level shortcuts and complete scene replacement in the built-in browser. [Integrated browser evidence](missile-browser-review.json) and [shared flame/bloom GPU checks](missile-bloom-gpu-review.json) are separate from the original level-source checks.

## Paired layouts

Each third level retains its zone's accepted first-level route, terrain, scenery, water and author lighting. Only the three existing gun-turret placements become the missile-launcher base, upgrade 1 and upgrade 2. The same surroundings allow direct comparisons with the turret and Arc Spire studies. These are development studies, not a proposed campaign difficulty curve or new enemy roster.

All launchers stand on dry, flat ground at path height **24**, with quarter-turn 0. The fixed bodies are 14/18/22 units high, giving world-space tops of 38/42/46. Their 22 × 22 pads stay inside the existing 24-unit defence boxes. Loaded missiles extend the tops to 41/45/49; missiles are runtime actors and are not additional saved level placements. The launchers and missiles have matte, nonemissive materials, with no static local-light clusters. The separately approved procedural thrust flame follows the on/off/on flight phases.

| Zone | Source | Base box X/Z | Upgrade 1 box X/Z | Upgrade 2 box X/Z | Route boxes | Placements |
| --- | --- | --- | --- | --- | --- | --- |
| A | `assets/levels/moss-03.json` | 2, 6 | 5, 6 | 9, 10 | 30 | 106 |
| B | `assets/levels/ochre-03.json` | 4, 7 | 9, 9 | 4, 12 | 35 | 97 |
| C | `assets/levels/ice-03.json` | 4, 3 | 6, 5 | 11, 11 | 33 | 98 |
| D | `assets/levels/plum-03.json` | 10, 2 | 8, 4 | 3, 2 | 31 | 102 |

Names append “· Missile launcher study” to the corresponding first-level title: The old waterway, The sunken aqueduct, The frostwater pass and The violet cloister. Weather is saved off. Runtime integration reuses A's dogs, B's Walkers and D's Spiders; C remains without enemies. Existing cosmetic wildlife remains outside targeting and damage. Shift+3 and the bottom level selector follow the existing developer-navigation convention; ordinary 1–4 still changes zone.

## Provisional combat contract

The lead approved the initial Tactician values, then increased each launch gap by 0.2 seconds and strengthened flight/exhaust after the user requested a higher, faster, more violent sequence. The subsequent user decision sets all launch gaps to1.0 second; the table shows that current trial. They are tuning values, not final campaign balance. The larger range distinguishes the guided launcher from the Arc Spire; travel time, obstruction losses and empty-magazine downtime limit its effective output.

| Variant | Horizontal range | Damage per impact | Loaded missiles | Minimum launch gap | Reload after final launch | Ideal sustained damage/second |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Base | 72 | 60 | 2 | 1.0 s | 4.0 s | 24.0 |
| Upgrade 1 | 96 | 75 | 4 | 1.0 s | 4.5 s | 40.0 |
| Upgrade 2 | 120 | 90 | 6 | 1.0 s | 5.0 s | 54.0 |

The ideal rates are magazine damage divided by `(magazine − 1) × launch gap + reload`, assuming uninterrupted eligible targets and every missile eventually hits. They exclude initial flight delay and losses. A 300-HP target requires 5/4/4 hits respectively. Existing turret and Arc values are unchanged.

Range is inclusive horizontal centre-to-centre distance checked at each launch. Once launched, a missile keeps its assigned target even if that target leaves acquisition range. It applies damage once, on physical contact; there is no damage at launch, splash, chaining or retargeting. Death, removal or route wrapping invalidates the assigned target and expires its missile. An eight-second lifetime bounds any unsuccessful pursuit.

`requiresLineOfSight` is explicitly **false** for all three launcher variants: a direct launcher-to-target ray does not describe a vertical departure and curved flight. The actual swept flight segment checks scenery and terrain and discards an obstructed missile without damage. Launch admission uses current range; prediction happens from the airborne missile when main thrust reignites, not from the launcher through the straight-intercept admission gate.

Each successful launch consumes one missile from the 2/4/6-cell magazine. The complete magazine must be exhausted before reload begins; no partial top-up occurs. Reload starts on the final actual launch, prevents all firing, then restores the full magazine even if no target is currently eligible. Target changes neither refill nor reset the magazine. Successive launches may acquire different targets, but each missile already in flight retains its original assignment. Loaded rounds already own their pooled actors. If too few free slots remain when the reload timer ends, full refill waits with the magazine empty; no flying missile is stolen and no partial refill occurs. Frame stalls must not replay missed launches as a catch-up salvo.

The existing shared planner still lets only one defence rank candidates per frame. All controllers continue their movement and safety checks each frame. Missile speculative future-damage credit is **zero**: neither an in-flight missile nor an unlaunched magazine promises a later kill to another defence. This conservative policy avoids claiming downstream coverage before the actual guided route, contact and target lifetime are known.

## Provisional flight tuning

| Phase | Tuning | Purpose |
| --- | --- | --- |
| Vertical thrust | 64 units/second for 0.50 seconds | Raises the missile root 32 units, including the user's latest 25% height increase. |
| Engine-off coast | 0.40 seconds; gravity 40 units/second²; attitude rotation up to 360°/second | Retains momentum while turning, with no freeze or thrust. From the initial vertical speed, this adds 22.4 units of height and leaves 48 units/second upward velocity. |
| Guided thrust | Cruise speed 120 units/second; acceleration 420 units/second²; turn limit 240°/second | Commit to the predicted point at reignition. At nose-distance22, cut flame/light and retain velocity/attitude with no braking/reignition; misses are allowed. |
| Entire flight | Maximum 8 seconds | Expires unsuccessful pursuits and bounds retained actors. |

The authored seats are at local Y 7/11/15 and decks at Y 14/18/22. The missile's local positive Y axis is its nose direction. Socket, origin and clearance metadata live in `shared/missile-model.js`; the level generator does not duplicate them. The coasting attitude may rotate while its trajectory continues under momentum and gravity. The guided phase must preserve position continuity when thrust returns.

## Source and regeneration

`scripts/missile-launcher-levels.js` exports `missileLauncherLevel(zone)` and derives fresh data from the accepted production layout generator. Existing level 1 and level 2 sources and all model files are untouched.

```sh
bun scripts/missile-launcher-levels.js         # Create missing studies only.
bun scripts/missile-launcher-levels.js --write # Explicitly regenerate all four studies.
```

Regeneration uses the production-generator baseline, not later manual edits to saved first levels. The ordinary command preserves existing third-level sources; `--write` deliberately replaces only these four study files. The runtime builds geometry from the saved model references, so no compiled level asset is needed.

## Verification on 18 October 2026

`bun test tests/missile-launcher-levels.test.js`: **2 tests, 100 assertions pass**. The first compares every saved study to the reproducible generator and the corresponding saved first-level route, terrain, environment, scenery and placement sites. The second builds all four worlds from the actual model sources, exercising solid overlap, terrain/water clearance, dry path-height defence support and occupied-cell route clearance. It verifies all three fixed launcher rigs, three static silo model-light clusters, zero light overflow and disposal of world references.

SHA-256 hashes for all eight existing level-1 and level-2 sources match the pre-work baseline. The normal create-missing command was run again and preserved all four new studies. No browser checks or full test suite were run as part of the original bounded level assignment. Lead subsequently verified the integrated preview and the approved emissive-highlight follow-up; the final level checks still pass, and [lighting evidence](missile-highlight-browser-review.json) records three silo lights with no missile local lights.
