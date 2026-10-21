# Engineer implementation and verification — 20 October 2026

Implemented the finite player integration for the authorised A1–A4 delivery. Campaign values and unlocks remain provisional; this record establishes runtime behaviour and bounded resource ownership, not gameplay acceptance or frame rate.

## Changes

- `play/enemies.js` resolves the configured Dog, Roller and Moth profiles, per-wave HP/speed overrides and complete authored route IDs. Future, killed and escaped actors remain outside targeting, damage smoke, wildlife threats and missile claims. Play-only Moth altitude is 44; `/game/` retains 36.
- `play/engine.js` uses the existing gun, Arc and physical missile controllers with one shared target planner. Arc contacts use a deterministic varying random stream; a constant sample could repeatedly choose the same obstructed surface. No splash, chaining, new damage type or new enemy is introduced.
- Geometry and logical instances are preallocated by family/tier and species. Same-map waves alias their new actor IDs to existing rigs; hidden pool IDs preserve renderer visibility compaction before a species first appears. Wildlife, scenery, camera state and scene geometry remain in place.
- `play/placement.js` supports all three defence families, checks their geometry, missile launch space, simultaneous deployments and connected wildlife. Ground/air clearance uses full spin/flap/bank voxel intervals with height-dependent radii. Configured placement rules consider every species occurring on that level, including later waves, and the play altitude. Existing gun-only signatures remain supported.
- `game/arc-spire-preview.js` and `game/missile-preview.js` accept optional profiles; default preview values and behaviour remain unchanged. The play missile option seats scarce rounds fairly in the existing 36-actor pool, prioritising empty launchers before topping up an incomplete waiting magazine. It never grants damage without physical contact.
- `engine/model-lights.js` accepts optional `entry.lightIndices`. Current-wave membership bounds authored emitters independently of the larger hidden species pools. `prepareWave` refreshes those CPU sources through the existing runtime sync callback, retaining instance buffers and light upload storage. Previews retain their original fallback membership.
- Arc effect callbacks translate controller-relative shot time to absolute `engine.time`, retaining surface attachment arguments. The app aligns effect clocks when a family is newly deployed and on wave changes. Preparation/settlement advances remaining flights without launching new rounds; P/visibility pause freezes the app loop.

## Focused checks

These are affected checks, not a full test suite. The final combined run is recorded separately in this directory.

| Run | Result |
| --- | --- |
| `tests/play-engine.test.js` | 9 pass, 375 assertions |
| `tests/play-mixed-combat.test.js` + `tests/model-lights.test.js` | 11 pass, 355 assertions |
| `tests/play-deployment.test.js` | 6 pass; GPU buffer identities, wildlife poses/journeys, wave reuse and exact disposal checked |
| Missile flight, Arc combat, model lights and player placement regressions | 43 pass, 6,143 assertions |

New mixed checks cover route/species lifecycle, absolute Arc timestamps and attachments, delayed physical missile damage, settlement/reset, actual animated poses inside finite swept envelopes, explicit preview exhaustion versus fair play seating, same-map first species appearances, and current-wave light membership without stale indices. The historical eight-wave witness now explicitly uses its historical profiles and verifies retained ownership on transfer into A3; it does not claim the old two-gun build beats today's production campaign.

Independent read-only review of `play/app.js` found the effects clocks, callback ordering, pause, source detachment, Arc attachments and scene cleanup consistent with the engine contract. Lead owns the production browser/GPU review and final combined test record.

## Measured retained resources

Measured from the current A4 source loaded for the finale, with all configured pools allocated. Byte totals are actual typed-buffer payload sizes or vertex/index/instance sizes; they do not include JavaScript object overhead or establish GPU execution time.

| Resource | Count / bytes |
| --- | --- |
| Defence rigs | 174: 32 per gun tier, 16 per Arc tier, 10 per missile tier |
| Defence root/part matrices | 34,560 retained bytes |
| Enemy rigs | 18: 6 per species; 126 part matrices |
| Physical missile actors | 36 fixed slots |
| Render groups / loaded model sources | 55 / 21 |
| Scene vertex/index/instance GPU payload | 2,211,528 bytes |
| Model-light capacity / upload storage | 128 / 4,112 bytes |
| Combined local-light uniform | 176 slots / 5,648 bytes |

Actual meshed emitter counts are gun base 3, Dog 4, Roller 1 and Moth 1. The configured 2-light allowances for Roller/Moth are conservative. Activating all 32 base-gun pool indices alongside the actual finale authors 116 lights; A4.1 authors 120. Both pass strict capacity 128. A separate 32-gun/eight-Dog boundary fixture exercises exactly 128 emitters and verifies the specialised shader/storage contract.

## Limits and preservation

The physical missile pool, six Arc strike slots and existing particle capacities remain bounded. Effect saturation can replace an older Arc strike or drop excess cosmetic particles without changing damage. Under unusual loadouts that exhaust projectile actors, partial waiting magazines receive physical rounds as slots become free; no unlimited projectile allocation is used.

One small resource limitation remains: a rebuilt missile controller supplies a new thrust-source object at a preparation/deployment/wave reset. `renderer.setMissileThrust` consequently releases its previous lazy 4,608-byte GPU instance buffer and recreates it on the next powered flight. This occurs at those source changes, not per frame. Scene geometry buffers remain stable. The lead explicitly chose to record this bounded preparation-time cost and freeze the verified implementation.

No asset/model/layout source, frozen backup, authored environment or `/game/` default was changed by this integration. The shared design record must describe the mixed finite player roster, three-family pools, staged availability, play-only altitude and provisional balance separately from accepted preview defaults. Lead owns those consolidated design-doc/project-brief/diary updates and user playtest review.
