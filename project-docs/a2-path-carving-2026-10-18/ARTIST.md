# A2 bridge and path carving: Artist review

**Subsequent user decision:** A2 was explicitly approved on 18 October ("Perfect!"); A3 is authorised next. Pending-review statements below describe the original handoff.

18 October 2026. Artist uses the retained `gpt-6.1-sol` / medium assignment for focused visual/composition review. [The design doc](../design-doc.md), current contributor instructions and latest explicit A2 authorisation govern this work. Artist owns this review file only; no browser, asset, model or runtime edits.

## Scope and baseline

The authorised comparison is A2 / **The Broadwater Garden**, with a winding route, visible useful defence ground and a **1-unit-thick wooden-plank bridge**. Its walking surface is at path height 24; water and bed remain untouched. No actual enemies or defences, railings, pillars or new effects are implied. Preserve approved A1, the other fourteen landscapes, models, wildlife support and the frozen backup. User selection/approval of the A2 result remains pending.

Evidence: [accepted landscape overview](../landscape-reset-2026-10-18/screenshots/moss-02.png), Lead's [fresh untouched production capture](screenshots/baseline.png), active A2 source before carving, [landscape metadata](../landscape-reset-2026-10-18/a-metadata.json), and the landscape generator. Both captures were inspected.

Broadwater's identity is the contrast between a substantial irregular eastern lake and wooded western mainland. The water has a broad northern basin, western inlet and narrowing southern arm, with visible low shelves. The overview shows a large bright open water mass framed by unequal orchard groups and pale limestone. The bridge should give that water a new journey relationship while retaining its scale and stepped shoreline.

The mainland's pillar `[7,6]` and walls `[8,6]`/`[7,7]` form a useful existing landmark; wall `[4,12]` gives a separate lower landmark. Rocks `[9,7]`, `[9,11]`, `[17,9]` and cypresses `[1,5]`/`[12,14]` punctuate banks and planting. Coordinates are `[X,Z]`, not screen directions. Bird-perch anchors `[7,1]`, `[16,1]`, `[2,13]` need supported trees. Landmark retention is a composition consideration, not a blanket prohibition on justified clearing.

## Initial guidance sent to the team

Compare different bank-to-bank journeys: a crossing of the narrower southern arm and a crossing through the broader basin can establish different arrival order, bridge prominence and placement trade-offs. A bridge should visibly connect dry land on both ends, with water readable beside its span. Avoid a long route that merely traces the shore to increase distance. Keep the water/bed unchanged and distinguish bridge travel from dry bank placement ground; the deck is not an approved defence site.

Make the useful ground understandable from the normal overview, with full 24×24 candidate areas visible. Review foliage/low props masking court corners independently of physical support and firing LOS. Do not impose arbitrary candidate counts or canopy-retention rules. Judge each removal by useful ground and the resulting whole composition.

For Engineer: broad transverse wooden planks, a few muted warm brown/tan material variations, and clean orthogonal seams can convey timber without textures. Keep a matte, nonemissive surface visibly distinct from pale paving and green water. Avoid dense alternating checkerboards or fine grain marks that disappear at play scale. A continuous supported top must remain continuous despite visual plank divisions. The deck is 1 unit thick, with no rails/pillars by default; no extra lighting/effects are needed.

Engineer subsequently specified top Y24/bottom Y23, 24-unit continuous support width, broad 4-unit transverse plank courses and occasional 1-unit dark flush joints, with real exposed slab sides. Surface partitions avoid coplanar overlays or travel gaps. Artist agrees this is suitable for the first render; final joint frequency/value will be assessed at overview and closer scale. The optional bridge source record describes straight water-only spans with dry banks; engineering validation is separate from this art review.

## Three rendered alternatives

Artist inspected all three proposal sources/manifests and Lead's actual same-framing renderer captures: [Garden Crossing](screenshots/garden-crossing.png), [Lower Arm](screenshots/lower-arm.png), [Northern Reach](screenshots/northern-reach.png). These are independent composition observations, not results inferred from the scenery counts.

| Option | Visual reading |
| --- | --- |
| **Garden Crossing — recommended** | The bridge is an immediate central event in the lake, with visible water on both sides. Mainland turns, surviving limestone and the separate post-crossing southern shore court create a legible sequence. The lake remains substantial despite the central division. Clear land around both bridge ends makes the support relationship understandable. |
| **Lower Arm** | The broad uninterrupted basin remains attractive and preserves the greatest continuous water emphasis of these two views. The bridge feels more peripheral to the lake composition, however, and the long later bank/exit traverse reads as a corridor beside a broad open lawn. Its different order of traversal is valid; the visual sequence is less distinct than Garden Crossing's. |
| **Northern Reach** | Keeps a handsome continuous lake and all source ruins, but near-view tree crowns conceal a substantial bridge-end segment and bank transition. That weakens the clarity of the requested new crossing. Its dry-land journey also feels concentrated around one masonry-side court, while Garden Crossing separates the mainland and post-crossing decisions more clearly. Keeping more scenery is not sufficient reason to prefer this composition. |

Garden Crossing and Lower Arm appear readable at the supplied normal overview. All **32 Garden Crossing candidate areas** read as open ground in that view; no visual blocker was found. This image assessment does not establish exact zero occlusion at every footprint point: full candidate-footprint visibility and weapon opportunities need their own geometric/tactical checks. The warm brown bridge and broad transverse plank courses are visibly different from limestone and green water; the thin deck fits the requested construction. No extra detail, railings, pillars or lighting is requested.

Lead's [bridge-detail capture](screenshots/bridge-detail.png) also passes Artist review. Broad timber courses and darker flush joints read as wooden planks at close scale. The thin exposed edge, clear water beside/below the span and level limestone-to-timber joins make the construction understandable without rails or posts. No material/detail tuning is requested. Night appearance remains unreviewed.

Both first options remove wall `[7,7]` for candidate-ground overview visibility while retaining pillar `[7,6]` and wall `[8,6]`; the remaining ruin group still reads as an existing landmark. That is a justified visible-ground trade-off, not a failure to preserve an arbitrary scenery count.

## Review status

Initial baseline/bridge guidance was sent directly to Tactician and Engineer before option selection. First rendered comparison was sent independently to Lead, Tactician and Engineer; the final three-way composition review was sent directly to Lead and Tactician.

**Artist recommends Garden Crossing for user review.** Its bridge is fully legible and central to the journey, the lake still reads at substantial scale, and the dry courts before/after the span make a stronger sequence than the alternatives. Bridge overview and close appearance pass. This internal recommendation is not user acceptance: **user approval remains pending**. Keep composition/readability, geometric support/full-ground visibility, weapon opportunity and campaign balance as separate conclusions. Artist edited only this review file, with no browser or asset changes. Lead should record the eventual A2 selection/implementation, bridge status and review limits in the design doc, project brief and diary; current approval for A1 and the other fourteen landscapes must remain intact.
