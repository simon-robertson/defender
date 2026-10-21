# From development previews to a playable game

**Research backlog · updated 19 October 2026 · first development plan delivered for gameplay testing; broader backlog remains deferred.**

This remains a prioritised backlog, not approval of every TODO. The user has signed the [first development plan](../plans/first-playable-game-2026-10-19.md) and requested a working version for testing. `/play/` implementation is now authorised for A1/A2, four waves each, base/upgrade1 guns and Dogs, with the provisional rules below. `/game/` and accepted assets/layouts remain the baseline. The first slice is now implemented with100 affected tests passing; [evidence and limits](../play-first-2026-10-19/README.md) record the bounded result. Broader tasks below remain future work.

## Latest user decisions

The following are explicit user direction, superseding the corresponding open questions and staging suggestions in the original draft:

1. Start at the title screen, then choose Start.
2. Begin with **2 tokens** available to purchase or upgrade defences.
3. Enter the first/next level and place the owned defences.
4. The player explicitly chooses Ready/Start Wave; no automatic start is implied.
5. Every enemy that exits increments the **miss counter**. The signed plan sets game over at **10 cumulative misses across the run**; retry resets to zero.
6. A successful wave adds **2 tokens**, then returns the player to preparation for purchases/upgrades and placement.
7. Token, defence and enemy configuration must be tunable later. Current values are initial settings, not final balance.
8. All four Zone B layouts are approved. This approves their creative layout; it does not claim campaign balance or add combat to their `/game/` previews.
9. Retain owned units/tiers and unspent tokens; permit purchases/upgrades/free repositioning only in preparation, retain same-map placements, and redeploy owned units on the next landscape. Retry starts a fresh run with 2 tokens and no units.
10. **P toggles pause/resume during an active wave, showing/hiding a pause screen.** Paused combat/spawn time must not advance or catch up on resume.

**Confirmed progression, 19 October:** four waves per level; then the next level in the area/zone; then the next zone after the area is complete. The earlier five-wave rule is superseded. Four levels in each of four zones means 64 campaign waves. The signed first delivery uses A1/A2 with eight waves total; the remaining campaign content is future work.

The new starting/reward rule is the authority for this first loop. Do not additionally award the earlier separate repair/upgrade tokens or a second level-completion award without an explicit reconciliation. Repair remains a longer-term design question, not an implied enemy-attack or wear mechanic.

## Finding and recommended first milestone

Combat and rendering provide a sufficient base. The first plan should connect the user's complete loop: **title → 2-token preparation/shop → landscape placement → manual wave start → kills/escapes and miss counter → successful-wave +2 tokens → preparation**, with game over and retry. It must include initial purchases/upgrades and title entry; the original suggestion to defer these until after a placement-only slice is superseded.

**Approved bounded milestone:** A1 Southern Hook and A2 Garden Crossing, base/upgrade1 gun turrets and Dogs, eight total waves. It includes a real initial choice between two base guns and one upgraded gun, title entry, purchases, deployment, manual starts, miss-based game over and fresh-run retry. Base Arc, silo, generator, drones and further tiers are outside this delivery; no null/inert tier should become an offered purchase.

The base turret has range 48 and strength 10; the Dog has 300 HP for effects testing. These are real working values, not evidence that a 2-token starting strategy can survive a proposed wave. Tactician should check actual firing windows and propose tunable encounter settings. No new model family, renderer feature or completion of every landscape is a prerequisite.

## Evidence and limits

The evidence table below is the original 19 October preview-code investigation, retained as motivation for the work now under way. It is not a claim that those gaps remain absent from in-progress `/play/` code. This documentation update does not rerun verification. The original investigation was local design-and-code research on 19 October. Researcher read the contributor instructions, shared design doc, project/visual/rendering briefs and team/researcher briefs, then inspected the implementation below. No external comparison was necessary to establish these local gaps. No game code, level source or shared design document was changed; no test suite or live gameplay session was run for this report. Existing verification records remain historical evidence, not newly repeated checks.

The accepted baseline now includes A1–A4 and B1–B4 layouts, plus the corrected A1 drones. A1 remains the two-drone/two-Dog/one-Moth combat test; A2–A4 and B1–B4 remain layout/wildlife previews. B's technical evidence is recorded in [the Zone B delivery](../zone-b-path-carving-2026-10-19/README.md); creative acceptance is now explicit, while campaign balance remains open. C/D and the frozen landscape backup are outside this assignment. Do not use archived weapon rosters or old carve records as current campaign content.

| Evidence | What it establishes |
| --- | --- |
| [Design doc: identity, campaign, economy and open decisions](../design-doc.md) | Sixteen levels with four waves each, manual deployment and three arsenal variants are documented. Latest user direction defines initial/reward tokens, manual start, title entry, exit misses and level/zone progression. |
| [Level schema](../../shared/level.js), lines 14–29 and 39–85 | `waves: 5` remains legacy preview metadata in current code/sources, not the new campaign rule. The signed player configuration uses 4; no runtime/schema/source migration was made during planning. Sources contain no playable encounter schedule. Terrain/footprint/overlap checks are useful authoring foundations. |
| [Preview catalogue](../../shared/preview-levels.js), lines 3–13; [mode guard](../../shared/preview-mode.js); [rosters](../../shared/enemy-roster.js), lines 25–41 | Development selections and fixed actors are deliberately separate from campaign progression. Noncombat sources cannot silently become combat. |
| [Application](../../game/app.js), lines 114–124 and 155–187; [HTML](../../game/index.html) | `/game/` owns preview selection, fixed controller construction, effects, death visibility and developer reset. There is no player wallet, build/upgrade/repair interface, wave progression or outcome flow here. Visibility pause and scene load/error cleanup already exist. |
| [Enemy controller](../../game/enemy-preview.js), lines 28–49, 65–81 and 99–104 | Actors are constructed as a fixed collection. Living actors wrap their route using modulo distance; exiting does not remove them or impose a loss. Health/death and pose reset already work. `PathMotion` itself samples/clamps a route; preview looping is in this controller. |
| [World builder](../../engine/world.js), lines 78–131; [renderer](../../engine/renderer.js), `setWorld`, `updateInstance`, `setActorVisible` | The current runtime builds rig collections and instance buffers for a supplied roster/placement set. Existing actor visibility compaction can hide/reveal those actors; this is not a general spawn, purchase or placement API. |
| [Defence coordinator](../../game/defence-preview.js), lines 13–46; [enhancers](../../game/enhancer-preview.js), lines 13–39 | Target planning and weapon controllers already integrate several families. Membership, enhancement neighbours and links are resolved from the scene; live deployment/upgrades must refresh these dependencies safely. |
| [Prices/stats](../../shared/defence.js); [weapon rules](../../shared/arsenal.js); [drone data](../../shared/drone.js) | Turret/Arc/silo prices are 1/2/3 per purchase and per upgrade step. They do not spend money. Turret upgrade 2 has zero strength and no firing rule; drone upgrade tuning is null. |
| [Health](../../engine/health.js), [frame clock](../../engine/clock.js), [scene loader](../../engine/scene-loader.js) | Reusable damage, shared time and ownership primitives exist. They do not define a session, protected objective or campaign save. |
| [Rendering requirements](../rendering.md), [current performance review](../performance-review-2026-10-18.md), fixed pools in [model lights](../../shared/model-lights.js), [missiles](../../shared/missile-flight.js), [Arc effects](../../shared/arc-effects.js) and [damage effects](../../shared/damage-effects.js) | Resource limits exist for previews. A wave/placement budget and target hardware/frame-time budget have not been agreed; source safety limits are not campaign capacity promises. |

## What is already available

- Accepted landscape/art direction, sixteen populated 20×16 sources, accepted A1–A4/B1–B4 carved layouts and multi-route/bridge support. C/D remain landscapes awaiting later carving authorisation.
- Reusable enemy movement/animation, health, physical hit reactions, damage/death effects, cosmetic wildlife and route-aware targeting.
- Working base/upgrade weapon studies for turret, Arc and missile; base drone flight/combat and base generator adjacency effects. Models for all three family variants exist, although some combat values are unassigned.
- WebGPU renderer, lighting/effects, frame clock, cameras, loading/unloading and diagnostics. The workshop and JSON source pipeline remain authoring tools.

These capabilities should be reused. Creating another visual combat study would not close the missing player-loop gap.

## Approved goals under implementation or remaining broader work

| Approved goal | Remaining work; distinction from an open decision |
| --- | --- |
| Title → preparation → placement → manually started wave | Implement this complete flow in `/play/`, preserving `/game/`. Title and initial upgrade choice now belong in the first plan. |
| Initial 2 tokens; +2 after a successful wave | Add wallet, purchases/upgrades and exact-once rewards with tunable data. Do not add a second legacy award. |
| Enemy exit increments miss counter; threshold ends the game | Finite escape/game-over handling is in progress; signed provisional rule is 10 run-wide misses and fresh-run retry. |
| Player manually places owned defences | Interaction/runtime integration is in progress. The signed plan separates ownership/tier from deployment, uses physical-clearance checks and permits changes only during preparation. |
| Four waves per level; four levels in each A→B→C→D zone | Wave scheduling/progression are in progress. Complete wave 4 before changing level, and the final level in an area before changing zone. |
| Same arsenal across zones, base → upgrade 1 → upgrade 2 | Initial purchasing/upgrading is required. Complete later families/tiers only with assigned price and attack data. Runtime ownership/reset policy is assigned in the signed plan; disk save/resume remains future work. |
| Earlier repair goals | What can be damaged/repaired, the damage source and repair cost/effect remain open. Separate-token awards are not assumed on top of the latest loop. |

## Decision status after sign-off

The first delivery's former decision blockers are settled as approved provisional rules. They can be tuned inside isolated play configuration; they do not require another approval cycle to implement. Broader decisions remain open.

| ID | Current status | Consequence |
| --- | --- | --- |
| D1 | Approved: 10 cumulative run-wide misses; fresh-run retry | Resolve +1 per escape once, and give game over precedence over a simultaneous success reward. |
| D2 | Approved: A1/A2, gun base/upgrade1 and Dogs | Build and verify eight tunable waves; preserve previews. |
| D3 | Approved: retained ownership/tiers and unspent tokens | Same-map placements remain; new landscape returns units to deployment inventory, with no repurchase. |
| D4 | Approved: preparation-only purchases/upgrades/free repositioning | Full placement clearance; unplaced units remain inactive; manual start need not spend/place everything. |
| D5 | Approved: four waves per level, then next level/zone | Fresh gun readiness before each wave; no partial burst inherited. First delivery ends after A2 wave 4. |
| D6 | Approved first interface and latest P-key requirement | Title/shop/deployment/HUD/results/retry; P toggles active-wave pause/resume with a pause screen and no paused-time catch-up. |
| D7 | Open, later: repairs | Define repairable state and approved damage source before adding repairs. |
| D8 | Approved first delivery: in-memory run, reload to title | Save/resume remains outside scope. |
| D9 | Open, later: further arsenal values | Do not offer unassigned turret upgrade2, generator/drone tiers or prices. |
| D10 | Open: final hardware/performance target | Measure the bounded test fixture and report limits; do not invent a final campaign budget. |

**Approval gate satisfied:** the user has signed the first plan. A1/A2 implementation, isolated tuning and affected verification are authorised. Broader backlog work remains deferred. No task below is marked complete merely because it was approved; final evidence belongs in the delivery record.

## Prioritised implementation TODO

Unchecked items distinguish work to verify from completed delivery: P0 is authorised and in progress under the signed first plan; P1/P2 remain broader backlog. Dependencies reference decision IDs above and earlier TODO items. Checkboxes await concrete completion evidence.

### P0 — make the first complete player loop

- [ ] **T1 · Write the slice contract and encounter sheet.** Lead + Researcher + Tactician; depends on D1–D6. Record `/play/` entry/title/shop/placement flow, exact sources, catalogue, miss policy, initial 2-token wallet, +2 successful-wave reward, and the confirmed four-wave level transitions. Separate approved constants from provisional balance. **Accept when:** the user can review one complete rules sheet with no hidden mechanic dependencies; each wave has explicit types/counts/spawn times/routes, and the approved A layout/test sources have a preservation plan.

- [ ] **T2 · Add session state and outcome handling.** Engineer; depends on T1/D1. Own title, purchase/upgrade preparation, placement, active wave, return to preparation, terminal completion and game over independently of preview selection. Resolve each kill/escape once, define terminal-event ordering and gate gameplay actions by phase. **Accept when:** an undefended run reaches the specified miss threshold, a winning fixture completes only at the approved progression endpoint, and simultaneous death/exit or repeated callbacks cannot double-count an outcome. A dead/escaped enemy cannot keep looping or remain targetable.

- [ ] **T3 · Add finite wave data and bounded spawning.** Engineer + Tactician; depends on T1/D2/D5. Give enemies explicit inactive/scheduled, active, killed and escaped states; initialise poses/health at actual spawn and retire them on resolution. Reuse existing rigs/animations and plan finite actor slots/assets before play. **Accept when:** all approved schedules spawn exactly once at the correct entrances/times; a large valid delta handles due events without omissions/duplicates; future/retired actors are invisible, untargetable and absent from collision/threat planning. Pause/hidden-tab time does not trigger a catch-up wave.

- [ ] **T4 · Complete wave boundaries and rewards.** Engineer; depends on T2/T3/D3/D5. Finish only after every scheduled enemy has spawned and resolved, with the agreed projectile/effect policy; produce exactly one boundary result and exactly one approved award. Do not make harmless cosmetic effects or a recharging drone an indefinite completion blocker. **Accept when:** empty/delayed schedules, final kills, final escapes and projectiles still in flight cannot skip, duplicate or stall a wave; each successful wave adds exactly 2 tokens and returns to preparation; game-over cannot also grant a success reward. The approved answer to D5 defines level transitions and final completion. No duplicate legacy reward is added.

- [ ] **T5 · Implement ownership, wallet, initial upgrades and manual placement together.** Engineer; depends on T1/D3/D4 and T3's capacity plan. Start a new run with 2 tokens; implement preparation purchases/upgrades against owned defence IDs/tiers before landscape placement. Then add picking and placement of those owned units. Purchases/upgrades debit once; placement itself must not debit the already-paid purchase again. Keep ownership, deployment and authoring JSON separate. Validate ground/footprint/route clearance/occupancy and atomically commit each action. **Accept when:** legal placements attack through existing controllers, invalid/cancelled/duplicate clicks spend nothing, balances cannot go negative, and paths/water/bridges/scenery cannot become accidental defence foundations. The player can see permitted ground from the normal overview.

  **Engineering dependency:** current world/renderer/controller collections are created from a scene. Choose a measured bounded-slot or controlled rebuild approach for the approved build windows; do not assume a new model can simply be appended. Refresh targeting membership, visibility/instance/light data, static obstacle/impact/drone clearance, generator neighbours and plasma links as applicable. Existing actor hide/show only handles preallocated actors. **Accept when:** placement cannot leave stale targeting/clearance references or reset unrelated session state; no recurring per-frame world rebuild is introduced.

- [ ] **T6 · Build the essential play HUD and input.** Artist + Engineer; depends on T2–T5/D6. Show title/Start, preparation purchase/upgrade choices and costs, tokens, miss counter/threshold, the approved wave/landscape position, selected defence and useful range/placement feedback. Provide the agreed start/next-wave, **P-key pause/resume with pause screen**, cancel and result/retry controls with clear unavailable states. **Accept when:** a new player can place a defence and finish/retry without developer keys, a console or undocumented gesture; UI clicks do not also place/orbit the world, and failure reasons are readable. Basic keyboard/focus/contrast usability belongs here, while a complete settings/remapping suite can follow.

- [ ] **T7 · Play and verify the slice before expanding it.** Lead + Tactician + Engineer + Artist; depends on T2–T6, with D10 for performance sign-off. Run affected tests and actual built-in-Chrome sessions covering a viable strategy, a weaker alternative, no defence, invalid buying, each wave boundary, P-key pause screen/resume with unchanged combat/spawn clocks, background/resume, defeat/victory, retry and leaving/re-entering play. **Accept when:** the user can play the complete approved title→shop→placement→manual wave→preparation loop, including an initial upgrade choice; outcomes/rewards are repeatable; retry restores exactly the chosen starting state and clears old enemies/claims/projectiles/timers without altering accepted previews. Record peak counts, frame/allocation/resource measurements and overflow under the approved fixture. Two observed winning strategies are useful design evidence, not a new requirement that every arrangement wins. User reviews gameplay before campaign rollout.

### P1 — fulfil the broader tactical progression

- [ ] **T8 · Design and implement repairs, then integrate them into wave decisions.** Researcher + Lead + Engineer + Artist; depends on D7 and T7. Keep this outside the initial loop unless explicitly included in the signed plan. First approve damage/durability/repair rules and reconcile the older separate-token scheme with the current wallet; then add repairable state, transactions and feedback. **Accept when:** damage has an approved source, repairs have measurable need/effect, valid repairs consume the specified tokens exactly once, invalid/full-health repairs charge nothing, and wave award/spend timing is correct. Do not add enemy attacks simply to give repair tokens a purpose.

- [ ] **T9 · Extend the initially usable arsenal to further tiers/families.** Tactician + Engineer + Artist; depends on D3/D9 and T5/T7. Bring in existing Arc/silo/generator/drone families in the agreed order; fill only the tier rules/prices needed for each enabled offer. Initial purchases/upgrades belong in T5; extend tier changes and refresh affected model/controller/clearance/light/link data, with an approved policy for HP/ammo/bursts/cooldowns/endurance during upgrade. **Accept when:** no offered tier has null/inert combat data, every purchase/upgrade uses the approved family price, and the base→upgrade 1→upgrade 2 restriction is enforced. Generator modifiers derive once from original stats; mixed weapons retain coordinated claims and drones retain accepted avoidance/return behaviour.

- [ ] **T10 · Extend initial runtime progression and decide save persistence.** Lead + Engineer + Artist; depends on D3/D5, T7 and the enabled arsenal systems. The first loop already needs runtime ownership and the agreed next-wave/landscape transition; extend this to full level unlock/zone progression, then implement any agreed D8 save/resume scope, versioning, retry and corrupt/absent-save behaviour. **Accept when:** each successful wave grants its +2 once and advances through the agreed preparation/destination flow, balances/ownership persist exactly as approved, failure/reload cannot duplicate rewards, and a resumed game cannot retain stale world references. Decide whether mid-wave saving is needed; it is not a prerequisite for slice one.

### P2 — expand content and prepare a release

- [ ] **T11 · Author and balance the campaign in increments.** Tactician + Artist + Engineer; depends on T7 and the enabled progression/arsenal rules. Finish/review remaining layouts when authorised, then author encounters per campaign level using the confirmed four-wave structure, introduction/order of enemies and arsenal access, budgets and difficulty transitions. B1–B4 layouts are now approved; their encounter balance remains future work. C/D carving remains a later authorisation. Test actual range/LOS/pitch/flight and affordability, not only empty-site counts. For merging routes, specify the entrance schedule and review simultaneous traffic/crowding separately. **Accept when:** each released level has a reviewed route and visible useful alternatives, an explicit playable encounter schedule matching D5, viable affordable play and measured peak resource demand. Do not wait for the full campaign encounter set before testing the first complete preparation/wave cycle.

- [ ] **T12 · Extend the required initial title entry into the full product shell.** Artist + Lead + Engineer; depends on a stable T7 loop, with the release target agreed. Title→Start in `/play/` is part of T2/T6. Extend the accepted scenery-only presentation with an appropriately scoped Settings/Credits flow; document controls and provide clear unsupported-WebGPU/load/device-loss messages. Decide distribution, save expectations and the supported desktop browser/hardware matrix. Expand accessibility/controls/settings and targeted compatibility/performance checks. **Accept when:** a player can enter, understand, play, retry/continue and leave a tested build without the authoring workshop or preview tools; no placeholder menu action promises an unimplemented feature. Audio/music need separate approval and are not a prerequisite for the first playable milestone.

## Explicitly deferred or excluded from the signed first delivery

- Final campaign balance, remaining landscapes/encounters, every arsenal tier, repairs, full Settings/Credits and save/resume can follow the first loop. **Title entry, purchasing, an actual upgrade choice, placement, manual wave start, miss/game-over handling and +2 successful-wave rewards are initial scope.** Do not defer them based on the original readiness recommendation.
- The full campaign has 64 waves across 16 levels. The approved first delivery has 8 waves across A1/A2; implementing the remaining campaign content follows later approval.
- No extra enemy, removed Monowheel replacement, boss, resistance/status effect, selling/refund, bounty, interest, energy mechanic, player-built maze, dynamic routing or independent-exit rule is inferred.
- Missile splash, Arc chaining/stun, enemy attacks on defences, fog/haze, dynamic weather/daylight and audio remain outside the current loop. One-bounce indirect lighting remains tentative. No renderer rewrite or new dependency is proposed.
- Preserve accepted A1–A4/B1–B4 appearance and A1 drone behaviour, C/D, models and frozen backup. `/play/` uses separate session/runtime composition; `/game/` retains development preview controls and source semantics.

## Shared-document handoff for the lead

The design doc, project brief and signed plan now record the bounded implementation-in-progress status and P-key pause-screen requirement. Historical planning/change records retain chronology. Lead must add actual test/browser/preservation evidence and final limits after verification; approval itself is not delivery evidence. Preserve the distinction between current two-map/eight-wave gun/Dog scope and later arsenal/repair/campaign work.

**Next action:** finish and verify the authorised implementation, then present the working version for gameplay testing. This documentation pass makes no test-pass or completion claim.
