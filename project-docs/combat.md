# Provisional enemy combat preview

**TODO 20/23 follow-up, 20 October (implemented):** removed health-based stagger/catch-up; ordinary configured enemy movement is restored, with existing physical-hit reactions retained. Upgrade I Arc chain range is96units/four tiles; enemy/missile critter-gib radii are48/72units/two/three tiles. Inclusive3D tests,20%chain strength, visibility and wave-end remains fading stay intact. Missile fright radius remains48units. [Current delivery](water-regression-2026-10-20/README.md).

**Earlier TODO14–19 delivery, 20 October (historical; movement/radii superseded by TODO 20/23):** completed items 14–19: sampled asynchronous GPU frame timing beside an audited whole-callback CPU app timer; 35% stronger direct sunlight on A2/B2/C2/D2; smooth half-health route staggering and bounded catch-up; one Upgrade I Arc chain at 20% strength within two tiles; and persistent blast-driven critter gibs/spray with safe respawn and run-end fading. Stage 2 means the middle Upgrade I tier, consistent with existing project terminology. Enemy run means the current wave. Actual combat/visual tuning remains provisional for user playtesting. GI and AO remain removed. [Implementation and checks](latest-todo-2026-10-20/README.md).

**Stage-2 Arc chaining TODO, 20 October (queued):** a successful hit should chain once to one random nearby enemy at 20% of the Arc's strength. The user corrects the wording to “chain to a random nearby enemy at 20%”; nearby is at most two tiles (48 current world units) from the hit enemy. Keep the requested stage label until its Base/Upgrade I/Upgrade II mapping is confirmed; chain visibility/target eligibility and planner accounting remain to specify. No runtime ability or active-playthrough change. [Current TODO](../TODO.md).

**Zone A player integration, 20 October:** `/play/` now uses the existing gun, Arc and physical missile controllers against finite Dog/Roller/Moth waves across A1–A4. Optional player profiles preserve shared preview defaults. One shared planner accounts for actual incoming missile damage; finite lifecycle excludes scheduled, escaped and dead actors. Existing single-target delivery, LOS/aim/contact and weapon timing policies remain active. [Implementation, balance and verification](zone-a-completion-2026-10-20/README.md).


**First playable verification, 19 October:**100 affected checks pass (30,644 assertions), including real eight-wave success and ten-miss failure. [Evidence and limits](play-first-2026-10-19/README.md). Final balance and user gameplay acceptance remain pending.

## Separate first player loop (19 October)

**Implemented adapter; verification complete for the bounded slice.** `/play/` uses the signed [A1/A2 first-delivery plan](plans/first-playable-game-2026-10-19.md): four waves per level, gun base/upgrade1 and Dogs. [`play/config.js`](../play/config.js) isolates provisional **80-HP, 12-unit/second Dogs** from the accepted 300-HP preview configuration. Gun attacks currently reuse base range/strength **48/10**, upgrade1 **72/12**, one base shot or three upgrade1 shots at 0.12-second gaps, then a one-second cooldown. Existing pitch/yaw/range/both-muzzle scenery checks, recoil, single damage per paired-barrel event and damage/death effects remain active. No random misses, new weapon family or source-model change is added. The older sections below describe preview milestones, not these player-wave values.

[`PlaySession`](../play/session.js) owns a new run's 2 tokens, purchased unit identities/tiers, placements, wave/level indices and cumulative misses. Gun purchase and base→upgrade1 each cost one token. Purchase/upgrade transactions are loadout-only; free placement/removal is deployment-only, and both are preparation phases. Owned tiers/unspent tokens persist between waves/levels; same-map positions remain, while a new landscape returns units to inventory. Unplaced units do not attack. Resolve each configured enemy ID once: escape adds one miss; **10 run-wide misses cause immediate game over**. Resolve every scheduled enemy below that threshold to grant **+2 tokens once**, including the final successful wave. Failure grants no success reward. Retry/New Game resets to A1, 2 tokens, zero misses and no units. These are adjustable first-delivery settings, not final balance or the whole campaign.

[`PlayEnemies`](../play/enemies.js) wraps `EnemyPreview` with explicit `scheduled → active → killed/escaped` lifecycle, using its opt-in `{finite, stats, movement}` constructor options. The wave's actors have preallocated rigs, but future/escaped actors' positive HP does not make them attackable: lifecycle-aware `health.alive` and a reused `activeTargets` view gate damage, targeting, smoke and wildlife threats. Spawn/reset/exit visibility is explicit; an escape is terminal and does not loop. Ordinary preview construction retains looping/default stats. `TurretPreview` accepts opt-in `{stats, firing}` values; `PlayEngine` injects resolved player config and uses active targets for both acquisition and its planner.

[`PlayEngine`](../play/engine.js) consumes the shared rAF delta using 120-Hz combat ticks, with at most 240 ticks per callback and carried backlog. Tick segments stop at actual scheduled spawn and exit times, advance poses, then fire before resolving exits; a killing hit at the exit instant resolves as a kill once. Completion requires every scheduled actor killed/escaped; reaching the miss limit stops the engine before it can grant a wave-clear reward. Each wave starts with freshly ready gun cycles, regardless of preparation edits. During preparation combat/spawns stop; **P pauses/resumes an active wave and displays a pause screen**, stopping the shared loop and resetting its delta baseline on resume. No paused/hidden time is replayed.

Deployment commits must pass [`createPlacementRules`](../play/placement.js) for actual scenery/terrain, continuous enemy-route and moving-gun envelopes, pairwise units, overview visibility and connected wildlife habitat. Per-arrangement reseeding is runtime-only. The adapter's current 72 model / 120 combined light capacity covers its conservative full-run inventory/allocated-wave bound; `/game/` retains 29/77. See [engine ownership and capacity notes](engine.md#first-player-adapter-at-play-19-october). Full eight-wave/browser/preservation verification is in progress; these implementation notes do not declare it complete.

Approved on 17 October 2026: dogs have health, turrets damage and destroy them, and the test values let them survive several shots. The subsequent approval doubles dog health and adds smoke below half health plus clean, violent death explosions; see [damage effects](damage-effects.md). Existing muzzle flashes, sparks, recoil, lighting and targeting remain unchanged.

## Unmodified values and behaviour

| Item | Provisional value |
| --- | ---: |
| Dog maximum health | 300 HP |
| Base turret strength | 10 HP per pulse |
| Upgrade 1 / stage 2 strength | 12 HP per pulse; 36 for a complete burst |
| Upgrade 2 / stage 3 | Inactive; strength 0 and no firing rule |

Tactician selected the attack strengths; the user subsequently doubled health from 150 to 300. Without an enhancer, a dog takes 30 base hits or 25 upgrade-1 hits to destroy from full health. One paired-barrel muzzle event deals one hit, not two. Range remains 48/72/96 units; cadence and existing cooldown rules are unchanged. Every emitted live hitscan pulse hits the currently validated target: no random miss rule is added.

A/B retain their three original 300-HP actors and add two new ground units plus two flyers. C has two Tripods and two Rays. D retains three Spiders and two Lanterns after the user removed the additional ground-enemy trial. New HP/speed defaults and runtime roster details are in [enemy expansion notes](enemy-expansion.md). They remain removed after death until the manual **R** reset, a refresh, or leaving/returning to the zone. A surviving enemy’s health persists through its route loop. Damage smoke, a brief lit death blast and colliding cube fragments are now implemented. No automatic respawn, waves, rewards, health bars or audio are introduced. The later Arc Spire approval adds its own per-hit welding sparks.

## Completed base-generator enhancement (18 October)

A base power generator gives +25% strength to one or more attacking defences in its four edge-sharing X/Z placement boxes at the same dry path height. Diagonal and two-box neighbours are outside coverage. It is active only when at least one eligible recipient exists. The strongest applicable bonus is applied once: `effectiveStrength = baseStrength * (1 + strengthIncrease)`. Fractions are retained, inactive zero-strength weapons stay inactive, and generators do not enhance one another. Shared weapon and enhancer records remain immutable. Only base activation is assigned; upgraded-generator activation ranges and costs remain unset despite their approved .5/.75 stored strength data.

Gun and Arc hitscan pulses use effective strength. Gun capacity forecasts use the same value; Arc and missile speculative capacity stays zero. A missile captures effective strength at launch, uses that captured value at physical contact and contributes it once to the shared in-flight ledger. Existing claims are not multiplied a second time. Weapon ranges, cadence, cooldowns, magazines and reload durations are unchanged.

`EnhancerPreview` caches supported adjacency at scene construction before the shared planner is created. Reset derives strength from the original value again, without compounding, and changed effective strength invalidates reservations. Scene edits require reload. There is no per-frame neighbour search or additional thinker; disposal restores borrowed weapon strengths and releases the cached bindings.

At the initial +20% milestone, **37 affected tests / 1,567 assertions** passed: six enhancer checks / 139 assertions, three integration checks / 193, and 28 missile/planner checks / 1,235. Mixed production-model combat verifies actual 14.4 gun, 36 Arc and 72 missile hits, effective gun forecasts and exact flight accounting. Live A1 verifies the first turret at 10→12 strength and a 12-damage hit, with middle/late strengths unchanged at 12/10. R does not compound the bonus. A2 has no generator, previous CPU/GPU scene counters clear, and returning to A1 restores the active modifier without browser errors. [Browser evidence](power-generator-combat-browser-review.json), [active A1 capture](screenshots/power-generator-a1-active.jpg).

The subsequent [green plasma link](concepts/power-generator-plasma-link-v1.md) is implemented and verified. It visualises active connections; it does not apply damage or determine the bonus, and its visual capacity cannot disable enhancement. The combat evidence above predates the effect; separate [plasma browser verification](plasma-browser-review.json) confirms T/R/rain, clean A1→A2→A1 switching, preserved Arc attacks and an A1 12-damage hit.

## Arc Spire hitscan combat (18 October)

Arc Spires share the existing health/death flow in all four second-level studies, including the mixed ground/air rosters. Each validated pulse applies damage once, synchronously. All three variants are stronger than their gun-turret counterparts using provisional tuning, shown here before any enhancer bonus:

| Variant | Range | Damage per pulse | Pulses per burst | Gap | Cooldown after last actual pulse |
| --- | ---: | ---: | ---: | ---: | ---: |
| Base | 48 | 30 | 1 | — | 1.4 s |
| Upgrade 1 | 72 | 40 | 2 | 0.20 s | 1.4 s |
| Upgrade 2 | 96 | 55 | 3 | 0.20 s | 1.6 s |

`DefencePreview` coordinates one shared planner across guns and spires. One defence ranks candidates each frame; every defence validates its shot each frame. Range is inclusive horizontal mast-centre to enemy-centre distance. The fixed crown uses its nearest existing terminal; it does not rotate. Centre LOS is conservative acquisition eligibility. When a pulse is actually due, `ArcImpactSampler` samples the current rendered side faces of the articulated enemy, weighted by visible projected area. The selected face must point toward the spire, the straight contact ray must clear the enemy's other parts, and the exact contact must clear static scenery and terrain. At most 16 attempts are made. A failed contact deals no damage and excludes that target for 0.5 seconds so another eligible enemy can be selected; R clears those bounded roster-indexed retry timestamps.

The sample stores a local surface point and current part matrix, so the short visual arc follows the moving contact without issuing more damage. A lethal hit freezes the final pose and cancels the remaining burst. Losing range, LOS or a valid target also cancels a burst. A long frame never replays missed historical hits. Arc coverage contributes no speculative downstream damage promises because future path samples cannot certify articulated surface visibility; existing turret coverage forecasts are retained. Upgrade I now adds the explicitly authorised single-hop20% chain described below; there is no stun or enemy area damage.

The [Arc effects notes](arc-effects.md) describe the procedural channel, whole-channel lighting, welding sparks and fixed pools. Model geometry, family token prices and accepted level layouts remain unchanged. Final campaign balance is still open.

## Manual preview reset

Press **R** (without Ctrl/Alt/Meta and outside text inputs) to restore the current roster to full health, zero hits, initial route distance/lap and exact initial articulated pose. `EnemyPreview.reset()` reuses its states, health objects, rigs, gait caches and matrices. Renderer visibility restoration uses the existing compacted instance slots. `DefencePreview.resetTargets()` reapplies enhancer bonuses from original strengths, resets the shared planner and all weapon controllers, and clears locks/reservations. Unfinished gun/Arc bursts are cancelled while turret pose, clocks and remaining cooldown are preserved; cached range/LOS coverage is reused. Missiles clear their flights and captured damage claims and restore full magazines. `DamageEffects.reset(true)` clears smoke, fragments, blasts, lights and waves but retains scene emitters/palettes/collision data. `ArcEffects.reset(true)` similarly clears all strikes, sparks and attachment references while retaining its clock and current collision field. Normal unload uses full resets, releasing scene references.

The camera, lighting, weather, wildlife and loaded assets stay in place. Held/repeated R, Ctrl/Alt/Meta shortcuts, text entry and input during a zone load are ignored. No automatic respawn or new wave rules are introduced.

The affected four-zone reset check verifies exact starting matrices, revived health, cleared effects/commitments, continued simulation and object/buffer reuse. The 34 affected combat, planner and damage-effect regressions also pass; no full suite was run. Built-in Chrome confirmed R restores all three dead dogs to 300 HP, clears damage effects, preserves camera/wildlife/scene loads/buffer counts and resumes combat. [Browser evidence](enemy-reset-browser.json).

## Ownership and frame order

- `shared/enemy.js` supplies dog health separately from model JSON. `shared/defence.js` keeps strength in the common defence contract, separate from firing cadence and geometry.
- `engine/health.js` owns one small reusable health state per actor: maximum, current health and received-hit count. It validates finite positive maximum health and non-negative damage, clamps overkill at zero and ignores later hits on a dead actor.
- `DogPreview` owns these states alongside its existing rigs/gaits. Dogs move first. Turrets then select only living, in-range, visible targets and recheck yaw and both muzzle-to-torso lines before every pulse.
- `TurretPreview` resolves a live hitscan pulse synchronously through the hit callback. A later turret in the same frame immediately sees the updated health. Projectile delivery does not use this instant-damage callback. Visual shot events still wait for the final head pose, keeping recoil/muzzle transforms consistent.
- On a lethal pulse, dog velocity is zeroed, animation stops and the death callback emits the pooled explosion and removes all 13 parts from rendering. The firing turret releases its target and cancels any remaining burst while retaining cooldown from the last actual shot. New targets do not inherit unused burst rounds.
- Renderer and combat objects keep stable logical slots until scene unload. No per-shot event objects or per-death arrays/buffers are allocated. The three health states and compacted draw storage are bounded by the loaded actor count. Controllers release callbacks/targets before the renderer/world unload.

## Rendering removal

`WorldRenderer.setActorVisible(actorId, visible)` compacts only actor-containing draw groups. It keeps canonical transforms indexed by the existing rig indices, plus a packed visible matrix array and two slot maps. Hiding an actor swaps the last visible instance into each removed slot; surviving rig updates map to their correct new slot. Empty groups submit no draw.

Depth, shadow and opaque passes are invalidated together, so old body pixels, shadows and SSR source pixels are removed. Camera and static water-visibility data stay cached. Hidden actors receive no animation updates; the renderer also suppresses uploads/invalidation if a hidden logical pose is updated externally. Restore is supported at renderer level, using the latest canonical pose, but the preview does not implement automatic revival.

Zone A adds **2,808 bytes of CPU visibility storage**: 2,496 packed matrix bytes and 312 mapping bytes. Actor visibility itself adds no GPU buffers, shaders or render pipelines; the subsequent damage effects have their own lazy resources. Hiding one dog needs at most thirteen 64-byte replacement writes through the existing batched flush, and none if all removed slots are already last. GPU geometry remains shared and allocated until zone unload. Do not interpret operation counts as measured FPS gains.

## Initial health-preview verification (before damage effects)

**165 Bun tests pass**, including seven new combat tests and two new actor-visibility cases. Coverage includes overkill/dead-hit idempotence, one hit per pulse, burst timing, blocked/out-of-range/unaligned shots, same-frame target death, replacement cooldown, stalls, health across path loops, stopped dead animation, fresh scene resets, pending/swapped pose uploads, all-part removal, restoration, weather replacement and resource cleanup. Engineer independently reviewed the combined lifecycle and found no concrete bugs.

The built-in browser was checked in the existing preview tab. Its live run recorded 13/13/14 hits and 40 total pulses before all dogs were gone, with zero remaining targets and no negative health. After recoil/effects settled, dog updates and matrix uploads were zero and only the display pass drew. The scene kept 87 GPU buffers / 961,992 geometry bytes throughout deaths. A → B → A released the old scene and restarted the three actors; no console or WebGPU warnings/errors were observed. Weather stayed authored off.

[Browser diagnostics](combat-check.json) and [preview capture](screenshots/moss-dog-health.png). Latest standing instruction: only open a preview tab if none is open; otherwise refresh/reuse it and leave it open.

Physical muzzle pitch remains a separate model task. The current guns yaw horizontally while damage/LOS uses their validated torso target, as in the preceding aiming preview. Damage visuals now consume the health/death transition without coupling damage to particles or changing the one-hit-per-pulse rule. Current verification is recorded in [damage effects](damage-effects.md).

## Strength retune (18 October)

The user increased power-generator strength bonuses to **25% / 50% / 75%** for base/upgrade1/upgrade2, replacing 20% / 30% / 40%. Updated shared immutable data, combat expectations and the plasma review label. Fire-rate/cooldown scalars remain zero; base adjacency and strongest-only application are unchanged. Upgraded-generator activation ranges/rules and costs remain unassigned.

All **12 targeted enhancer/unit/integration checks pass (419 assertions)**, covering real gun/Arc/missile damage, forecasts, flight claims and reset/disposal. Enhanced strengths are 15 for the upgrade-1 gun, 37.5 for the base Arc and 75 for the base missile. Browser review displays all three new percentages; live A1 confirms the first base turret at 12.5 strength and an actual 12.5-damage hit, with middle/late turrets unchanged at 12/10, one plasma link and no browser errors or warnings. A1 remains open at normal speed. [Browser evidence](power-generator-strength-browser-review.json).


## Ordinary movement and Upgrade I chaining (20 October)

TODO20 restores ordinary configured route movement at every health level. The wounded slowdown/catch-up module and its traffic/forecast hooks are removed. Existing nonlethal missile-hit body reactions remain; escape running/gallop stays removed.

Upgrade I Arc (stage2) chains once from the successful primary surface impact to one uniformly random current living exposed target within inclusive96-unit (four-tile) 3D torso-centre distance. Damage is20% current enhanced pulse strength, even if the primary hit is overkill-clamped. Air/ground eligibility and physical transfer clearance are checked; the chain cannot cross the primary body, scenery or other defence geometry. No recursion, self-hit or future secondary promise. Existing six visual slots prefer primary bolts; damage survives secondary visual saturation.
