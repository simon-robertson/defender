# Native flight clearance audit — 21 October 2026

The current curved and banked flight passes this bounded native review at the campaign's unchanged **44-unit root altitude**. No production, asset, test or browser files were changed by this specialist audit. The lead implemented the movement and owns the separate unit/integration/browser verification.

- [Pinned numerical evidence and all per-route/per-wave rows](clearance.json)
- [Reproduction script](clearance-audit.js)
- [Native run log](clearance.log)

Run from the project root with `bun docs/flying-turns-2026-10-21/clearance-audit.js --pin`. The final run took about 14 seconds on this host; that is audit duration, not a game performance measurement. Its 109 scoped input hashes were checked against the bytes loaded or observed before execution and rechecked before delivery; all remained identical.

## Scenery and terrain

All four flyer models were exercised on **all 20 current production routes**, across all sixteen levels: 80 model/route cases, **80,252 poses** and **220,693 articulated part checks**. Nineteen cases are species/routes actually used by the campaign; the other 61 are additional cross-zone stress cases, including aircraft on A1 where no air enemy is currently scheduled.

There were **zero static scenery, terrain, bridge or world-bound contacts**. In fact, no conservative transformed part box overlapped a static BVH leaf, so the current play-altitude cases did not require the script's occupied-voxel SAT refinement. The minimum sampled horizontal world-bound margin was two units.

The audit uses the actual finite `EnemyPreview` pose, current smooth flight sampler, banked body and articulated wings/rotors. It samples every authored distance unit, including route endpoints, with the natural time-dependent mechanism phase. At corner centres and tangent joins it additionally checks three phase offsets, making four sampled phases there. Broad-phase part boxes conservatively enclose the complete local occupied part; any candidate would be refined using actual transformed occupied-voxel OBBs against the static tree's exact disjoint occupied cuboids. Terrain and bridges belong to the same tree.

This result concerns the current production routes and campaign altitude. The lead separately reports passing archived 36-altitude occupied-voxel checks; that older-preview result is not inferred from this audit.

## Finite traffic and merges

All **64 authored finite schedules** were evaluated without weapons at 120 Hz, using each wave's actual release times, routes and species speeds. Ground actors use unchanged `PathMotion`; air actors use the current `FlightPathMotion`. Every active pair with overlapping conservative vertical envelopes was checked using complete-animation horizontal envelopes.

The run made **32,627,973 pair checks**, including **8,383,065 involving an airborne actor**. No air-related conservative envelope overlap was found. The smallest sampled air-related clearance was **3.318384 units**, between Moths from the two A3.3 approaches at t=28 seconds: root separation 29.694242 units. This includes the finite merged schedules rather than testing each branch in isolation.

There are **37 conservative circle-overlap candidate pairs**, all Dune Tread versus Dune Tread at B1/B2 ground corners. Those actors retain their previous motion, and the new flight behavior is absent from each pair. Circle overlap is a broad-phase candidate, not an occupied-geometry collision; this audit does not claim all ground traffic is newly proven collision-free. No airborne pair requires that qualification.

The script preserves the authored progression/exit clock when sampling: active intervals end at `spawn.at + path.length / speed`. It does not run health, weapon selection, rewards or a full campaign replay.

## Retained defence placements

The five previously successful frozen policies are mixed, Arc-focused, missile-focused, adaptive generator and adaptive control. Every recorded simultaneous deployment across their 64 waves was rechecked using current production placement rules: **320 arrangements and 3,846 unit checks, zero failures**.

This checks the current support, overview visibility, scenery, route envelope and simultaneous defence movement rules. It deliberately disables cosmetic critter handling and does not rerun connected habitat relocation. Legal placement is not evidence that these exact old policies retain their previous combat outcome after flight changes.

An initial exploratory pass found 298 repeated placement rejections, representing 41 unique Upgrade II Arc courts in A3/A4/B1–B4. These came from the first blanket 1.875-unit radius inflation. A representative A3 court at `[11,0,10]` had a Moth layer radius grow from 13.187929 to 15.062929 units against a fourteen-unit gap, although the unchanged original bank envelope had fit. The lead replaced blanket padding with route-specific bounded flight slabs while retaining the original bank/height envelope. The final audit confirms **all 41 formerly rejected courts are legal again**. The final pinned evidence describes that tighter implementation, not the first padding experiment.

## Limits

Geometry and traffic are finite samples, not continuous occupied-volume collision proofs. Wing/rotor sampling does not enumerate every possible independent mechanism phase. Unarmed traffic excludes missile-induced displacement and subsequent collision/targeting feedback. The audit does not cover arbitrary player-created routes, every possible legal defence deployment, GPU rendering, human readability, difficulty or campaign victory. Source identities are pinned for reproducibility; no active player session was reloaded.
