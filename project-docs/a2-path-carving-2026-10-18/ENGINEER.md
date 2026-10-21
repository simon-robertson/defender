# A2 wooden bridge engineering

**Subsequent user decision:** A2 was explicitly approved on 18 October ("Perfect!"); A3 is authorised next. Pending-review statements below describe the original handoff.

18 October 2026. Reused Engineer `gpt-6.1-sol`, High effort, for bounded source-aware bridge geometry, support and lifecycle integration. No further delegation. The user authorises A2's path-layout review with a one-unit wooden deck; **Garden Crossing is the team's selected proposal and awaits the user's review**. No assets, catalogue, production wrapper or frozen backups were edited by Engineer.

Subsequent decision: the user approved completed A2 Garden Crossing (“Perfect!”) and requested A3 next. Pending-review statements below describe this handoff's original checkpoint; A2 is now accepted.

## Source and support contract

Optional version-4 `bridges: [{id, boxes: [[x,z], ...]}]` records describe straight, ordered, contiguous spans over water. Thickness is fixed at one unit; top is `pathHeight`, so A2 occupies Y23–24 above its unchanged Y20 water and original bed. No rails, pillars, ramps, filled water columns or bridge models are introduced.

Shared validation rejects malformed/extra bridge fields, duplicate IDs/boxes, overlapping spans, non-route tiles, turns, dry-filled tiles, water touching the underside and crossings without complete straight travel between dry path-height banks. Every route using a span must cross its whole length. Landscape mode rejects bridge metadata. Existing levels without bridges retain their previous validation and route semantics.

`TerrainField.height()` and `flatBox()` still describe natural terrain; water boxes remain non-dry. `bridgeBox()` identifies decks and `supportBox()` reports natural dry support or the deck top. Defence placement retains its existing natural-land-only rule. Exact placed model cells cannot intersect a deck. Path-height mutation throws for bridge routes instead of draining/rebuilding the water. Terrain brushes protect the route, including the original water below it.

## Geometry and consumers

`shared/bridges.js` builds broad transverse courses in muted warm timber with darker flush joints. Surface partitions provide continuous flat support with no coplanar overlays or holes. Materials remain texture-free, matte, nonemissive and unlit. Exposed slab sides and underside are solid; internal tile faces and bank/deck contact faces are removed. An independent occupied-cell oracle verifies the combined exposed natural terrain and deck surface exactly.

The game appends deck quads to its existing ground mesh and draw passes. Natural bed geometry and the separate water mesh remain intact. Paving and soil shoulders never cover the deck. Rain geometry rebuilds preserve the same water mesh and matte wood; no wet wooden reflection or new surface effect is implied.

The workshop renders a cached deck group with its existing terrain. Terrain-cache signatures include bridge membership/elevation; deck-cache signatures include adjacent terrain. Removing a bridge releases that group and restores the natural bank faces. Bridge path painting, undo-step, clear-path and common-height controls are disabled, with complete crossing edits made in source JSON. **Historical merged routes retain their previous common-height control**, while their existing path-edit restrictions remain.

Exact one-unit deck cuboids join `SceneryVisibility`. Existing LOS, debris sweep/rest, missile scenery contact, Arc spark collision and rain/snow/leaf stopping queries therefore see the same solid slab while the air gap underneath remains open. Camera and enemy-impact dense support maps include the deck top; their frame queries allocate no bridge objects. Actual ground gait continues at the shared path height. An offline Dog audit traverses both banks and deck using actual articulated sole cells; no enemies or weapons are added to the layout preview. Cosmetic ground wildlife keeps natural dry-ground navigation, without a new bridge-specific behaviour.

## Changed files

`shared/bridges.js`, `shared/level.js`, `shared/terrain.js`, `shared/terrain-mesh.js`; `engine/world.js`, `engine/visibility.js`, `engine/camera.js`, `engine/enemy-impact.js`; `tools/app.js`; `tests/bridges.test.js`, `tests/preview-levels.test.js`, `tests/landscape-preview-runtime.test.js`, `tests/world.test.js`, and one historical catalogue assertion in `tests/missile-flight.test.js`.

## Verification

- Bridge tests pass six focused cases: support/schema/editor protection; actual Dog soles at 65 poses; invalid span/bank/water cases; exact solid-cell geometry; weather/material/water invariance and workshop cache invalidation; camera/clearance/LOS/debris/rain contact and disposal.
- The concrete geometry/terrain/routes/visibility/scene-loader group passed **34 tests, 46,291 assertions** before the final additional sole audit and overlap assertion. Existing flight, damage and impulse checks also exercised the shared visibility/support consumers. No full suite was run.
- One existing missile-flight test expected no ID-only missile catalogue for `ochre-04`, despite the unchanged current catalogue and its own catalogue tests retaining missile markers for every fourth level. Corrected that stale historical compatibility expectation to the existing 36-slot catalogue contract; the affected seated-missile test passes. No missile runtime behaviour changed.
- After the final Garden Crossing source landed, `bun test tests/landscape-preview-runtime.test.js tests/preview-levels.test.js tests/world.test.js` passed **20 tests, 305,643 assertions**. A1 and A2 equal their current factories. All sixteen sources load only scenery and six cosmetic actors, animate safely, release their world/visibility/actor references and retain zero combat states/planners/missile pools. Only A1/A2 enable path camera; fourteen other sources remain landscapes. Archived undefined-mode combat still works.
- Workshop app syntax build passes with Bun. Lead owns the single built-in browser tab and browser/GPU review. Artist accepts the actual proposal overview's wood/plank treatment; this is not user approval of the completed A2 layout.

Development-server dependency: Bun caches the server-side imported validators. After changing the level/bridge schema, restart the existing verified project server before testing `/api/levels/...`; otherwise the API can retain the old dry-ground-only validator even when the static browser modules and direct JSON comparison viewer are current. Lead observed and resolved this stale-server failure by restarting the project server; it was not a bridge source or runtime defect.

## Actual Garden Crossing storage observations

The six deck boxes produce **89 quads**, equivalent to **17,800 bytes of gross vertex/index payload** added into the existing ground mesh before accounting for removed bank faces. There is no new game draw group or GPU pass. Static visibility adds exactly **six primitives / 336 bytes**, for **352,044 total visibility bytes**. The loaded layout uses **13 model assets, six cosmetic actors and 16 opaque mesh entries**; its water mesh has 62 quads. Geometry and visibility data remain scene-owned and use existing disposal. These are storage/work observations, not GPU timings or frame-rate claims.

## Handoff and limits

Lead owns `docs/design-doc.md`, its change record, the project brief, terrain/tool/bridge notes and diary. Record A2's implemented bridge support and proposed Garden Crossing separately from user acceptance. `docs/bridges.md` matches the implementation apart from clarifying that only bridge levels lock common-height editing; historical merged levels still support it. Tactician owns actual A2 route/site/species coverage evidence and asset preservation. No bridge deployment, destruction, water combat, wave or economy system is added.
