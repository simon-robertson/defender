# Drone defence — concept v1

18 October 2026. **Artwork approved by the user; modelling authorised.** Generated with the built-in image generator. [Exact generation prompt](drone-defence-moss-porcelain-v1.prompt.txt).

![Base drone and landing pad, two endurance upgrades and takeoff/return studies](drone-defence-moss-porcelain-v1.png)

## Requested behaviour

The defence consists of a drone and its landing/recharge pad. The drone takes off and flies for a specified duration, then returns to its own base to recharge. Upgrades increase the available flight time. Recharging is the unit's cooldown period.

The drone carries a machine gun with its own firing rate and weapon cooldown. Keep the flight/recharge cycle separate from weapon firing/cooldown; neither timer replaces the other. All three arsenal stages are represented: base, upgrade 1 and upgrade 2.

## Subsequent model revision

The user subsequently removes all drone legs/skids, changes the underslung gun to twin barrels, and keeps the resting drone hovering slightly above the pad with fans turning. This explicit direction supersedes those details in the image. Existing round strength/cadence remain unchanged; barrel sequencing is a later presentation choice.

## Approved visual direction

Four square shrouded lift fans surround a porcelain-and-forest-green body. A single underslung machine gun sits between the landing supports. Larger dorsal battery housings distinguish successive endurance upgrades; these do not assign stronger damage, extra ammunition or faster recharge. The low square pad uses docking/contact rails and compact rear charging hardware. Small vermilion accents match the Moss and Porcelain defence family; green light remains the enhancer identifier.

Fan arrangement, gun mounting, battery housings, pad contacts and accent appearance are approved modelling references, not certified production geometry or additional gameplay mechanics. The illustration guides a future texture-free, grid-authored model; footprint and animated clearance still need verification during modelling.

## Open decisions and scope

Base starting values now specify20 seconds from launch (return excluded), turret-base strength per round,10-round bursts at4 rounds/second, and5 seconds cooldown after each burst. Finish an active firing phase on flight expiry, then return immediately. Base recharge duration, upgrades, targeting range, flight radius/speed, costs and hitscan versus projectile delivery remain unspecified. The user requests intelligent prioritisation of near-exit enemies and nearly destroyed enemies outside other defences' range; exact ranking weights remain open. Enhancer interaction and pad damage behaviour are also open. Do not infer these from the illustration.

The user has now authorised base/two-upgrade models and their isolated visual review. Combat integration and level placement follow later; the assigned starting values will be refined once in levels. A4 path carving remains deferred.
