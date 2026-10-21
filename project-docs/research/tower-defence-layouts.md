# Tower-defence layouts: research for Artist and Tactician

**Researcher · 17 October 2026 · reference study, not an approved replacement layout.** Sources and linked images were inspected on this date. Current project references: [production layouts](../production-levels.md), [A](../screenshots/production-a-overview.png), [B](../screenshots/production-b-overview.png), [C](../screenshots/production-c-overview.png), [D](../screenshots/production-d-overview.png).

## Finding for the next layout pass

The current previews are legible, but their large square grounds and long separated road sections often read as scenery displays with a road through them. The researched examples organise the ground around **places where the player can meaningfully engage the route**: compact inside bends, returns near earlier stretches, and distinct entry, central and final defence areas. More path length or more empty boxes alone does not create that structure.

This is a comparative design interpretation, not proof of the cause of the user's dissatisfaction. Preserve the requested generous room for imperfect placements. Improve the relationship between empty ground and reachable enemies before adding scenery or extending the route again. A square level boundary does not require a square, symmetric or uniformly spread route.

**Recommended next step:** Tactician should make a few small top-down route/placement studies, with actual 48/72/96-unit range circles and sightline corridors. Artist should review their composition before dressing a chosen layout. Start with one Zone A study to settle the direction; derive the other zones from distinct engagement ideas rather than repeating a board-filling serpentine. These are workflow proposals for lead review, not permission for a new gameplay system.

## What was actually examined

Three established references were selected for different reasons, not as a popularity ranking. Kingdom Rush gives clear authored roads and compact landmarks; Bloons TD 6 gives broad placement freedom and repeated exposure; Defense Grid gives a close 3D/grid comparison and a useful contrast between constrained and open build areas. Official store pages establish the products: [Kingdom Rush](https://www.kingdomrush.com/kingdom-rush), [Bloons TD 6](https://store.steampowered.com/app/960090/Bloons_TD_6/), [Defense Grid](https://store.steampowered.com/app/18500/Defense_Grid_The_Awakening/).

The map studies below use visible geometry, with a few explicitly attributed textual descriptions. They do **not** reproduce complete routes, placement collision masks, exact dimensions, wave balance or solutions. No game was purchased or played during this study. No third-party image was downloaded into the project. The small original [range-spacing diagram](range-spacing.svg) explains Defender's own geometry, not another game's map.

### Kingdom Rush — modest routes shaped around land

Ironhide's [official strategy guide](https://www.kingdomrush.com/kingdom-rush-strategy-guide) supplies named background images. They are small images without a complete active build interface, so do not infer exact tower-site counts or clearances from them. The guide calls its second map **The Farmlands**; other versions/community references use **The Outskirts**. Keep the source's label here.

| Examined map | Visible observation | Interpretation for our designers |
| --- | --- | --- |
| [Southport — official image](https://www.kingdomrush.com/images/kingdom-rush/strategy-guide/screenshots/KR_Strategy_01.jpg) | A northern approach curls around a central grassy peninsula before reaching the eastern boundary. Forest frames much of the outside; the inside bend stays visually open. | A first map can have one memorable engagement pocket rather than cover every corner of the board. |
| [The Farmlands — official image](https://www.kingdomrush.com/images/kingdom-rush/strategy-guide/screenshots/KR_Strategy_02.jpg) | An irregular winding road leaves two projecting grassy pockets; fields and forest occupy different outer regions. | Vary the length and width of pockets. Avoid several equivalent rectangular lawns separated by identical long straights. |
| [Pagras — official image](https://www.kingdomrush.com/images/kingdom-rush/strategy-guide/screenshots/KR_Strategy_03.jpg) | Two close returns put three stretches alongside elongated grassy fingers. Water sits outside the lower road. | A return can give a defence another opportunity later in the same journey. The spacing matters more than the mere presence of a hairpin. |
| [Twin Rivers — official image](https://www.kingdomrush.com/images/kingdom-rush/strategy-guide/screenshots/KR_Strategy_04.jpg) | Two visible road arcs surround central land and cross a diagonal river at separate bridges. | A landmark can explain the composition. Its branch/bridge topology is reference only; our current single route does not implement it. |

Artist: these images keep broad road/ground/forest shapes readable before small details. Translate that hierarchy into our orthogonal terrain rather than copying their curved roads. Tactician: borrow compact pockets and purposeful returns, not fixed build-site restrictions or unsupported branching.

### Bloons TD 6 — free ground with repeated exposure

Ninja Kiwi's [official Steam media](https://store.steampowered.com/app/960090/Bloons_TD_6/) includes [a Monkey Meadow gameplay image](https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/960090/ss_c49e84b50f5326a4d44f49f1e56e317682f53789.1920x1080.jpg?t=1782123772). Clean views were inspected through the community-maintained Japanese guide, explicitly secondary image hosts: [Monkey Meadow screenshot](https://img.atwiki.jp/btd6/attach/75/1128/B_MONKEY%20MEADOW.png), [Logs screenshot](https://img.atwiki.jp/btd6/attach/136/1214/B_LOGS.png), [map index](https://w.atwiki.jp/btd6/pages/79.html). These are game screenshots, not fan-designed maps.

| Examined map | Visible/source-supported observation | Interpretation for our designers |
| --- | --- | --- |
| Monkey Meadow | The stone track makes compact rectangular returns and crosses itself. There are open grassy areas both inside and outside the track; dense foliage mostly frames the perimeter. Entry/exit arrows are visible in the clean view. The community [map description](https://bloons.fandom.com/wiki/Monkey_Meadow) identifies one entrance and exit and describes two intersections. | An approachable-looking board can give several local coverage choices without fencing every tower into a prescribed pad. Separate an efficient inner pocket from nearby reasonable alternatives. Do not reproduce its intersections in our current route format. |
| Logs | The clean view shows a compact rectilinear network around small grass islands, a central water patch and logs over some passages. The community [description](https://bloons.fandom.com/wiki/Logs) identifies intersecting paths and line-of-sight obstacles. The static image alone does not reveal the full traversal order. | An apparently simple grid can repeatedly bring enemies near shared ground. Use this as a contrast to oversized empty courts, not a proposal to build a dense grid maze. The obstacles illustrate why coverage and actual LOS must be considered separately. |

A caution: Bloons' tower footprints, ranges, upgrades, wave rules and crossing support differ from ours. Do not transplant its spacing by eye or use community claims that a map is “easy” as evidence for Defender's difficulty. Our free space must accommodate full 24-unit defence footprints, rotating parts and the actual 48-unit base range.

### Defense Grid — the buildable board is designed, not leftover space

The developer-published [Steam gallery](https://store.steampowered.com/app/18500/Defense_Grid_The_Awakening/) was inspected, particularly [image 0000005944](https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/18500/0000005944.1920x1080.jpg?t=1721059385) and [image 0000006570](https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/18500/0000006570.1920x1080.jpg?t=1721059385). They show clusters of square tower spaces adjacent to returning roads, with deep scenic gaps outside the active surfaces. These are cropped action images; map names and complete routes are not established by the gallery, so they are **not** labelled as particular missions here.

| Named example | Evidence and its limits | Interpretation for our designers |
| --- | --- | --- |
| Assessing the Threat | The player-authored [Standard of Entertainment guide](https://standardof.net/games/guide-archives/assessing-the-threat/), updated 4 October 2020, describes one large and one small curved section around a central structure, with interior sites and separate outer strips. Its linked overview image currently returns 404; this is a textual reference, not a visually verified reconstruction. | Build a distinction between interior high-exposure sites, outer support sites and late-route coverage. We should verify the equivalent with our own range/LOS data rather than inherit the guide's strategy. |
| Service Interruption | The [official release announcement](https://store.steampowered.com/news/3894/) (2 June 2010) describes an obstructed road to the core, contrasting it with the open companion map. | Placement restriction is a deliberate design variable; do not let accidental scenery crowding choose it for us. |
| Height of Confusion | The same official announcement explicitly describes a wide open build surface. No claim about its exact lane count or optimal maze is made here. | Generous freedom is compatible with tower defence, but it must be evaluated in the game's rules. Player-built route blocking is outside our current scope. |

In a first-person [art-development account](https://www.gamedeveloper.com/design/from-concept-to-execution---the-art-of-i-defense-grid-the-awakening-i-) (Dave McCoy, Hidden Path art director, 27 May 2009), the team describes choosing elevated roads and vertical scenery to support its 3D identity, and making towers distinguishable at a glance. For Defender, borrow the separation of active ground from scenic mass and the silhouette discipline. Do not import elevated defence pads, overpasses, textures or effects that conflict with our constraints.

Further primary reference located for later viewing: [Hidden Path's DG2 Architect: Designing the Level for Gameplay](https://www.youtube.com/watch?v=ICFPE0hUTD0), linked by the [DG Architect community guide](https://steamcommunity.com/sharedfiles/filedetails/?id=322352152). The title/page was verified but the video was **not watched**; no finding in this brief is attributed to its unseen content.

## Translate the ideas into our grid

These are project-specific proposals and arithmetic, not claims made by the sources.

### Design in attack range, not in board percentages

Base range 48 units is only **two 24-unit boxes**. A tower at the centre of the box immediately beside a straight path is 24 units from its centreline. On a sufficiently long straight, the in-range length is `2 × sqrt(48² − 24²) ≈ 83.1 units`. At 48 units perpendicular distance it only touches the route at one point: zero length, not a second useful firing stretch. Finite paths and LOS can only reduce these idealised lengths.

For straight parallel sections, box-centred placement gives these useful reference cases:

| Path centreline separation | Empty rows between paths | Base turret consequence | Upgrade-1 consequence |
| --- | ---: | --- | --- |
| 2 boxes / 48 units | 1 | A turret in the middle row is 24 units from both paths: real exposure to both. | More exposure, subject to LOS. |
| 3 boxes / 72 units | 2 | Each middle row is 24 from one path and 48 from the other: the second is tangent only. | At radius 72, both stretches can have positive coverage. |
| 4 boxes / 96 units | 3 | The exact middle row is tangent to both paths; other rows positively cover only their nearer straight. | The middle row is 48 from both, so both have positive coverage. |

This assumes defence centres on box centres and straight sections alongside the tower; future deployment rules remain unimplemented. Arbitrary offsets, end turns, different ranges and obstructions change the result. **Do not change range or placement policy simply to make a pretty diagram work.** [Original diagram](range-spacing.svg).

Use a small number of optional strong pockets while keeping wider outside ground for alternative placements and recovery. A narrow shared-coverage strip need not consume the entire layout. Do not protect all nominally in-range cells with an identical visual corridor: check the actual candidates, rotations and shot lines, then compose scenery around them.

### Diagnose the current four previews

These observations use the current project screenshots and documented routes, not third-party balance evidence.

| Zone | Current concern to test | Bounded direction for a paper study |
| --- | --- | --- |
| A | The route advances across separate right-angle steps; broad courts mostly flank one part of the journey. There is no obvious compact central return. | A recognisable hook around one useful pocket, a separate later catch area and nearby weaker-but-reasonable choices. Preserve generous outside ground. |
| B | Its long equal-spaced parallels dominate the composition. The documented four-box separation means many apparent centre sites need upgrade range for dual-straight coverage. | Keep the desert's openness but vary pass length and spacing; deliberately choose which pocket rewards base versus upgraded range. |
| C | The road is a sequence of separated chicanes, while the lake and tree groups sit largely around the edge. | Let a low landmark shape a purposeful bend and two differently sized courts, while keeping the route flat and the central sights open. |
| D | The large outer return and inner return give substantial total route length, but the layout's near-rectangular geometry and central pool can dominate the tactical reading. | Choose one principal re-engagement area and one clear late defence area. Reduce redundant long traversal if it contributes no distinct decision. |

The requested mistake tolerance cannot be established by empty-box totals or today's three-turret preview. It eventually depends on deployment budget, waves, enemy speed/HP, recovery rules and the strength of alternative arrangements. For now show several plausible alternatives in the layout study, including their weaker coverage, and state what has not been balanced.

### Artist handoff

- Keep a clear hierarchy at overview: route first, enemy/defence silhouettes next, useful open ground evident, scenery framing it. Check the actual oblique camera; top-down clearance alone does not prevent a tall tree hiding the road.
- Use existing low terrain, water and scenery groups to give a bend a reason. Leave asymmetric gaps. Avoid evenly distributing decorative clusters or treating every board corner as equally important.
- Keep useful ground visually calm, but distinguish “open area near action” from remote decorative lawn through composition. This is not approval for new placement overlays, pads or material systems.
- Keep the accepted large flagstones, palette hierarchy, 24-unit main terrain alignment, matte models and dry flat route. A more organic composition does not require diagonal geometry or new effects.

### Tactician handoff

- Draw entry, exit and traversal direction first. Use one ordered nonrepeating route; mark intersections/branches from references as excluded for now.
- Identify a few intended decision areas: early contact, repeat exposure and later coverage. A bend earns its place when it changes a placement decision, not merely the route-box count.
- Plot at least a strong candidate and nearby alternatives for each intended area. Record reachable route length and which journey intervals they cover, not just distance to the closest path tile.
- Keep spare same-height ground for imperfect choices. Distinguish useful alternatives from boxes with zero base coverage. Do not promise that every empty box is equally effective.
- Verify actual muzzle LOS, model bounds and readable dog/approved-enemy motion before scenic polish. Coordinate with Artist on what scenery can safely frame each view.
- Present one small route/coverage study to the lead before remodelling all four again. No new branching, maze blocking, bridges, waves, economy or deployment implementation follows automatically from this research.

## Evidence limits and follow-up

Official KR images are low-resolution background maps. BTD6 clean images are community-hosted; their gameplay geometry is visible, but no current-version collision data was measured. Defense Grid's official gallery is cropped, and one named-map image is unavailable. Sources demonstrate examples, not universal genre rules or a tested optimum. The current brief deliberately avoids copied map coordinates, difficulty rankings, exact tower counts inferred from art, and unverified video claims.

All source links above were accessed 17 October 2026. Ninja Kiwi's official API documentation was also located through [its support page](https://support.ninjakiwi.com/hc/en-us/articles/13438499873937-Open-Data-API), but the API site presented a security check; it was not used as evidence or bypassed. No runtime files changed and no runtime tests were run for this research-only assignment.

Review status: lead reviewed the source/interpretation separation, spot-checked the official Kingdom Rush guide, Defense Grid release announcement and Dave McCoy article, and accepted the research direction on 17 October 2026. This is not runtime implementation approval. Brief and diagram shared with Artist and Tactician for their discipline-specific responses; see [Tactician response](layout-design-response.md) when available.
