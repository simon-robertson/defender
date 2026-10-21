# Zone A encounter and balance handoff — 20 October 2026

The user authorised finishing Zone A for review before work on other zones. The implemented candidate uses the accepted A1–A4 landscapes, three existing enemies and three existing defence families. No additional type was needed. All values below are provisional play tuning, isolated in `play/config.js`; model sources, shared preview profiles and `/game/` remain unchanged.

## Encounter structure

The zone has sixteen manually started finite waves and 168 scheduled enemies. Species have a stable profile within each level; wave variety comes from groups, air/ground competition and A3's two approaches. Every escaped species still contributes one miss. No armour, resistance, splash, chains or new enemy ability is assumed.

| Level | Dog HP / speed | Roller HP / speed | Moth HP / speed | Wave enemy counts |
| --- | --- | --- | --- | --- |
| A1 Southern Hook | 100 / 12 | 350 / 12 | absent | 3, 6, 6, 9 |
| A2 Garden Crossing | 240 / 14 | 750 / 14 | 180 / 20 | 7, 11, 12, 14 |
| A3 Garden Confluence | 480 / 15 | 1,400 / 15 | 300 / 21 | 10, 12, 14, 14 |
| A4 Ruin and Mere Tour | 650 / 15 | 2,000 / 15 | 450 / 22 | 12, 12, 12, 14 |

A1 introduces Dogs, then separated Rollers. A2 introduces a small Moth group that existing guns can hit at suitable distances, then overlaps flight with heavier ground traffic. A3 alternates the heavier approach and combines branch damage with the shared southern catch. A4 tests retained investment on the longer tour, with a heavy procession, larger air group and a final two-Dog/six-Roller/six-Moth encounter. The finale has 16,000 HP, compared with A4.1's 12,400 HP; it is not a repetition with an extra wallet.

Ground species share speed within each level, avoiding overtaking by faster ground followers. At 15 units/s the eastern A3 approach reaches the common tail eight seconds before the western one. Eight-second branch gaps and four-second release offsets interleave ground arrivals. Moths at 21 units/s have a different 5.714-second approach difference: eastern air releases at 6.714 seconds in A3.3 and 10.214 seconds in A3.4 prevent near-simultaneous merge arrivals. These times are deliberate traffic authoring, not random jitter.

Moths use a play-only altitude of 44, increased from the preview's 36. The original flight height crossed the complete upper-tier gun pitch sweep and conservatively excluded almost all useful courts. The separate player altitude restores physical clearance while preserving the accepted models and `/game/` height. It makes suitable horizontal aiming distance meaningful; it does not grant immunity or alter routes. Configuration-aware placement checks consider species present anywhere in the current level, so absent Moths do not exclude A1 ground.

## Arsenal and economy

Starting tokens remain 2, successful-wave reward 2 and cumulative miss limit 10. The wallet, owned units and tiers persist. Before waves 1–16 total available investment is 2, 4, …, 32 tokens; the final reward produces 34 total earned tokens but cannot fund another active wave. No reward or price change was needed for these witnesses.

| First global wave | Available family or tier |
| --- | --- |
| 1, A1.1 | Gun base and Upgrade I |
| 5, A2.1 | Gun Upgrade II; Arc base and Upgrade I |
| 9, A3.1 | Arc Upgrade II; missile base and Upgrade I |
| 13, A4.1 | Missile Upgrade II |

| Family | Purchase / each upgrade | Base damage / range | Upgrade I damage / range | Upgrade II damage / range |
| --- | --- | --- | --- | --- |
| Gun | 1 / 1 | 10 / 48 | 12 / 66 | 14 / 84 |
| Arc Spire | 2 / 2 | 36 / 60 | 48 / 84 | 65 / 108 |
| Missile launcher | 3 / 3 | 200 / 96 | 280 / 126 | 360 / 150 |

Gun cadence stays one/three/five hits per burst, 0.12-second round gaps and one second after the last actual round. Arc uses one/two/three hits, 0.16/0.18-second upgraded gaps and 1.2/1.3/1.4-second cooldowns. Missiles retain their actual two/four/six-round magazines, one-second minimum launch gaps and separate four/4.5/five-second reloads. Missile damage occurs only after physical contact; scenery collisions and missed shots remain real costs.

The Arc's initial proposed damage was reduced before final probes to avoid obvious nominal dominance. Continuous-target ideal DPS is about 10/29.0/47.3 for guns, 30/65.8/110.8 for Arc, and 80/149.3/216 for missiles under their actual first-to-last launch/reload cycle. These bounds do not include target acquisition, useful exposure, overkill or flight loss. Actual per-family useful damage is recorded by the audit; no family is made mandatory through immunity.

## Evidence and reproducibility

The authoritative native run is [balance.json](balance.json). It uses production `PlaySession`, `loadPlayWorld` and `PlayEngine`, 120 Hz fixed simulation, 30 Hz outer updates, real aiming/LOS, articulated movement, impacts, physical missile flight and connected-wildlife deployment preparation. Same-map waves reuse the world; inventory and wallet persist through all three landscape transfers. Each report records affordable transactions, exact placements/tiers, kills/escapes, remaining escape HP and useful damage by family/species. Hashes are captured before the run and every load-bearing listed source is checked unchanged at the end.

The final frozen-source run contains 79 wave attempts across six comparisons:

| Policy | Result | Misses | Tokens spent | Kills |
| --- | --- | ---: | ---: | ---: |
| Mixed, seven owned units | Complete all 16 | 0 | 31 | 168 |
| Same mixed plan after undeployed opening | Complete all 16 | 3, all in A1.1 | 31 | 165 |
| Continuous gun investment | Complete all 16 | 1, in A3.3 | 32 | 167 |
| Arc-heavy investment | Complete all 16 | 0 | 32 | 168 |
| Old two Upgrade II guns | Defeat during A2.4; 7 completed | 10 | 6 | 58 |
| Wide base guns | Defeat during A2.3; 6 completed | 10 | 14 | 38 |

The clean mixed finale applies 2,898 useful gun damage, 5,371 Arc damage and 7,731 missile damage against 16,000 HP. Its missiles score 24 physical hits, three scenery collisions and one missed pass; delayed/orphaned shots remain real rather than guaranteed damage. Across the full mixed run useful damage is 34,349 gun, 40,607 Arc and 33,624 missile. These witnesses demonstrate useful roles and several affordable solutions; they do not establish that one family is optimal or that prices are final.

The six comparison policies are retained in `scripts/zone-a-balance-audit.js`: old two upgraded guns, continuous gun investment, a mixed arsenal, the same mixed plan after deliberately leaving the purchased opening guns undeployed, wide base guns and an Arc-heavy arsenal. The recovery policy keeps its purchased units and receives ordinary rewards after surviving the three opening misses; it has no free replacement or miss reset.

Reproduce all native comparisons with:

```sh
bun scripts/zone-a-balance-audit.js --scenario=all --output=docs/zone-a-completion-2026-10-20/balance.json
```

[traffic.json](traffic.json) independently samples every unarmed schedule at 120 Hz using production `PathMotion` and conservative complete-animation horizontal radii and vertical envelopes. Every same-height actor pair has positive separation; the smallest cylinder margin is approximately 1.456 units in A1. This authoring check excludes combat stagger and is supplemented by Researcher's occupied-geometry checks. Reproduce it with `--scenario=traffic` and the same `--output` argument.

Fresh targeted config verification: seven checks and 111 assertions pass. They cover finite schedules, immutable preview separation, ordered family/tier availability, supported species/route/altitude profiles, per-family/species capacity, actual missile magazine sockets and invalid delivery/cadence contracts. The full suite was not run.

The affordable worst case is 32 owned base guns. Per-family pools are bounded at 32 guns, 16 Arcs and ten launchers; each species needs six reused actor slots, eighteen total. No wave exceeds fourteen enemies. The peak active model-light budget is 128, calculated from the affordable wallet and the species present in that wave, rather than summing disjoint wave peaks. Renderer visibility/light membership is Engineer's integration responsibility; CPU success does not establish laptop frame rate.

Native clear/fail witnesses establish feasibility and a need to reinvest, not human win rates or final enjoyment. The user should review Zone A before any Zone B progression work. Remaining open scope includes later zones, generators/drones in player inventory, repairs, saving/resuming and final campaign balance.
