# Current game and rendering features

Snapshot: **20 October 2026**. These lists describe implemented features, including recent changes awaiting visual/balance playtesting. **Preview only** marks engine features available in `/game/` or developer studies but not in the `/play/` campaign arsenal. Research proposals and removed experiments are excluded.

## Game features

- **Complete A–D campaign:** four biome zones, sixteen levels, four waves per level and sixty-four authored waves containing 1,084 enemies. Completing a level advances to the next level and then the next zone.
- **Four distinct environments:** Moss and Porcelain woodland/ruins; Ochre and Petrol desert/mesas; Ice and Ember snowy highlands; Plum and Mint autumnal woodland/ruins. Arsenal colours adapt to each zone.
- **Authored tactical routes:** winding paths, unequal branching approaches, shared merge sections, wooden bridges and the additional B4 lake crossing, with nearby defence clearings.
- **Persistent run economy:** start with two tokens, earn two per successful wave, and retain purchased units, upgrade tiers and unspent tokens between waves and levels. Escapes count toward ten cumulative misses; defeat supports a fresh-run retry.
- **Preparation and manual wave starts:** purchase and upgrade defences, deploy/reposition them freely during preparation, return deployed units to inventory, and start the next wave when ready. A four-second settling period lets combat effects finish before preparation resumes.
- **Three campaign defence families:** twin-barrel Gun, Arc Spire and Missile launcher, each with Base, Upgrade I and Upgrade II models and distinct range, strength and firing behaviour. Families and later tiers unlock through Zone A.
- **Physical gun aiming:** independent yaw and barrel pitch, limited vertical aiming, recoil, burst/cooldown timing and instant-hit attacks against eligible ground or airborne enemies.
- **Electrical Arc attacks:** instant-hit strikes and burst timing. Upgrade I can chain once to one random eligible enemy within four tiles, dealing 20% of the current enhanced pulse strength; the transfer requires a clear physical path and cannot recurse.
- **Staged guided missiles:** separate loaded rounds, vertical launch, eased/randomised attitude rotation, brief acceleration/braking thruster pulses and a final powered intercept flight. Missiles commit to an intercept point; damage requires physical contact rather than a guaranteed target hit.
- **Missile obstruction handling:** predicted curved flight is checked against scenery before launch; live flights use swept collision. Misses continue to physical impact, while a destroyed target leaves a missile travelling toward its last known position.
- **Cooperative target selection:** defences consider threat, remaining route progress, health and other committed attacks. Bounded target commitment reduces dithering; actual incoming missile damage helps prevent unnecessary additional launches.
- **Geometry-aware line of sight:** scenery and other deployed defence units can block attacks; each firing unit excludes its own geometry. Eligibility is checked again at the actual shot.
- **Ten enemy species:** Dog, Roller, Moth, Walker, Dune Tread, Twin Fan, Tripod, Ray, Spider and Lantern, with zone-specific ground/air rosters, health, speed and scheduled arrivals.
- **Articulated mechanical animation:** walking legs and supported feet, rolling bodies, six-wheel Dune Treads, spinning fans, flapping wings and airborne banking. Health does not change ordinary route speed; nonlethal missile hits retain their bounded physical shove/brace and recovery.
- **Validated defence placement:** checks terrain, water, scenery, existing units and the moving enemies' height-specific route envelopes. A legal placement relocates obstructing critters safely rather than treating the animal itself as a permanent blocker.
- **Deployment information:** grouped defence roster, model portraits, selected-unit highlighting, current-range previews on roster hover/focus and next-tier range previews on the Upgrade control.
- **Wave intelligence and entrance markers:** upcoming species/counts and route information, plus entry badges and inward ground chevrons before the level's first wave. Entry markers disappear once the run begins.
- **Automatic cameras:** scenic title view, path-focused preparation overview with full-landscape fallback, and the default aerial Drone action camera during combat/settling. View changes are immediate; manual pan/zoom and camera selectors are disabled in the player UI.
- **Scene-aware Drone filming:** higher/farther viewpoints, varied safe openings, predictive encounter framing, continuous eased travel, survey drift, gimbal/zoom changes and fresh angles. Swept clearance avoids terrain, scenery, canopy and live actors; the camera is cosmetic and cannot affect combat.
- **Pause and run screens:** pause/resume with P, frozen simulation/camera footage, loading/error handling, defeat, campaign completion and retry/title flows.
- **Fixed level lighting progression:** each zone's four levels repeat day, late afternoon, early evening and night. Late-afternoon sunlight is brighter; conditions persist through the level's waves. Campaign weather is currently off.
- **Autonomous ground critters:** zone-specific hares, lizards and beetles choose reachable destinations, hop/scuttle around scenery and defence envelopes, avoid one another and reserve destinations. Spawn/relocation checks require connected usable roaming ground.
- **Autonomous birds:** supported tree/cactus perches, destination reservations, folded/flapping wings and clearance-tested take-off, flight and landing journeys. Wildlife can cross enemy paths.
- **Wildlife fright and escape:** nearby enemies and explosions trigger bounded fleeing behaviour, with safe ground routes or bird departures, followed by a return to normal activity.
- **Deep-pool fish:** articulated swimming fish inhabit suitable connected pools and scatter when nearby enemy debris actually lands in the same water body, then resume swimming.
- **Critter blast gibs:** ground animals, birds and fish within two tiles of enemy destruction or three tiles of missile impact break into outward-flying fragments and spray. Remains persist for the current wave, then fade; the next preparation safely respawns the animals. This awards no tokens and adds no misses.
- **Reactive combat/environment effects:** living-enemy damage smoke, enemy destruction flashes/debris, gun and Arc impact sparks, missile fireballs/smoke/pressure rings, and debris-driven water splashes/ripples with sinking fragments.
- **Live performance HUD:** rolling FPS, frame interval, synchronous CPU app time and asynchronously sampled GPU render time, with explicit unsupported/pending/paused states where appropriate.
- **Preview only — combat drones:** autonomous take-off, route-aware firing positions, twin-gun bursts, separate endurance/recharge/weapon timers and return/landing. Predictive avoidance accounts for scenery, terrain, defences, enemies, wildlife and other drones, with stable yielding at crossings and a level body steered by tilting fans.
- **Preview only — power generators:** base generators enhance attacking defences in edge-adjacent same-height boxes by 25%, applying the strongest bonus once. Active recipients receive animated green plasma connections. Generator upgrade models exist; upgraded activation rules are not part of the campaign.
- **Preview/developer controls:** shared model/combat/landscape studies, level switching, reset, slow motion, night/weather overrides and inspection diagnostics alongside the separate player game.

## Rendering techniques and features

- **Custom WebGPU renderer with WGSL shaders:** shared rendering infrastructure for the player game, previews and developer studies.
- **Grid-derived low-poly meshes:** exposed-surface generation and greedy rectangle merging per rigid model part, with per-face colour, emission and reflectiveness. Ordinary model surfaces retain a matte, sharply readable appearance.
- **GPU instancing and rigid-part animation:** shared geometry plus instance transforms for repeated scenery, articulated actors and solid debris; changed poses update existing transform buffers.
- **Camera depth-only prepass:** opaque geometry and active debris write depth without colour attachments before main opaque shading. Colour shading uses depth equality; static frames can reuse the existing depth result.
- **4× multisample anti-aliasing:** multisampled opaque colour, normals/material information and camera depth, with resolved colour/normal textures for screen-space effects.
- **Direct and ambient surface lighting:** a directional sky light, orientation-weighted ambient fill, emissive face accents and restrained material-controlled specular highlights, calculated in linear colour with final sRGB display conversion.
- **Filtered directional shadows:** a 2048² shadow map with a 3×3 tent filter and receiver-plane depth correction to reduce close-up shadow acne. Moving actors and solid debris participate.
- **Local point lights:** opt-in emissive model-face lights for panels/eyes and transient lights for muzzle flashes, explosions and missile thrust. These local lights are unshadowed and use bounded storage.
- **Continuous electrical/plasma lighting:** finite-polyline/tube lighting along Arc strikes and generator connections, rather than a light only at each endpoint.
- **Screen-space reflections (SSR):** bounded depth-ray marching for reflective surfaces and water, with screen-edge/distance fading and a sky fallback. Reflections use visible screen content rather than off-screen scene tracing.
- **Separate water depth and normals:** the nearest water surface is resolved independently of opaque terrain, preserving the submerged bed and correct foreground occlusion.
- **Translucent water optics:** view-dependent Fresnel reflection, IOR-based screen-space refraction, depth-dependent absorption/transmission and visible bed colour. Guards prevent sampling dry foreground banks into the water.
- **Procedural water motion:** animated ripple normals, spatially varying currents/calm patches, tint variation and sunlight glints, plus restrained low-sun ambient reflection. Water geometry remains flat; the movement is shader-driven.
- **Separate distant biome vistas:** low-poly terrain, groves and landmarks far below the floating battlefield, with parallax, biome-specific palettes, darker lighting and filtered blur. Their separate depth keeps distant scenery outside gameplay depth, shadows and collision queries.
- **Selective bloom:** reduced-resolution floating-point emission/effect extraction, separable horizontal/vertical blur and additive composition for eligible panels, eyes, electrical channels and combat effects, preserving crisp ordinary surfaces.
- **Pooled procedural particles:** instanced muzzle flashes, sparks, lightning channels, thrust jets, launch/final-flight smoke, layered missile fireballs and explosion rings, using depth-aware alpha/additive blending and water attenuation where applicable.
- **Lit solid debris and persistent remains:** instanced model-coloured fragments participate in opaque, depth and shadow passes. Gravity, swept collision, supported resting, water drag and matched ordered-coverage fading provide consistent flight and cleanup.
- **Debris/water impact rendering:** splash crowns, weighted droplets and paired expanding water-tinted rings, clipped to the relevant visible water surface. Submerged fragments lose momentum and sink.
- **Refractive explosion shockwaves:** temporary screen-space distortion of the composed scene, including water and existing effects, with opaque/water depth protecting foreground objects.
- **Optional zone weather rendering:** lit instanced rain, snow and autumn leaves, with wet-path reflection, snowy path treatment or leaf litter when enabled in previews. The campaign currently keeps weather disabled.
- **DOM/SVG game interface:** borderless adjoining panels, model-derived portraits, sharp text/icons, entrance overlays and projected range/highlight indicators, separate from scene post-processing.
- **Cached passes and bounded resources:** unchanged opaque/depth/shadow/vista results are reused; water/effects can animate independently. Effect pools, lazy GPU resources, reused buffers and explicit scene teardown limit unnecessary work and retained allocations.
- **Asynchronous GPU profiling:** optional timestamp queries cover the actual first-to-final production render-pass span, with bounded readbacks and no render-loop wait. CPU submission/app timings remain separately measured.

For detailed requirements and implementation limits, see the [design document](docs/design-doc.md), [rendering notes](docs/rendering.md), [engine notes](docs/engine.md) and [current TODO delivery](docs/water-regression-2026-10-20/README.md).
