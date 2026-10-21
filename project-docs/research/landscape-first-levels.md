# Landscape-first levels: evidence and the A4 trial

**Researcher · 18 October 2026 · fresh source review and proposed evaluation criteria.** All external sources below were accessed on **18 October 2026**. The approved experiment is to build **Zone A level 4** in two stages: Artist first creates a populated landscape **without paths or reserved defence clearings**; Tactician then carves the route and useful defence ground into that landscape. The lead owns integration and implementation status in [the design doc](../design-doc.md#landscape-first-level-design).

## Finding

Good candidates for this trial have a recognisable landscape, a readable journey and sites whose different coverage gives the player a reason to choose between them. A long winding path and a high count of empty cells are insufficient evidence. Measure where attacks can actually happen, which parts of the journey those attacks cover, and what scenery changes were needed to create those opportunities.

The sources support those concerns, but **do not establish that landscape-first production is generally better than route-first production**. This is the user's bounded experiment. The earlier [17 October study](tower-defence-layouts.md) recommended route studies before dressing; that order is superseded for A4 only. Do not quietly pre-design a route, leave tactical lawns in Artist's baseline, or treat preserving every baseline tree as more important than making the later route work.

The research is based on developer writing, an interview, official release notes and official map images. No reference game was played and no video was watched. The current-project [Zone A path/soil capture](../screenshots/path-soil-a.jpg) was inspected for context; it shows an earlier A2 appearance milestone, not A4 or the latest mixed roster. Its broad central open ground and peripheral scenery make the proposed change of workflow understandable, but a screenshot cannot establish combat quality.

Artist's delivered input is now preserved as [the uncarved source](../zone-a-four-landscape.json) and [its before capture](../screenshots/zone-a-four-landscape-before.jpg). The source read confirms **18 × 16 boxes, 292 scenery placements, an empty path and weather off**. The capture visibly carries scenery through the interior as well as around the lake and borders. These are first-stage observations; this research report does not certify the subsequent carve, gameplay or final appearance.

## Source-supported findings

The middle column reports evidence. The last column is our interpretation, **not** the source author's prescription for Defender.

| Subject | Source-supported fact | Interpretation for this trial |
| --- | --- | --- |
| Route clarity and repeat exposure | Hidden Path CEO Jeff Pobst describes single-path levels as easier to understand, and open areas as enabling creative play, including routing enemies past towers more than once. He says levels should present different situations building on what players learned. [2011 developer interview](https://truepcgaming.wordpress.com/2011/09/21/hidden-path-entertaiment-interview-defense-grid-the-awakening/). | Keep one unmistakable authored journey. Seek a deliberate return near useful ground, but let its position follow the delivered landscape. Defender does not adopt player-built mazes. |
| Difficulty and learning | In the same interview, Pobst reports an early test where a struggling player wanted another attempt because they knew what to try next; he distinguishes this from frustration with controls. This is one team's reported observation, not a controlled result. [Interview](https://truepcgaming.wordpress.com/2011/09/21/hidden-path-entertaiment-interview-defense-grid-the-awakening/). | A reviewer should be able to name an alternative site and explain its benefit. Do not label A4 balanced or harder solely from its shape. |
| Art, visibility and revision | Art director Dave McCoy describes establishing Defense Grid's environmental identity through visual development, then encountering LOS problems with low weapons in tall environments. Generic pylons made weapons difficult to distinguish; the team explored distinct whole-tower silhouettes and reviewed 3D views. [First-person art account, 2009](https://www.gamedeveloper.com/design/from-concept-to-execution---the-art-of-i-defense-grid-the-awakening-i-). | Scenic composition and firing geometry need a feedback pass. For Defender, adjust scenery and carving within the authorised scope; do not raise defence ground or redesign accepted towers to rescue a view. |
| Scenery is not one kind of obstruction | Ninja Kiwi's v39.0 editor documentation separately describes paths, props, LOS blocking and placement blocking; certain props can have LOS blocking disabled. [Developer update notes, 2023](https://store.steampowered.com/news/posts/?appids=960090&enddate=1700181328&feed=steam_community_announcements). | Maintain separate checks for traversable route, dry support, model clearance, attack LOS and camera visibility. Defender's actual solid scenery remains authoritative; no new blocking flags or invisible placement masks are proposed. |

### Map-specific comparisons

| Reference | Evidence inspected | What it suggests, and what it does not prove |
| --- | --- | --- |
| **Kingdom Rush: Pagras** | Its [official 258×177 background image](https://www.kingdomrush.com/images/kingdom-rush/strategy-guide/screenshots/KR_Strategy_03.jpg) shows close road returns around two narrow grassy tongues, with woodland and water around the outside. Name confirmed by the [official guide](https://www.kingdomrush.com/kingdom-rush-strategy-guide). | A few strong masses can frame repeated route exposure. Exact tower locations, legal placement and balance cannot be read from this background image. |
| **Kingdom Rush: Silveroak Forest** | The [official background image](https://www.kingdomrush.com/images/kingdom-rush/strategy-guide/screenshots/KR_Strategy_05.jpg) shows a dense forest boundary and two differently shaped open fingers between pale road sections. The [official guide](https://www.kingdomrush.com/kingdom-rush-strategy-guide) supplies the name. | A forest can feel continuous around a legible playing area. The image does not establish the traversal order or production workflow; do not copy its apparent branch topology. |
| **Bloons TD 6: Dark Path** | Ninja Kiwi describes this harder reinterpretation as changing both the path and the placeable areas of the earlier triple-return park setting. This is a textual example from [v39.0 notes](https://store.steampowered.com/news/posts/?appids=960090&enddate=1700181328&feed=steam_community_announcements), not a measured map reconstruction. | Route and deployment space jointly change the tactical problem. Keeping a bend while erasing all useful nearby ground is not preserving its gameplay value. Its difficulty label does not transfer to A4. |
| **Defense Grid: Service Interruption / Height of Confusion** | The [official 2010 release announcement](https://store.steampowered.com/oldnews/3894) contrasts an obstructed road to the core with a wide-open build surface. | Constrained and open spaces are both deliberate level variables. Defender can offer local differences in opportunity without adopting Defense Grid's route blocking, core recovery or victory rules. |

Pagras and Silveroak Forest were visually inspected in a separate hidden built-in-browser research tab. These small background images support only broad composition observations. Reference art remains linked; it was not copied into game assets.

## Proposed adaptation: landscape, carving, then review

These are **A4 authoring proposals**, not imported game rules or proof of an optimal layout. The user already authorised the two-stage order. No path coordinates are prescribed by this research.

1. **Preserve Artist's landscape before tactical work.** Save its source and an overview using identifiable placements. It should contain coherent water/landform/woodland/ruin relationships, including populated interior ground, with no route, defence models or deliberately reserved tactical clearings. Ordinary irregular spacing between scenery is natural composition, not automatically a hidden route. Record enough of the baseline to distinguish an honest landscape from a dressed route template.
2. **Choose the journey from the supplied place.** Tactician identifies candidate entry/exit directions and compares a small number of possible journeys against existing landmarks. Select one ordered, nonrepeating, edge-connected chain of 24-unit boxes. Carve only after this comparison; a turn should create a coverage choice or respond to a landmark, rather than fill another corner of the board.
3. **Carve usable opportunities as well as a road.** Seek distinguishable early contact, one repeat-exposure opportunity, and later coverage. Preserve at least one plausible alternative near each intended opportunity. Openings may differ in shape and size; do not apply an identical empty strip along the whole path. Record removed or moved placements and any terrain/water edits with a reason: travel clearance, defence support, attack sightline or camera readability.
4. **Verify using current mechanics.** Separate ideal horizontal range from shots permitted by geometry and aim. Check actual Dog, Roller and Moth poses. Keep the accepted flat dry route and defence ground at Y24, current attack stats, existing scenery collisions, weather-off default and current preview roster. The lead's planned mixed study uses a base gun, base Arc, base silo and adjacent base generator; the generator's bonus changes damage, not coverage.
5. **Review the landscape after carving.** Compare the same overview before and after. Recognisable masses and landmarks should survive, and the final route and nearby choices should read clearly. Report over-carving rather than disguising it with extra remote props. Artist reviews the actual oblique view; Tactician reviews coverage and alternatives; the lead integrates the evidence and user review.

## Measurable A4 checks

The checks below are proposed **review criteria**. Counts and thresholds are diagnostics, not campaign balance commitments or future deployment restrictions. If a criterion is changed, state why rather than quietly changing the definition of success.

| Check | Evidence to record | Interpretation |
| --- | --- | --- |
| Honest first stage | Baseline source/capture; zero path boxes, zero defence placements, no reserved tactical-site list; short Artist composition rationale. | Makes the requested order inspectable. A path-free landscape is not expected to run enemy combat. |
| Route validity | Ordered box list; no repetitions or non-edge steps; centre-line length; flat dry support at Y24; full ground/air actor clearance along the route. | Structural correctness, separate from tactical quality. |
| Coverage by journey position | For each intended site and alternative: world coordinate, weapon/stage, range, positive-length in-range intervals in route-distance units, and the corresponding LOS/pitch-eligible intervals. Report intervals in early/middle/late thirds as descriptive bins. | Nearest-path distance and total covered length alone hide whether two sites do the same job. |
| Real repeat exposure | At least one candidate with positive eligible coverage on two distinct passes of the journey; identify both passes and whether exposure is continuous through the connecting turn or genuinely exits and re-enters range. | A tangent point is not a second firing window. Do not force arbitrary extra turns to meet a count. |
| Meaningful alternatives | Proposed starting target: at least two usable candidate boxes for each of the early, repeat and late opportunities. List distinct cells once, show overlaps between categories, and explain at least one coverage trade-off between each pair. | Candidate cells are authoring evidence, not fixed build pads. Each candidate needs real supported placement and positive eligible coverage; empty remote ground does not count. |
| Distinct late coverage | Identify an eligible interval in the final third and an earlier strong site's loss or reduction of that interval. | A late site should add a reason to choose it instead of being a redundant duplicate. A missed central kill is not an implemented loss condition. |
| Scenery retained | Baseline/final counts by model family, unchanged/moved/removed/added placement IDs, and before/after images at matched framing. List affected landmark groups. | No universal retention percentage is justified. Counts expose the cost of carving; visual continuity still needs human judgement. |
| Attack and visual visibility | Separate static shot obstruction from screen occlusion. Review normal overview, another useful orbit, day/night and optional rain; show actual attacks against all three A species. | Low props can block a muzzle; a high canopy can hide action without blocking that ray. Both failures matter for different reasons. |
| Difficulty claim | Record weapons, enhancements, enemy stats and starting positions used; compare alternatives under the same preview conditions if trialled. | This can establish contribution and geometry. It cannot certify five-wave difficulty, affordability, mistake tolerance or a campaign progression that does not exist yet. |

### Range arithmetic to prevent misleading pockets

This is Defender-specific geometry, not a rule taken from the sources. For a straight path at perpendicular distance `d` from a defence centre and radius `R`, an infinitely long unobstructed straight has covered length `2 × sqrt(R² − d²)` when `d < R`. At `d = R` it is tangent and has zero covered length. Finite segments, pitch, aim time, obstruction and real attacks can reduce practical opportunity.

| R | d | Ideal straight exposure |
| ---: | ---: | ---: |
| 48 | 24 | 83.1 units |
| 48 | 48 | 0 units |
| 72 | 24 | 135.8 units |
| 72 | 48 | 107.3 units |

Thus two parallel path centrelines **48 units apart** can give a box-centred base gun midway between them real coverage on both. At **72-unit separation**, either of the two intervening box-centred rows is 24 units from one pass and 48 from the other: the second straight contributes only a tangent at base range. A return can still have useful corner coverage, but measure that actual geometry instead of claiming dual-straight coverage. No range enlargement is authorised to rescue the composition.

One ideal 83.1-unit straight interval lasts about **6.93 seconds for Dog**, **5.20 for Roller**, or **4.16 for Moth** at current route speeds 12/16/20. Those are geometric transit times, not guaranteed firing time or damage: Moth height/banking and the gun's pitch limit are especially relevant. Gun upgrade 2 has zero strength; its 96-unit radius is not active firepower. Arc's random current-surface contact and the missile's committed physical flight require live validation, not speculative promises from a range plot. [Current attack and enemy contract](../design-doc.md#shared-attack-rules-and-current-weapon-values).

## Source register and limitations

| Source | Authorship / date | Used for |
| --- | --- | --- |
| [Hidden Path interview](https://truepcgaming.wordpress.com/2011/09/21/hidden-path-entertaiment-interview-defense-grid-the-awakening/) | Jeff Pobst answering Adam Ames; 21 September 2011. Primary developer testimony hosted by an interviewer. | Route learning, repeat exposure, reported playtest lesson. |
| [Defense Grid art account](https://www.gamedeveloper.com/design/from-concept-to-execution---the-art-of-i-defense-grid-the-awakening-i-) | Dave McCoy, Hidden Path art director; 27 May 2009. First-person production account. | Environmental identity, actual LOS/silhouette revision. |
| [BTD6 v39.0 notes](https://store.steampowered.com/news/posts/?appids=960090&enddate=1700181328&feed=steam_community_announcements) | Ninja Kiwi developer announcement; 9 October 2023. | Editor distinctions; Dark Path textual example. This is historical version-specific evidence. |
| [Kingdom Rush official guide](https://www.kingdomrush.com/kingdom-rush-strategy-guide) and its linked Pagras / Silveroak images above | Ironhide official host; publication date not shown. | Map names and broad visible composition only. |
| [Resurgence Map Pack 1 release](https://store.steampowered.com/oldnews/3894) | Official Steam product-release announcement; 2 June 2010. | Named obstructed/open map contrast, not independent balance measurement. |

The older Hidden Path “Level Progression: Design” link (`https://www.hiddenpath.com/blog/217/`), discovered through [the DG2 resource index](https://steamcommunity.com/app/221540/discussions/0/613940477955480832/), returned 404. It is **not evidence** here. DG2 tutorial videos were located but not watched. Community difficulty rankings and uncited claims about optimal maps were excluded.

This bounded sample cannot determine a universal best workflow, optimum density, correct path length or a finished difficulty curve. Published developer accounts describe their games and may report intentions rather than independently measured outcomes. A4 uses a different scale, camera, collision model, arsenal and unfinished campaign loop. Review the actual trial before generalising to other levels. Research edits add no runtime content and require no game-runtime tests.
