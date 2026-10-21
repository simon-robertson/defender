# Full campaign encounters and balance — 20 October 2026

The user authorised completing Zones B, C and D so they are playable and balanced like Zone A. `/play/` now has sixteen levels, sixty-four manually started waves and 1,084 scheduled enemies: A168, B284, C288 and D344. The accepted A encounters, enemy profiles, defence profiles and staged unlocks are preserved. Numerical difficulty and the new C/D layouts remain for human playtesting.

## Scope and economy

The existing attacking families remain Gun, Arc Spire and missile launcher. Their purchase/upgrade costs, ranges, strength and cadence remain the [Zone A player profiles](../zone-a-completion-2026-10-20/TACTICIAN.md). The run starts with two tokens, awards two after each survived wave and ends at ten cumulative misses. Owned units, tiers, misses and unspent tokens persist through zone changes; deployment remains free during preparation. No generator/drone cost, new enemy type, resistance, splash, chaining, running, repair or reward rule is introduced.

Before waves 1–64 the total earned investment is 2, 4, …, 128 tokens. The final reward brings lifetime earnings to 130 but cannot fund another active wave. Pools accommodate that finite earned budget without imposing a new player inventory rule. Every escaped species contributes one miss.

## Encounter progression

Zone B uses the accepted Cistern and Mesa Circuit, Riverfold Crossing, Mesa Confluence and Aqueduct and Shore Tour. Existing Walkers, Dune Treads and Twin Fans provide tall ground, low heavy ground and airborne targets. Both ground species use ten units/second, the ordinary Dune Tread speed, preventing faster Walkers from overtaking tracked actors. Each level retains one HP/speed profile per species; wave variety comes from group weights, release windows and approaches.

| Level | Walker HP | Dune Tread HP | Twin Fan HP | Wave counts |
| --- | ---: | ---: | ---: | --- |
| B1 | 1,100 | 2,600 | 600 | 14 / 15 / 18 / 18 |
| B2 | 1,400 | 3,200 | 750 | 16 / 18 / 20 / 20 |
| B3 | 1,700 | 3,900 | 900 | 14 / 17 / 20 / 20 |
| B4 | 1,400 | 3,300 | 900 | 16 / 18 / 20 / 20 |

Twin Fans use18 units/second. B4's shorter tour uses lower ground HP than B3 rather than treating encounter difficulty as HP alone. B3's `main`/`eastern` routes differ by336 units. Eastern ground releases are delayed38.6 seconds to reach the shared tail five seconds after their western counterparts, with ten-second branch gaps. Split flight groups use a23.667-second eastern release against a two-second western release and six-second branch gaps, interleaving tail arrivals by three seconds. These are authored finite schedules, not random traffic adjustment.

Zone C uses existing Tripods and Rays on the new landscape-specific routes. Zone D uses only the accepted Spider and Lantern on four distinct single-route tours. The removed Concertina family remains absent.

| Level | Tripod HP / speed | Ray HP / speed | Wave counts |
| --- | --- | --- | --- |
| C1 | 3,300 / 14 | 1,800 / 22 | 14 / 17 / 19 / 22 |
| C2 | 4,200 / 14 | 2,025 / 22 | 14 / 17 / 19 / 22 |
| C3 | 5,100 / 14 | 2,250 / 22 | 14 / 17 / 19 / 22 |
| C4 | 5,850 / 14 | 2,475 / 22 | 14 / 17 / 19 / 22 |

C3's `main`/`northern` routes differ by336 units. Ground releases use zero/28 seconds with eight-second branch gaps; split flight uses two/20.273 seconds with six-second branch gaps. Other C levels use single winding tours. The independent route and placement reports explain the bridge banks, branches, returns and late catches rather than claiming all clear plots are equivalent.

| Level | Spider HP / speed | Lantern HP / speed | Wave counts |
| --- | --- | --- | --- |
| D1 | 6,000 / 12 | 2,400 / 16 | 18 / 20 / 22 / 26 |
| D2 | 6,750 / 12 | 2,700 / 16 | 18 / 20 / 22 / 26 |
| D3 | 7,500 / 12 | 3,000 / 16 | 18 / 20 / 22 / 26 |
| D4 | 8,250 / 12 | 3,300 / 16 | 18 / 20 / 22 / 26 |

All flight species use a player-only root altitude of44, matching the accepted player Moth treatment and retaining physical pitch, range, contact and LOS limits. Preview profiles and model geometry remain unchanged. Player conditions remain daytime and clear.

An initial candidate let the mixed arsenal stop investing after B and still clear all64 waves with67 tokens left. That demonstrated insufficient later pressure. C/D HP was increased by50%; all A/B values, all schedules/speeds, weapon rules and the economy stayed fixed. The final policies below were rerun against that revision.

## Actual retained-budget results

[balance.json](balance.json) is the authoritative five-policy run. It contains228 wave attempts, all using production `PlaySession`, `loadPlayWorld` and `PlayEngine`:120Hz fixed simulation driven at30Hz, actual aiming/LOS, Arc contact, physical missiles, finite exits and the retained wallet. Its48 listed load-bearing source hashes match the delivered files and were checked unchanged at the end of the run.

| Policy | Result | Kills / misses | Spent | Final wallet |
| --- | --- | ---: | ---: | ---: |
| Continued mixed arsenal | All64 waves | 1,084 / 0 | 126 | 4 |
| Arc-heavy after the gun opening | All64 waves | 1,084 / 0 | 128 | 2 |
| Mixed after leaving bought opening guns undeployed | All64 waves | 1,081 / 3 | 126 | 4 |
| Stop investing after A | Defeat in C1.1;32 waves completed | 456 / 10 | 31 | 35 |
| Unarmed run | Defeat in A1.3;2 waves completed | 0 / 10 | 0 | 6 |

The separate [stop-after-B comparison](b-only-investment.json) has the same48 source hashes. It completes42 waves, then defeats in C3.3:632 kills, ten misses,63 tokens spent and23 remaining. Its43 attempted waves bring the final evidence to **271 actual wave attempts across six policies**. This establishes a need for later investment for these preparations; it is not a minimum-spending proof or an exhaustive strategy comparison.

The mixed policy finishes with22 owned/deployed units; Arc-heavy finishes with23. All spending is affordable when performed. The recovery policy retains its actual purchased guns, ordinary rewards and three opening misses; it receives no refund, replacement or reset. Same-map positions are retained where legal. A moving animal caused a half-second ordinary preparation wait in the mixed and recovery runs; live wildlife was never teleported to admit a deployment.

The final mixed D4.4 wave contains155,100 HP. Actual useful damage is Gun18,065, Arc58,664 and missile78,371. Missiles record231 physical hits,63 scenery collisions and75 missed passes in that wave, so launcher damage is not inferred from nominal DPS or guaranteed flight. The wave resolves at110.192 seconds; the corresponding initial lower-HP candidate resolved at90.292 seconds.

Combat alone totals about80 minutes for the complete mixed witness, before settling and player preparation. No campaign-duration target has been assigned; pacing and difficulty remain part of human review.

## Placement, traffic and physical limits

Tall Walker/Tripod clearance excludes many directly adjacent gun positions. Under the conservative complete-sweep passing-enemy guard, B1 admits one UpgradeII gun court. Carried units without a simultaneous safe position remain owned and undeployed; the audit never forces an illegal plot. C's additional distant courts provide27 native gun positions across four levels, generally useful with the already available upgrades. These are material family/site restrictions, not a claim that every gun or strategy fits every landscape. Arc and missile alternatives remain available. Consult the C/D placement matrices for exact family/tier restrictions and overview visibility.

[traffic.json](traffic.json) checks all64 unarmed schedules at every120Hz tick, with32,316,324 same-height pair comparisons against conservative complete-animation cylinders. No overlap is observed; the smallest positive margin is approximately1.456 units. This checks authored release spacing and all route exits, and excludes combat stagger.

The independent occupied-geometry checks use disjoint local voxel-box unions, actual articulated part matrices and15-axis separating-axis tests:

| Evidence | Waves | Sample instants | Actor poses | Observed overlaps |
| --- | ---: | ---: | ---: | ---: |
| [Unopposed finales](spacing-unopposed.json) | Final wave of all16 levels | 7,662 | 87,219 | 0 |
| [Actual mixed-combat finales](spacing-mixed.json) | Final wave of all16 levels | 5,265 | 32,493 | 0 |

Both reports bind to the final configuration and asset hashes. The mixed-combat placements exactly match the authoritative mixed policy. Sampling is4Hz, with release/exit boundaries included for unopposed timelines; mixed combat itself still runs at the production120Hz. These are finite-scene observations of enemy/enemy, scenery/terrain and representative-defence separation. They do not certify continuous sweeps, every intermediate wave in occupied geometry, every possible deployment, within-actor joints, wildlife contact or missile contact. Production deployment guards remain active.

The full earned-budget bound is128 base guns,64 Arcs or42 base launchers; the peak whole-wave enemy count is26. Global per-species maxima sum to87 slots, but runtime loads only the current zone's species and budgets defence geometry through that zone. The computed conservative peak is424 model lights. Root integration retains the fixed36 physical missile slots and verifies safe saturation/deferral separately; witness success is not a GPU frame-time or hardware guarantee.

The final HP configuration passes **8 focused tests,1,319 assertions**; [log](config-tests.log). The full suite was not run.

## Reproduction

```sh
bun scripts/campaign-balance-audit.js --scenario=all --output=docs/campaign-completion-2026-10-20/balance.json
bun scripts/campaign-balance-audit.js --scenario=b-only-investment --output=docs/campaign-completion-2026-10-20/b-only-investment.json
bun scripts/campaign-balance-audit.js --scenario=traffic --output=docs/campaign-completion-2026-10-20/traffic.json
bun scripts/campaign-spacing-audit.js --output=docs/campaign-completion-2026-10-20/spacing-unopposed.json
bun scripts/campaign-spacing-audit.js --mixed-only --mixed=docs/campaign-completion-2026-10-20/balance.json --output=docs/campaign-completion-2026-10-20/spacing-mixed.json
bun test tests/play-config.test.js
```

These demonstrations establish affordable success, cumulative failure, recovery and increased pressure. Final human difficulty/pacing acceptance, further zone tuning, generator/drone purchases, repairs and save/resume remain open.
