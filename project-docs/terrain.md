# Level terrain authoring

**20 October follow-up:** B4 now has an additional complete lake crossing and shared-tail approach; six original water columns retain their bed beneath a one-unit wooden deck. Three dry 28-unit mesa shoulders are lowered to 24 for rover turning. Ground placement stays off bridges. [Evidence and limits](b4-missile-follow-up-2026-10-20/README.md).

Approved and implemented on 17 October 2026. The user's clarification is essential: **from above, the main terrain building blocks align to the 24 × 24 box grid**. Ground height and water depth change in **1-unit vertical steps**. Do not confuse vertical precision with permission for unaligned horizontal terrain. The stream, terrain regions, path and model placements use the same horizontal grid.

## Wooden bridge support

A2 implements the user-approved one-unit-high wooden-plank style. Decks are explicit straight spans over unchanged water, with top at `pathHeight`, underside one unit lower and dry banks at both ends. `TerrainField.height` and `flatBox` retain natural terrain meanings; `supportBox` additionally recognises a bridge deck. Defences remain restricted to dry land. Complete bridge routes/heights are currently source-authored; terrain brushes protect them. [Full contract, geometry and verification](bridges.md).

## Using the editor

Open Level studio, then Terrain in the level plan. Paint boxes by clicking or dragging. Raise +1 and Lower −1 affect a box once per stroke; Set ground applies the Ground height field; Set water applies the Water depth field; Drain removes water. Inspect reads a box without editing. The box X/Z fields and Apply brush button allow exact coordinate edits. Undo/redo includes terrain; invalid strokes are reverted. The 3D mesh updates on stroke completion, while the plan updates during painting.

Every new level starts with solid ground from Y=0 to Y=24. A ground height of 4 with water depth 8 means solid ground from Y=0 to 4, water from Y=4 to 12, and open air above Y=12. Ground can be zero. The editor's height ceiling is 256 units, a tool guardrail rather than a game budget. Raising ground preserves the existing water surface until the ground reaches it, at which point that box becomes dry. Water is an authored volume; it does not flow into neighbours. The opaque colour preview shows its exposed surfaces. This workshop view remains a simple opaque preview. The separate engine now renders translucent water with refraction and ripple glints; see [engine notes](engine.md).

Path mode uses ordered, neighbouring boxes. Every path box has the same `pathHeight` and uses dry ground or an explicitly validated bridge deck. Terrain brushes skip these boxes. The Flat path height field moves all path ground together, subject to normal placement validation. Adding a path box requires its ground to already match the route height. Removing a path marker leaves its terrain intact. No route climbs or ramps are introduced.

Ground-anchored models follow their box's ground height. Extra Y boxes add multiples of 24 above that ground. The optional Absolute box layer anchor preserves direct world-Y placement for authoring; validation rejects intersections with ground or water. Ground-anchored placements require dry boxes. Player defence models (`role: "defence"`) additionally require both their placement base and supporting ground to equal `pathHeight`. Elevated, sunken or floating defences are rejected. Scenery can still use raised/lowered terrain and extra layers.

## Source format

Levels now use `defender.level` **version 4**. Model and compiled-model formats stay at version 3. Terrain is implicit flat ground plus sparse box overrides:

```json
{
  "terrain": {
    "defaultHeight": 24,
    "boxes": [
      {"box": [1, 4], "ground": 4, "water": 12},
      {"box": [4, 1], "ground": 32, "water": 0}
    ]
  },
  "pathHeight": 24,
  "path": [[0, 0, 3], [1, 0, 3]]
}
```

`box` is an integer `[X,Z]` coordinate. Each override covers exactly 24 × 24 units. `ground` is an absolute top height; `water` is an absolute top height, or 0 for dry ground. Nonzero water must exceed ground. The UI exposes water **depth**, converting it to an absolute surface height when painting. Default dry 24-unit boxes are omitted when written by the editor. Overrides are sorted by Z then X. No per-column sub-box terrain is authored by this format.

Path entries retain `[X,0,Z]`; their common absolute elevation is `pathHeight`. Placement `box` remains `[X,Y,Z]`, with `anchor: "terrain"` (also the default when omitted) or `"absolute"`. Terrain anchoring adds ground height to `Y * 24`. Existing v1–v3 levels migrate in memory to default ground, preserving horizontal placement and route coordinates; models rise onto the new ground layer. An old path's common Y layer becomes `24 + oldY * 24`. Migrations outside the current height guardrail require a deliberate refit. Saving retains revision protection. The former layout study source is [archived](archive/layout-study-v3.json).

## Geometry and performance

`shared/terrain.js` validates and edits the sparse source. `shared/terrain-mesh.js` generates exposed surfaces directly from heights, without allocating underground voxel volumes. Adjacent ground/water volumes hide their internal interfaces. Equal horizontal rectangles and vertical spans merge into axis-aligned quads, with neighbour samples removing seams between boxes. The workshop treats water as opaque. The engine enables the mesher’s translucent-water mode, retaining submerged ground/bed/bank faces and extracting water into a separate surface mesh; ground-water contact faces are not duplicated as water faces.

Content-based caching reuses unchanged box meshes. Identical meshes are instanced; one-off meshes are combined into one batch to avoid a draw for every edited box. The renderer draws on demand, reusing GPU geometry during camera movement. Terrain mesh construction is editor work, not a per-frame simulation operation. No engine performance budget or timing target is implied.

The [terrain study](../assets/levels/terrain-study.json) is an authoring example, not a campaign level. Its turret positions are [2,0,1], [4,0,1], and [6,0,1]; the route remains row Z=3. The stream occupies box row Z=4, with ground 4 and water surface 12, leaving a bank at row Z=5. All three turrets now stand at Y=24, matching the route. The 32- and 40-unit demonstration mounds were moved to row Z=0 and remain scenery terrain. Positions and route were preserved when correcting the stream's alignment. `terrainStudy()` in `scripts/seed.js` reproduces this example; seeding never overwrites existing files.

## Verification

Tests cover box alignment, unit-height edits, exact ground/water layers, route protection, model support and collision, source migration, malformed terrain, persistence, and an independent solid-cell surface oracle (coverage, no duplicate faces, outward winding, and chunk borders). The existing model and server checks remain in place. The original terrain milestone passed 32 tests. The current suite passes **49 tests**, including translucent surface coverage and the defence-height rule. Built-in Chrome checks verified a pointer-painted whole-box raise, one-unit mound changes, path protection, undo, save/reload, and the ground 4 / water depth 8 / surface 12 readout. The [verified editor preview](screenshots/terrain-editor-24.png) shows the aligned stream and preserved turret/path positions. The linked screenshot predates the later defence-height correction; use the current saved source and engine preview for the latest placement rule.
