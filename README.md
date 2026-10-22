# Defender project notes

Start with the shared **[design doc](project-docs/design-doc.md)** for the current game design, rules, environments, models, weapon data, approved artwork and open decisions. Every project agent must read it before working. With `bun run dev` running, [view the design doc in the browser](http://127.0.0.1:4173/docs/design-doc); edits to its Markdown source appear on refresh.

A tower defence game for desktop web browsers, built with WebGPU and no third-party dependencies. The world will use a grid and a simple voxel-like appearance made from axis-aligned quads. Engine performance and low allocation rates are primary priorities.

All four palettes in the [concept sheet](project-docs/concepts/colour-directions-v1.png) are approved as successive zones, in A → B → C → D order. The planned campaign has four levels per zone and four waves per level. The first playable slice has A1/A2, eight waves, base/upgrade1 guns and Dogs: start with 2 tokens, earn 2 after each successful wave, and lose at 10 cumulative misses. Owned guns and unspent tokens persist; redeploy on a new landscape. Balance is provisional and isolated in [play configuration](play/config.js).

## Play

Run `bun run dev`, then open [Defender](http://127.0.0.1:4173/play/). Buy or upgrade guns, deploy them on highlighted clear ground, and start each wave when ready. **P** pauses/resumes during combat. Retry starts a fresh run; reload returns to the title. [First playable scope and verification](project-docs/play-first-2026-10-19/README.md).

## Local authoring workshop

```sh
bun run dev
```

Open `http://127.0.0.1:4173/` in Codex's built-in Chrome. No installation or build step is needed. The model editor supports grid painting, face materials, upgrade variants, and rigid-part pivots. The level editor places saved models on 24-unit boxes. Both use versioned JSON and a WebGPU preview.

Run only affected checks with `bun test <test files>`; full suite runs are reserved for an explicit user request. `bun run compile` exports compiled meshes. Read [the tool and asset format guide](project-docs/tools.md) for controls, saving, and AI authoring. `/game/` retains development previews separately from the player loop.

## Start here

- [design doc](project-docs/design-doc.md) is the consolidated current reference and required reading; [browser edition](http://127.0.0.1:4173/docs/design-doc).
- [AI working instructions](AGENTS.md) preserve constraints and approval rules for future sessions.
- [Specialist team](project-docs/team/README.md) defines Artist, Tactician, Engineer and Researcher roles, their review process and current assignment.
- [Project brief](project-docs/project-brief.md) records requirements, unresolved decisions, and current status.
- [Development diary](project-docs/development-diary.md) records daily progress, decisions, checks and unfinished work, starting on 17 October 2026.
- [Terrain and rendering requirements](project-docs/rendering.md) records approved capabilities and the tentative indirect-lighting experiment.
- [Visual style brief](project-docs/visual-style.md) prepares the concept artwork discussion.
- [Refined turret models](project-docs/turret-model.md) documents the 24-unit variants, colour variation, rig, and interactive review page.
- [Arc Spire models](project-docs/arc-spire-model.md) documents the approved electric-defence family; [inspect all three](http://127.0.0.1:4173/tools/arc-spire-review.html) with day/night lighting and zone palettes.
- [Arc Spire test levels](project-docs/arc-spire-levels.md) compare all three upgrades in each zone. In the game preview, use Shift+1/2 or the bottom selector to change levels; ordinary 1–4 changes zones. Run bun run seed:arc-levels to create missing study sources.
- [Gun turret concept](project-docs/concepts/gun-turret-moss-porcelain-v1.png) shows the starting defence's base model and two upgrade proposals in Moss and Porcelain.
- [Selected enemy models](project-docs/enemy-models.md) documents B Walker and D Spider; [inspect the pair](http://127.0.0.1:4173/tools/enemy-review.html) through the local server.
- [Layout research](project-docs/research/tower-defence-layouts.md) provides references for Artist/Tactician after user feedback on the current layout feel.

Use Bun for local tooling and HTTP serving. Use only Codex's built-in Chrome for browser work; never launch an external browser.

Terrain editing is available in **Level studio → Terrain**. Horizontal blocks align to 24 × 24 boxes; ground and water heights use 1-unit steps. See [terrain authoring](project-docs/terrain.md).

## Zone previews

All sixteen landscapes use **20 × 16 boxes (480 × 384 units)**. A1–A4 and B1–B4 have accepted carved routes; C/D remain populated landscapes for future carving. A1 retains the accepted two-drone combat test; A2–A4 and B are layout/wildlife previews. See [the design doc](project-docs/design-doc.md), [A1 evidence](project-docs/a1-drone-test-2026-10-18/README.md) and [Zone B evidence](project-docs/zone-b-path-carving-2026-10-19/README.md).

`bun run check:previews` checks current sources; `bun run rebuild:previews` invokes the current preservation-aware builder. Rebuilding or legacy seed/generator commands write assets, so use them only for explicitly authorised authoring work. Preserve the [frozen pre-carving backup](project-docs/landscape-reset-2026-10-18/backup.md).

Earlier production generators and authoring maps remain historical fixtures; they do not replace the accepted active landscapes.

With Bun running, open [the zone preview](http://127.0.0.1:4173/game/). Use **1–4** or the on-screen zone buttons:

| Key | Zone | Preview |
| --- | --- | --- |
| 1 | Moss & Porcelain | The old waterway — woodland ruins and porcelain turrets. |
| 2 | Ochre & Petrol | The sunken aqueduct — sandstone terraces, cacti and porcelain turrets with petrol details. |
| 3 | Ice & Ember | The frostwater pass — snowy firs, darker stone paths and ivory/ember turrets. |
| 4 | Plum & Mint | The violet cloister — plum canopies, limestone paths and mint turrets. |

Each switch unloads scene geometry, assets, rigs and active effects before loading the new zone. Shared renderer resources stay allocated. Rapid changes cancel superseded loads. Night mode and preview time scale carry across; the camera resets to overview. Use Shift+1/2/3 to select a development level. These are twelve studies, not the complete 16-level campaign. Current images and their approval/status captions are in the design doc.

With Bun running, open [The old waterway](http://127.0.0.1:4173/game/). The Moss & Porcelain study includes wooded ruins, a stone route, box-aligned stream, small scattered props and two base turrets and a middle stage-2 burst turret, with depth prepass, shadows, instancing and initial SSR. In Zone A, turrets track nearby dogs with weighted rotation, then fire with upper-assembly recoil, white-hot muzzle flashes, local sparks and brief warm light on nearby surfaces. B tracks Walker and D tracks Spider; C retains the random firing study. The middle turret fires a three-shot burst; cooldown is one second after the last shot. Turret shots are instant-hit with no travelling projectile; validated hits now damage dogs; random miss rules remain unassigned. Drag to orbit, right/Shift drag or WASD to pan, scroll to zoom. **F toggles path view**: random path-box start, 80° FOV, WASD movement, drag to look, always 12 units above terrain. F again restores the overview; Frame level resets it. **N toggles day/night lighting**, keeping the sky light in place; the Night/Day button does the same. [Engine notes](project-docs/engine.md) describe implementation and limits. [Shot preview](project-docs/screenshots/moss-01-shot-effects.png). [Night preview](project-docs/screenshots/moss-01-night.png).

Zone A includes Dog/Roller/Moth, B Walker/Dune Tread/Twin Fan, C Tripod/Ray, and D Spider/Lantern. A/B retain three original actors plus two of each new type; C has two of each type; D has three Spiders and two Lanterns. [Models, provisional stats and mixed previews](project-docs/enemy-expansion.md). Walker uses larger strides at 18 units/second; Dog and Spider both move at 12 units/second; Spider now has four legs and 2.88-unit strides. Articulated hips, knees and paws keep the steps grounded as they follow the existing path. Their meshes are shared across instances, and they unload with the zone. Turret ranges are 48/72/96 units for base/upgrade 1/upgrade 2, with provisional base/upgrade-1 strengths of 10/12 (upgrade 2 remains inactive). The revised A placement gives all three turrets useful route intervals: early contact, repeat coverage and late catch. Both barrels require clear line-of-sight through scenery to the dog’s torso; an obstructed target is replaced by another visible dog within range. The original Dog/Walker/Spider each have 300 HP; the seven additional models use provisional health from 180 to 420 HP. Each disappears at zero; paired barrels deal one hit per pulse. **R resets the current enemies** to full health and their starting positions for another test, clearing old damage effects without reloading the zone. Below half health dogs emit damage smoke; death produces a lingering compact lit explosion, an expanding refractive shockwave and spinning model-coloured cubes that land on scenery, settle for 1.5 seconds and vanish. [Effect settings and checks](project-docs/damage-effects.md). [Combat notes](project-docs/combat.md). [Targeting notes](project-docs/defence-targeting.md). [Dog model notes](project-docs/dog-model.md).

Each zone also has three cosmetic ground critters and three birds, with autonomous destinations and one scheduled wildlife decision per frame. Ground animals can cross paths and flee nearby living enemies or explosions; birds relocate between supported trees. Small turret identity panels glow and illuminate nearby surfaces. [Wildlife behaviour](project-docs/wildlife.md), [model lighting](project-docs/engine.md#emissive-turret-accent-lights).

Weather rendering and its controls have been removed. The engine batches instance uploads, caches stride contacts and refreshes only the render passes affected by a change. [Maintenance notes](project-docs/engine-maintenance.md).

The engine runs from a shared `requestAnimationFrame` loop with delta seconds. Water now has translucency, visible bed geometry, refraction and animated ripple glints. All player defences sit at enemy path height; scenery may still use mounds.

## Static deployment

Run `bun run deploy:local` to clear and rebuild `docs/` for GitHub Pages. The game entry is `docs/index.html`; `docs/site/` holds its runtime files and assets. Project documentation lives in `project-docs/` and packaging metadata in `build/deployment/`, outside the published directory. Deployments retain the bottom-bar FPS/frame/CPU/GPU readout. Deployment does not run tests or browser checks, or commit, push or publish.
