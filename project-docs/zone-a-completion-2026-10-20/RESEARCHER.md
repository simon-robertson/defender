# Zone A completion: independent design review

Researcher, 20 October 2026. Initial review; implementation and balance evidence are still being produced. This is a design judgement within the user-authorised Zone A delivery, not final user acceptance.

## Roster recommendation

**No additional enemy or defence type is presently needed to complete Zone A.** Dog, Roller and Moth, with gun, Arc Spire and missile launcher, provide enough existing variation for sixteen authored waves. First prove that the current families create useful decisions under actual combat and affordable spending. Do not add another species or weapon merely to conceal a numerical advantage in one existing family.

This recommendation rests on current capabilities, rather than an assumption that three is a universally sufficient count:

| Existing ingredient | Distinct question it can already support | Limitation to preserve |
| --- | --- | --- |
| Dog | Economical sustained damage and repeated route exposure | No special resistance or ability |
| Roller | A tougher ground target competing with other enemies for fire | A slow/tough role must be assigned in play configuration; preview defaults are faster than Dog |
| Moth | Different shot elevation, animated LOS, and shorter usable contact at higher speed | Follows its assigned route at altitude; no map shortcuts or blanket gun immunity |
| Gun | Affordable placement versus concentrated upgrades; mechanical aiming and sight lines | Its range and burst upgrades can make it numerically dominant unless measured against cost |
| Arc Spire | Immediate heavier hits, fixed mast and actual surface-contact opportunities | Single target; no chain, stun or splash; heavier nominal hits do not alone prove a distinct economic role |
| Missile launcher | Range and physical indirect flight around scenery, magazine/reload timing | Real contacts can fail; launch admission without LOS is not guaranteed obstacle clearance; no splash |
| A3's two approaches | Early branch damage versus shared-tail interception, unequal arrivals | Simultaneous spawn times do not imply simultaneous arrival; merge crowding needs actual pose checks |

Capability evidence: [shared design](../design-doc.md#shared-attack-rules-and-current-weapon-values), [enemy expansion](../enemy-expansion.md), [A3 route evidence](../a3-path-carving-2026-10-18/README.md), and [current progression research](../research/zone-a-wave-progression-2026-10-20.md). The latter already records external developer sources and their limits; no new external research is needed for this bounded review.

## Unlock and information review criteria

The researched proposal—gun base/I at A1; gun II and Arc base/I at A2; missile base/I and Arc II at A3; missile II at A4—is a sensible starting sequence. Unlocks should make useful options available before their first serious test. A2's first Moths must remain answerable with owned guns; a newly unlocked Arc should be an opportunity, not a compulsory surprise purchase. Preparation-only spending means the player cannot correct a hidden composition mistake during a wave.

Before manual start, show the current wave's enemy names/counts, effective HP/speed and route/entrance assignments. Counts alone are insufficient where the same named species changes strength between levels. Identify air and ground plainly. A short wave purpose/group description can explain staged arrivals; the UI must describe the actual schedule rather than an invented encounter story. Show available families and next unlocks, current costs, tiers and range/damage sufficiently clearly to make spending reviewable. Do not describe missiles as area damage or Arc as a chaining/crowd weapon.

The preview should remain concise at laptop sizes: a grouped species/route summary can carry detailed values without enumerating every actor. If a wave changes effective stats within a species, separate those groups; preferably retain one understandable species profile per level. Active route names must correspond to the source's real complete routes. The user needs to see which approach receives which group, particularly on A3.

## Balance and recovery criteria

The baseline economy supplies 2, 4, …, 32 total tokens before the sixteen waves and awards a final 2 only after completion. Purchase/upgrade expenditure already sunk in persistent inventory counts toward those totals. A replay that invents a late wallet or starts every map with a fresh arsenal cannot establish campaign feasibility.

Every species currently contributes one miss. The ten-miss run-wide threshold permits imperfect waves only while the cumulative total remains below ten. A successful wave with escapes must still earn its ordinary reward, making later reinvestment possible; no perfect-clear reward gate or hidden punishment is authorised. With free repositioning and no refunds, recoverability must be demonstrated using the inventory actually purchased, not by replacing it with an ideal arsenal at no cost.

Required evidence for a design recommendation to ship for user review:

1. A complete progressive mixed-family witness, using legal unlocks/spending and real family controllers.
2. A complete gun-focused comparison and a wider low-tier comparison. All-gun success may be acceptable; identical or cheaper success everywhere would leave the new families' usefulness unproven.
3. The old minimal two-gun strategy visibly loses its former effortless clear. Do not require every gun strategy to fail simply to force diversity.
4. A genuine early-miss recovery run that survives later pressure with the same persistent wallet, units and misses.
5. Explicit clean completion, ten-miss defeat and fresh retry; pause, settlement rewards and level transfers must not duplicate income or erase losses.
6. Actual A3 arrival/merge spacing, Moth aiming and missile contact evidence. Mathematical HP/DPS totals are useful diagnostics, not substitutes for the engine.

## When another type would be justified

Revisit the roster after measured encounters and human playtesting if the remaining problem is a missing tactical decision: all three enemies are handled identically despite purposeful speeds/timings/routes; all three defences offer the same useful firing windows and timing; or the user finds sixteen encounters repetitious after meaningful existing combinations. Identify the missing decision and propose a type that addresses it before commissioning art or mechanics.

If one weapon wins simply through greater useful damage/range per token, tune the existing play-only profiles and verify alternatives first. If the problem is unreadable entrances, hidden strength changes, cramped merge traffic, arbitrary targeting or missile reliability, repair that issue directly. Extra types do not resolve those causes.

## Current evidence limit and integration handoff

Initial inspection found the earlier A1/A2 gun/Dog implementation still present. The new four-level candidate, production replays and browser preview are being built by the team; this initial review does not claim they pass. Add concrete implementation review findings below as evidence becomes available.

Lead should update `docs/design-doc.md` campaign/player-loop/token/weapon sections and change record, the project brief, diary and team notes to reflect the delivered scope, measured balance and still-provisional human difficulty. Preserve the distinction between this implementation's roster sufficiency and the user's eventual gameplay acceptance.

## Candidate review and fresh checks

Read the candidate `play/config.js`, `play/session.js`, `play/ui.js` and `play/app.js` as they evolved. The candidate has all four A landscapes and the researched unlock sequence; one effective HP/speed profile per species per level; grouped species/route preview with the actual overrides; and family-aware inventory. The initial app's gun-only purchase/range/placement call sites were flagged to Lead and have since been updated. Preview wording suggestions are to call A3's main route western, and to show bounded release timing so delayed groups are apparent.

The initial A4 finale repeated A4.1's exact composition with almost identical releases despite six additional earned tokens. Flagged to Tactician; the proposed replacement uses the existing roster for greater combined air/heavy demand. Actual-engine evidence is still required before claiming that the finale is harder.

Fresh independent pure-session check (production `PlaySession`, 20 October): completed sixteen synthetic-resolution waves with two escapes in the opening wave. Bought/upgraded a gun, bought Arc at A2 and missile at A3; early family/tier purchases were rejected. Confirmed species/route preview totals and effective HP/speed, exact once-only rewards including imperfect survival, pause freezing settlement, retained misses/ownership/tiers, cleared placements at all three landscape transfers, final reward and fresh retry. Spending was 13 tokens; completion wallet 21 = 2 + 16×2 − 13. This checks state/economy correctness only; synthetic kill/escape resolutions do not demonstrate combat success or recovery feasibility.

Lead subsequently assigned the three existing camera/acquisition regression fixtures. Migrated these to `tests/helpers/legacy-play-config.js`, explicitly preserving the 19 October A1/A2 Dog schedules, gun ranges and original reported placements. The config retains all four required catalogue levels; unused A3/A4 placeholders carry one Dog so they do not create an impossible hypothetical light budget. Added an optional configuration argument to `scripts/play-targeting-audit.js` so the historical acquisition regression remains reproducible without changing its normal default. No camera source or assertion was relaxed. Engineer confirmed the original Dog movement envelope is unchanged.

Fresh targeted run: `bun test tests/play-action-camera.test.js tests/play-live-camera.test.js tests/play-target-commitment.test.js` — **21 pass, 0 fail, 71,605 assertions**. Includes actual A1/A2 framing, supported operator journeys, combat invariance at 30/60/120 Hz, pause/settlement/return continuity and the reported two-base opening's held/readable shots. These historical fixtures establish camera/controller regressions; current mixed-roster performance and composition still require their separate new-campaign checks.

## Independent physical spacing and flight-height audit

Fresh reproducible probe: `bun scripts/zone-a-spacing-audit.js --hz=20 --mixed=docs/zone-a-completion-2026-10-20/mixed.json --output=docs/zone-a-completion-2026-10-20/spacing.json`. [Machine evidence](spacing.json) records source hashes; every tracked config, engine, enemy/placement module, gait, level and actor/defence model hash matched the saved source on completion and independent recheck.

Across **35,215 sample instants and 227,985 actor poses**, observed **zero** enemy/enemy, scenery/terrain or representative defence overlaps. This covers every one of the sixteen full unopposed schedules, preserving exact release/exit boundaries, plus six native-combat scenes using the mixed witness's A2.1, all four A3 and A4 finale placements. The unopposed pass retains all enemies until escape, so combat deaths cannot conceal a later authored traffic conflict. The combat probes include current posed guns and missile-induced hit responses.

The checker independently merges occupied cells into exact disjoint local cuboids without filling holes, transforms them through actual production part matrices, then uses a 15-axis separating-axis test against other posed boxes and exact static BVH leaf cuboids. Axis-aligned bounds are only the broad phase. Numerical overlap tolerance is 0.0001 units. This is a 20 Hz sampled check, **not** continuous swept certification; it does not cover every player placement, within-actor joint intersections, missile/wildlife contact or unseen between-sample events. Fresh isolated combat scenes are physical placement probes, not retained-state balance replays, and their kill outcomes must not replace the campaign witness.

Moth's **play-only altitude is 44**, preserving the shared preview's 36. Lowest sampled occupied Moth Y was **67.9036**. Conservative complete gun yaw/pitch/recoil envelopes reach Y59/62/65 for base/I/II on path-height ground, leaving **2.9036 units** above the highest gun envelope at those Moth samples. Static scenery clearance also passed the actual occupied-box test. This documents the reason for raising the play profile rather than removing useful accepted defence courts or altering the model.

Independent 1-unit midpoint samples along the 984-unit A2 route show real gun opportunities against the introductory Moth at altitude 44:

| Carried gun in mixed A2.1 placement | Units within horizontal range | Units passing actual pitch and both muzzle LOS checks at zero/full recoil | Equivalent route time at 20 units/s |
| --- | ---: | ---: | ---: |
| Gun 1, Upgrade I, range 66 | 207 | 161 | 8.05 s |
| Gun 2, Upgrade I, range 66 | 218 | 132 | 6.60 s |
| Gun 3, base, range 48 | 66 | 37 | 1.85 s |
| Gun 4, base, range 48 | 84 | 42 | 2.10 s |

All admitted pitch angles stay below the actual 35° limit; highest admitted angle is 34.9192°. These are opportunities along one representative complete Moth journey; simultaneous targets, aim acquisition, cooldowns and competition reduce delivered damage. The base guns' short windows explain why the briefing's “suitable distances” qualification matters. Higher-tier carried guns have substantial real windows, so the air introduction does not create a blanket immunity or compulsory Arc purchase. Actual campaign witnesses provide the separate affordability and kill evidence.

## Final design recommendation from authoritative evidence

**Ready for the user's Zone A gameplay review; no additional enemy or defence type is required.** This accepts the bounded implementation's demonstrated feasibility and distinct choices. Human enjoyment and final difficulty remain provisional.

Independently read [the authoritative final balance report](balance.json), recorded 20 October 2026 at 07:55:56 UTC, and verified every recorded source hash against the current files: **zero mismatches**. Its six production-engine campaigns contain **79 wave attempts**. Independently checked every wave's wallet identity, legal unlocked family/tier, cumulative expenditure within available income, complete successful resolution and retained miss total. No invented late wallet or free replacement inventory was needed.

| Final witness | Outcome | Killed / missed | Total spent | Completion/end wallet |
| --- | --- | ---: | ---: | ---: |
| Progressive mixed arsenal | All 16 waves complete | 168 / 0 | 31 | 3 |
| Same mixed investment after an undeployed opening | All 16 waves complete | 165 / 3 | 31 | 3 |
| Progressive gun investment | All 16 waves complete | 167 / 1 | 32 | 2 |
| Arc-heavy investment after initial guns | All 16 waves complete | 168 / 0 | 32 | 2 |
| Old two-gun, six-token investment | Defeat at A2.4 after seven completions | 58 / 10 | 6 | 10 |
| Broad base-gun investment | Defeat at A2.3 after six completions | 38 / 10 | 14 | 0 |

Recovery is concrete: both opening guns are purchased but left undeployed; all three opening Dogs escape. The ordinary reward arrives, the actual owned guns are subsequently upgraded/deployed, all three misses persist, and the remaining fifteen waves incur **zero further misses**. This demonstrates recovery from that particular placement mistake without selling, free units or a forgiven miss counter. It does not prove recovery from every possible spending mistake.

The mixed run records useful actual damage from every family: **34,349 gun, 40,607 Arc and 33,624 missile** over the zone. In the 16,000-HP finale, guns deliver **2,898**, Arcs **5,371**, and missiles **7,731**. Arcs contribute 2,385 of 2,700 damage against Moths; missiles deliver 6,776 of 12,000 against Rollers. These observed allocations support distinct practical uses in this arrangement; they are not new targeting rules, forced counters or optimal-build claims. The finale records real missile hits, collisions and missed/orphaned flights, so missile usefulness is not inferred from nominal damage or guaranteed contact.

The old minimal build no longer coasts: it loses despite banking ten tokens, while reinvestment can succeed with different developed arsenals. The base-only run's first air wave loses three nearly destroyed Moths, consistent with the measured short base-gun pitch windows. The gun-focused run still survives the entire zone; adding Arc is therefore an option, not an enforced air immunity check. Clean Arc-heavy and mixed success at approximately the same total cost does not prove equal efficiency everywhere, but it gives no evidence that an extra weapon family is needed to make this zone viable.

Remaining limits for user review: the witness placements are purposeful legal preparations, not a novice-play win rate or an exhaustive search; all successful late builds spend 31–32 of the 32 available pre-finale tokens; alternative mistakes and cheaper successful strategies remain unmeasured. The sampled physical audit and Tactician's separate native-rate traffic envelope audit complement each other; neither proves all arbitrary deployments or all continuous-time collisions absent. Do not call the provisional numerical curve final or expand to Zone B on the strength of these results.

No unresolved design, inventory, reward/recovery or sampled physical blocker remains in this review. Preserve the existing roster for the user playtest. Revisit extra types only in response to a demonstrated missing tactical decision or explicit user feedback, not simply to increase the roster count.
