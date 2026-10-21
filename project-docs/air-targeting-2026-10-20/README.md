# A2 upgraded guns and flyers — 20 October 2026

The user reports upgraded turrets ignoring flying enemies and requests a 2D ground radius if admission uses a sphere. Range already uses inclusive squared horizontal XZ distance in `DefenceAim.solve()`. Altitude does not consume range. Upgrade I player range remains 66 units.

## Cause and correction

Read the current `/play/` placement diagnostics without changing the user's run. Replayed A2.1 with the six reported guns: upgrades at `[16,0,9]` / `[17,0,7]` and bases at `[3,0,5]`, `[5,0,5]`, `[8,0,10]`, `[8,0,8]`.

The planner could reserve an idle downstream gun for a future Dog. While that Dog was not currently hittable, the reservation forced the gun to select no target, even if an uncovered Moth was in range, aimable and unobstructed. Gun 02 had 126 such sampled opportunities and remained idle on the Dog reservation throughout. Gun 01 was also delayed by future reservations.

`TargetPlanner.choose()` now releases an unavailable reservation when an uncovered eligible target can be attacked immediately. Releasing the promise also removes its forecast credit, so upstream guns cannot continue counting damage from that busy weapon. Current hittable assignments retain priority; a gun may still wait when all available alternatives are already covered. Target ranking, valid burst/acquisition rules, weapon values and scene geometry remain unchanged. This applies to live targets generally, without an air-specific preference or extra roster scan.

The independent 35-degree elevation limit still rejects steep shots at nearby Moths. This is a mechanical aiming limit, separate from horizontal range; it was not changed by this correction.

## Actual deployment replay

| Result | Before | After |
| --- | ---: | ---: |
| Enemies destroyed | 4 | 7 |
| Moths escaped | 3 | 0 |
| Gun 01 Moth pulses | 8 | 18 |
| Gun 02 Moth pulses | 0 | 12 |

[Before](before.json) · [After](after.json). Replay with `bun scripts/play-air-targeting-audit.js`. This uses production assets, wave schedule, combat and physics at 120 Hz; diagnostics only classify eligibility and attention. It is not a claim that every placement or strategy clears Zone A.

## Verification

- 60 focused targeting/combat tests pass, 20,791 assertions. New regressions verify opportunity-taking revokes future damage credit, while covered alternatives and current hittable assignments retain reservation behaviour. [Log](targeting-tests.log).
- 33 further lead-aiming, Arc, drone and missile integration checks pass, 404,762 assertions. [Log](family-tests.log).
- The investing mixed strategy still clears all 16 waves: 168 kills, zero misses, 31 tokens spent. [Updated witness](mixed.json).
- The old six-token two-gun policy still loses: it now completes eight waves and fails during A3.1 at ten cumulative misses. Earlier A2.4 failure was measured before this fix. [Updated witness](old-two-guns.json).
- Player browser bundle builds; all 85 asset hashes match the preceding delivery. [Preservation](preservation.json). No campaign profiles, range values, models, layouts or frozen backup were edited. No full test suite was run.

The user's current game was not reloaded or reset. Existing loaded modules retain the previous behaviour until a new page load.
