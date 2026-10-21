# Retained turret report — 20 October 2026

The user cannot reproduce the issue now and asks to record this setup, defer investigation until it recurs, and finish the UI/environment changes. **No targeting correction is claimed in this follow-up.** The earlier report suggested A2 wave 2 and Upgrade I; the retained game has completed that wave and is preparing wave 3, “Shared attention.” This is a location/setup record, not a captured failure.

- Level: A2, The Broadwater Garden (`moss-02`).
- Phase: Arsenal/preparation before wave 3; six campaign waves completed.
- Economy: 2 unspent tokens, 2 cumulative misses of 10.
- Conditions: day, weather off.

| Defence | Tier | Placement box [X,Y,Z] |
| --- | --- | --- |
| Gun 01 | Upgrade I | [3,0,6] |
| Gun 02 | Upgrade I | [9,0,7] |
| Gun 03, bridge exit | Upgrade I | [18,0,9] |
| Gun 04, bridge exit | Upgrade I | [18,0,7] |
| Arc Spire 05 | Base | [14,0,12] |
| Arc Spire 06 | Base | [16,0,12] |

All placements have turn 0. The user describes the bridge exit as visually left in the overview. [Complete read-only snapshot](retained-turret-setup.json) · [Screenshot](retained-turret-setup.png). The browser run was neither reset nor advanced.

The historical six-gun A2.2 replays in [a2-wave2-replays.json](a2-wave2-replays.json) used **different positions and inventory**: upgrades at [16,0,9]/[17,0,7] plus four base guns. Those tests did not reproduce a sustained idle fault, and do not clear the newly recorded setup. They remain a historical acquisition/transition regression only. Future investigation should start from this retained setup and an actual recurrence, rather than treating the historical positions as the current report.

Passive per-gun counters, current targets/reservations, cooldown and aim/LOS fields are included in the existing `#world` element’s `data-play` diagnostics. This adds no player control or extra targeting scans. At this preparation snapshot gun counters have already reset for the upcoming wave, so it cannot establish what happened during wave 2.
