# A2 tactical carving: Garden Crossing

**Subsequent user decision:** A2 was explicitly approved on 18 October ("Perfect!"); A3 is authorised next. Pending-review statements below describe the original handoff.

**18 October 2026 · implemented for user review; visual acceptance pending.** Lead selected Garden Crossing after three actual-renderer comparisons and matching Artist/Tactician recommendations. Only `moss-02` changes. Approved A1 and the other fourteen production levels remain untouched.

The [shared design doc](../design-doc.md) governs this work. The user authorised A2 carving and a one-unit wooden-plank bridge, with review before any further levels. This source is a layout preview: six cosmetic wildlife, no enemies and no actual defence units. Candidate ground is authoring evidence, not fixed build pads or a new placement mechanic.

## Compared journeys

All three use the same frozen 20×16 Broadwater Garden. Diagrams show the complete 24×24 candidate rectangles and numbered route order at matching scale. Original option sources and individual removal reasons accompany them.

| Option | Journey | Route length | Water span | Candidate boxes | Scenery retained | Principal trade-off |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| **[Garden Crossing](garden-crossing.svg)** | West entry and return → limestone garden → central lake crossing → eastern bend → southern court and exit | **984** | **144** | **32** | **171/258** | Strongest separation of western repeat positions and later shoreline choices; central bridge remains visible with open water on both sides. |
| [Lower Arm](lower-arm.svg) | North entry → western garden → lower-arm crossing → eastern-bank climb → northeast exit | 864 | 120 | 34 | 182/258 | Shorter uncovered crossing and a broad uninterrupted basin, but the later ground reads as a narrower bank corridor. |
| [Northern Reach](northern-reach.svg) | West meadow return → upper limestone garden → northern crossing → short eastern descent | 744 | 144 | 28 | 191/258 | Retains all four limestone pieces and more scenery; raised upper-bank terrain rules out full visible ground at X10–12/Z2, and the later journey is more linear. |

These are comparisons, not quotas. All three received full-ground visibility-based carving and rough range geometry. Only the selected Garden received the expensive production route, weapon, LOS/pitch/contact and independent clearance audits. [Comparison data](comparison.json) must not be mistaken for actual attack evidence for the rejected alternatives. Artist’s actual-render review is recorded separately in [ARTIST.md](ARTIST.md).

## Selected geometry and preservation

Route corners `[X,Z]`:

```text
[0,7] → [4,7] → [4,3] → [6,3] → [6,9] → [9,9] → [9,8]
      → [17,8] → [17,10] → [15,10] → [15,13] → [11,13] → [11,15]
```

The route has **42 boxes, 41 centreline steps and 984 world units**. Entry `[0,7]` and exit `[11,15]` are boundary boxes; all **40 intervening boxes are interior**. The first step moves inward, the last outward, and no segment runs along a perimeter. `checkA2PathEdges()` enforces this without imposing an extra setback.

The bridge crosses precisely the six water boxes **X11–16/Z8**, with natural dry landings `[10,8]` and `[17,8]`. Its deck is **one unit thick**, underside **Y23**, walking surface **Y24**, flush with the existing path. Original water remains **Y20**, with its original stepped bed below. The route stays straight over water and may turn after reaching dry land. Deck traversal has explicit walking support; `flatBox()` correctly remains null over water, so the bridge is never advertised as defence ground.

**171 of 258 scenery placements remain byte-identical.** The [final manifest](moss-02.manifest.json) records all 87 removals: 36 for dry route travel, 32 for full candidate ground and 19 for normal-overview visibility. Wall `[7,7]` is removed to expose candidate ground; pillar `[7,6]`, wall `[8,6]` and southwest wall `[4,12]` remain. Both raised landforms and all three supported bird-perch trees remain. There are no moved, resized or replacement models.

Terrain, water metadata, environment and all six wildlife seeds/perches are unchanged. [Final verification](verification.json) proves exact factory/source identity, preservation of the other 15 production levels, all 66 current model sources and all 67 frozen level/model assets. Lead owns the separate archive/backup-metadata checksum and live lifecycle evidence.

## Useful ground and actual coverage

All **32 complete dry 24×24 boxes** have positive base-range opportunities against Dog, Roller and Moth with both the actual gun and Arc. All 32 individually accommodate the base and upgrade-1 gun and Arc geometry; **there are no per-weapon exclusions or upgrade-dependent-only boxes**. Adjacent alternatives are not a promise that every simultaneous arrangement will fit.

The western return supplies genuine separated exposures, the limestone-side positions shift contact toward the lake approach, and the eastern bend and southern court cover different later portions. Final-catch ground reaches the exit after the east-landing base sites have stopped reaching the route.

Intervals below are route distance, sampled in one-unit midpoint bins. Guns use real pitch limits and both muzzle rays at zero/full recoil; Arc uses the production terminal, centre LOS and deterministic facing-side contact sampling. These are opportunities, not promised damage or final battle balance.

| Position | Base gun/Arc Dog windows | Upgrade-1 gun Dog windows | Purpose |
| --- | --- | --- | --- |
| `[1,6]` | 0–66 | 0–92 | Earliest entry choice. |
| `[5,4]` | 126–306 | 100–332 | Sustained northern turn coverage. |
| `[5,5]` | 102–186 and 246–330 | 66–356 | Separated base re-entry, 60-unit gap = five seconds for Dog. Upgrade joins the exposures. |
| `[5,6]` | 78–162 and 270–354 | 52–188 and 244–380 | Longer separated return: 108-unit base gap = nine seconds for Dog. |
| `[7,5]` | 246–330 | 210–343 | Masonry-side opportunity; upgraded Arc reaches 210–356, while retained masonry trims the gun rays. |
| `[9,7]` | 456–522 | 402–548 | Western bank approach and start of bridge. |
| `[16,9]` | 606–786 | 580–812 | Eastern landing and following turn, separate from western deployment. |
| `[18,7]` | 654–690 | 628–716 | Shorter outside-bank alternative: 36 units of base opportunity, not equal to the inside-bend position. |
| `[14,12]` | 774–906 | 738–932 | Southern inside-turn choice. |
| `[10,15]` | 942–984 | 906–984 | Distinct final catch; east-landing base opportunities end by 786. |

Full per-species intervals and summaries are in [the production audit](garden-crossing.audit.json) and [coverage.json](coverage.json). The strongest individual base position reaches 180 units, about 18.3% of the journey; the strongest upgraded gun reaches 290 units, about 29.5%. The route therefore leaves substantial work for other regions. Range-96 upgrade-2 gun figures in the generic audit are ideal geometry only; that gun stage remains inactive and is not counted as available attack coverage.

### The intentional bridge gap

The deck occupies route distance **516–660**. Even the union of all independent dry-bank candidates cannot reach its middle:

- **Base range 48:** route **522–606**, 84 units uncovered; seven seconds at Dog speed 12.
- **Upgrade-1 range 72:** route **548–580**, 32 units uncovered; about 2.67 seconds for Dog.

These are **actual gun and Arc results**, identical for all three surveyed species. The rough alternative comparisons leave base/upgrade gaps of 60/8 units on Lower Arm and 108/56 on Northern Reach. Garden was selected for its broader journey and distinct before/after courts, not because it minimises this gap. There are no bridge defence pads, water infill or stat changes to eliminate it. Future waves and arsenal composition must account for it; no campaign balance claim is made.

## Scope of evidence and reproduction

- **2,955 route poses / 20,685 occupied-part checks:** Dog, Roller and Moth at every whole-unit distance and endpoints; no scenery, terrain, deck or map-boundary conflict.
- **128 individual site/weapon combinations:** complete gun-yaw envelopes, per-layer head cylinders, analytic pitch extrema and recoil endpoints; fixed Arc bounds; all pass static and route-motion clearance. [Clearance report](garden-crossing.clearance.json).
- **32 full ground rectangles:** 18,432 normal-overview ground rays plus continuous projected-cuboid clipping; no obstructions. Rendered composition was checked independently by Lead/Artist.
- Probes operate in an offline clone with `previewMode` removed only to admit synthetic production actors/weapons. The saved source stays `previewMode: "layout"` and contains only retained scenery. No wave, economy, stat, model or historical-fixture changes.

```sh
bun scripts/a2-path-carving.js                       # Summary; no write
bun scripts/a2-path-carving.js --write               # A2-only regeneration
bun scripts/a2-path-carving-audit.js garden-crossing
bun scripts/a2-path-carving-clearance.js garden-crossing
bun scripts/a2-path-carving-coverage.js
bun scripts/a2-path-carving-verify.js
```

The deterministic async `carveMoss02()` returns `{level, manifest}` without heavy probes. Lead owns canonical builder integration and shared design-doc/brief/diary updates; Engineer owns bridge/runtime checks. Record A2 as implemented for review, with user acceptance pending, while retaining A1’s approved status and the remaining fourteen landscape-only levels.
