# A1 drone combat test

**Later motion revision:** the user requested smoother flight, a level body and independently tilting fans for both translation and rotation. The current controller and twelve-part models supersede the initial movement and eight-part rig described by this milestone. Approved combat values and this level's layout are unchanged. See [current motion and fan-steering evidence](../drone-motion-2026-10-18/README.md).

18 October 2026. **Implemented and verified for user review.** The user approved A4 Ruin and Mere Tour and the revised legless, twin-barrel drone family. This test adds two base drones and three existing Zone A enemies to the approved Southern Hook layout. It does not assign campaign waves or economy.

[Open A1](/game/?inspect&level=moss-01) · [Drone models](../drone-model.md) · [Design doc](../design-doc.md#proposed-drone-defence)

## Source and preservation

`scripts/a1-drone-test.js` wraps the accepted `carveMoss01()` factory. The original40 path boxes, terrain, water, environment, all229 scenery placements and six cosmetic wildlife actors are retained. One hare seed moves from an eight-node corner pocket to `[106,24,250]`; bird perches and the other seeds are unchanged. The [pre-test source](baseline.level.json) is the exact approved layout. Pads are base models at `[4,0,9]` and `[15,0,9]`, on existing visible ground at path height. No scenery was removed to accommodate them.

The source declares `previewMode: "combat"` and an explicit `previewActors` roster: two Dogs at route distances72/300 and one Moth at180. Current preview loading uses that source roster rather than the larger historical A enemy catalogue. All fifteen other previews remain noncombat; A2–A4 retain their accepted routes and B–D remain populated landscapes.

## Agreed timing

| Setting | Base value |
| --- | --- |
| Flight budget |20 seconds measured from launch |
| Return flight |Excluded from the flight budget |
| Round strength |10 HP, matching the base turret |
| Burst |10 rounds at4 rounds/second (.25-second gaps) |
| Weapon cooldown |5 seconds after the final actual round |
| Recharge at own pad |10 seconds, separate from weapon cooldown |
| Flight expiry during a burst |Finish the active valid burst, then return immediately; do not start another burst or wait out weapon cooldown |

Fans continue turning during the low pad hover. The stationary pad, flying body, twin gun and rotors use the accepted model rig. No projectile, audio or unrelated effect is added; the initial gun delivery reuses existing hitscan damage and muzzle effects. Upgrade statistics, costs and generator interaction remain open.

## Implementation choices and evidence

Initial test tuning is provisional: horizontal gun range72 units, flight speed48 units/second and nominal attack lift24 units above the resting bind pose. Higher transit positions may be needed to clear scenery; firing still requires physical gun pitch, aim and muzzle-to-target visibility. Target selection should favour exit urgency and finishable enemies outside friendly coverage, using the existing bounded shared planner and conservative live commitments.

Three source-contract checks initially passed (36 assertions): malformed/duplicate actor data and route-bound violations are rejected, runtime actors are copied from the explicit roster, and loading the test world preserves all original geometry while resolving only its requested models. Controller and browser checks are recorded below; source checks alone do not establish runtime correctness. After the A1 hare correction, the three source checks plus the A4 roaming regression pass together with 56 assertions, including rejection of both historical trapped seeds.

## Completed controller and verification

The A1 test is implemented. `DronePreview` owns independent flight and gun clocks, opposing rotor animation, body lean, mechanical gun aiming and real muzzle transforms. The pad stays fixed while the aircraft moves. It attacks ground and airborne enemies through existing hitscan damage, then returns to its own pad and completes a ten-second recharge. A burst that remains valid may finish after the 20-second budget; blocked/dead/out-of-range targets cancel the burst and do not delay an expired return. Partial cancelled bursts still receive the normal five-second weapon cooldown. R resets combat, flight and inspection state using the loaded assets.

The shared target planner ranks only one defence per frame. Its normal threat/time-to-exit score is augmented by a provisional finish bonus below 100 residual HP when an enemy is outside other active weapons’ ranges. Only future shots certified against range, mechanical pitch and static visibility receive a damage commitment. Pursuit/loaded rounds and uncertain airborne/impact poses receive none. Independent Engineer review found and verified fixes for expiry cancellation and overly optimistic burst reservations.

Navigation uses a cached 12-unit XZ graph at four transit heights, swept aircraft clearance and retained search/path arrays. The current graph has 5,412 nodes (3,387 free), 11,016 shared bytes and 108,300 bytes per aircraft’s planning storage: 227,616 bytes total. Replanning occurs on the shared thinker turn, limited by a 0.4-second interval or invalidation. Aircraft hold for one another; a stable priority lets one use a certified upper lane for tested head-on returns. This bounded preview strategy is not a general deadlock-proof crowd solver. No new rendering pass, GPU pool or animation loop is introduced. These are storage and correctness observations, not a whole-game performance claim.

Verification completed on 18 October:

- **58 affected tests / 88,477 assertions** pass across drone combat, target planner, existing combat, turret pitch, enhancer preview and explicit combat-source validation. The eight drone cases include full valid expiry bursts, early cancellation, recharge, reset, quarter-turn placements, stalled frames, conservative commitments, head-on return and a 120-second actual A1 run with both muzzle rays, static clearance and aircraft separation checked.
- **Six existing model checks** pass; geometry is unchanged. **Seven selector checks / 104 assertions** pass after updating the current preview catalogue.
- The earlier A4 route/bridge/layout run passed 19 checks / 44,296 assertions. The trapped-critter regression separately passes 14 assertions and rejects the historical one-node spawn. [A4 wildlife evidence](../a4-path-carving-2026-10-18/wildlife-roaming.json). The A1 follow-up likewise confirms all three critters share 4,788 reachable nodes and complete journeys; [A1 roaming evidence](wildlife-roaming.json).
- All sixteen current factories reproduce their saved sources. [Preservation verification](preservation.json) confirms only A1/A4 changed among 85 original JSON assets; 67 model sources and the other fourteen production levels are unchanged. All 69 frozen backup checksums and the archive hash remain intact.

One old planner test contained stale exact shot-count expectations. Engineer reconstructed the pre-drone planner logic in memory against the same archived fixtures and obtained the same current counts as the new implementation before updating those expectations. The existing enemy-expansion fixture also assumed a seed distance was shorter than its archived route; its assertion now checks the engine’s existing wrapped distance and lap, without changing movement or roster data. [Engineer handoff and precise commands](ENGINEER.md).

Live browser checks observed hits on both Dogs and the Moth, three launches and returns per aircraft, return to the original pads after the roster was destroyed, T at 0.1×, R restoring health/flight state while preserving time scale/night, and A1→A4→A1 resource release/reload. A1 has 126 scene buffers; unloading destroys them before A4’s 54 are loaded. A4 has no aircraft or drone navigation. Model-light overflow stays zero. [Browser samples](browser-review.json).

![Two base drones flying in the preserved Southern Hook layout](drone-flight-overview.png)

Upgrade statistics, economy/costs, generator interaction, final flight speeds/priority weights and campaign balance remain open. This test does not add waves or player placement, and the finite roster still uses the existing loop/reset convention.
