# A–D campaign completion · 20 October 2026

The player game now contains all16 levels and64 waves, with1,084 enemies across the existing four zone rosters. The user requested completing B, C and D to the same playable, balance-tested standard as A. New C/D layouts and the numerical difficulty are implemented for human review; automated successful strategies do not establish final difficulty acceptance.

## Scope and behaviour

- A’s16 waves, weapon costs/unlocks/profiles and accepted A/B layouts remain unchanged. B adds16 waves on its existing routes. C/D each add16 waves and four carved layouts on their original landscapes.
- Existing enemies only: A Dog/Roller/Moth; B Walker/Dune Tread/Twin Fan; C Tripod/Ray; D Spider/Lantern. Counts by zone are168/284/288/344. All retain ordinary movement; schedules coordinate same-band speeds and branch arrival times without restoring running or adding traffic mechanics.
- Economy remains2 starting tokens, +2 after each successful wave,10 cumulative misses. Inventory, upgrades and wallet carry between zones; each new landscape permits free redeployment. Four waves advance to the next level; D4.4 completes the campaign. Fresh retry clears the run.
- Daytime and clear weather remain the player defaults throughout. Original environment authorship and `/game/` controls remain intact. The HUD, portraits, air-height briefings and completion text now support every zone, retaining the accepted panel design and cameras.

## Balance evidence

[The authoritative native replay](balance.json) records purchases, costs, placements, real hits, physical missile results, misses and wallet transitions for each attempted wave. [Tactician’s report](TACTICIAN.md) explains the progression and strategy comparisons. Replay code uses the production session, placement and combat controllers; it never grants free units or rewards a failed wave. Wildlife occupancy is handled by legitimate preparation waits and normal redeployment.

The final six policies cover271 attempted waves:

| Policy | Completed waves | Kills | Misses | Tokens spent | Final wallet | Outcome |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Mixed arsenal | 64 | 1084 | 0 | 126 | 4 | Complete |
| Arc-heavy after gun opening | 64 | 1084 | 0 | 128 | 2 | Complete |
| Recovery after three opening escapes | 64 | 1081 | 3 | 126 | 4 | Complete |
| Stop investing after A | 32 | 456 | 10 | 31 | 35 | Defeat C1.1 |
| Stop investing after B | 42 | 632 | 10 | 63 | 23 | Defeat C3.3 |
| Unarmed | 2 | 0 | 10 | 0 | 6 | Defeat A1.3 |

The separate [B-investment witness](b-only-investment.json) supplements the five-policy authoritative replay. Holding only the A investment fails in C; holding only the B investment fails in C3. An earlier candidate allowed the B investment to clear everything, so C/D HP was increased by50% and the policies rerun. A/B values, schedules, speeds, weapon rules and token economy did not change in that revision. This demonstrates an investment requirement for these witnesses, not optimal strategy or a guarantee that every placement works.

[Traffic checks](traffic.json) evaluate all64 authored schedules at120Hz against conservative same-band envelopes. [Independent exact unopposed checks](spacing-unopposed.json) sample all16 finale waves using occupied voxel geometry; these finite observations supplement the production placement guards. The additional [actual mixed-combat finale sample](spacing-mixed.json) is also clear. Combined exact checks cover12,927 sample instants and119,712 actor poses; the120Hz traffic survey covers32,316,324 same-band pairs. These are finite checks with the limits stated in the Tactician record.

## Layouts and preservation

[C authoring and evidence](zone-c.md) and [D authoring and evidence](zone-d-README.md) contain two compared alternatives per landscape, selected routes, scenery-removal reasons, coverage intervals, physical restrictions, bridges, actual wildlife journeys and source hashes. C3 has two approaches; C2/C3 and D4 use the existing one-unit wooden deck. Original terrain, water, environment, footprint and bird perches remain intact. Retained scenery objects are unchanged.

C and D each provide168 surveyed visible full plots. All have legal weapon choices, but not every family or tier fits every plot. Tall Walker/Tripod clearance deliberately excludes many close-path gun sites; B1 has one legal upgraded-gun court, and C provides27 native gun positions across its four levels. C’s more distant courts generally require upgrades, already available by that stage. Arc/missile alternatives are documented. Neither adjacent plots nor independently clear firing intervals imply simultaneous placement or guaranteed damage.

Across C/D,16,770 sampled route poses show no observed scenery collision; all48 wildlife actors complete real180-second journeys. Of162 finite missile trials,146 hit and16 contact retained scenery as ordinary physical misses. No flight remains unfinished or leaves stale damage claims. Full reports bind to the final source hashes.

[Preservation](preservation.json) verifies all67 model files and all eight A/B level sources unchanged; only the eight authorised C/D level assets changed. Both [current preview reconstruction](rebuild-check.log) and [frozen landscape checks](frozen-check.log) pass. The immutable69-file snapshot is separately rehashed by the D verifier.

## Runtime and presentation verification

The player now supplies Walker/Spider’s actual gait contracts and expands physical deployment checks to all existing species. Scene pools retain only the current zone’s enemy geometry; defence capacity follows the affordable inventory through the end of that zone. Maximum base-gun counts are32/64/96/128. The full campaign’s conservative light demand is424 model clusters plus48 transient lights. The supported ceiling511 total lights occupies16,368 uniform bytes, below the portable16KiB limit; preview defaults remain77 total.

The existing36-missile player pool fairly defers waiting silos. Under saturation it can admit partial magazines, preserving the earlier Zone A player behaviour. This differs from the shared preview’s complete-magazine contract and can constrain very large silo arsenals; no projectile pool or firing policy changed here. A maximum42base-silo test verifies deferral, freed-slot priority, no phantom shots and reset.

**96 distinct affected tests pass (6,914 assertions)** across configuration, full session progression, conditions, placement, finite combat, resource ownership, preview selection and C/D authoring. Preview reconstruction also passes. Logs are saved here; no full repository test suite was run. The [independent integration review](INTEGRATION-REVIEW.md) found no actionable current bug. A browser bundle builds successfully.

[Actual GPU checks](gpu-bloom.json) pass25/25, including the511th light in both ordinary and bloom water display, with no validation errors. [GUI composition checks](gui-checks.json) retain borderless panels, zero seams, loaded portraits and no horizontal overflow in representative B/C/D screens and laptop/desktop sizes. Completion shows64 waves/16 landscapes. [C1](c1-overview.png), [C2](c2-overview.png), [C3](c3-overview.png), [C4](c4-overview.png) and the D overview images show the new layouts in the actual renderer.

`/tools/campaign-review.html` loads recorded mixed-strategy deployments into the actual renderer and combat engine for isolated GPU inspection. It is separate from normal campaign progress. [Actual B3/C3/D4 combat captures](gpu-combat.json) show native kills, missiles and Arc effects with no errors or light overflow. Every scene replacement satisfies created minus destroyed buffers equals current scene buffers. C3 Drone and D4 Cam man both run; C3 pause freezes simulation and aerial position. The playable `/play/` tab is left at fresh A1 preparation. GPU resource counts and camera observations are finite-scene diagnostics, not a hardware performance guarantee.

## Reproduction

```sh
bun scripts/campaign-balance-audit.js --scenario=all --output=docs/campaign-completion-2026-10-20/balance.json
bun scripts/campaign-balance-audit.js --scenario=b-only-investment --output=docs/campaign-completion-2026-10-20/b-only-investment.json
bun scripts/campaign-spacing-audit.js --output=docs/campaign-completion-2026-10-20/spacing-unopposed.json
bun scripts/campaign-spacing-audit.js --mixed-only --mixed=docs/campaign-completion-2026-10-20/balance.json --output=docs/campaign-completion-2026-10-20/spacing-mixed.json
bun scripts/campaign-balance-audit.js --scenario=traffic --output=docs/campaign-completion-2026-10-20/traffic.json
bun scripts/current-preview-levels.js --check
bun scripts/fixed-landscapes/build.js --check --snapshots-only
bun test tests/play-config.test.js tests/play-session.test.js tests/play-conditions.test.js tests/play-placement.test.js tests/play-engine.test.js tests/play-mixed-combat.test.js tests/play-campaign-integration.test.js tests/model-lights.test.js tests/preview-levels.test.js tests/c-path-carving.test.js tests/d-path-carving.test.js
```

Generator/drone purchases, repairs, save/resume, new enemy types and final human balance acceptance remain separate scope. The running rollback remains intact.
