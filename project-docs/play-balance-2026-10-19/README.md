# Moderate A1/A2 difficulty pass — 19 October 2026

The user found Area 1 too easy and authorised Researcher and Tactician to adjust its enemy configuration. The active `/play/` slice remains A1/A2, four waves each, with existing Dogs and gun models. This pass keeps the 2-token opening, +2 successful-wave reward and 10 cumulative misses. The result is a moderate introductory ramp with a forgiving opening and useful second upgrades; final balance remains subject to playtesting.

## Active provisional tuning

| Wave | Dogs | HP each | Speed | Spawn gap |
| --- | ---: | ---: | ---: | ---: |
| A1.1 | 3 | 100 | 12 | 3 s |
| A1.2 | 4 | 120 | 13 | 2.8 s |
| A1.3 | 5 | 140 | 14 | 2.6 s |
| A1.4 | 6 | 160 | 15 | 2.4 s |
| A2.1 | 6 | 180 | 15 | 2.3 s |
| A2.2 | 7 | 200 | 15 | 2.2 s |
| A2.3 | 8 | 220 | 15 | 2.1 s |
| A2.4 | 9 | 240 | 15 | 2 s |

Optional `wave.enemyOverrides.dog` records only HP and speed. The runtime resolves them over the ordinary play enemy defaults. Shared `/game/` enemy and weapon values remain independent.

Gun upgrade 2 is play-only provisional tuning: 96 range, 14 damage per round, five rounds with 0.12-second minimum gaps, then a 1-second cooldown. Each upgrade step costs 1 token. Upgrades retain the existing actual line-of-sight, barrel aiming, burst cancellation and target planning rules.

## Real-engine witnesses

The [audit script](../../scripts/play-balance-audit.js) uses production `PLAY_CONFIG`, `PlaySession`, `loadPlayWorld`, `PlayEngine` and `createPlacementRules`. Every arrangement must pass full placement and connected-wildlife preparation checks. Combat uses the actual 120 Hz fixed simulation with 30 Hz outer updates, including scenery/terrain LOS, physical aiming, target selection, damage and escape boundaries. It verifies ownership, paid sequential upgrades, exactly-once rewards and the complete run economy. No asset source is written.

```sh
bun scripts/play-balance-audit.js --require-defaults --output=docs/play-balance-2026-10-19/audit.json > docs/play-balance-2026-10-19/audit.jsonl
```

The old wave profile had 36 Dogs, all 80 HP at speed 12, with counts 3/4/5/6 restarting on A2. Two base guns upgraded once after the opening cleared all eight waves with zero misses and 14 unspent tokens. Under the new profile, the same old two-gun strategy completes with five misses and the same 14 tokens. This is increased pressure, not a forced defeat for saving tokens.

The final replay passes **51 wave attempts across seven scenarios**. All active-profile scenarios use `PLAY_CONFIG` directly; `--require-defaults` also confirms every active count, spawn time, HP and speed against the recorded table.

| Profile and purchase plan | Result | Misses | Tokens spent | Final wallet |
| --- | --- | ---: | ---: | ---: |
| Earlier profile, two upgrade-1 guns | Complete | 0 | 4 | 14 |
| New profile, same old positions and upgrades | Complete | 5 | 4 | 14 |
| New profile, spread A1 positions and upgrade 1 | Complete | 4 | 4 | 14 |
| New profile, same spread positions and upgrade 2 | Complete | 0 | 6 | 12 |
| New profile, progressive additional purchases | Complete | 0 | 16 | 2 |
| New profile, one upgraded opening then purchases | Complete | 0 | 16 | 2 |
| New profile, no defences | Defeat during A1.3 | 10 | 0 | 6 |

The clean six-token witness buys two bases at A1 `[13,0,9]` and `[4,0,9]`, upgrades both to upgrade 1 before wave 2, then upgrades both to upgrade 2 before wave 3. It keeps those two guns for the rest of A1, and redeploys the same owned guns at A2 `[5,0,5]` and `[8,0,8]`. All **48 Dogs are killed with zero misses**; the run ends with **12 tokens**, after spending 6 in total. Those same A1 positions with only upgrade 1 finish with four misses, so the upgrade comparison holds the placement choice fixed.

The opening supports different purchases. The original sensible two-base placement `[2,0,7]`/`[9,0,10]` kills two of three opening Dogs and incurs one recoverable miss. The spread two-base arrangement above kills all three. A single initially upgraded gun is also tested as a separate complete-run witness. No hidden placement restriction was added to force spending.

For the six-token witness, A1 wave 4 resolves in 26.60 seconds and A2 wave 1 in 26.46 seconds, with zero escapes in either. Retained ownership and the gradual 160→180 HP increase avoid resetting the difficulty or creating a measured transfer cliff. The final wave resolves in 40.23 seconds with the same two guns. More purchases are permitted, but these results do not imply that all available tokens must be spent.

The configured bound is 16 affordable guns and 9 scheduled Dog slots, or 84 model-light clusters. The new entry spacings range from 30 to 36.4 units, exceeding the previous 24-unit minimum. This describes route-entry spacing; right-angle turns can reduce straight-line separation between neighbours, and the game has no enemy queueing mechanic.

## Evidence and limits

- [Final audit report](audit.json) and [per-wave raw log](audit.jsonl): active defaults, source hashes, exact placements, wildlife seeds, economy and all comparison outcomes.
- [Native two-upgrade witness](native-two-tier2.json) and [raw log](native-two-tier2.jsonl): independent replay after per-wave runtime support landed.
- [Opening candidates](opening-probes.jsonl), [alternative opening sites](opening-sites.jsonl), and [single-gun site probes](site-probes.jsonl): bounded rejected-candidate and placement evidence. The 500 HP site probes measure finite exposure against one Dog, not sustainable wave damage or a proof of optimal placement.
- [Research rationale and independent checks](../research/play-difficulty-2026-10-19.md).

These deterministic witnesses establish viable choices and a measurable difference from the earlier profile. They do not establish a unique best strategy or final human difficulty acceptance. Layouts, scenery, models, wildlife behaviour, preview combat values and the frozen landscape backup remain outside this tuning scope. The audit directly verifies that the A1/A2 source hashes do not change during its run; the lead's broader preservation check covers the full asset set and backup.
