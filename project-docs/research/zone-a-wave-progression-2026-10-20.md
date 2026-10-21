# Zone A wave progression and balance research — 20 October 2026

**Status: research and proposed direction, not implemented tuning.** The user reports that the game is far too easy. The session aim is to finish Zone A: all four levels, enemy waves, defence availability, weapon/enemy tuning and possibly tokens. This first step researches progression and diagnoses the existing build. All external sources were accessed on 20 October 2026. Source-supported observations, local evidence and recommendations are separated below.

**Later the same session:** the user authorised team implementation. Zone A is now complete for review; the [delivery record](../zone-a-completion-2026-10-20/README.md) supersedes this brief's proposed values with the implemented profiles and fresh evidence.

## Executive finding

Build sixteen authored encounters that ask progressively different placement and spending questions. Increase pressure through enemy composition, arrival timing, coverage and sustained demand, alongside numerical strength. Introduce new threats in readable conditions, then combine them. Keep the established four waves per level.

The current problem is measurable: yesterday's production replay clears all eight waves with two guns upgraded through tier II, spending six tokens total. Sixteen tokens are available before the eighth wave; the witness finishes with twelve unspent after its final reward. Today's user feedback rejects that difficulty as sufficient. This is historical replay evidence, not a newly executed run or proof of the cheapest solution.

## What the reference games support

| Source-supported observation | Interpretation for Defender |
| --- | --- |
| **Defense Grid: The Awakening** distinguishes basic enemies, weak packs, fast enemies, shielded units, flyers and spawning enemies. Its tactical display communicates enemy abilities and strength tiers. See the [official manual](https://cdn.akamai.steamstatic.com/steam/apps/18500/manuals/manual_english.pdf?t=1667008094), sections 5 and 7. | Variety can test different defensive weaknesses. Raw HP is only one dimension. Show upcoming composition before the player commits. Defender need not acquire those games' shields, spawning or immunities. |
| **Defense Grid's developer** describes starting with readable single paths and creating later puzzles from different route, entrance and flying-enemy arrangements. He also distinguishes merely surviving from higher-performance goals. [Jeff Pobst interview](https://truepcgaming.wordpress.com/2011/09/21/hidden-path-entertaiment-interview-defense-grid-the-awakening/), difficulty and level-design answers. | Use A3's existing merging approaches to change the problem. A clean clear and a survivable imperfect run are different useful benchmarks. |
| **Plants vs. Zombies:** George Fan's own [GDC slides](https://media.gdcvault.com/gdc2012/slides/Design%20Track/Fan_George_How%20I%20Got.pdf), PDF pages 48–57, advocate spreading instruction and giving players time with each new tool. His [interview](https://www.gamezebo.com/news/interview-with-plants-vs-zombies-creator-george-fan/) describes gradual plant availability and how halving the sunflower price required rebalancing the entire game. | Unlock tools in stages. Teach a new enemy before making it central to a difficult mixture. Changing tokens or prices affects the whole progression. |
| **Defender's Quest:** its developer argues that players should see incoming enemy types, counts, strength and spawn locations so the challenge concerns planning. [Lars Doucet's design article](https://www.gamedeveloper.com/design/optimizing-tower-defense-for-focus-and-thinking---defender-s-quest), “Total Information.” | Preparation-only building makes advance information especially valuable: an unexpected threat cannot be answered during our wave. |
| **Goal Defense:** the developer connects enemy health, spacing, speed, coverage and economy. The article seeks renewed investment every one or two waves and demonstrates, under its simplified model, why a sufficiently defended stream remains beatable regardless of how many identical enemies follow. [Balance in TD-games](https://www.gamedeveloper.com/design/balance-in-td-games), wave/economy and creep-count sections. | More enemies can merely lengthen a solved wave. Test short periods of simultaneous demand and reasons to invest again. The suggested frequency is that developer's preference, not a universal genre rule. |

These sources support design principles, not a universal percentage ramp or transferable spawn table. Defense Grid has recoverable cores, building during combat and its own weapon counters; PvZ has lanes, vulnerable plants and sun production. Defender has fixed routes, preparation-only spending and persistent ownership. Their numerical economies cannot be imported directly.

This research read manuals, developer prose and slides; it did not play these games or watch complete campaign walkthroughs. Ironhide's [official Kingdom Rush guide](https://play.kingdomrush.com/kingdom-rush-strategy-guide) was inspected, but it primarily links videos; no exact Kingdom Rush wave counts or unlock order are asserted here.

## Local diagnosis and constraints

The inspected [configuration](../../play/config.js) still enables only A1/A2, Dog/main-route spawns and the gun family. Dogs increase from 100 to 240 HP, speed 12 to 15 and count 3 to 9, with progressively shorter gaps. This is one steadily strengthening stream rather than varied encounters.

The [19 October native replay](../play-balance-2026-10-19/native-two-tier2.json) and [difficulty report](play-difficulty-2026-10-19.md) show that the player can finish investment by preparation for A1.3 and clear the remaining run. The subsequent targeting correction changed controller behaviour; the old replay remains historical evidence. A fresh full replay is required for the next balance pass.

Gun upgrades increase damage throughput and range together. From the current configured cycles:

| Gun tier | Total purchase/upgrade tokens | Range | Ideal uninterrupted DPS |
| --- | ---: | ---: | ---: |
| Base | 1 | 48 | 10 |
| I | 2 | 72 | 29.03 |
| II | 3 | 96 | 47.30 |

Formula: burst damage / (time from first to last pulse + cooldown). These are continuous-target upper bounds; actual output depends on LOS, aiming, contact time, cancellation and overkill. Range gains also expose more of a winding route, so their benefit is not captured by DPS.

The [shared prices and strengths](../../shared/defence.js) assign gun/Arc/missile purchase and per-step upgrade costs of 1/2/3 tokens. At six total tokens, two play-profile tier-II guns offer 94.59 ideal DPS; one shared-profile tier-II Arc offers 82.5, at the same 96 range. Arc's fixed mast and contact selection differ from gun aiming, so this does not prove dominance. It does show that unlocking the existing Arc unchanged is not automatically a compelling purchase. Compare actual useful damage per token.

Other important boundaries:

- Existing Zone A models are Dog, Roller and Moth. Preview Roller is 360 HP at speed 16; Moth is 180 HP at speed 20 and altitude 36. These are preview defaults, not assigned campaign balance. Roller is currently faster than Dog, not an established slow tank.
- Moths follow the authored route at altitude. They do not take shortcuts across the map. Actual gun pitch, LOS and projectile contact determine attack opportunities; “flying” does not create a blanket immunity.
- All current attack families deal single-target damage. Missile explosions do not confer splash; Arc does not chain. A crowd wave tests acquisition, parallel fire and sustained output.
- A3 has two complete approaches of 768/648 units with a shared 264-unit tail; A4 has a 1,104-unit route. Route length alone is not difficulty. A3 traffic must be scheduled by arrival at useful coverage and the merge, not just simultaneous entry.
- Enemies do not queue or avoid one another. Tighter gaps, faster ground followers and merging traffic require actual animated-envelope checks.
- [Player enemies](../../play/enemies.js), [engine pools](../../play/engine.js), [inventory](../../play/session.js) and UI currently contain gun/Dog assumptions. Completing Zone A needs bounded integration work as well as schedule data.
- Capacity needs a fresh audit. Extending the unchanged economy to sixteen waves permits 32 base guns before the finale. Under today's simple light formula, 32 guns plus nine Dogs require 132 model lights, exceeding the current 128 limit. This is a code constraint to resolve, not a reason to choose an economy solely to fit the old allocation.

The existing [preparation screenshot](../target-commitment-2026-10-19/ready-wave-four.png) was inspected for interface context. No difficulty claim is inferred from the image.

## Proposed sixteen-wave structure

This is an encounter outline for tuning, not a validated spawn schedule. Exact counts, timings and HP should follow actual-engine trials. Use one understandable stat profile per species per level initially; vary composition and timing within a level. If stronger variants are later introduced within a level, identify them clearly in the wave preview.

| Level and purpose | Wave 1 | Wave 2 | Wave 3 | Wave 4 |
| --- | --- | --- | --- | --- |
| **A1 — Southern Hook: placement and reinvestment** | Readable Dog opening; retain viable two-base and upgrade-first choices. | Two Dog groups; reward another purchase or improved coverage. | Small Roller introduction with familiar Dogs, leaving enough separation to read its behaviour. | Dogs and Rollers in a sustained test of upgraded and distributed fire. |
| **A2 — Garden Crossing: height and timing** | Few clearly announced Moths, with known ground enemies. | Ground-dominant wave with a later air group. | Air and ground reach useful firing areas together, testing coverage and target competition. | Mixed-wave culmination with a second group arriving before the first is fully dealt with. |
| **A3 — Garden Confluence: distributing fire** | Establish both approaches with staggered familiar groups. | Shift the larger group to the other approach; retain a useful shared-tail defence. | Overlap arrivals near the merge, sharing the total enemy budget across approaches. | Unequal mixtures on the two approaches, testing early branch damage plus late interception. |
| **A4 — Ruin and Mere Tour: mastery** | Re-establish the mixed roster on this longer route without resetting to A1 pressure. | Tougher ground emphasis: sustained damage and reload coverage. | Faster/air emphasis: dependable firing windows and cleanup. | A staged combined finale using all three species and the arsenal introduced so far. |

Do not raise every variable on every wave. A new enemy can justify a modest quantity dip; a fourth-wave peak can be followed by a slightly calmer introduction on the next map while still respecting accumulated player power. The rising curve should be evident across the zone.

“Tougher ground” proposes a relative HP role for Roller; it does not add armour or resistance. Avoid faster ground packs catching slower ones unless actual separation has been demonstrated. Alternating groups, different approaches and air/ground overlap offer safer first experiments than tightly interleaving different ground speeds.

## Proposed defence availability

| First availability | Proposal | Purpose |
| --- | --- | --- |
| A1 preparation | Gun base and Upgrade I | Establish placement versus concentration. |
| A2 preparation | Arc base/I; gun Upgrade II | Broaden the choice as Moths introduce different firing geometry. Existing guns must remain a viable answer to the introductory air wave. |
| A3 preparation | Missile base/I; Arc Upgrade II | Add longer-range, indirect projectile opportunities as the approaches divide coverage. |
| A4 preparation | Missile Upgrade II; retain earlier options | Let the finale test a developed arsenal without introducing a mandatory new system. |

This would move gun Upgrade II's first availability from the opening preparation to A2. It is a proposed progression change, not a description of today's build.

Recommend reserving generators and drones for later-zone introductions in the first Zone A balance pass. Their models/controllers exist, but availability, player integration and prices need separate work. This leaves useful discoveries after Zone A and keeps today's first calibration to three enemy and three weapon families. If the user wants either in Zone A, explicitly revise the table and balance matrix rather than quietly assuming it.

Initial identities to test: gun for economical sustained fire; Arc for heavier immediate hits with fixed-mast aiming; missile for longer-range shots around scenery, offset by flight and reload. Tune their real results before claiming those roles are successful. No forced weapon-type check is needed merely to justify an unlock.

## Economy and parameter experiments

Keep the current 2-token opening, +2 per completed wave and 10 cumulative misses as the comparison baseline. Sixteen waves then allow total spending of 2, 4, …, 32 tokens before each wave. Inventory already bought is included in that total; it is not new cash each time.

First author encounters and compare affordable builds using the existing 1/2/3 family prices. Adjust play-only damage/cadence/range if one family dominates all tested situations. Preserve model geometry and shared preview profiles.

Then compare a +1 reward variant, which permits 2, 3, …, 17 total tokens before the sixteen waves. This is a test candidate, not a recommendation to halve income immediately. A +1 reward with the current eight-wave solution still permits those same six tokens by wave five; it would delay upgrades without establishing a richer late game. Increasing upgrade costs is another alternative, but do not simultaneously change prices, rewards and every enemy statistic in the first comparison.

For each wave, record total HP, release duration, peak simultaneous threat, time spent in actual firing coverage, kills/misses, remaining HP on escape, useful damage by defence and wallet/spend. HP per spawn-second helps compare steady streams, but is not a standalone difficulty score for finite groups, mixed speeds or multiple approaches.

## Completion criteria for the session's implementation pass

1. All sixteen waves run through the production session, with family availability and a concise upcoming-wave preview (types/counts, relevant strength and entrances).
2. Compare a progressively upgraded mixed arsenal, a gun-focused arsenal, a wide low-tier build, and the old two-gun strategy. Compare several meaningful placements, not only an optimised witness.
3. Establish multiple affordable successful preparations. The old minimal strategy should no longer cruise through the full zone; a larger well-placed gun investment need not be forbidden.
4. Tune for a demanding but learnable first zone: good planning can clear cleanly, reasonable imperfect play has room to recover, and neglected upgrades/coverage eventually fail. These are proposed qualitative targets, not measured win rates.
5. Replay the complete persistent economy. Include recovery after early misses, A2→A3 and A3→A4 transfers, failure, retry, pause and final reward. A later wave winning in isolation with an invented wallet is insufficient.
6. Inspect actual ground spacing, merge traffic, airborne aiming and physical missile flight. Preserve accepted scenery, wildlife journeys, models, authored conditions and camera behaviour.
7. Verify entity/light/effect capacities and representative laptop/desktop rendering under affordable dense builds. A CPU success witness does not establish frame rate.
8. Finish with a user playtest. Automated clear/fail evidence establishes feasibility and differentiation, not enjoyment or final balance acceptance.

## Practical handoff

Tactician: turn the outline into timed groups and compare branch/junction/mixed placements with persistent spending. Engineer: generalise the bounded player pools, family inventory and configuration validation; wire existing combat controllers into finite waves and results. Artist/readability review: retain accepted layouts and models, inspect species identification, air/ground separation and the wave preview. Lead: integrate, update the shared design record, run affected checks and record the user playtest.

Open choices for the next design step are the unlock table, whether to include drone/generator in A, the target difficulty feel and whether evidence warrants altered reward or upgrade prices. The present research does not declare these choices approved.
