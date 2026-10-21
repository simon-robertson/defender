# A4 Tactician handoff

**Ruin and Mere Tour is implemented for review.** Tactician used gpt-6-astra / xhigh for the spatial/coverage comparison, within the user’s Extra High ceiling. Lead selected the dry tour after comparing two complete proposals in the production renderer; Artist independently agreed. The latest user request authorises this A4 carve before the separate A1 drone/enemy test. User acceptance of the final A4 appearance remains distinct from internal selection and technical verification.

[Options and maps](OPTIONS.md) · [Artist review](ARTIST.md) · [final source manifest](moss-04.manifest.json) · [verification](verification.json).

## Selected journey and preservation

The single 47-box route measures **1,104 units**, entering at `[0,9]` and exiting at `[10,15]`. All45 intermediate boxes are interior; no segment runs along the boundary. The order is southwest ruin court, western woodland return, central masonry, lower mere shore, eastern return and southern catch. The corrected eastern neck leaves full unpaved ground at `[13,8]`, so incoming and returning roads do not suggest an unintended junction. No merge or bridge is needed for this option.

The rejected Northern Crossing offers a longer northern journey and preserves all seven ruins, but has longer continuous courts, no separated base-range revisit among its surveyed plots and greater woodland removal. Its bridge is an alternative study, not active A4 geometry.

Selected A4 retains210 of324 scenery placements, both raised groves, all24 original water boxes and all wildlife seeds/perches. Five ruins remain; walls `[10,6]` and `[11,8]` are removed for the route. The114 removals each have a recorded purpose:51 route travel,44 full candidate ground and19 overview visibility. Several boxes contained extra small details, so placement counts exceed box counts. There are no moved/added scenery placements, altered terrain/water/environment, model edits, enemies or actual defences.

At A4 handoff, all85 pre-task asset hashes were checked: only `assets/levels/moss-04.json` differs; the other15 levels, all67 model sources and all67 frozen backup assets match. This is a dated A4 preservation result before the separately authorised A1 test, not a claim about later edits. The exact saved source equals the reviewed revised proposal and two independent factory calls.

Source SHA256: `1e2970b40e61d6a5dd7be857114ce25f8b28d40b08518af5c8816dcc291ca33c`.

## Placement choices and actual opportunities

All40 surveyed full24×24 areas are visible from the normal overview. **37 offer positive actual base gun and Arc opportunities against Dog, Roller and Moth.** `[5,9]`, `[5,10]` and `[11,11]` require upgraded range; they remain optional connected support/alternative ground, not extra base-useful plots. The shortest base opportunity is36units at `[18,10]`; `[11,15]` gives42units of final contact. These are practical shorter alternatives, not equivalent to the stronger inner returns.

The following actual base gun/Arc intervals agree for all three tested species. Values are distance along the complete route in world units, sampled in one-unit midpoint bins.

| Ground | Base eligible intervals | Choice |
| --- | --- | --- |
| `[4,10]` | 54–138 | Early southwest contact beside the retained ruin court. |
| `[6,7]` | 318–402 | Later woodland approach; does not substitute for the entrance. |
| `[13,8]` | 576–690; 846–912 | Separated mere-side encounters,156-unit gap. |
| `[15,8]` | 654–738; 798–882 | Shorter60-unit return gap; upgrade1 joins this into continuous628–918 coverage. |
| `[12,9]` | 558–624; 864–930 | Earlier contact and a much later return,240-unit gap. |
| `[11,14]` | 990–1104 | Distinct114-unit final catch, beyond the strong earlier return sites. |

The156/60/240-unit revisit gaps correspond to13/5/20 seconds for Dog at12units/s,9.75/3.75/15 for Roller at16, and7.8/3/12 for Moth at20. These are travel-time differences, not promises of shots or damage. Gun aim/cadence, enemy state and placement combinations still matter.

Independent eligible-site unions deliberately exclude incompatible weapon variants. Base gun leaves162–178 uncovered for Dog/Roller (162–174 for Moth), and522–534 for all three; base Arc leaves162–174 and522–534. Upgrade1 Arc covers the route, while upgrade1 gun retains a4-unit Dog/Roller gap174–178. These short masonry-side gaps are recorded honestly; no balance change or extra scenery removal was made to erase them. An independent union is not a simultaneous defence arrangement or summed team damage.

## Physical and visibility limits

The route passes3,315 production enemy poses and23,205 occupied-part checks. All40 areas pass23,040 ground rays plus continuous projected-cuboid clipping over their full footprints at normal yaw2.45/pitch0.68. Artist separately inspected the production image; geometric visibility is not a GPU contrast test.

Individual full-motion clearance passes for39 base guns,37 upgrade1 guns, all40 base/upgrade1 Arcs and all40 of each silo stage. Explicit gun exclusions preserve the reviewed landscape:

- `[5,10]`: both gun stages excluded; the full-yaw head envelope reaches the retained southwest wall `[5,11]`.
- `[2,11]` and `[18,10]`: upgrade1 gun excluded because its swept head/guns reach retained adjacent oak crowns. Base guns remain clear.

The conservative sweep audit does not certify these excluded combinations; Arc and silo alternatives fit. Clearance-ready counts differ from range-useful counts. Adjacent plots are alternatives and are not certified as simultaneously occupied.

Forty-five finite single-flight probes cover five distinct early/woodland/shore/southern/late arrangements × three silo variants × Dog/Roller/Moth. All45 launch, hit, resolve and release claims; none expire, lose targets or collide with static scenery. These production guidance/contact probes establish representative feasibility, not universal hits or campaign balance. Offline clones remove `previewMode` only to admit synthetic actors; the saved level remains layout-only.

## Reproduction and integration

`carveMoss04()` in `scripts/a4-path-carving.js` is deterministic and bounded: frozen baseline hash, fixed route/removal inventory, source validation and edge/site checks. Heavy probes run separately. `bun scripts/a4-path-carving.js --write` writes only active A4 and its manifest. Focused commands are the A4 `audit`, `clearance`, `coverage`, `missiles` and `verify` scripts; no full suite was run by Tactician. The clearance report intentionally has `allProbedCombinationsClear:false` and `declaredSuitabilityPassed:true` with the four declared weapon exclusions.

Lead owns canonical preview integration, runtime/browser lifecycle evidence, shared design-doc/brief/team/diary updates and user presentation. Relevant shared-doc change: A4 is now an implemented layout with the above limitations; A1–A3 remain approved, B–D remain populated landscapes, and the separate A1 drone/enemy test follows this handoff. No waves, economy, stats, new models or drone combat are introduced here.

Lead’s completed integration handoff:19 relevant runtime/route/bridge tests pass with44,296 assertions. Live A4→A3→A4, path view, six wildlife/zero enemies and release of54 old buffers/CPU references pass with zero browser errors. [Browser evidence](browser-review.json). The A4 preservation checkpoint was saved before Engineer began the separately authorised A1 runtime work; no further A4 edits or probes are needed.
