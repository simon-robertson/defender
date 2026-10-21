# Arc retry ownership fix — 21 October 2026

**Subsequent work:** the user also authorised [smooth flying-enemy corners](../flying-turns-2026-10-21/README.md). The C3 source-pinned snapshots below record the Arc correction before that later motion change; their guards require those recorded inputs. The newer full campaign verifies both changes together.

Implemented the user-authorised correctness fix from [Tactician's audit](../balance-review-2026-10-21/README.md). No numerical balance tuning, deployment or active browser reload.

`ArcSpirePreview` used the current active-list index to read/write a surface rejection's retry deadline. Deaths/escapes compact that array, so another enemy could inherit the remaining delay. Each spire now uses weak enemy-object keys, keeping its existing half-second interval. Reset replaces the cache; it does not retain enemies after their controller is released. The eligibility/read and rejection/write paths no longer scan the list for an index.

## Verification

- The new real `PlayEngine` regression exercises both kill and escape removal before a rejected enemy, a later spawn, normal expiry and explicit reset. It fails on the exact pre-fix module and passes with the fix. [Before](regression-before.log), [after](regression-after.log).
- **58 affected tests pass across six files**: Arc combat, Arc chains, finite mixed combat, generator integration, shared targeting and Arc runtime. One archived missile-scene snapshot in `target-planner.test.js` fails identically with the pre-fix Arc source (expected `[2,15,8]`, observed `[0,12,5]`); its unrelated expectation remains unchanged. [Verified baseline failure](planner-baseline.log). No full suite run.
- Paired isolated **C3 wave snapshots clear 72 enemies across all four waves with zero escapes**. Arc shot counts are 738/909/932/1,075 and rejection counts 2/0/6/2 in both versions. These encounters do not demonstrate a measurable outcome change from the fix. Actual native simulation, legal recorded placements, non-Arc audited-source equality and useful-HP conservation are verified. [Fixed results](c3-fixed.json), [baseline](c3-baseline.json), [runner](replay-c3.js).

The C3 snapshots use the saved earned-token Arc portfolio independently per wave; they are not a new persistent 64-wave campaign or a human difficulty assessment. Cosmetic rendering and the live user session were not exercised.

Reproduce from the project root:

```sh
bun test tests/arc-combat.test.js tests/arc-chain.test.js tests/play-mixed-combat.test.js tests/play-enhancer-combat.test.js tests/target-planner.test.js tests/arc-spire-runtime.test.js
bun test tests/play-mixed-combat.test.js -t 'Arc surface retries'
bun test --preload ./docs/arc-retry-identity-2026-10-21/baseline-loader.js tests/play-mixed-combat.test.js -t 'Arc surface retries'
bun docs/arc-retry-identity-2026-10-21/replay-c3.js
bun --preload ./docs/arc-retry-identity-2026-10-21/baseline-loader.js docs/arc-retry-identity-2026-10-21/replay-c3.js --baseline
```

The baseline regression is expected to fail. The baseline loader reverses only this Arc patch in memory and asserts its complete SHA-256 matches the original audit, without changing production files. The first command retains the documented unrelated snapshot failure. Existing browser sessions use the correction on their next ordinary load.
