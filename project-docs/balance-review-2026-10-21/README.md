# Campaign balance re-evaluation — 21 October 2026

**Subsequent update:** the user authorised the Arc retry identity correction, now [implemented and checked](../arc-retry-identity-2026-10-21/README.md). This audit and its source hashes describe the pre-fix state; no numerical balance change was made.

Tactician's read-only assessment of the current Arc chains, Power Generator and faster missiles. No production code, assets, prices, damage, income or live browser session changed.

**Recommendation:** retain current provisional tuning for review. Fix the Arc retry ownership defect before numerical balancing, then reassess the C3 pressure point and later-zone pacing. The witnesses do not justify a blanket enemy-health increase.

- [Tactician's detailed findings, comparisons and reproduction commands](TACTICIAN.md)
- [Independent mechanics and evidence audit](mechanics.md)

| Current policy | Outcome |
| --- | --- |
| Mixed, Arc-focused, missile-focused, purposeful generator cluster | Each clears 64 waves with no escapes |
| Gun-focused | Defeat at C1.2 |
| Mixed purchases stopped after B | Defeat at C3.4 |
| Frozen Arc army, secondary damage disabled | Completes with eight escapes at C3 |
| Frozen generator army, bonus disabled | Completes with two escapes, versus zero with bonus |

The generator remains a useful cluster investment at its provisional four-token price. Later-map policies generally boost two or three recipients. Equal-earned-budget stopped-investment generator/control policies fail at C4.4/C3.4, spending 64/63 respectively; the extra spent token and differing armies prevent a strict dominance claim. [Generator evidence](adaptive-gen.json), [bonus-disabled comparison](adaptive-gen-no-bonus.json), [capped generator](adaptive-gen-capped-b.json), [capped control](adaptive-control-capped-b.json).

Arc chains supply roughly 10–23% additional useful HP relative to primary Arc damage across zones in the Arc-focused witness, with the strongest contribution in dense later traffic. [Current witness](arc-heavy.json), [secondary-damage ablation](arc-heavy-no-chain.json). Faster missiles deliver fewer contacts per launch in the paired mixed witness; changed target deaths, committed flights and shared capacity mean speed is not a uniform DPS multiplier. [Current mixed](mixed.json), [previous flight speed only](mixed-old-missiles.json).

Engineer reproduced a retry timestamp transferring between enemies when the active-target array compacts. This can misassign up to the remaining 0.5-second exclusion; campaign impact is unmeasured. The defect remains in all current replays and is a proposed correctness fix, not a delivered change.

The lead independently repeated the current stopped-after-B policy: 43 waves completed, defeat at C3.4, 63 tokens spent, 25 held, and all owned weapons deployed in the pressure waves. [Result](stop-after-b.json), [isolated runner](stop-after-b.mjs).

Actual native combat, finite schedules, legal placements, retained wallet, 120 Hz simulation, damage reconciliation and scoped source hashes underpin the evidence. Fixed policies and seeds establish bounded viability and pressure, not exhaustive optimal play or human difficulty acceptance. Initial `cluster-gen`/`cluster-control` files are failed court diagnostics; use the `adaptive-*` files for generator combat conclusions. No full test suite or browser/GPU review was run for this audit.
