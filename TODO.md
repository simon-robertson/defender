# Development TODO

22 October 2026: the player authorises working through the remaining playthrough findings. Items 44–48 are implemented for review; item 47 follows the revised requirement for at least one deployed unit. Earlier completed/withdrawn entries retain their historical status; GI/AO and weather remain removed.

1. [x] **Single-bounce indirect lighting experiment — retired.** Experiment and colour audit completed, then rejected by the user along with AO. All GI/AO code, tools and caches are removed; evidence remains historical only.

2. [x] **Drone start-camera investigation and original fix.** Historical delivery, now superseded by the complete transition removal in item 5. [Investigation](docs/research/drone-start-transition-2026-10-20/README.md).

3. [x] **Shorten directional-thruster firing.** Replace the repeated correction pulse train with one brief spin-up and one braking impulse, each at most 65 ms. Jets and white light end together; no jets within one degree of alignment or after terminal cutoff. Retain the 5.25-unit length and separate main engine exhaust. Actual slow/fast launches checked at 30/60/120 Hz.

4. [x] **Bottom-bar performance readout.** FPS, milliseconds per frame and synchronous CPU renderer milliseconds. Clearly labelled, updated four times per second, reset on pause/loading/hidden/resume. GPU execution time is not claimed.

5. [x] **Completely remove the camera transition.** Deleted timed overview↔Drone blending, mixed projection and transition-only waiting/state. Immediate view changes and level transfers; ordinary Drone movement, view selection, disabled manual controls and four-second effect settling remain.

<!-- Item 6 withdrawn by the user as a misunderstanding; remaining task IDs retained. -->

7. [x] **Remove bulky flying missile-explosion particles.** Removed the eighteen outward ballistic fragments and their shader branches. Keep the main core, eight fireball lobes, smoke, ring and original missile lighting.

8. [x] **Reduce turret muzzle-flash light intensity by 20%.** Peak 10 → 8, retaining geometry, radius, colour and duration.

9. [x] **Shorten enemy-destruction light bursts by 30%.** All enemy families use .336 seconds instead of .48; peak intensity, other particles and missile-impact lighting remain.

10. [x] **Group roster by defence type.** Gun, Arc Spire and Missile launcher groups keep each family's upgrades together, preserving unit identities, controls and ownership order within each group.

11. [x] **Roster current/upgrade range previews.** Deployed-unit hover/focus shows the actual current range; UPGRADE shows the configured next tier with a dashed ring and NEXT label. Preview only; clears when leaving, paused, loading or changing scenes.

12. [x] **More detailed zone skyboxes.** Finer terrain, coherent groves and biome-specific landmarks across A–D; retain darkness/softness and sharp foreground. Every geometry buffer is smaller than before; all 64 GPU compositions pass.

13. [x] **Ease missile rotation in and out.** Gentler angular acceleration and a longer settling tail, shared by actual flight and admission forecasts. Varied turn rates remain; combined with item 3. The retained mixed strategy clears all 64 waves/1,084 enemies without escapes.

14. [x] **GPU frame timer beside CPU time.** Sample the entire production render-pass span from the first actual pass (including vista) to the final display/refraction pass (including bloom/shockwaves). Optional timestamp feature with a safe fallback, three bounded asynchronous readbacks and at most ten samples per second; no render-loop wait or extra pass. Explicit unsupported/stale states and pause/loading/hidden/resize/scene cleanup. Separate rolling GPU milliseconds in the footer.

15. [x] **Brighter late-afternoon sunlight.** A2/B2/C2/D2 direct sunlight is 35% stronger, retaining warm colour, angle and ambient fill. Idempotent play-only override; other periods and authored sources unchanged. Appearance remains for user review.

16. [x] **Wounded stagger and catch-up — rolled back in item 20.** Health no longer changes route movement; ordinary configured speed and existing physical-hit reactions are retained.

17. [x] **Original Stage-2 Arc chain hit — superseded by item 39.** Historical Upgrade I-only 20% chain and fixed range were delivered; current chaining covers both upgraded tiers at 25% strength and half the originating range, with visible enemy-to-enemy beams. See item 39.

18. [x] **CPU timing audit.** The previous figure measured synchronous renderer submission only. Footer now labels and measures CPU app work across simulation, cameras, renderer, overlays and scheduled HUD updates; diagnostics retain both app and renderer scopes. Frame interval remains separate unscaled rAF wall time. Async GPU/driver work, later browser painting and separate event callbacks are excluded; pause/loading/hidden/resize reset samples.

19. [x] **Critter blast gibs and persistent spray.** Inclusive 3D body-centre distances: 48 units (two tiles) from actual enemy explosion origin, 72 units (three tiles) from missile impact, doubled by item 23. Applies to ground animals, birds and fish. Eight model-coloured fragments and sixteen solid spray droplets fly outward with gravity, swept scenery collision and water drag. Remains persist for the current wave, then fade over two seconds during four-second settling; late impacts fade within the remaining settlement time. Defeat advances only cosmetic damage effects long enough to fade, with combat/wildlife/missiles frozen. Dead critters respawn safely for the next preparation; fixed reserved capacity protects all 18 critters alongside enemy debris.

20. [x] **Remove enemy stagger.** Restored ordinary configured route movement at every health level and removed wounded-only slowdown/catch-up state, traffic hooks, helper module and review controls. New all-species trace checks cover route bends, aim and rig poses; existing physical-hit impact reactions remain.

21. [x] **Hide camera view options for now.** Removed player-facing Frame/Auto/Drone selectors and click handlers/hints. Drone remains the run default; title/preparation overview and pause lifecycle remain. Actual title/preparation/deploy/wave/pause UI verified with no selectors or renderer errors.

22. [x] **Confirm the initial depth-only render pass.** Confirmed actual GPU `Initial camera depth` has no colour attachments, writes opaque/debris depth before main opaque shading, and is invalidated by camera/pose/resize/rebind changes. Static cached frames reuse depth. The distant vista can render first to separate depth; shadow depth is separate. No production renderer change was needed.

23. [x] **Double Arc chain and critter gib radii.** Arc secondary range is four tiles/96 units; enemy critter-gib radius is two tiles/48 units; missile critter-gib radius is three tiles/72 units. Inclusive 3D metrics, chain 20% strength/visibility/eligibility and remains lifetime stay intact. Boundary/just-outside and fish checks pass.

24. [x] **Double critter gore and strengthen the burst.** 16 fragments +32 red spray droplets per animal; stronger outward/upward launch, faster spin and larger droplets. Existing radii, persistence, collision and wave-end fade remain. [Delivery and checks](docs/critter-density-2026-10-21/README.md).

25. [x] **More critters on every level.** Nine ground critters +three birds (double the previous land/bird total) across all sixteen levels, plus existing fish. Six added seeds favour safe connected routeside ground. Fixed remains capacity covers the complete population. Appearance/density accepted for now; no further tuning queued. [Delivery and checks](docs/critter-density-2026-10-21/README.md).

26. [x] **Increase gib velocity with distance-based shockwave impulse.** Add a stronger outward3D kick, falling smoothly from112units/s at the core to32at the48/72-unit lethal-radius edge, on top of existing scatter. Retain doubled gore/population, collision, water drag and wave-end fade. [Delivery and checks](docs/critter-shockwave-2026-10-21/README.md).

27. [x] **Unblurred higher-fidelity vistas across A–D.** User authorises integrating the new A skybox and upgrading B–D. Retained reviewed A geometry, added richer terrain/landmarks/vegetation for the other zones, standardised75%resolution and removed the nine-tap blur.32affected tests and64actual GPU compositions pass. All16production levels use the shared update; appearance remains for review. [Delivery and measurements](docs/all-zone-vista-fidelity-2026-10-21/README.md). Culling remains research only: no measured net saving is established, so no culling is integrated. [Research](docs/research/vista-culling-2026-10-21/README.md).

28. [x] **Hidden screenshot camera while paused.** `BACKSPACE` hides the complete pause screen/dimming and Drone viewfinder while the world stays frozen. `W`/`S` fly forward/backward along the viewing direction; `A`/`D` strafe; mouse drag rotates. Free movement is72units/s, with normalized diagonals and no terrain tether. `BACKSPACE` restores the saved camera pose/projection and normal pause screen, still paused. P/Escape restore the view before ordinary resume; blur/visibility loss clears held inputs, and scene/error/teardown release the temporary camera owner. No normal gameplay selector is added. [Delivery and checks](docs/todo-28-30-2026-10-21/README.md).

29. [x] **Blood decals from critter spray impacts.** Small red droplets become larger, flat irregular blood marks at their first solid impact. Marks follow the contacted face normal, clip to that supporting face and remain on ground/scenery/bridge surfaces, including walls/undersides. Underwater solid impacts can stain the bed; no floating water-surface decal. Reuse each droplet's existing effect slot and matrix buffer. The21Octoberdepth correction excludes marks from depth/shadows and draws them last in the existing opaque pass using stable alpha order; item 32 subsequently adds a 0.08-unit outward normal offset with ordinary read-only depth testing; no extra pass, image texture or GPU capacity. [Depth correction and research](docs/blood-decals-2026-10-21/README.md). Existing debris collision handles static scene surfaces; no new moving-actor collision/attachment system is introduced. All marks share item30's lifetime. [Delivery and checks](docs/todo-28-30-2026-10-21/README.md).

30. [x] **Keep all critter-gib effects until build/deploy returns, then fade.** Fragments, blood droplets and impact marks stay fully opaque through wave end and camera settling. Begin their two-second fade only once build/deploy is visible. Same-level preparation retains them while rebinding enemy effects; at level boundaries keep the outgoing board until its preparation fade completes before loading the next scene. A quick new-wave start clears any remaining old fade to free the reserved slots. Defeat/final-completion views retain remains until scene disposal. Safe critter respawn and clean reset/unload remain. No active player session was reloaded. [Delivery and checks](docs/todo-28-30-2026-10-21/README.md).


31. [x] **Reduce enemy-explosion critter-gib range by 30%.** Radius 48→33.6 world units (1.4 tiles), retaining inclusive 3D body-centre checks. Missile gib radius stays 72 units; population, piece counts and combat damage stay unchanged. The shared impulse curve uses the new radius with the same core/edge strength. [Delivery and checks](docs/todo-31-33-2026-10-21/README.md).

32. [x] **Move critter blood marks slightly away from scenery.** Marks lie 0.08 units outward along the contacted face normal, retaining clipped footprints. Read-only less-or-equal depth and stable alpha order replace the per-sample plane-equality check that still flickered near the camera. No new pass/buffer/texture; existing preparation-only fade remains. Near-camera appearance is implemented for review. [Delivery and close-up](docs/todo-31-33-2026-10-21/README.md).

33. [x] **SSR on water.** All 16 current water materials use reflectiveness 0.65. The shared composite reflects visible above-water opaque geometry using ripple normals and view-angle weighting, with 28 bounded ray steps and hit-only MSAA validation. Retain blue tint,60% base transparency/refraction and no analytic glints/image textures. Misses preserve the water base; off-screen/hidden geometry has no SSR image. No new render targets/passes/buffers. Appearance and local GPU cost are recorded for review. [Delivery and checks](docs/todo-31-33-2026-10-21/README.md).

34. [x] **Start Drone-cam nearer the centre.** Open within the middle half of the map in X/Z, with small seed-based variation and existing view-quality/safety checks. Widen only if no central station is safe. Preserve higher/farther clearance, later action-driven filming, smooth movement and restoration. All 16 levels pass five seeds and repeated entries (160 starts). [Delivery and checks](docs/todo-34-35-2026-10-21/README.md).

35. [x] **Make water more reflective.** Reflectiveness 0.65→0.85 across all 16 current materials/defaults; raise overhead reflection weighting from 0.04 to 0.25 while retaining grazing-angle response. Blue tint, 60% base transmission, breeze ripples and refraction remain. Same bounded SSR trace/resources; actual A2/A3/B4 GPU controls pass. Appearance remains for review. [Delivery and checks](docs/todo-34-35-2026-10-21/README.md).

36. [x] **Halve water ripple amplitude for clearer reflections.** All 16 current materials/defaults use strength 0.09 instead of 0.18. Retain scale/speed, tint, base transparency/refraction and stronger SSR. GPU motion/transmission controls pass. [Delivery and checks](docs/todo-36-41-2026-10-21/README.md).

37. [x] **Review and improve enemy-model aesthetics.** Reviewed all ten; refined six with balanced sensor highlights/strips, cleaner Roller rims and simplified Twin Fan guards. Four already coherent models remain identical. No occupied cells added; sizes, rig contracts and palettes remain. Six affected meshes regenerated; source/gait/clearance tests pass. Appearance awaits review. [Delivery and checks](docs/todo-36-41-2026-10-21/README.md).

38. [x] **Increase bloom by 100%.** Composite strength 0.35→0.70; retain selective emitters, blur footprint and existing resources. Actual GPU halo pixels confirm doubled linear-light contribution. [Delivery and checks](docs/todo-36-41-2026-10-21/README.md).

39. [x] **Visible enemy-to-enemy Arc chaining for both upgraded tiers.** Upgrade I and II chain once to one random eligible living active enemy within 50% of the originating Arc targeting range, using the retained inclusive 3D metric; secondary damage is 25% of effective Arc strength. Depart from a compatible exposed primary surface, attach both endpoints, and reserve separate six-bolt primary/secondary banks. Real A2/A4 encounters show 12/16.25 secondary damage and visible beams; boundaries, blocked/airborne/lethal/saturation tests pass. Supersedes items 17/23 chain tuning. [Delivery and checks](docs/todo-36-41-2026-10-21/README.md).

40. [x] **Raise nighttime sky light for quarter-length shadows.** Runtime night direction has 4× authored Y at unchanged XZ heading; all four GPU compositions show a 0.25 flat-ground shadow projection ratio. Night colour/intensity/ambient and 12° evening light remain. [Delivery and checks](docs/todo-36-41-2026-10-21/README.md).

41. [x] **Include defences in obstruction checks; stop missiles clipping through Arc towers.** Shared missile admission and swept collision now query live posed defence cuboids, with firing-launcher exclusion and exact supporting impact faces. Deployment revision invalidates cached admission. Actual Arc tower tiers block terminal flight at 30/60/120 Hz; obstruction/removal, openings and pose-update tests pass. Existing gun/Arc LOS continues using the same defence parts. [Delivery and checks](docs/todo-36-41-2026-10-21/README.md).


42. [x] **Engine optimisation review and planar water reflections.** Remove decal-only depth/shadow redraws and hidden-emitter bloom; skip full-size dry-water targets and empty masks; fix Drone anticipation self-occlusion; share/throttle telemetry snapshots. Cache defence bounds within synchronous missile forecasts and reject missed Arc part bounds, preserving exact combat/contact/RNG traces. Half-resolution planar reflections now default for each current water height, sharing geometry/shadows and retaining accepted ripples/tint/refraction/transmission, after paired A2/B4 comparisons outperform SSR locally. Off-screen objects/clipping, cache/reactivation, dry/wet/resize/disposal and native campaign checks pass. 189 affected tests and 64 production GPU compositions pass; appearance remains for review. [Delivery and measurement limits](docs/engine-optimisation-2026-10-21/README.md).


43. [x] **Investigate and avoid first-destruction graphics setup.** Reported occasional first-kill staggering. Moved seven event-time rendering pipeline creations and existing effect pools/images into asynchronous loading-time preparation (fourteen death/decal/bloom pipelines total). Actual GPU runs show zero setup creations during first destruction; 59 affected tests pass. The larger intermittent pause was not reproduced, so complete hitch removal awaits player confirmation on next load. Active run remains untouched; visuals and combat unchanged. [Diagnosis, reservation cost and limits](docs/first-destruction-2026-10-21/README.md).

44. [x] **Clarify checkpoint recovery and leaving an area.** Return to title opens a clear loss/checkpoint explanation, freezes simulation and preserves the prior pause state on cancellation. Defeat offers Resume checkpoint when a valid save exists; the fresh-A1 action is Restart campaign. Recovery is the primary action when available. End-of-level autosaving and checkpoint storage are unchanged.

45. [x] **Explain defence and upgrade benefits before spending.** Selected units and keyboard/hover-inspected upgrade rows expose compact configured current-to-next damage/range and firing details. Gun burst size, Arc one-hop chain strength/range and missile magazine/launch/reload differences are explicit; generator bonuses are included. Selection and keyboard focus reveal the comparison inside the roster scroll area. Rows stay compact when not inspected.

46. [x] **Add concise per-wave outcome feedback.** A separate completed-wave record counts actual escapes, independently of cumulative weighted misses. Preparation shows Last wave · No escapes (or N escaped) · token reward inline. The player subsequently requests removing the floating bottom-left completion panel, so no completion notice is emitted over the board. No blocking result screen or reward change.

47. [x] **Require a defence before starting a wave — revised player direction, 22 October.** Start wave is disabled until at least one owned unit is placed. Recalling the last unit disables it again; the session also rejects empty-board starts. Reserves remain allowed once a unit is deployed. Supersedes the earlier proposed undefended-start label.

48. [x] **Improve board context in the Drone opening.** The existing three-second high central opening starts its focus nearer board centre, adaptively retaining the actual action anchor within the shot, then smoothly releases toward the live focus. Accepted centre/altitude/boundary, flight/lens limits, pause and subsequent battle selection remain. All seven native study starts and native 30/60/120 Hz combat/clearance checks pass; an actual A1 opening shows about 59% board coverage.
