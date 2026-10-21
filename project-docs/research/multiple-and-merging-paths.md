# Multiple and merging enemy paths

Researcher brief, 18 October 2026. All external sources below were accessed on **18 October 2026**. This is a research recommendation for future design review, not approval or implementation of new routing, waves, objectives or controls. Lead owns the corresponding [design-doc section](../design-doc.md#later-level-route-variety).

## Finding

**Yes: selectively consider multiple routes in later Defender levels. The first useful candidate is two visible approaches that merge into one shared final stretch.** This is a proposed adaptation, not a conclusion that more paths always produce better or harder levels. It can introduce a clear investment question: buy earlier, branch-specific coverage or concentrate on coverage that can serve both approaches. Keep single-route levels in the design vocabulary.

Treat the **route connections** and the **arrival schedule** as separate decisions. Two entrances used in alternation are a different encounter from two entrances carrying enemies at the same time. Neither a mandatory four-level pattern nor a numerical relationship between path count and difficulty is supported by this small evidence set.

## Source-supported evidence

**Defense Grid — developer account of progression.** Jeff Pobst describes starting with readily understood fixed paths and introducing routing choices. He says the team considered build-area size, entrances and exits between areas, and complexity; later lessons build on earlier ones. His discussion of two fronts also reports dissatisfaction with aspects of the first game's flying-enemy design. These are first-person design judgments, not comparative measurements of player difficulty. They support introducing a comprehensible new problem and testing its consequences, rather than using extra entrances as a universal improvement. [Pobst interviewed by Filippo Dinolfo, 7 December 2018](https://smashpad.com/a-decade-of-defense-grid/).

**Bloons TD 6 — authoring timing separately.** Ninja Kiwi's version 43.0 notes explicitly provide whole-path modes described as alternating, sequential or a specified pattern. This establishes that the developer exposes route-use scheduling as an authoring choice. Those words alone do **not** establish simultaneous spawning, exactly how each mode divides a round, or which published maps use it. [Ninja Kiwi, v43.0, 28 May 2024, “Game Changes / Additions”](https://store.steampowered.com/news/posts/?appgroupname=Bloons+TD+6&appids=960090&enddate=1749696583&feed=steam_community_announcements).

**Bloons TD 6, Workshop — a documented merge case.** The version 39.0 map fixes explicitly name Workshop when describing an error that made Bloons untargetable on the final segment before changing paths at a merge. This is direct evidence of merging-path behaviour and a concrete transition failure. It does not specify the entire map's topology, arrival schedule or optimal tower arrangement. [Ninja Kiwi, v39.0, 9 October 2023, “Map Specific Fixes”](https://store.steampowered.com/news/posts/?appids=960090&enddate=1716946448&feed=steam_community_announcements).

**Bloons TD 6, Ancient Portal — route transfer is another mechanic.** The version 45.0 introduction says the portal can move Bloons from one path to another. This confirms a named example of path transfer, but supplies too little detail to reconstruct its complete schedule or balance. A portal-based transfer should not be mistaken for evidence about a simple visible road junction. [Ninja Kiwi, v45.0, 8 October 2024, “New Awesome”](https://store.steampowered.com/news/posts/?appids=960090&enddate=1739504393&feed=steam_community_announcements).

These cases show different design and implementation choices. They do not demonstrate that Defender needs flying shortcuts, portals, player-built mazes, changing roads or Defense Grid's core-return objective. None of those is proposed here.

## Working distinctions and interpretation

The definitions and consequences below are our analysis. The arrows are original schematic notation, not reconstructions of the cited maps or approved Defender layouts. `A/B/S` denote entries, `M` a merge, and `E` an exit.

| Arrangement | What it means | Likely tactical question and risk to examine |
| --- | --- | --- |
| Two approaches, shared tail: `A → M → E`, `B → M → E` | Separate early segments become the same final route. | Earlier branch coverage versus shared late coverage. A generous central site can make every branch site redundant. |
| Independent lanes and exits: `A → E1`, `B → E2` | Each route retains its own endpoint. | Allocate coverage across separate escape risks. There is no shared final stretch, though a suitably positioned defence might still reach both roads. |
| Split then rejoin: `S → two arms → M → E` | A common approach separates into alternatives and later recombines. | Cover the common approach/tail or exploit an arm. Specify which enemies take which arm; a fork alone does not explain route assignment. |
| Multiple entries with alternating use | A schedule selects entries at different times; the road arrangement may be any of the above. | Plan around changing demand. Alternating spawns do not guarantee that the previous entry's enemies have left, so check actual overlap. |
| Simultaneous traffic on separate approaches | Living enemies occupy distinct approaches concurrently. | Divide attention and available coverage across concurrent threats. This describes an encounter condition, not an automatic increase in enemy count. |

A visual crossing is not necessarily a connection; the level must communicate whether enemies can change roads there. Likewise, separate exits do not inherently mean separate objectives, life pools or rewards. Those would require their own design decisions.

## Proposed Defender adaptation

Use the two-approach merge as a bounded future experiment because it retains a common destination while adding one understandable allocation choice. Give each approach a readable identity within the landscape and at least one useful area with meaningful pre-merge coverage. The shared stretch should offer a credible alternative. “Useful” means a demonstrable coverage opportunity with the current weapons, not an obligation to place one tower on every branch.

The important failure case is **central domination**: if the shared area gives equal or better opportunity against every relevant enemy than the branch positions, the second road may add visual complexity without adding a decision. Compare alternatives before making the tail longer or adding more central sites. Conversely, an extremely short shared stretch can make a supposed common safety area ineffective. Neither outcome can be diagnosed from the junction's shape alone.

Use current Defender constraints when judging this tradeoff: 24-unit boxes, flat dry paths, defence ground at path height, actual attack ranges and static obstruction checks. Current guns and Arc Spires have 48/72/96-unit ranges; missile launchers have 72/96/120-unit launch ranges. Gun upgrade 2 remains inactive. Gun/Arc line-of-sight, aiming and cadence, plus missile flight/contact and reload timing, all limit opportunities that a radius plot might suggest. Generators strengthen qualifying adjacent defences; they do not enlarge coverage. The current attacks are single-target: a missile impact flash supplies no splash damage, and an Arc strike supplies no chain damage. A merge therefore creates shared access to targets, not an approved area-damage bonus. [Current weapon rules](../design-doc.md#shared-attack-rules-and-current-weapon-values).

For progression, first establish that the player can read each approach and understand the value of its sites. A later encounter could introduce overlapping traffic on the same layout if that creates a worthwhile new decision. This is a candidate teaching approach, not a fixed sequence or a decision to change the approved five-wave structure. Do not duplicate the existing roster or wave size merely because there are two entries. Keep total enemy demand controlled when comparing schedule variants, then tune separately if authorised.

Independent exits and split/rejoin arrangements remain valid alternatives to investigate when they express a specific intended choice. They should earn their extra explanation and validation work. Do not assign them mechanically to particular zone or level numbers before the actual encounters and progression have been designed.

## Practical review checks for a future authorised trial

These are proposed checks, not numeric acceptance thresholds or results from a completed test.

1. **Draw the connections and timing separately.** Identify every entry, exit, shared segment and route assignment. Record when living enemies actually overlap on separate approaches, including carry-over after an entry changes.
2. **Measure each site's opportunity per route.** Record in-range route distance and transit time before and after the merge, then account for real LOS, aiming, cadence and current enemy poses/speeds. Keep missile launch eligibility separate from eventual physical impact. A long total route is not evidence that every route receives adequate coverage.
3. **Compare branch and central alternatives.** With the same stated defence allocation, compare a central concentration, a branch-heavy arrangement and a mixed arrangement. Record which route/enemy each helps, where coverage ends and what reaches the endpoint. Final purchase/repair economics remain undecided, so identify any assumed allocation rather than presenting a balanced campaign result.
4. **Audit readability from the normal overview.** Entries, direction through the junction, exits, occupied sites and all intended alternative placement ground must be visible. Remove or reduce obscuring scenery under the standing placement rule; orbiting is not a substitute. Keep physical clearance, attack LOS and visible build ground as separate checks. [A4 visibility precedent](../zone-a-four-layout.md).
5. **Check transition continuity if implemented later.** A merge must not create targeting gaps, duplicate actors or progress discontinuities. Threat comparisons and remaining travel time need to refer to each enemy's actual remaining route. Workshop's documented bug motivates testing this boundary; it is not evidence that Defender currently has that bug. Lead/Tactician own the concrete engine dependency review.
6. **Measure attention and authoring workload.** Observe whether players can explain a failure, notice pressure on both approaches and understand why a branch site helped. Count the extra route/schedule combinations requiring review. Simultaneous spatially separated threats may demand more attention, but do not assume a measured workload increase without playtesting.

For Artist, preserve coherent landscape composition while making connections and intended placement ground legible. For Tactician, carve meaningful coverage alternatives using actual geometry and attacks. The successful A4 landscape-first process is a useful local precedent; this report does not authorise modifying A4 or extending that experiment to another level. [Landscape-first study](landscape-first-levels.md).

## Current Defender dependency review

Tactician inspected the current code on 18 October 2026; these are local implementation findings and future considerations, not external research or approval to modify the engine.

| Current assumption | Work needed for a future fixed-route trial |
| --- | --- |
| [`shared/level.js`](../../shared/level.js) validates one ordered, edge-connected, nonrepeating `path`. | Design a compatible/versioned contract with stable route identities, independently valid routes and explicitly allowed shared segments. |
| [`shared/terrain.js`](../../shared/terrain.js), [`engine/world.js`](../../engine/world.js) and [`tools/app.js`](../../tools/app.js) use the single path for protected ground, paving and editing. | Use the deduplicated union of path ground for terrain/rendering/obstruction checks; teach the editor and [`engine/camera.js`](../../engine/camera.js) route selection. |
| [`game/enemy-preview.js`](../../game/enemy-preview.js) creates routes from the same source and caches them by turning distance. | Cache by route identity and turning distance. Give each actor one complete entry-to-exit route including the shared suffix; avoid resetting distance, gait or lap at the junction. Existing [`PathMotion`](../../engine/path-motion.js) can sample each chain; a general graph pathfinder is not inherently required. |
| [`engine/target-planner.js`](../../engine/target-planner.js) currently profiles one path and uses its length for exit timing. | Key forecasts by route and aim height; compare actual remaining travel time across unequal routes. Revisit raw-distance tie breaks. Keep one shared thinker and one reservation owner per defence, so shared-tail capacity is never promised twice. |
| Current missiles own exact enemy/lap claims; attacks use actual actor geometry and velocity. | Preserve these claims and the airborne/off-centre forecast exclusions. Fixed routes do not require retargeting. Validate actual contacts, continuity, reset/unload and legacy levels. |

The finite preview roster loops; `waves: 5` is metadata, not an implemented scheduler. No inter-enemy avoidance or queueing exists, so concurrent merge traffic needs a visual crowding review. Keep the initial comparison bounded rather than multiplying actors by route count. Later verification should include unequal-route urgency, shared-tail continuity, each ground/air type, actual weapon attacks, one-time damage commitments and old single-route compatibility. Profile route/aim-height/defence precomputation and the existing actor/light/flight pools before making performance claims.

## Sources and limits

| Primary source | Publication date | Scope of use |
| --- | --- | --- |
| [Jeff Pobst interview, SmashPad](https://smashpad.com/a-decade-of-defense-grid/) | 7 December 2018 | Developer testimony about teaching, complexity and multiple fronts; not a controlled player study. |
| [Ninja Kiwi v43.0 official notes](https://store.steampowered.com/news/posts/?appgroupname=Bloons+TD+6&appids=960090&enddate=1749696583&feed=steam_community_announcements) | 28 May 2024 | Historical whole-path scheduling options. |
| [Ninja Kiwi v39.0 official notes](https://store.steampowered.com/news/posts/?appids=960090&enddate=1716946448&feed=steam_community_announcements) | 9 October 2023 | Workshop merging-path transition bug and fix. |
| [Ninja Kiwi v45.0 official notes](https://store.steampowered.com/news/posts/?appids=960090&enddate=1739504393&feed=steam_community_announcements) | 8 October 2024 | Ancient Portal's documented path-transfer concept. |

Steam links above are official announcement archive pages containing the named dated releases. Their historical details are not assertions about the latest editor's limits or current game balance.

This was a bounded reading of developer material. No game was played and no walkthrough video was watched. The built-in browser was unavailable to this Researcher for a separate official image inspection; no existing game tab was used, and no new topology claim relies on an uninspected screenshot. The evidence does not establish exact schedules for Workshop or Ancient Portal, universal player preferences, an optimum route count, or a mandatory difficulty curve. The two-approach shared-tail recommendation is a Defender design hypothesis requiring a separately authorised trial. This document changes no runtime behaviour and needs no game-runtime tests.
