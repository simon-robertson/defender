# Drone campaign recommendation — 23 October 2026

The player explicitly delegated the price, availability and upgrade decision to Tactician because it affects gameplay. The lead accepted this recommendation for integration. This document is a bounded design decision and native-controller probe; it does not certify campaign balance or human acceptance of the new unit.

## Decision

| Choice | Recommended rule |
| --- | --- |
| Purchase | **1 token** |
| Unlock | **A2, wave 1**; global encounter 5 |
| Owned fleet | **At most 4 Drone pads per army**, including reserves |
| Versions | **Base only**, no purchasable upgrades |
| Approved combat | 10 HP/round; ten rounds at 4 rounds/s; 5-second cooldown after final actual round |
| Approved endurance | 20 seconds from launch, with return outside the budget; finish an active valid burst on expiry; 10-second recharge at own pad |
| Range/motion | Existing 72-unit horizontal gun range and approved flight/aim/navigation behavior |
| Generator interaction | Retain existing exclusion of mobile weapons; parking near a generator does not confer a permanent flying bonus |

Expose the special fleet rule directly in the catalogue: **“Drone fleet 4/4”** at the limit, with its current count before the limit. Disable an unaffordable, locked or full-fleet purchase consistently. The cap applies to ownership, so recalling a Drone does not open an extra purchase slot. Do not show endurance upgrades as merely locked future tiers. Suggested description: “Mobile cleanup support. 20-second sorties, then return and recharge. Maximum 4.”

A2 adds mobile support alongside the first flyers after the gun-focused introductory level. At its start the player has earned 10 total tokens before spending (2 initial plus four 2-token wave rewards), so a one-token optional experiment does not require an additional saving wave. This is an affordable support choice, not a required purchase or a replacement for the stationary army.

## Why this scope and price

The base Drone has the damage of the one-token base Gun, with mobility and 72-unit range but long weapon cooldown, flight/return/recharge downtime, mechanical aim limits, scenery avoidance and time spent travelling. A full burst removes only 100 HP. With uninterrupted valid fire, first-to-first burst spacing is 2.25 seconds of round spacing plus 5 seconds of cooldown: 100 / 7.25 ≈ 13.79 HP/s while available to fire. An idealized immediate-fire 20-second sortie starts three full bursts, dealing 300 HP; 20 seconds plus 10 seconds recharge gives 10 HP/s **before** actual launch/return/aim/route overhead. Finite bursts and expiry extensions mean a smooth duty-cycle approximation is not a strict upper bound.

Two tokens would compete against a base Arc's 36 HP every 1.2 seconds (30 nominal direct HP/s before physical opportunity constraints). Three tokens would compete against a launcher's 300-HP base missile. These comparisons do not assign guaranteed damage to any family, but they show why pricing unchanged 10-HP Drone rounds at 2–3 tokens merely to fit engine capacity would be a poor gameplay response.

The existing upgrade concept increases flight duration alone. In the continuous-duty approximation, 20/30/40-second endurance with 10-second recharge yields availability of 2/3, 3/4 and 4/5: only 12.5% and 6.7% relative availability gains. Real burst alignment, travel and completing an active burst change those figures. Even indefinite endurance leaves the same roughly 13.79 HP/s continuous weapon cycle. Longer endurance cannot solve the later campaign's much larger enemy HP, and charging another whole purchase price for a modest, placement-dependent duration increase would be hard to justify. Keep the accepted upgrade models available to authoring, but omit campaign upgrades until there is a specific playtested role for them. Preserve the approved base statistics now.

## Why an explicit four-Drone fleet

This is a deliberate support-fleet rule. Four aircraft allow a small group across two fronts with potential recharge overlap, while retaining a readable mobile presence and bounding autonomous navigation work. It prevents a cheap Drone swarm from becoming the campaign's implied primary army. No automatic assignment to fronts, formation behavior or guaranteed staggering of recharge cycles is added.

The cap also respects the current renderer and controller design. Each Drone has nine real model-light clusters rather than a Gun's three. With no family limit, 128 one-token Drones would require 1,152 model lights before enemies; the existing model-light binding supports 463. Per-aircraft route-search and motion storage also grows with the number of aircraft. The four-owned rule permits a genuinely affordable unit without a renderer migration, hidden light omissions or a damage buff to justify an artificial price. At a fixed one-token budget, replacing up to four Guns with Drones adds at most 4 × (9 − 3) = 24 model lights; final capacity must still be computed against every actual wave. The lead owns transaction/save/deployment validation and the bounded capacity calculation.

## Finite native evidence

Run `bun project-docs/drone-campaign-2026-10-23/tactician-probe.js` from the repository root. [Machine-readable evidence](tactician-evidence.json) records source hashes, pads, hit times and totals. Each case uses one real base Drone, its real shared target planner, navigation, mechanical aim, LOS, hitscan damage and finite campaign enemy routes/schedules at 120 Hz. Pads pass current visible-ground, collision, departure-lane and navigation-home checks. The selection policy takes the legal pad nearest the main route entry or exit; it is not an optimal placement search. Wildlife and other weapons are absent, and no wallet or miss-limit loss is simulated.

| Authored first wave | Pad policy; box X/Z | Shots / useful HP | Kills / escapes |
| --- | --- | ---: | ---: |
| A2.1 | Exit-near; 10/14 | 16 / 160 | 0 / 7 |
| A2.1 | Entry-near; 1/6 | 3 / 30 | 0 / 7 |
| A3.1, simultaneous fronts | Exit-near; 12/13 | 0 / 0 | 0 / 10 |
| A3.1, simultaneous fronts | Entry-near; 2/12 | 10 / 100 | 0 / 10 |
| D4.1, authored full HP | Exit-near; 10/14 | 13 / 130 | 0 / 18 |
| D4.1, artificially wounded to 100 HP per spawn | Same exit-near pad | 12 / 120 | 1 / 17 |

All six finite waves resolve and report zero emergency stops. The observed legal-pad counts are 27 on A2, 37 on A3 and 47 on D4 under the probe's enemy/profile/visibility rules. These counts are placement alternatives, not simultaneous fleet capacity or proof of useful shots.

The Drone hits both ground and air on A2 and D4. The A3 comparison establishes that a legal pad does not guarantee useful combat: the exit-near witness completes a sortie without a single shot, while the other pad delivers one burst. The data support clear placement guidance and an inexpensive experiment; they do not establish reliable universal coverage.

Later HP is a real limit. D4 Spiders have 8,250 HP and Lanterns have 3,300 HP; a 100-HP burst is only about 1.2% or 3.0% of a fresh enemy. The artificial 100-HP-residual witness proves that the existing controller can finish a late-zone enemy when it has a valid opportunity; it does **not** show that an ordinary mixed army creates enough such opportunities, or that the purchase prevents an escape in normal play. No late-campaign damage scaling, all-Drone victory, whole-campaign dominance, optimality or measured performance claim is made.

## Integration and review boundary

The implementation should expose purchase, deployment, recall, selection, save/checkpoint recovery, wave cleanup and the clear fleet limit. Preserve approved base behavior and every existing enemy/wave/economy value. Run focused correctness checks for those boundaries and real productive sorties. Larger fleets need independent separation/return validation; these one-aircraft probes do not certify four-aircraft traffic. Record the unit as provisional mobile support in the design doc, replacing the old statement that campaign Drone availability/pricing remain entirely unassigned.

The remaining player-review question is usefulness and feel alongside a real army, particularly after A. If feedback finds it inconsequential, revisit that bounded role directly rather than advertising weak duration upgrades or silently boosting the accepted weapon. This delivery does not claim to have completed that later balance review.
