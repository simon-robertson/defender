# A3 tactical carving: Garden Confluence

**18 October 2026 · implemented for review; user acceptance pending.** The user approved A2 (“Perfect!”) and requested A3 next. Lead selected Garden Confluence after two matched renderer comparisons and independent Artist/Tactician recommendations. The active source is identical to that selected proposal: SHA-256 `e7b3b6dd37d4eb7174936ecd3016b9c8d606e4bf74bfec21e6a6370e61b9d909`.

Only A3 / Cypress Rise changes. Approved A1/A2, the other thirteen production levels, models and frozen backup remain intact. The source uses `previewMode: "layout"`: six cosmetic wildlife, no enemies or actual defence units. The [shared design doc](../design-doc.md) and latest explicit user decisions govern this work.

## Alternatives and choice

Both proposals preserve the original stream, raised cypress landforms, five limestone pieces and three bird-perch anchors. Full candidate rectangles and numbered route order appear in the same-scale diagrams; JSON sources and per-removal manifests accompany them.

| Study | Journey and opportunities | Complete route lengths | Candidate boxes | Scenery retained |
| --- | --- | ---: | ---: | ---: |
| [Single Western Return](single-west-return.svg) | Western return → upper limestone approach → one-cell stream crossing `[12,4]` → eastern loop and northeast exit. Two strong repeated encounters, but the southern orchard/ruin setting stays outside the journey. | 936 | 32 | 220/301 |
| **[Garden Confluence](garden-confluence.svg)** | Separate western garden and northeastern bank approaches → quiet lower stream crossing on the eastern approach → dry junction → shared southern meadow and exit. Branch-only choices remain useful beside the shared court. | **768 / 648** | **44** | **194/301** |

The extra route was selected for its separate settings and branch/shared placement trade-off, not a level-number requirement or count target. Artist found the dry T junction legible and the small crossing separate from it. [Artist review](ARTIST.md). The single-route option remains a valid, simpler comparison.

Both studies received natural-support/full-ground visibility checks and rough range comparison. Only selected Garden Confluence received the full actual weapon, moving-actor and missile-flight audits. [comparison.json](comparison.json) is ideal horizontal range geometry, not actual attack evidence for the unselected design.

## Route, bridge and preservation

The primary western approach uses these `[X,Z]` corners:

```text
[0,11] → [5,11] → [5,5] → [7,5] → [7,8] → [12,8]
       → [12,11] → [10,11] → [10,14] → [12,14] → [12,15]
```

The eastern approach is:

```text
[19,3] → [16,3] → [16,6] → [18,6] → [18,8] → [12,8]
       → [12,11] → [10,11] → [10,14] → [12,14] → [12,15]
```

They merge at **`[12,8]`**, distance **504** on the western route and **384** on the eastern route, then share an identical **264-unit / 12-box tail**. The full paths have 33 and 28 boxes respectively; their paved union has **49 boxes**. No crossing ambiguously implies a second junction, and routes never separate again after merging. This topology assigns no wave timing or simultaneous entrance schedule.

Every complete route obeys the edge rule: western entry `[0,11]`, eastern entry `[19,3]`, common exit `[12,15]`; the respective **31 and 26 intermediate boxes are interior**. Entry steps move inward and the last step outward. No perimeter-following segment or additional arbitrary setback is introduced.

The eastern approach crosses only water box **`[14,8]`**, between dry banks `[15,8]` and `[13,8]`. The one-unit wooden deck has **top Y24 / underside Y23**, above original **water Y22 / bed Y20**. Its full extent occupies eastern route distance **324–348**. A dry landing separates it from the junction. The water/bed remain natural terrain; deck support is additional and `flatBox()` remains null there. Defence sites are all dry land, never bridge boxes.

**194 of 301 scenery placements remain byte-identical.** All **107 removals** have purposes in [the manifest](moss-03.manifest.json): 48 dry route cells, 44 full candidate areas and 15 overview obstructions. No models are moved, replaced or resized. All five ruins, the cypress knolls, all three wildlife perches, original terrain/water/environment and six wildlife seeds are preserved. Early drafts omitted several candidate boxes whose visibility would otherwise require removing the northern pillar/wall or southern ruins; the retained alternatives still give ample useful ground.

[Final verification](verification.json) proves factory determinism, exact selected-source identity, unchanged other 15 production levels, all 66 current model sources and all 67 frozen level/model assets. Lead separately records backup metadata/archive checks and live runtime review.

## Actual placement choices

All **44 full 24×24 candidate rectangles** are visible from the normal overview and offer positive base gun/Arc opportunity against **Dog, Roller and Moth**. Their actual base classification is:

- **18 western-only alternatives**, including the cypress-side return and limestone approach.
- **14 eastern-only alternatives**, including the bank bend and stream approach.
- **12 shared alternatives**, spanning junction, southern return and final catch.

Every candidate individually fits base/upgrade-1 gun and Arc geometry, and all three silo stages: **308 combinations**, with **no weapon exclusions**. This is not a claim that arbitrary neighbouring rotating weapons can all be placed simultaneously. Candidate ground is not a new fixed-pad or placement rule.

Representative actual Dog intervals follow; the full per-species results are in [the audit](garden-confluence.audit.json) and [coverage summary](coverage.json). Values are complete-route distances, sampled in one-unit midpoint bins. These are attack opportunities, not guaranteed damage.

| Site | Western base gun/Arc | Eastern base gun/Arc | Tactical distinction |
| --- | --- | --- | --- |
| `[6,7]` | 174–258 and 318–402 | None | Genuine western re-entry, separated by 60 units / five Dog seconds. Upgrade-1 joins it into 148–428; even ideal silo range 120 does not reach the eastern route here. |
| `[17,5]` | None | 78–210 | Eastern investment, separate from western coverage. Upgrade-1 reaches 0–236. |
| `[11,9]` | 438–570 | 366–450 | Junction approach coverage, but it misses most of both early branches and the late exit. |
| `[11,10]` | 510–642 | 390–522 | Shared southern descent/turn. Upgrade-1 extends to 426–668 and 354–548. |
| `[11,13]` | 630–762 | 510–642 | Later shared return, after the junction site's base reach has ended. |
| `[13,15]` | 726–768 | 606–648 | Final interception reaches the common exit; a shorter 42-unit base window, not equal to the stronger interior court. |

The strongest individual base site covers **180 units** of either complete approach (23.4% western / 27.8% eastern). Strongest upgraded-gun coverage is 280 western units or 260 eastern units. The shared junction therefore does not replace early branch choices by coverage alone. Affordability, targeting contention, reload pressure and final difficulty remain open.

The union of all independent base alternatives has a small **12-unit eastern gap at distance 354–366**, on the dry landing after the bridge and before junction reach. It lasts one second at Dog speed. Upgrade-1 reaches it; the bridge itself is covered and the western base union has no gap. This is documented rather than adding another clearing to the selected appearance. The hypothetical union does not certify a simultaneous deployment.

## Missile feasibility and proof limits

The scoped flight study uses **five distinct sites / seven site-and-approach cases**, covering western return, eastern approach, stream crossing, both junction approaches and both late approaches. Each launches one missile with each current silo variant against each A species: **63 production flights at 1/120-second steps**.

**60 hit. Three miss** the Moth turning after the eastern merge, one per silo stage. These are valid committed-intercept misses: each completes boost, coast and powered flight, passes the committed point, then contacts ground or the stream bed. No launch departure is blocked; no flight expires or remains active; all damage claims clear. No scenery, stats or guidance were changed to force perfect hits. [Flight evidence](garden-confluence.missiles.json).

Static launcher evidence covers all 44 positions and loaded missile tips; finite flights certify only the recorded cases, not every socket, launch instant or position. The preview itself contains none of these synthetic actors or launchers.

Other selected checks pass:

- **4,254 actual route poses / 29,778 occupied-part checks**, including both complete routes and endpoints; no scenery, terrain, deck or boundary conflicts.
- Complete gun yaw, per-layer head cylinders, analytical pitch extrema and recoil endpoints; fixed Arc and conservative loaded-silo envelopes; no static or route-motion conflicts at any declared individual site. [Clearance](garden-confluence.clearance.json).
- **25,344 ground rays plus continuous projected-cuboid clipping** across all 44 full rectangles, with no obstruction. Lead/Artist independently reviewed the rendered appearance.
- Production gun checks use actual pitched muzzle rays at zero/full recoil; Arc checks use actual terminals, centre LOS and deterministic facing-side surface contact. Gun upgrade 2 remains inactive and is not counted as an available attack.

Synthetic probes remove `previewMode` only from an offline clone, keeping actual routes, scenery, terrain and deck geometry. No wave/economy/balance changes, model changes, edits to A1/A2 evidence or full-suite claim are included.

## Reproduction and handoff

```sh
bun scripts/a3-path-carving.js
bun scripts/a3-path-carving.js --write
bun scripts/a3-path-carving-audit.js garden-confluence
bun scripts/a3-path-carving-clearance.js garden-confluence
bun scripts/a3-path-carving-missiles.js
bun scripts/a3-path-carving-coverage.js
bun scripts/a3-path-carving-verify.js
```

`carveMoss03()` is a lightweight deterministic async factory returning `{level, manifest}`; it does not repeat the heavy probes. Lead owns canonical generation, shared design-doc/brief/diary records and browser review; Engineer owns final runtime/lifecycle checks. Record **A1/A2 approved; A3 implemented for review; thirteen other levels still landscape-only**. Do not infer A3 user acceptance from internal selection or technical success.
