# Defender Workshop tools and asset format

**Planned player entry, 19 October:** `/play/` is proposed for the player-facing title and game loop; `/game/` stays the accepted development preview. The [first development plan](plans/first-playable-game-2026-10-19.md) awaits user sign-off. `/play/` is not implemented yet, and this planning update changes no server route or tool.

Defender Workshop is a local model and level editor built with browser APIs, WebGPU, and Bun. It has no third-party dependencies. These tools author assets; they do not implement combat, enemy behaviour, token economies, audio, or the game's effects stack.

## Living design documentation

Open [design doc](/docs/design-doc) from the workshop navigation. Its editable authority is [docs/design-doc.md](design-doc.md), required reading for every agent. Save changes to that file and refresh the browser; no compilation or duplicated HTML content is needed. The reader supplies section navigation, approved concept/production imagery, links to detailed notes, a Markdown-source link and print styling.

`server/docs.js` uses Bun's native Markdown renderer and `HTMLRewriter`, with no client JavaScript or third-party dependencies. Linked Markdown notes under `/docs/` use the same reader; `?raw=1` returns their source. Only explicit README/AGENTS root documents are exposed. Relative model/level JSON references map to the existing read-only asset API. Path confinement, extension restrictions and escaped raw HTML protect the local viewer; it does not enable a new authoring API. Reader checks are in `tests/docs.test.js`; isolated HTTP checks are in `tests/server.test.js`.

## Combat camera comparison (21 October)

`/tools/combat-camera-review.html` reconstructs frozen production A2 combat at two camera angles and a recorded, naturally achieved A1 lower shot. It uses PlayEngine and WorldRenderer, has no continuous animation loop, disposes the outgoing scene on case changes and leaves the player session alone. The exact recipe, native behavior, GPU captures and limitations are in [the delivery](combat-camera-follow-up-2026-10-21/README.md). This tool is development-only; it adds no production control or query override.

## Run the workshop

From the project directory:

```sh
bun run dev
```

Open `http://127.0.0.1:4173/` in Codex's built-in Chrome. The server binds to loopback only. Set `PORT` to choose another port. There is no install or build step.

```sh
bun test tests/terrain.test.js # Example: choose files affected by your change
bun run compile
```

Only run tests that may be affected by the change. The user will request full runs when needed.

Server tests include an isolated local HTTP server and need permission to listen on loopback. Compilation writes derived meshes under `build/models/`. `bun run compile -- path/to/model.json` compiles a specific source. `bun run seed` creates missing study assets and never overwrites existing files.

## Rebuilding current level previews

`bun run rebuild:previews` writes the current authorised sources: the A1 drone combat test within approved Southern Hook, approved A2–A4 layouts, the four selected B layouts, and the eight C/D populated landscapes, all20×16 boxes (480×384units). `bun run seed:previews` creates missing sources and refuses mismatched existing files; `bun run check:previews` verifies actual sources against their current factories and model geometry without writing. The single-level command is `bun scripts/current-preview-levels.js --level moss-01 --write`. These commands never regenerate models or write the frozen backup.

`bun run check:landscapes` separately validates the original landscape snapshots and geometry, using `--snapshots-only` because A1–A4 and B1–B4 active sources now intentionally differ. Do not use the old fixed-landscape builder's `--write` to update current production previews: it would erase an authorised carve. The [accepted backup](landscape-reset-2026-10-18/backup.md) remains the rollback authority. Read [A1's review record](a1-path-carving-2026-10-18/README.md) and [baseline authoring details](landscape-reset-2026-10-18/ARTIST.md).

The eight C/D sources declare `previewMode: "landscape"`, `path: []`, no `routes` or `actorRoutes`, and scenery placements only. A2/A3/A4 and B1–B4 declare `previewMode: "layout"` with supported routes; A2/A3/B2 also declare explicit `bridges`, and A3/B3 declare a second complete route merging into the primary tail. Both modes forbid defence/enemy placements and runtime combat actors; source-aware factories decide actors after validating the fetched source. Catalogue IDs must not implicitly restore historical enemies or missiles. Both retain authored cosmetic wildlife and skip combat/effect update work. Layout enables F path view; path-free landscape disables it. R has no enemy work in either mode. The common predicate is `shared/preview-mode.js`.

A1 explicitly declares `previewMode: "combat"` and `previewActors` records containing unique`id`, approved`modelId`, base`variant`, valid`routeId` and finite`startDistance` within that complete route. This bounded test contains two base drone placements, two Dogs and one Moth; the saved source controls loading and never falls back to the historical mixed roster. Layout/landscape sources reject explicit combat rosters. Legacy ID-only study calls retain their old rosters. [A1 test record](a1-drone-test-2026-10-18/README.md).

`previewWildlife` contains three `habitats` boxes, three exact world-coordinate `habitatPoints`, and three supported scenery perches. The shared production footprint is `shared/level-footprint.js`; generic editor/test scenes retain their own sizes. Carving may revise wildlife seeds only where needed to retain safe support; do not remove cosmetic life or change movement rules as a side effect.

The [A1 layout comparison](/tools/a1-layout-review.html) renders the accepted baseline, the three considered route alternatives and the approved Southern Hook layout without combat units. It is a read-only authoring review, not player placement UI or fixed build pads. The saved maps identify alternative useful ground; they do not establish that every adjacent candidate can hold a rotating defence simultaneously.

The [A2 bridge comparison](/tools/a2-layout-review.html?view=garden-crossing) provides baseline, three options and current-source views, with a Bridge detail button. [Bridge source/geometry contract](bridges.md). Bridge-bearing routes and path height are edited together in source JSON; workshop route painting/undo/clear/height controls are disabled to protect water and bank support.

The [A3 comparison](/tools/a3-layout-review.html?view=garden-confluence) shows the untouched landscape, single-route alternative, selected merging proposal and current source. [A3 authoring and evidence](a3-path-carving-2026-10-18/README.md). It uses existing route/bridge support without restoring the historical missile roster.

The [A4 comparison](/tools/a4-layout-review.html?view=ruin-and-mere-tour) retains the accepted landscape, two considered routes and the user-approved Ruin and Mere Tour. [A4 evidence](a4-path-carving-2026-10-18/README.md).

The [Zone B comparison](/tools/b-layout-review.html) shows the original landscapes, two considered options per level and current B1–B4 sources in the production renderer. It includes day/night, framing and bridge detail with scene cleanup between views. These are read-only authoring alternatives, not player build pads or gameplay UI. [Zone B evidence](zone-b-path-carving-2026-10-19/README.md).

The older `first-level`, `production-level`, Arc-level, missile-level and `rebuild-level-layouts` factory modules remain historical fixture helpers. Their explicit write CLIs produce superseded carved layouts; use the current rebuild command for production previews. Combat review tools explicitly load the archived sources through `tools/archived-preview-world.js`; main game previews always use active sources.

The [archived landscape comparison](/tools/landscape-review.html) selects the previous sixteen originals and their matching archived carved layouts through the production renderer. It does not compare old landscapes to the current reset. The game accepts `?level=moss-03` (and other catalogue IDs); ready scene changes update this link so refresh retains the selected level. `?inspect` still opts into diagnostics. Path view and enemy reset are unavailable in current path-free landscapes.

## Model studio

Select a variant, rigid part, material and horizontal Y slice. Paint the 24 × 24 grid to add or recolour cells. Erase removes cells from the selected part only; Pick selects a cell's material and owning part. Other parts appear muted in the slice view. Fill, Clear and Copy from below act on the selected part. Width and length remain 24 units; the height field permits taller models.

Use Whole cell to apply a default material to all faces, or choose one of six face directions for an override. Painting a whole cell removes its previous face overrides. Material edits affect every face referencing that material. Add another material when a surface needs independent properties.

The source format contains Base, Upgrade 1 and Upgrade 2 slots. Enemy models may leave upgrade slots empty; the three required model variants apply to the player’s arsenal. Model Role now includes Enemy alongside Defence and Scenery. Copy into replaces the chosen target variant, with Undo available. Add rigid parts and assign parents and pivots. Pose sliders rotate a selected part and its descendants for inspection. Preview angles are temporary and are not saved into source meshes.

The included twin-barrel turret is now a [refined 24-unit family](turret-model.md) based on the approved concept. It demonstrates three distinct variants, authored colour variation and rotating heads. The earlier blockout is archived.

## Level studio

Place saved models by box coordinates, variant and quarter-turn. The plan supports painting, selecting, moving, and erasing placements. Models follow the ground height by default; Extra Y boxes adds 24-unit offsets. Selected placements can use an absolute box layer instead. A model's full height is considered when checking terrain, water and other placements.

For a single-route level, path mode appends edge-connected boxes whose ground matches the common path height and is dry. Terrain brushes protect these boxes; Flat path height moves the whole route surface together. Undo step and Clear path remove route markers without changing their ground. This metadata does not establish combat or tower-placement rules.

Merged-route levels expose a route selector that highlights each complete authored approach. Their path geometry is currently edited in source JSON; path painting, undo-step and clear-path are disabled for these levels. Terrain protection and paving cover the deduplicated union of all approaches. Single-route painting remains unchanged.

Choose Terrain in the plan to raise/lower ground by one unit per stroke, set a ground height, set water depth, drain water, or inspect a box. Horizontal regions always follow the 24 × 24 box grid. Default ground height is 24; ground 4 plus water depth 8 gives a water surface at Y=12. See [terrain authoring](terrain.md) for exact controls, format, migration and mesh details. The terrain study demonstrates a stream and scenery mounds; all turrets now stand at the flat route height.

The **Weather** section has an **Enable weather for this level** checkbox. Zone A selects rain; it also makes the game preview’s path reflective. Save and reload `/game/` to apply it; the workshop viewport keeps its simple shading. Zone C selects a snowstorm with settled snow along path edges. The game preview’s Weather On/Off button temporarily switches particles and their path treatment without saving; reloading or switching zones restores the authored setting. Zone D selects gently falling purple/rust leaves with matching path-edge litter. B stays clear by request and its control remains disabled. Changing to an unassigned zone disables weather. Saved level-v4 data uses `environment.weather: {"enabled": true}` or `false`; old `"clear"` and missing settings stay disabled. Enabling an older draft without environment data creates the existing default daylight settings. See [weather notes](weather.md).

Select a zone to preview its palette. `shared/zone-style.js` supplies matching colours for all 17 turret material slots, including highlights, shadows and face overrides, in both the workshop and game preview. Other palette-driven models use the first five roles (body, mechanism, secondary, stone, accent), with extra colours retained. Scenery marked `colorMode: "authored"` retains its complete authored palette. Primary colours remain guidelines, not a fixed limit. Recolouring shares immutable geometry and preserves emission and reflectiveness without mutating source assets. The included layout study demonstrates the three turret variants and a path guide; it is not a campaign level.

Drag the 3D viewport to orbit, Shift/right-drag to pan, and scroll to zoom. Frame recentres the view. Shift/right-drag the placement plan to pan and scroll to zoom; Fit plan resets it. These are editor camera controls, not a decision about the game camera.

## Saving and recovery

Save to library writes human-readable JSON to `assets/models/<id>.json` or `assets/levels/<id>.json`. File IDs use lowercase letters, digits, and hyphens and begin with a letter. Changing an ID saves a new file; existing files are not silently replaced. Save validation uses the same modules as the UI and compiler.

The server validates revisions before writing and uses an atomic rename. A stale save returns a conflict instead of overwriting external changes. Reload the saved asset or use a new ID to resolve it. Model updates are also checked against saved layouts that reference them. Imported files start as drafts; use a new ID when importing a copy of an existing asset.

Unsaved browser drafts recover through local storage. Disk files remain authoritative for saved documents. Undo history is bounded to 40 edits or 16 MiB per document and is not persisted across reloads. Browser storage is a recovery aid; save important work to the library.

Export JSON downloads source data. Export mesh downloads all three compiled model variants. Level JSON references model IDs, so distribute its model source files alongside it. Import accepts source model or level JSON, not a compiled mesh. No network services or cloud storage are used.

## Coordinates and model source

Schema `defender.model`, version `3`, uses a right-handed coordinate system: X width, Y up, Z length. One cell occupies `[x,x+1] × [y,y+1] × [z,z+1]`. Coordinates are integers in bind pose; pivot coordinates may be fractional. Model origin is the minimum corner of its placement box.

```json
{
  "schema": "defender.model",
  "version": 3,
  "id": "example",
  "name": "Example",
  "size": [24, 36, 24],
  "materials": [
    {"name": "Porcelain", "color": "#F1E8D5", "emission": 0, "reflectiveness": 0}
  ],
  "variants": {
    "base": {"parts": [
      {"id": "body", "name": "Body", "parent": null, "pivot": [12, 0, 12], "voxels": [[7, 0, 7, 0]]}
    ]},
    "upgrade1": {"parts": [
      {"id": "body", "name": "Body", "parent": null, "pivot": [12, 0, 12], "voxels": []}
    ]},
    "upgrade2": {"parts": [
      {"id": "body", "name": "Body", "parent": null, "pivot": [12, 0, 12], "voxels": []}
    ]}
  }
}
```

Each voxel is `[x, y, z, materialIndex]`, optionally followed by six face material overrides: `[x,y,z,materialIndex,[plusX,minusX,plusY,minusY,plusZ,minusZ]]`. An override of `-1` inherits the cell material. One grid cell can belong to only one part in a variant. Sparse cell lists make authored geometry explicit; saves sort cells by Y, Z, then X for stable diffs.

Materials store RGB hex colour in sRGB, **emission from 0 to 1**, **reflectiveness from 0 to 1**, and optional boolean **`castsLight`**. An absent flag means false; emission alone does not opt a surface into model-driven lighting. Face overrides select complete materials, including this flag. The flag can be authored in source JSON and is preserved by workshop material edits; a dedicated checkbox is not present. Emission is the stored field for the requested surface luminance control; it is a normalised artistic value, not a physical luminance unit. The preview displays simple face shading plus emission, or a grayscale inspection of either property. The workshop does not simulate model-driven surrounding light or reflections.

All part cells and pivots use the same model bind coordinates. A part's transform is its parent's transform multiplied by `T(pivot) × Rz × Ry × Rx × T(-pivot)`. The root parent is `null`; parent cycles are rejected. This is rigid articulation, not weighted skinning. The authored width and length limit applies to the bind pose; check motion clearance when designing rigs.

## Level source

Schema `defender.level`, version `4`, stores `id`, `name`, `zone` (A–D), `size: [widthInBoxes, lengthInBoxes]`, `waves: 5`, `placements`, `path`, `pathHeight`, and sparse `terrain`.

The optional additive fields `routes: [{id, path}]` and `actorRoutes: {actorId: routeId}` support fixed merging approaches without a format-version migration. `path` is the complete primary route with the reserved ID `main`. Each extra `path` is another complete entry-to-exit chain, sharing one identical directed suffix with the others. Chains are nonrepeating, edge-connected, flat and dry; crossings, reverse travel and splitting after a merge are rejected. Each actor keeps its assigned route throughout movement, reset and targeting. Missing assignments use `main`. The source limits of 16 complete routes and 16,384 total points are validation safety bounds, not gameplay budgets.

Development levels may also store `previewWildlife: {habitats: [[x,z], ...], perches: [{id,point:[x,y,z]}, ...]}`: three ground spawn seeds and three supported bird perches. These use existing cosmetic species and do not confine their subsequent movement. Rebuild audits validate retained perch support and spawn clearance.


```json
{
  "schema": "defender.level",
  "version": 4,
  "id": "example-level",
  "name": "Example level",
  "zone": "A",
  "size": [12, 8],
  "waves": 5,
  "placements": [
    {"id": "p1", "model": "example", "variant": "base", "box": [2, 0, 3], "turn": 0}
  ],
  "pathHeight": 24,
  "terrain": {"defaultHeight": 24, "boxes": []},
  "path": [[0, 0, 0], [1, 0, 0]]
}
```

X and Z box coordinates are multiplied by 24. Placement Y is the ground height plus `box[1] * 24`, unless `anchor: "absolute"` is set; then it is `box[1] * 24`. Path Y is stored as 0, with its common absolute elevation in `pathHeight`. Quarter-turns are around the box centre; `turn: 1` maps a cell `(x,z)` to `(23-z,x)`. References resolve to the saved model library. Duplicate placements and actual bind-pose voxel overlap are rejected. Paths are ordered box coordinates. Enemy wave compositions and token amounts are deliberately absent because their rules are undecided.

## Box scale and legacy files

`shared/grid.js` defines the final **24-unit** box size. New models start with a 24 × 24 × 24 authoring volume and may extend upwards. Models and compiled meshes use version 3. Levels use version 4, adding terrain and explicit path height; version 3 levels migrate as described in the [terrain notes](terrain.md). Version 1 used 15-unit boxes; version 2 used 32-unit boxes.

Library loading, source import, browser draft recovery, and command-line compilation recognise legacy source. Conversion preserves model cells, materials, height and pivots when all occupied X/Z coordinates and pivots fit the 24-unit footprint. Oversized legacy models are rejected with a refit message; they are never automatically cropped or resampled. Keep an original copy when deliberately refitting a model. The current turret family has been refitted explicitly, with its approved 32-unit source and generator archived.

Level box coordinates, quarter-turns and route order stay the same; their world spacing is now 24 units. Revalidate dependent layouts, particularly vertical stacks, after refitting. Reading a compatible legacy file converts it in memory; saving writes the current format version under the original revision check. Regenerate compiled meshes from source. For an oversized older browser draft, export it from its original editor session before reloading; the current importer cannot automatically refit it.

## Planned support for approved rendering requirements

The [rendering brief](rendering.md) requires a default one-box (24-unit) ground layer, carving and mounds, fixed per-level time of day and weather, sky lights, and a flag for emissive faces that cast light. Terrain, mounds and water editing are implemented in level version 4. The first level now has optional fixed time, a per-level weather switch and sky-light metadata, described in [engine notes](engine.md). The source/mesher now preserve the opt-in `castsLight` flag; runtime model-light status is documented separately in the engine notes. Zone C snowstorms and Zone D autumn leaves share the weather author switch. Paths are deliberately flat. The preview remains an authoring renderer, with instancing but without the approved game effects.

## Mesh compilation and z fighting

`shared/mesher.js` builds occupancy per rigid part, removes faces between adjacent cells in that part, and greedily merges exposed coplanar faces sharing one material index. It emits one quad per merged rectangle, triangulated with outward winding. There are no duplicate cells, zero-area rectangles, or overlapping same-facing surfaces generated by the mesher. A solid cuboid compiles to six quads regardless of its cell count.

Contacts between independently moving parts retain both opposing faces: deleting them would create holes when those parts move. Their opposite windings and back-face culling avoid drawing coincident opposing faces in the bind pose. Do not add decorative coplanar overlay meshes to model surfaces. Use face materials or actual geometry instead. The editor grid has a small display-only offset and is never exported as model geometry.

Greedy rectangles may meet at T-junctions. The shared integer coordinates align in the current renderer; this is a render mesh, not a guaranteed watertight manufacturing mesh. Arbitrary posed intersections are not detected automatically and may still produce artifacts. Inspect the intended rotation range and keep moving geometry clear; do not use depth bias to hide a modelling error.

Compiled schema `defender.mesh`, version `3`, contains all variants, part IDs, parents, pivots, and GPU-oriented buffers. Each vertex has 11 float components: position XYZ, normal XYZ, linear RGB, emission, reflectiveness. Indices are unsigned 32-bit. `quadMaterials` stores the source material index for each consecutive group of four vertices, preserving exact palette identity for zone recolouring. Materials retain optional `castsLight`; each part additionally has optional `lightQuads` indices for exposed quads with a true flag and positive emission. Unflagged meshes omit that field. Source JSON is the canonical editable format; compiled files are disposable outputs. The browser uses `Float32Array` and `Uint32Array` without any external loader.

## Performance and current limits

The preview renders on demand. Camera movement and pose changes reuse geometry; repeated level placements share GPU vertex/index buffers and use instanced draws per part. Camera matrices and uniform storage are reused. Unused GPU meshes and resized render targets are destroyed. This is an authoring renderer; runtime simulation pools and game-specific visibility systems remain future engine work.

Current authoring guardrails are 256 units of model height, 64 parts per variant, 32 materials, levels up to 128 × 128 boxes, Y layers 0–255, and 8 MiB source uploads. These are tool safety limits, not approved game content budgets. Model height can exceed one 24-unit box. The first editor supports one ordered, flat path guide; more complex route editing can be added when game rules are chosen.

Validation coverage includes surface coverage against a separate voxel-neighbour oracle, triangle winding, hidden-face removal, face materials, rig pivots, world placement, duplicate and tall-model overlap, missing references, source round trips, stale saves, and dependent layout protection. Browser checks cover painting/filling, material saving and reload, articulation, model placement, zone palettes, paths, and undo/redo.

The terrain milestone was verified in Codex's built-in Chrome on 17 October 2026 with 32 tests passing, including terrain validation, meshing and persistence. See the [terrain editor preview](screenshots/terrain-editor-24.png). Model format remains version 3; level format is version 4. Browser checks confirm the 24-unit model footprint, centred pivots, version 3 display, 24-unit level spacing, and the refitted turret family with rotating upper assemblies. See the [current comparison](screenshots/turret-refined-24.png) and [turret model notes](turret-model.md) for measured geometry counts. Both example assets are valid. The [turret review page](http://127.0.0.1:4173/tools/turret-review.html) compares the actual models and provides independent yaw, barrel pitch and recoil inspection using the production rigid-part transforms. Pitch/recoil slider limits come from the shared weapon settings, and part/quad counts come from the loaded sources. The preview frames the full scene in the available viewport, including narrow editor panels.

Historical previews are retained for reference: [32-unit model studio](screenshots/model-studio-32.png), [32-unit level studio](screenshots/level-studio-32.png), [original 15-unit model studio](screenshots/model-studio.png), and [original 15-unit level studio](screenshots/level-studio.png). These show earlier assets and format versions, not the final scale.

Implementation references: [WebGPU specification](https://www.w3.org/TR/webgpu/) for GPU coordinate and rendering conventions, and [Bun HTTP server documentation](https://bun.sh/docs/runtime/http/server) for local serving.

## Zone previews and scattered props

Latest production rebuild: the four preview sources now use distinct 16 × 16 layouts from `scripts/production-layouts.js` and `scripts/production-level.js`. `scripts/production-scenery.js` supplies 43 clean authored scenery models, retaining the old 35 IDs plus eight silhouette variants. `bun run rebuild:previews` explicitly overwrites these four level sources and scenery sources/compiled outputs; ordinary seed commands remain create-missing-only. Reserved clear ground stays in authoring data and does not establish a gameplay placement rule. [Current layout/source counts](production-levels.md), [model catalogue](production-art.md), [authoring maps](maps/production-a.svg). Counts and screenshots in earlier milestone descriptions below are historical.

Open **Level preview** from the workshop header to view `/game/`. Keys **1–4** select A–D with real scene unloading/loading. Level studio can edit **The old waterway**, **The sunken aqueduct**, **The frostwater pass**, and **The violet cloister**. Their saved IDs are `moss-01`, `ochre-01`, `ice-01`, and `plum-01`. Saving and revisiting a zone loads its edited source; no inactive world cache is retained. The fixed time-of-day field affects runtime daylight; N is a temporary preview override. `bun run seed:zones` creates missing B/C/D JSON sources only; it never overwrites authored edits.

Choose **Small detail prop** in Place a model to snap smaller models to individual units around the clicked position. Multiple details may occupy the same box when their actual cells do not overlap. In Selected placement, use the placement dropdown to choose any instance, including details sharing a box; edit Offset X/Y/Z in whole units. Source uses `kind: "detail"`, `offset: [x,y,z]` in world axes, each -23…23. The Y offset adds to ground/absolute anchoring. Detail props must remain clear of the route, ground and water; normal box placements are unchanged. These are solid models, not texture decals or overlapping face layers.

Scenery with `colorMode: "authored"` keeps all its material colours in zone previews. Scenery assets only use their base variant; empty upgrade slots retain format compatibility. The arsenal still requires all three variants. The first level has ten reusable scenery/detail models and 109 placements, including two base turrets and a middle stage-2 (`upgrade1`) burst turret with random aiming/firing/recoil in the game preview. The workshop studies and turret review retain all three variants. Firing rules live separately in `shared/arsenal.js`; no model/level schema change is needed. Engine details and verification: [engine notes](engine.md). B/C/D add 25 scenery sources and three layouts, with 122/122/121 placements respectively. All four previews use the same turret family. The zone-preview milestone had 80 passing tests and 36 compiled sources. The subsequent [dog model](dog-model.md) adds an authored enemy source and thirteen-part rig; it appears on the route through runtime actor data rather than static level placements.

## Timing, water and defence elevation update

The engine now uses a continuous shared requestAnimationFrame clock and delta seconds; the workshop's static preview still renders on demand. The engine water material is saved as optional level-v4 `waterMaterial` metadata. Its translucency, refraction and procedural ripples are visible in `/game/`; the workshop continues to show the authored water volume simply. Exact fields and bounds are documented in [engine notes](engine.md).

Choose **Player defence** in the model's Role field for every arsenal model. This stores `role: "defence"`, also retained in compiled models. Shared layout/server/runtime validation requires its base and supporting ground to equal the enemy path height. Extra vertical offsets or raised/sunken/floating defence placements are rejected. Scenery remains free to occupy varied terrain. The turret source and both level studies now obey this latest rule. A path-height change must keep defence ground/base heights consistent in the same authored document; validation will reject an intermediate inconsistent edit.


## Arc Spire model review

The newer [Arc Spire model review](http://127.0.0.1:4173/tools/arc-spire-review.html) shows its base and two upgrades with the production renderer's local panel lighting and bloom on a neutral floor. Choose all/individual models, A–D palette, day/night, orbit/pan/zoom or reset. This isolated in-memory view does not add a saved game level. `bun run seed:arc-spire` creates a missing source; `bun scripts/arc-spire.js --write` explicitly rebuilds it, and `bun scripts/compile.js assets/models/arc-spire.json` compiles just that model. [Geometry, checks and approval gate](arc-spire-model.md).

## Walker and Spider model review

The user-approved B/D enemies are saved as `assets/models/walker.json` and `assets/models/spider.json`. `bun run seed:enemies` creates missing sources without overwriting authored files; `bun scripts/compile.js assets/models/walker.json assets/models/spider.json` compiles just this pair. The [model review](http://127.0.0.1:4173/tools/enemy-review.html?model=spider) uses the existing workshop renderer with the production articulated gait. Select either model or both, Walk/Bind pose, pause, step 1/60 second, or use half/quarter-speed playback. Bodies remain centred while sampling straight-path contacts; this view does not show route turns. Orbit, front/side/top views and 24-unit footprint outlines remain available. One shared FrameLoop drives playback and camera redraws, reusing part meshes and instance buffers; paused views render on demand and hidden views stop the clock. Both models remain editable in Model studio. [Rig contracts and approval record](enemy-models.md). These library assets do not add new actors to the game levels.

## Multiple development levels

The game preview now offers two levels per zone. Shift+1/2 and buttons above the interaction bar select levels; ordinary 1–4 switches zones while retaining the level number. The second sources are moss-02, ochre-02, ice-02 and plum-02, editable in Level studio like the first sources. They are paired Arc Spire model studies with unchanged environments and static spires. The new seed:arc-levels command creates missing sources only; the generator's --write flag explicitly rebuilds them. [Sources, controls and checks](arc-spire-levels.md).

## Healthy enemy lighting snapshots

The [enemy and damage review](http://127.0.0.1:4173/tools/damage-review.html?level=plum-01&mode=healthy&night) now includes **Healthy model**, showing one living Dog/Walker/Spider with no damage effects in its real level. Use day/night and orbit/zoom to inspect eye emission, bloom and local spill. This is a fixed production pose; the separate model review supplies walking playback and slow motion. No source or game level is changed by these inspection modes.


## Missile launcher review

The [loaded model review](http://127.0.0.1:4173/tools/missile-launcher-review.html) displays the base and both upgrades with their 2/4/6 separate missiles. Use all/individual views, A–D palettes, day/night, orbit/pan/zoom and reset. It is an isolated production-renderer scene, with no saved level or flight simulation. [Model geometry and shared sockets](missile-launcher-model.md).

`bun run seed:missile-launcher` creates missing model sources; `bun run seed:missile-levels` creates missing level-3 studies. Explicit `--write` on the generator scripts regenerates their own sources. Compile the two models with `bun scripts/compile.js assets/models/missile-launcher.json assets/models/guided-missile.json`. In the game, **Shift+3** selects the third level in the current zone; **1–4** changes zones while retaining the selected level number. Level buttons remain above the interaction instructions.

The [missile flight review](http://127.0.0.1:4173/tools/missile-review.html) freezes actual boost, coast and homing poses from A3/B3/D3 using the production controller and renderer. Choose a launcher, day/night and snapshot age (up to four seconds), or use 250/700/1200 ms phase buttons. Engine cutoff freezes the actual latched terminal coast, with speed/flame/light diagnostics. Launch smoke, Enemy impact and Miss → ground buttons also freeze the production effects. Enemy impact applies one real hit; the miss demonstration moves the enemy after commitment and continues the flight to actual surface contact. These review scenes do not save changes. URL `mode` accepts `terminal`, `launch-smoke`, `enemy-impact` or `ground-impact`. [Flight limits and checks](missile-combat.md).

The [enemy impact review](http://127.0.0.1:4173/tools/enemy-impact-review.html) uses the actual Dog, Walker and Spider controllers in their existing levels. Before/peak/recovery/settled snapshots and 1×/¼× replay show one directional missile hit; the unhit comparison uses the same route time. It supports a start-distance field, day/night and explicit position/rig diagnostics. It adds no game controls, saved changes or impact effects. [Response contract](enemy-impact.md).

## Game preview slow motion

Press **T** or use the bottom **Time: 1× / Time: 0.1×** button to toggle the entire live game simulation. Enemies, wildlife, weapons/reloads, missiles, effects, water/weather and held-key camera movement use one scaled delta and elapsed clock. The setting survives R and zone/level selection, but page reload restores normal speed. It does not edit saved levels or change the isolated review tools' existing playback controls. The `?inspect` canvas exposes `data-clock` with timeScale, unscaledDeltaSeconds, deltaSeconds and elapsedSeconds.

## Power generator model review

The [power generator review](http://127.0.0.1:4173/tools/power-generator-review.html) compares the base and both upgrades using the production renderer on a neutral floor. Inspect all or one model, orbit/pan/zoom, switch A–D casing palettes and day/night, or reset the view. Green enhancer identity highlights stay green in every palette. Cards also display the shared strength/fire-rate/cooldown data. This is an isolated in-memory inspection fixture; it does not write a level or enable enhancement gameplay. The user approved all three models on18 October.

`bun run seed:power-generator` creates the missing source; `bun scripts/power-generator.js --write` explicitly rebuilds it. `bun run compile -- assets/models/power-generator.json` compiles only this family. Source geometry and checks are documented in [generator model notes](power-generator-model.md).

## Power-generator plasma review

The [power-link review](http://127.0.0.1:4173/tools/power-link-review.html) loads the actual A1 generator and adjacent turret, using production enhancement, fixed-face anchors, plasma rendering and lighting. Choose close/overview, day/night (also N), Link on/off, Play/Pause or a 0–4-second snapshot. Orbit/pan/zoom remain available. Link off provides a lighting comparison without altering the 25% enhancement. This inspection view loads no enemy roster and does not run weapon attacks or save changes.

One FrameLoop drives motion and camera redraws; paused views stop when no camera interaction needs a frame, and hidden views stop the clock. Diagnostics expose endpoints, effective strengths, link/span/light counts, overflow and resource bytes. Scene/page teardown releases the effect and loaded world. Initial production captures and current smaller/faster wave settings are recorded in [engine notes](engine.md#generator-plasma-connections-18-october); the [plasma GPU harness](http://127.0.0.1:4173/tools/plasma-check.html) runs the 44 production checks.


## Landscape-first A4 comparison

The [landscape review](http://127.0.0.1:4173/tools/landscape-review.html) compares Artist’s frozen path-free landscape with the saved A4 carve using the production renderer. Before/After, orbit/pan/zoom, Frame and Night are inspection controls; no enemies run and no source is saved. The initialisation-gated stage buttons use the shared scene lifecycle, releasing previous CPU/GPU geometry before replacements. Inspection is capped at 10 Hz.

**Historical A4 trial commands:** `bun run seed:zone-a-four` creates a missing A4 only; `bun scripts/zone-a-four.js --write` explicitly regenerates that one level from its frozen landscape. `bun scripts/zone-a-four-landscape.js --check` verifies the baseline. `bun scripts/verify-zone-a-four-visibility.js --write` records full-ground overview visibility. The [layout notes](zone-a-four-layout.md) contain targeted checks and coverage limitations. The later all-zone rebuild supersedes this trial generator for current sources: use `bun run rebuild:previews`. Shift+4 now selects level 4 in every zone, and zone switching retains the selected level number. Weather defaults off.

## Drone defence review

The [drone model review](/tools/drone-review.html) displays all three stages or one at a time, in A–D palettes with day/night lighting. Pad-hover and flight inspection separate the fixed recharge pad from the legless aircraft. Fans spin automatically in both poses; animated flight shows collective fan tilt for travel and differential tilt for yaw, with a level body. Manual yaw/pitch inspect the independent gun rig. Orbit/pan/zoom remain available. These illustrative model-review poses are separate from A1's production flight/combat controller and do not edit level placements.

`bun run seed:drone` creates the missing canonical source without overwriting it; `bun scripts/drone-defence.js --write` explicitly rebuilds only this family. Compile with `bun scripts/compile.js assets/models/drone-defence.json`. [Model geometry, articulation and checks](drone-model.md); [approved starting data](../shared/drone.js).

## Flying-enemy corner review (21 October)

[Flight turn review](http://127.0.0.1:4173/tools/flying-turns-review.html) uses the actual EnemyPreview/WorldRenderer with one Moth, Twin Fan, Ray or Lantern at campaign altitude44. Play at0.65×, pause, scrub the authored route, jump to either turn direction, or switch follow/overview. It changes no source assets or game state. Paused/hidden views stop the inspection clock; model changes release the preceding world. [Motion and clearance verification](flying-turns-2026-10-21/README.md).
