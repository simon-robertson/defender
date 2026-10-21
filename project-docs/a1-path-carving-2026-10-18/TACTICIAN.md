# A1 tactical carving: Southern Hook

**18 October 2026 · implemented, visually approved by the user.** The user reviewed the three rendered alternatives and selected **Southern Hook**: “A1 - Southern hook looks good by the way. Approved.” This supersedes the internal preference for Orchard Tour. The saved A1 is byte-for-byte identical to the reviewed Southern Hook source; no further scenery changes were made after that approval.

This is a layout preview with cosmetic wildlife, **no enemies and no actual defence units**. Candidate ground and synthetic attack probes are authoring evidence. They do not implement fixed build pads, manual deployment, waves, budgets, outcomes or campaign balance. The shared [design doc](../design-doc.md) and latest user decisions govern the task.

## Compared journeys

All alternatives use the same frozen 20×16 Limestone Orchard and the same terrain, weather-off setting, models and matching-scale diagrams. They were compared before writing the production source. Each received production Dog/Roller/Moth route-geometry checks, base/upgrade-1 gun and Arc eligibility probes, and independent full-ground overview visibility checks.

| Option | Journey | Route | Candidate ground | Base-useful boxes | Scenery retained | Principal trade-off |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| [Orchard Tour](orchard-tour.svg) | West entrance → limestone meadow → east of central grove → southern flower-belt return → east exit | 1,104 units | 34 boxes | 32 | 231/320 | Preserves the central six-tree group and makes several unequal courts, but its stronger base repeats are widely separated in time. |
| [Northern Traverse](northern-traverse.svg) | North gateway → western return → central traverse → eastern orchard loop → south exit | 984 units | 35 boxes | 32 | 227/320 | Reaches the northern/eastern landscape, but removes two limestone pieces and opens larger rectangular road frames. |
| **[Southern Hook](southern-hook.svg)** | West entrance → southwest orchard → broad southern court → northward return → eastern hook → independent east exit | **936 units** | **34 boxes** | **32** | **229/320** | The broad middle ground replaces the central six-tree mass, retaining the northern knolls, all limestone and outer orchard frame. The user preferred this more open composition. |

The figures diagnose the designs; they were not quotas or acceptance rules. The internal Artist/Lead preference for Orchard Tour is retained as review history in [Artist’s report](ARTIST.md). The user’s subsequent selection governs the implementation. The other two remain comparison artifacts only.

Original option sources, individual removal reasons and complete coverage arrays are beside these diagrams as `*.level.json`, `*.manifest.json` and `*.audit.json`. Orchard Tour was restored to its already-rendered/audited comparison state when the user selected Southern Hook; the abandoned interim meadow adjustment is not part of any final source.

## Selected route and land preservation

The continuous route uses these `[X,Z]` corners:

```text
[0,8] → [5,8] → [5,12] → [10,12] → [10,5]
      → [14,5] → [14,8] → [12,8] → [12,10] → [19,10]
```

There are **40 route boxes / 39 centreline steps / 936 units**. Its path height is Y24 throughout; terrain remains unchanged and dry. It turns south, east, north, east, south, west, south and east, giving the returns a traversal order rather than making a monotonic series of offsets. Its bounds are X0–19/Z5–12. The northern raised knolls remain scenic boundaries; no water or bridge is introduced into this intentionally dry first landscape.

The latest edge rule is satisfied: entry `[0,8]` is on the west boundary, exit `[19,10]` is on the east boundary, and all **38 intervening boxes are interior**. The first step moves inward and the last moves outward. **No segment follows a perimeter row or column.** `checkA1PathEdges()` enforces this in the A1 factory; it adds no arbitrary extra setback.

Of the original 320 scenery placements, **229 remain byte-identical**. The removal manifest records all **91** removals: 40 for route travel, 34 for full candidate ground and 17 for normal-overview visibility. The approved wider central meadow requires removing the six former trees at X7–9/Z8–9; this cost was visible in the approved rendering. Both raised northern knolls, the pillar and three wall placements, and all three bird-perch trees remain. Terrain, water metadata, environment settings and the full six-actor cosmetic wildlife metadata are unchanged. No model is edited, moved, rescaled or replaced.

The independent pre-carving backup remains untouched. [Final asset verification](verification.json) checks the selected source/factory/approval identity, the other 15 production sources and 51 backed-up model dependencies. Lead’s [preservation record](preservation.json) also verifies the frozen archive and metadata checksums.

## What the ground offers

Each candidate is one whole, visible **24×24 dry area at path height**. Related boxes form connected courts, not painted pads. Of 34 candidate boxes:

- **32 have a positive base-48-range opportunity** against Dog, Roller and Moth with both the actual gun and Arc probes.
- `[7,10]` and `[8,10]` are **upgrade-dependent interior alternatives**: base range is tangent-only and gives zero eligible length. At upgrade-1 range 72, each offers 204 units of actual gun/Arc coverage. They remain part of the user-approved open court, explicitly not advertised as base-gun sites.
- Every box supports the base gun and base/upgrade-1 Arc geometry individually. **33 support the upgrade-1 gun’s full movement envelope.** `[17,11]` does not: its upgraded gun head can rotate into the retained oak canopy. A base gun or Arc fits there; use another box for an upgraded gun. This preserves the approved scenery.

“Supports” describes geometry. It does not override the separate range qualification above. Neighbouring alternatives are not a promise that every combination of adjacent rotating guns can coexist. No simultaneous placement arrangement has been approved or certified.

The west entry strip provides forgiving timing shifts before the first corner. Its interior/outside bend alternatives then trade a longer initial engagement against later contact beside the southern court. The broad southern area supplies both close-path base choices and positions that become materially stronger with upgraded range. The northern return contains a compact repeat opportunity as well as a strong upgrade position. The east exit offers a final catch beyond all northern base coverage; upper/lower alternatives include both near-equivalent flexibility and demonstrably different upgrade/return windows.

### Actual eligible intervals

Intervals below are distances along the **entire 936-unit journey**, sampled in 1-unit midpoint bins. Gun data uses actual torso targeting, pitch limits and both muzzle rays at zero/full recoil; Arc data uses the production terminal, LOS and deterministic production facing-side surface sampling. These are opportunities, not promised damage: aim travel, cadence, cooldowns, target competition and future wave timing still matter.

| Position `[X,Z]` | Base-gun Dog intervals | Upgrade-1 gun Dog intervals | Interpretation |
| --- | --- | --- | --- |
| `[1,7]` | 0–66 | 0–92 | Earliest contact; does not cover later turns. |
| `[4,9]` | 58–186 | 58–212 | Inside early turn; retained southwest masonry trims the gun’s ray windows. Base Arc gets 54–186 and upgraded Arc gets 28–212. |
| `[6,11]` | 150–282 | 124–308 | Continuous southern inside-turn coverage, not a separated re-entry. |
| `[7,10]` | None | 114–318 | Upgrade-dependent court interior; base range only touches the route. |
| `[9,11]` | 270–402 | 244–428 | Later side of the southern court, shifting contact toward the climb north. |
| `[11,7]` | 414–498 **and** 702–738 | 388–582 **and** 676–764 | Genuine separated exposure. Base uncovered gap 204 units = **17 seconds at Dog speed 12**. |
| `[12,7]` | 678–744 | 402–768 | Strong upgrade benefit: base sees the late descent; upgrade gives one continuous northern engagement, not two separate windows. |
| `[14,9]` | 648–714 **and** 774–858 | 624–884 | Shorter repeat gap: 60 units = **5 seconds for Dog**; upgrade joins these into continuous coverage. |
| `[15,9]` | 654–690 **and** 798–882 | 628–716 **and** 772–908 | Base repeat gap 108 units = **9 seconds for Dog**. Compare `[15,11]`, which only supplies 798–882 at base range. |
| `[16,9]` | 822–906 | 642–692 **and** 796–932 | Same base interval as `[16,11]`, but upgrading the north-side position adds an earlier distinct window. |
| `[18,9]` or `[18,11]` | 870–936 | 844–936 | Independent final catch. Northern base sites stop by distance 738, so this is not redundant late-labelled ground. |

All selected base opportunities have matching positive Roller/Moth opportunities. The full per-species arrays, including small real LOS differences at the retained wall and any Arc contact retries, are in [the selected audit](southern-hook.audit.json). Model-dependent gun/Arc differences were retained rather than removing more landscape until every number matched.

The strongest individual base site covers 180 units, about 19.2% of the journey. The strongest upgraded-gun site, `[12,7]`, covers 366 units, about 39.1%, while missing the entry and the final 168 units. This supports distinct early/late choices; it is **not** a final balance or affordability claim. Overlapping intervals are not summed as unique team coverage.

## Geometry, visibility and scope of proof

- The selected route check samples **2,811 actual occupied-part poses**: one representative Dog, Roller and Moth at every 1-unit distance plus endpoints, with **19,677 part checks**. No route/scenery/terrain/map-boundary conflict was found.
- Complete gun-yaw cylinders, analytical pitch extrema and recoil endpoints were checked against static cuboids; head checks separate occupied Y layers so the wider lower skirt does not falsely enlarge the upper head. Arc uses fixed occupied-vertex bounds. Each of the four base/upgrade-1 gun/Arc sets repeats the route-versus-weapon check over all independent candidates with zero movement conflicts.
- `[17,11]` upgrade-1 gun exclusion is a **real intersection**, not only a conservative-envelope warning. An interior point in its head voxel `[2,28,20]`, at yaw 0.8382589 radians, enters the retained canopy cuboid. The precise witness is in [the clearance report](southern-hook.clearance.json). That report correctly states `allProbedCombinationsClear: false` and `declaredSuitabilityPassed: true`; the factory metadata excludes that one combination.
- All **34 full candidate ground rectangles** pass the independent normal-overview check: 19,584 ground rays plus continuous projected-cuboid clipping. There are no scenery/terrain obstructions, including narrow unsampled slivers. This is geometric visibility from the normal camera direction, not an arbitrary-orbit guarantee or a substitute for the rendered user review.
- Synthetic probes remove `previewMode` only in an offline clone so the production controllers may instantiate enemies/weapons. The actual saved source retains `previewMode: "layout"` and contains only retained scenery. No synthetic probe modifies a level or model.

The selected source passes the ordinary level/geometry contract. The factory is deterministic, its exact result equals the approved review source, its returned manifest includes every removal and its edge-policy checks pass. Lead and Engineer own the live runtime/lifecycle checks recorded separately in [Engineer’s handoff](ENGINEER.md) and [browser review](browser-review.json). Only affected checks were run; no full suite or final campaign simulation is claimed.

## Reproduction and handoff

```sh
bun scripts/a1-path-carving.js                 # Deterministic factory summary; no write
bun scripts/a1-path-carving.js --write         # Explicit A1-only regeneration
bun scripts/a1-path-carving-audit.js southern-hook
bun scripts/a1-path-carving-clearance.js southern-hook
bun scripts/a1-path-carving-verify.js
```

The lightweight async `carveMoss01()` returns `{level, manifest}`; it does not rerun tactical or visibility sampling. Heavy evidence is separate. Canonical production rebuild/preview integration belongs to Lead. Historical carving factories, old level snapshots and the frozen backup are unchanged.

Design-doc/project-brief/diary handoff: record **A1 Southern Hook selected and visually approved**, the new edge-only entry/exit rule, the landscape-only status of the other 15 levels, 229 retained scenery/91 purpose-recorded removals, unchanged six wildlife, and the qualified 32 base-useful plus two upgrade-dependent ground choices. Keep the `[17,11]` upgrade-gun limitation visible. Future defence layouts should select compatible individual sites and test their intended simultaneous arrangement before adding equipment.
