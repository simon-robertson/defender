# Production scenery remake

The user requested larger square levels rebuilt from scratch and a production-quality model pass. The lead approved rebuilding all 35 existing scenery sources and adding eight reusable silhouette variants of those same prop categories. The accepted turret and mechanical dog designs stay intact; this scenery module does not change their geometry, rigs or materials. New enemy concepts follow level completion and require a separate creative review.

## Source ownership and integration

Artist owns [production-scenery.js](../scripts/production-scenery.js) and this document. It imports the lead's [model-builder.js](../scripts/model-builder.js). Lead owns the existing generator wrappers, saved model/level files and integration. Tactician owns the square layouts and clear defence courts; Engineer reviews runtime costs and renderer coverage.

`productionSceneryModels()` returns all 43 canonical, authorable model sources. `productionSceneryModels('A')` (or B/C/D) returns just that zone. The function does not write files or retain generated sources. The existing 35 IDs remain stable; eight new IDs provide controlled silhouette variety. Every model has one static `body` part in `base`; the format's two unused upgrade slots remain empty. The sources are marked `role: 'scenery'` and `colorMode: 'authored'`.

These are explicit integer-cell sculptures. Constructive box/crown operations union into one occupancy map; later operations can deliberately recolour an occupied cell. Erasure makes cracks and chipped silhouettes. Final source has no duplicate cells. Meshing removes internal surfaces and greedily merges exposed faces with equal materials. Nothing is rebuilt or randomised per frame.

## Shape direction

Large forms establish the silhouette; a few purposeful secondary forms explain material and construction. Fine random cell noise is deliberately absent. Tree crowns have visible forks and branch gaps, rocks have substantial fractures and shelves, and masonry uses staggered courses with recessed supporting cores rather than floating blocks. Tall/young variants change canopy proportions, not merely colours. Low props keep a much lower profile than the previous block shrubs.

| Zone | Rebuilt visual vocabulary | Colour hierarchy |
| --- | --- | --- |
| A, Moss & Porcelain | Asymmetric oak lobes on three branch forks; narrow uneven cypress columns; broken limestone courses, garden pillars and split low ledges; small grouped shoots/flowers. | Deep foliage undersides, moss/olive upper masses, warm neutral bark and limestone. Scenic highlights remain quieter than porcelain defences. |
| B, Ochre & Petrol | Ribbed cacti with unequal arms; connected sandstone towers with vertical clefts and restrained sediment shelves; buttressed eroded walls; spreading dry scrub and thick succulent shoots. | Ochre/sandstone forms retain large quiet colour areas. Muted green plants and dusty flowers provide secondary separation without copying the forest silhouettes. |
| C, Ice & Ember | Separated tapering fir boughs with uneven snow caps; fractured slate monoliths, angular low ledges and snow-lipped masonry; sparse alpine plants. | Neutral snow over evergreen branches and slate; warm-grey path and ivory/ember defences remain distinct. Snow caps are authored solid cells, matte and texture-free. |
| D, Plum & Mint | Offset umbrella crowns on visible horizontal forks; airy taller trees; open stepped arches and broken arch springs; buttressed neutral ruins and fractured low rock. | Plum/mauve belongs mainly to foliage. Stone remains neutral; mint is reserved for the accepted defence armour and tiny subdued flowers. |

All material emission and reflectiveness values are zero. Palette variants follow broad forms and top/side roles, with no random speckles or texture overlays. The zone palettes remain guidelines; related shades are used to express form without a uniform zone tint.

## Catalogue and placement

The existing category IDs continue to work in older studies. The eight additional IDs are:

| Zone | New ID | Occupied height | Suggested composition role |
| --- | --- | ---: | --- |
| A | `scenery-oak-young` | 32 | A smaller forked crown between larger woodland clusters. |
| A | `scenery-cypress-short` | 37 | A shorter narrow vertical accent. |
| B | `ochre-cactus-young` | 28 | A compact single-fork cactus. |
| B | `ochre-mesa-low` | 26 | A broad stepped transition below the tall crags. |
| C | `ice-fir-young` | 31 | A narrower, shorter fir for grove transitions. |
| C | `ice-pillar-broken` | 21 | A fractured low monolith with snow on exposed shelves. |
| D | `plum-tree-young` | 32 | A two-crown fork with an open underside. |
| D | `plum-arch-broken` | 27 | One surviving arch spring and a shorter opposite pier. |

All X/Z cells stay inside one 24-unit placement box. Existing primary trees reach 42–58 units; cacti/mesas reach 45–47; major ruins reach 25–43; low rocks/shrubs reach 9–14; tiny props reach 3–8. A model taller than one box is scenery, not permission to raise defence sites.

Tactician's reserved route strips, defence courts and firing fans remain completely clear: no shrubs, detail props, water or raised ground inside them. Tall scenery belongs outside the route's immediate eight-neighbour collar and forms broken peripheral/background groups. Avoid a continuous foreground tree fence. Keep unit-offset detail models inside their allowed boxes; low props must not spill into clear courts. Existing enemy-route height, box alignment and slab treatment remain unchanged by these sources.

For the larger levels, Artist recommends coherent broad patches of the existing low-contrast ground colours rather than a repeating four-colour box checker. This is material assignment within the accepted palette; no texture or renderer feature is needed. Lead owns that integration and final scene review.

## Authoring verification

The source API validates all 43 models with the shared schema. Checks confirm all 35 pre-existing scenery IDs are present, unique IDs, deterministic generation, static single-part geometry, integer in-bounds occupancy, and zero emission/reflectiveness. A six-neighbour connected-component audit confirms every solid component reaches local ground Y=0: supported trees/masonry plus intentional separate grounded fragments and plants. This caught and corrected two unsupported masonry courses by adding recessed cores.

| Zone | Sources | Occupied cells | Greedy quads | Maximum occupied Y |
| --- | ---: | ---: | ---: | ---: |
| A | 12 | 28,430 | 2,378 | 58 |
| B | 10 | 28,021 | 1,200 | 47 |
| C | 10 | 25,456 | 1,791 | 58 |
| D | 11 | 20,989 | 1,867 | 52 |
| Total | 43 | 102,896 | 7,236 | 58 |

Counts describe the entire unique-source library, not simultaneous rendered instances or a performance benchmark. These are compile/load-time costs. Repeated placements share immutable meshes through the existing instancing path; extra variants should be used purposefully rather than increasing every scene's unique model count without a composition need.

Built-in-browser path/day/night validation and integrated level/source checks belong to the lead. No complete test suite was run for this source-only assignment; the standing policy is affected checks only.

## Composition review completed

Artist reviewed the initial four overviews and Zone A close view, and requested one bounded composition pass. The first layout left several scenic anchors looking like isolated sample props. Extra mass was needed around those anchors, not inside the protected route and defence courts.

Artist supplied 26 additional substantial prop coordinates and 38 tiny-detail coordinates. Every coordinate was checked against the existing route, clear courts, towers, water and occupied boxes. Tactician integrated them without changing tactical reservations: A gained 8 props and 10 details, B 5 and 8, C 7 and 10, D 6 and 10. Final placement counts, including the three preview turrets, are **62 / 64 / 65 / 60** for A–D.

Artist signs off the refreshed daytime [A overview](screenshots/production-a-overview.png), [A close view](screenshots/production-a-close.png), [B overview](screenshots/production-b-overview.png), [C overview](screenshots/production-c-overview.png) and [D overview](screenshots/production-d-overview.png). The additions create stronger grove, crag and ruin groups with low-scale transitions; broad gaps still separate these groups. A reads as woodland around open defensive ground, B retains desert spacing, C has distinct snowy groves and shore fragments, and D's plum groves frame the pale cloister route. Routes and defence silhouettes remain immediately visible. No further model, palette or placement changes are requested for this pass.

This is approval of the implemented scenery/composition pass for user review, not a declaration that every eventual campaign level is finished. Player placement, waves and further environment content remain separately scoped. The user remains the final creative reviewer. Artist did not control the browser or infer animation/night results from daytime stills.

## Next enemy concept brief — proposals only

**Subsequent selection:** the generated sheet is saved in [concepts](concepts/enemy-lineup-v1.md). The user approved B Walker and D Spider for modelling, and set A Brambleback and C Cinderhaul aside as too similar to dog. The following table preserves the original four-design brief; it does not override that selection. See [the two approved model sources and rig notes](enemy-models.md).

After the level review, the lead may generate one labelled four-panel concept sheet. The following are unimplemented visual proposals; names and dimensions are provisional. They imply no abilities, weapons, health, speed, armour rules or other mechanics. Preserve the accepted dog's industrial mechanical family without merely recolouring its silhouette.

| Zone / working name | Proposed silhouette | Proposed W × L × H | Colour separation |
| --- | --- | --- | --- |
| A · Brambleback | Broad low mechanical beetle on six articulated legs, with a stepped protective back and compact forward sensor. | 20 × 22 × 15 | Dark forest shell, warm-stone spine, restrained vermilion sensor. Dark underside separates it from the pale route and porcelain turrets. |
| B · Walker | Narrow tall industrial biped, angular reverse-knee legs, compact forward upper body and broad grounded feet. | 13 × 18 × 27 | Terracotta/ochre outer plates, dark petrol mechanics, small neutral armour panels. Avoid making the entire body sand-coloured. |
| C · Cinderhaul | Wide low four-legged machine with a heavy horizontal central body and substantial exposed joints. | 23 × 20 × 18 | Dark slate/navy mass, small ember frontal panels and ice-neutral joint covers. Retain strong contrast against snow and ivory defences. |
| D · Spider | Flat central machine on six long folded outrigger legs; a wide low silhouette distinct from the domed Brambleback. | 23 × 23 × 14 | Deep aubergine lower body, pale-grey shell segments and muted coral sensors. Avoid mint dominance because mint identifies player defences. |

Each panel should show a clear three-quarter view and a small top silhouette on a 24 × 24 footprint guide. Label the sheet **Enemy design proposals** and use the working names. Authoring remains texture-free, matte, axis-aligned in each rigid part; limbs can rotate at joints. Broad readable forms and mechanical joints matter more than surface detail. The image is a visual reference, not proof of fit, rig clearance or engine readiness. No new enemy source or gameplay implementation is authorised by generating the sheet.
