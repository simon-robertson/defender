# Wooden path bridges

**Current use, 19 October:** the existing wooden-deck contract also supports the authorised B2 Riverfold Crossing. Its two boxes[6,6] and[7,6] cross the original river with topY24/undersideY23 and unchanged water/bed. B1/B3/B4 use dry routes. Zone B is implemented for review; user layout acceptance remains pending. [Evidence](zone-b-path-carving-2026-10-19/README.md).

18 October 2026. The user authorises a **1-unit-high wooden-plank bridge** in Zone A level 2, The Broadwater Garden, as part of its next path-layout review. The bridge style and completed A2 composition are user-approved. A3 is the next authorised carve. A1 and the other levels remain unchanged.

## Geometry and support

The deck is exactly **1 unit thick**, with its top at the common `pathHeight`. A2's top is Y24 and underside Y23; its original water remains at Y20 and its lake bed is unchanged. The bridge joins dry banks at the same walking height, without steps, ramps or filled water columns. Each span covers straight, contiguous 24×24 route boxes over water.

Broad transverse wooden courses use muted warm browns, darker flush joints and exposed slab edges. The top is completely supported: joint colours partition the surface without overlapping decals or holes. Materials are texture-free, matte and nonemissive. There are no rails, pillars or new effects. Subtle zone variations remain permitted; this first crossing uses the Zone A timber treatment.

The source adds an optional `bridges` array to the existing version-4 level format:

```json
{
  "bridges": [{
    "id": "garden-crossing",
    "boxes": [[11, 8], [12, 8], [13, 8], [14, 8], [15, 8], [16, 8]]
  }]
}
```

Every bridge box must already belong to a complete route. Each route using a span crosses its whole length straight, with dry path-height banks at both ends. Spans cannot overlap, repeat boxes, turn over water, replace dry land, or intersect water. Water must stay below the underside. Deck height and thickness are derived, not separately editable fields. Landscape mode remains path-free and forbids bridge metadata.

Natural terrain height and dry-ground queries remain unchanged. Explicit walking support recognises the deck; defences still require natural dry ground at path height. Bridge-deck deployment, water combat and destructibility are not implemented.

## Runtime and authoring

The game adds deck quads to its existing ground geometry and draw passes, retaining the original separate water mesh and submerged terrain. Internal faces and bank contacts are culled. Land paving and soil edging do not cover the wooden deck; weather rebuilds keep it matte. The workshop caches its deck mesh with terrain geometry.

Exact one-unit slab cuboids join the existing static collision/visibility structure, so ray tests, debris, sparks, projectiles and weather use the same solid support. The path camera and enemy impact support maps include the deck's top height. This does not add combat actors to the layout preview. Work is performed during scene construction or explicit geometry rebuilds; movement uses existing dense support data and collision queries, without new GPU passes or per-frame bridge geometry generation.

Bridge paths and their height are currently authored in source JSON. The workshop disables route painting, undo-step and clear-path for both bridge and merged routes. Bridge levels additionally lock path-height editing; merged routes retain their editable common height. Terrain brushes protect the route, including the water below its span. Editing a whole crossing must preserve its banks, route and water together.

## Verification and current review

[Engineer evidence](a2-path-carving-2026-10-18/ENGINEER.md) records the affected checks. An independent occupied-cell surface comparison checks exposed geometry and duplicate faces; targeted cases cover invalid spans, land-only defence support, unchanged water, material behaviour across weather rebuilds, camera height, contact/underpass clearance and lifecycle ownership. These checks establish the implemented structural contract, not campaign balance.

[A2 layout and evidence](a2-path-carving-2026-10-18/README.md) · [Browser comparison and bridge detail](/tools/a2-layout-review.html?view=garden-crossing) · [Design requirements](design-doc.md#water-composition-and-variety).
