# First-area difficulty follow-up — 19 October 2026

**Researcher + Tactician; implemented provisional play tuning.** The user reports that Area One is a little too easy and requests a harder enemy configuration. This work covers the existing A1/A2 eight-wave `/play/` slice, including the newly requested second gun upgrade. Keep the 2-token start, +2 successful-wave award, ten cumulative misses, preparation rules, models, accepted routes, wildlife behaviour and `/game/` preview statistics. Final balance still needs player feedback.

## Diagnosis from the existing implementation

The [first real-engine success witness](../play-first-2026-10-19/placement-and-tuning.json) spent four tokens in total: two base guns, followed by one upgrade each after the first wave. Those same two guns then cleared all 36 Dogs without misses, finishing with 14 unspent tokens. A2 repeated A1's 3/4/5/6-Dog schedules at the same 80 HP and 12 units/second despite four previous rewards. The evidence supports increasing later pressure and making further upgrades useful; it does not establish that the player must spend every token or that a weaker strategy must lose.

The available total spend before each wave is 2, 4, 6, 8, 10, 12, 14 and 16 tokens. A base gun costs one token, an upgrade-1 gun two total, and an upgrade-2 gun three total. The final reward cannot fund an active wave. Compare encounters against affordable preparations, including a player who spends the rewards and a player who keeps the old two-gun loadout.

| Lever | Useful effect | Risk and constraint |
| --- | --- | --- |
| Dog HP | More validated shots required; preserves readable movement. | One global increase can make the two-token opening disproportionately hard. Burst and shot thresholds make small HP changes discontinuous. |
| Dog speed | Shorter firing windows; fewer long walks through cleared space. | The existing verified Dog gait supports at most 15 units/second; this is a 25% increase over the first playable. Do not exceed that limit for balance. |
| Spawn gap | More simultaneous demand on the guns. | Tight traffic reduces model separation. At speed 15, a 1.6-second gap gives 24 units of route separation at entry; it does not prove model clearance around corners. |
| Enemy count | Tests sustained capacity and creates a fuller wave. | Extra identical enemies mainly extend duration once a defence already sustains the stream. Large counts are a poor substitute for a difficulty curve. |
| Per-wave Dog profile | Keeps an approachable opening while later waves match the growing arsenal. | Must be explicit, validated and resolved identically for HP, movement and targeting. This remains the same Dog, without new abilities or models. |

With uninterrupted valid targeting, ideal full-cycle damage rates are 10 HP/s for base, `36 / 1.24 = 29.03` for upgrade 1 and `70 / 1.48 = 47.30` for the proposed play-only upgrade 2 (14 HP, five rounds, 0.12-second gaps, one-second cooldown after the final round). These are explanatory upper bounds, not measured combat rates: aiming, LOS, finite exposure, cancellations, retargeting and overkill reduce actual output. Range also increases 48 → 72 → 96, so DPS ratios alone cannot predict outcomes.

A global 120-HP Dog stream at 1.7-second gaps presents about 70.6 HP/s while two upgrade-2 guns have a combined ideal 94.6 HP/s and broad coverage. Merely adding enemies to that stream need not make the late game interesting. Per-wave HP is justified if actual-engine comparisons confirm that a low opening HP still lets the accrued arsenal dominate the final waves.

## Opening comparison

Researcher's independent actual `loadPlayWorld` + `PlayEngine` probe used A1, one affordable upgrade-1 gun at `[8,0,10]`, four Dogs at speed 15 and 2.4-second gaps. The normal fixed 120 Hz simulation was driven with 30 Hz outer frames. Models, routes, LOS, articulation and ordinary targeting were active. Tactician's [opening probes](../play-balance-2026-10-19/opening-probes.jsonl) independently reproduce the overlapping 120/140/160-HP cases.

| Dog HP | Killed / escaped | Shots | Resolution time | Escaped HP |
| ---: | --- | ---: | ---: | ---: |
| 120 | 4 / 0 | 40 | 34.23 s | — |
| 140 | 4 / 0 | 48 | 35.23 s | — |
| 160 | 3 / 1 | 48 | 69.60 s | 88 |
| 180 | 3 / 1 | 50 | 69.60 s | 120 |

The 140 → 160 step loses a whole kill despite the modest nominal HP increase. Tactician additionally found the previous two-base witness kills no Dogs at 140 HP / speed 15. That setting therefore cannot be selected solely because the upgrade-first opening succeeds. Better base placements and gentler opening profiles must be compared before integration. Some imperfect placements may leak; a clean solution for every legal arrangement is not a requirement.

## Combined recommendation

The lead integrated the restrained profile below after the Researcher/Tactician comparison. Explicit `wave.enemyOverrides.dog` assigns HP/speed, resolving the existing Dog's health, gait and targeting from the same profile. All enemies in each wave share that profile. Counts increase modestly; later HP and pressure no longer reset when A2 begins.

| Wave | Dogs | HP each | Speed (units/s) | Spawn gap | Last spawn | Nominal stream HP/s | Available total spend |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A1.1 | 3 | 100 | 12 | 3.0 s | 6.0 s | 33.3 | 2 |
| A1.2 | 4 | 120 | 13 | 2.8 s | 8.4 s | 42.9 | 4 |
| A1.3 | 5 | 140 | 14 | 2.6 s | 10.4 s | 53.8 | 6 |
| A1.4 | 6 | 160 | 15 | 2.4 s | 12.0 s | 66.7 | 8 |
| A2.1 | 6 | 180 | 15 | 2.3 s | 11.5 s | 78.3 | 10 |
| A2.2 | 7 | 200 | 15 | 2.2 s | 13.2 s | 90.9 | 12 |
| A2.3 | 8 | 220 | 15 | 2.1 s | 14.7 s | 104.8 | 14 |
| A2.4 | 9 | 240 | 15 | 2.0 s | 16.0 s | 120.0 | 16 |

Nominal stream HP/s means HP divided by spawn gap, not measured damage demand at every instant. Finite trains, earlier damage, route returns and remaining coverage let a defence survive an interval whose nominal arrival rate exceeds its ideal DPS. Last-spawn times are measured from the first spawn at time zero; they are not wave duration estimates.

This raises the run from 36 to 48 Dogs and total scheduled health from 2,880 to 8,840, while retaining a familiar three-Dog opening. The speed ramp shortens the unopposed A1 traversal from 78 to 62.4 seconds by its fourth wave. Entry route separation stays at least 30 units throughout, instead of pushing the existing animation envelope or tightly packing a larger roster. Actual corner separation still needs visual review.

The play-only second upgrade uses 14 damage per pulse, range 96, five pulses with 0.12-second minimum gaps, and a one-second cooldown after the last actual pulse. This rewards one more preparation purchase per gun without altering shared preview defaults. It is a provisional counterpart to the accepted third model, not a new weapon ability.

## Verification and difficulty-wall checks

Tactician's pre-integration actual-engine comparisons show the old two-upgrade-1 strategy completing with five cumulative misses instead of zero; a six-token two-upgrade-2 strategy clears the run without misses. The weaker strategy remains playable, consistent with an introductory area. A clean run should not require every available token, and a five-miss run is useful difficulty evidence rather than a failed balance test.

The old A1 opening pair `[2,0,7]` / `[9,0,10]` kills two of the first three Dogs at the new 100 HP / speed 12. An alternate two-base arrangement `[13,0,9]` / `[4,0,9]` clears all three. The affordable one-upgrade-1 opening also remains viable. These are witnesses, not claims that every legal placement is equally strong.

Researcher's supplemental actual finale probe at 240 HP, speed 15, nine Dogs and two-second gaps uses two upgrade-1 guns at `[5,0,5]` / `[5,0,7]`, selected from Tactician's high-damage individual-site sweep. It kills seven and leaks two, with 48 and 132 HP remaining. A three-upgrade-2 preparation at `[5,0,5]` / `[8,0,8]` / `[16,0,9]` clears all nine. This supports pressure across more than one arrangement; it does not establish an optimal solution or prove the third gun is needed.

The stronger exploratory 320/400-HP finales were rejected for this first adjustment. In the 400-HP probe, two upgrade-2 guns leaked three Dogs and resolution took 81.6 seconds, compared with a clean 240-HP finale in roughly 40 seconds. More leaking and waiting are not automatically a better introductory experience. Retain the moderate profile and use the user's next playtest to judge whether the ramp should change again.

The [native per-wave-override replay](../play-balance-2026-10-19/native-two-tier2.json) verifies the integrated configuration through the production `PlaySession`, `PlayEngine` and `loadPlayWorld`, with ordinary LOS, aiming, pitch, bursts and target planning at 120 Hz fixed simulation driven by 30 Hz updates. Every arrangement passes source placement and connected-wildlife preparation checks. Buy two bases at A1 `[13,0,9]` / `[4,0,9]`, upgrade both after wave 1, upgrade both again after wave 2, then redeploy the same owned IDs at A2 `[5,0,5]` / `[8,0,8]`. This completes eight waves, kills all 48 Dogs, spends six tokens total and ends with zero misses and 12 tokens. Its final wave resolves in 40.225 seconds.

The supported worst-case configuration remains 16 affordable guns, now with nine current-wave Dogs and 84 model-light clusters. This is a bounded entity/light-capacity check, not a frame-rate guarantee. Full gameplay/browser and affected-test closeout belongs to the lead's delivery record.

## Shared-document handoff

After integration, the lead should update [the design doc](../design-doc.md), its change record, [the project brief](../project-brief.md), [team handoff](../team/README.md) and [daily diary](../development-diary.md). The first-player-loop section should identify the revised eight-wave profile and all three enabled gun tiers as implemented provisional play tuning. The token/upgrade table should show base → upgrade 1 → upgrade 2 in `/play/`; the shared preview weapon table must continue to distinguish its inactive upgrade-2 attack from the play-only resolved attack. Keep final player acceptance, broader campaign balance and additional arsenal/enemies open.

This report uses local source and actual-engine evidence. Earlier [layout research](tower-defence-layouts.md) informs readable coverage and alternative sites; it does not establish Defender's numerical difficulty or justify importing another game's economy, resistances, abilities or route rules.
