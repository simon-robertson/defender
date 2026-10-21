# A1 path carving: Artist review

18 October 2026. Independent composition/readability review by Artist (`gpt-6.1-sol`, medium reasoning: focused review of an existing accepted landscape). [The design doc](../design-doc.md) and the latest A1-only authorisation govern this review. No other production level is in scope.

## Current user decision

**Southern Hook is selected and approved by the user after actual-renderer review:** “A1 - Southern hook looks good by the way. Approved.” This supersedes Artist's earlier internal preference for Orchard Tour. The comparative observations below remain review history; they do not authorise reverting the selected layout.

The user also established a standing route rule: **start and end at the boundary; never run along the perimeter.** Lead and Tactician are validating the selected route against it. This note records the decision, not completion of that validation. Preserve the A1-only scope and the other fifteen landscapes.

## Accepted landscape reading

Evidence: [normal overview before carving](../landscape-reset-2026-10-18/screenshots/moss-01.png), active A1 source before carving, [landscape metadata](../landscape-reset-2026-10-18/a-metadata.json), and its generator. This is deliberately a **dry orchard**. A lake, stream, new landform or new model would change its premise.

The baseline works through unequal tree masses, low meadow planting and pale limestone punctuation. The near-view groves give the scene weight; the low central meadow lets the eye travel between them. The visual success is the contrast between enclosed orchard and open ground, rather than the number of trees retained.

Source landmarks (coordinates `[X,Z]`):

- Raised western oak knoll around `[2,3]` and the smaller northeast knoll around `[12,2]`. Keep the terrain and unequal scale.
- Northern limestone group: pillar `[8,2]`, walls `[9,2]`/`[8,3]`, shrub `[7,3]`, rock `[9,4]`.
- Secondary southwest wall `[3,9]` with rock `[4,10]`; this gives the lower journey its own existing landmark.
- Central oak group around X7–9/Z8–9. It can separate playable courts without becoming a wall across their visibility.
- Low eastern/southern punctuation: cypress `[14,8]`, rock `[12,8]`, rock `[10,12]`.
- Bird-perch trees `[1,3]`, `[13,2]`, `[3,11]` and six cosmetic wildlife actors. Preserve their support.

## Visual acceptance criteria

The route should read as one journey visiting distinct parts of this orchard, with changes of direction explained by landforms/groves/ruins. Several equal parallel road bands would make the accepted place feel like leftover strips. Retaining coherent grove interiors and a few strong enclosure/opening transitions matters more than preserving every isolated shrub.

Useful ground should read as generous connected choices where practical, with visible full 24×24 areas. A line of tiny roadside holes does not establish the requested larger choice. Equivalent nearby positions can still improve freedom, but should be distinguished from different encounters in the tactical record.

The main overview risk is foliage on the camera-near side of a clearing. Its crown can conceal ground behind it even while the model footprint and firing ray are clear. Review full ground polygons independently of route support, attack LOS and occupied-model visibility. Low rocks/shrubs may also cover a candidate corner. Remove or reduce the actual obstruction; orbiting is not a remedy.

At least one retained mass should visually separate the central and final courts. The exit should have a legible approach of its own rather than disappearing into a foreground tree line. Route length, retained percentages and candidate counts do not decide this review by themselves.

## Historical source comparison before user selection

Three separate proposal sources/manifests and matching-scale SVG plans were supplied by Tactician before active carving. The SVGs were inspected as source. Lead then supplied all three actual renderer captures at matching normal-overview framing; Artist inspected each independently. These observations supported the earlier internal recommendation below, subsequently superseded by the user's Southern Hook selection.

| Alternative | Composition assessment |
| --- | --- |
| **Orchard Tour — earlier Artist preference** | The west entry, north limestone meadow, eastern side of the central grove, southern return and independent eastern exit make a journey between existing features. Both raised knolls and all six central oak trees at X7–9/Z8–9 survive. The rendered central mass forms a strong internal island separating the courts. The broad southern court reads clearly and remains subordinate to the central, foreground and eastern canopy masses. Artist requested no aesthetic trim at this comparison stage. |
| **Northern Traverse** | A different gateway and northern/eastern journey, but the early seven-box gateway is visually a long strip. The middle road removes the northern row of the central oak group. Its eastward U also cuts into an existing coherent orchard mass. This spends strong scenery to reach more board without the same landmark sequence or court separation. |
| **Southern Hook — subsequently approved by user** | The southern sweep and return below the northeast knoll are understandable, but its large middle court requires all six central oaks removed for full-ground visibility. Artist judged the lost internal separator a composition trade-off in the comparison. The user subsequently reviewed and approved this more open layout. |

Orchard Tour's revised proposal records 34 candidate boxes and 231/320 original scenery placements retained, with unchanged terrain, all three bird-perch anchors and both limestone wall/pillar groups. Those figures describe the proposal; they are not independent evidence that all boxes are useful or that the composition passes. Rock `[9,4]` and rock `[10,12]` are removed for route/site purposes; this is a smaller visual cost than removing the central grove. The three-piece northern masonry silhouette remains the landmark.

## Historical rendered comparison before user selection

Evidence: [Orchard Tour](screenshots/orchard-tour.png), [Northern Traverse](screenshots/northern-traverse.png), [Southern Hook](screenshots/southern-hook.png), all captured by Lead in the production renderer at the same overview. These are path/landscape reviews with no combat units.

**Earlier internal recommendation: Orchard Tour.** Its retained central grove creates the strongest rhythm of enclosed orchard, open court, grove edge and separate final approach. The northern knolls remain a coherent wooded backdrop, the pale limestone stays recognisable, and the road visits different parts of the place. The southern lawn is visibly broad, but canopy still carries the composition. Making it smaller merely to restore density would sacrifice the requested freedom without a demonstrated benefit. This preference is preserved as independent review history, not the current selection.

Northern Traverse looks more like two long rectangular road frames around open strips; the loss of the central grove's upper row weakens the scene's internal focus. Southern Hook keeps good outer groves but opens the centre into a continuous broad lawn/road band. Its apparent spaciousness costs the orchard's most useful internal separator. Orchard Tour has the clearest enclosure/opening transitions of the three.

No visual blocker was found in Orchard Tour's normal overview. Intended courts read as open ground, and the route's exit approach remains distinct. This screenshot review does **not** certify every point in all 34 candidate footprints, weapon clearance or attack eligibility: the separate geometric visibility and tactical audits own those claims. It does not establish campaign balance.

Initial diagnosis was sent before route selection; source and rendered feedback were sent directly to Tactician and Lead. Artist edited only this review document, not assets, models, runtime or the frozen backup, and did not open a browser. **Current acceptance: user-approved Southern Hook; route-rule validation is handled separately by Lead and Tactician.** Lead owns the selected/implemented A1 status in the design doc, project brief and diary. The other fifteen landscapes remain outside this assignment.
