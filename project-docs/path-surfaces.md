# Path surface art

Implemented 17 October 2026 after the user requested larger irregular slabs and an Artist review of the small tiled paths.

## Wooden bridge surface

A2's bridge now uses a one-unit-thick deck with broad transverse warm-brown planks and flush darker joints. It is continuous solid geometry over retained water, matte and nonemissive, with no stone paving, soil shoulder or weather overlay on its top. Subtle zone variations remain permitted for later crossings. [Bridge source and implementation](bridges.md). The stone paving implementation below remains unchanged on land.

## Appearance and geometry

`shared/path-surface.js` now generates broad flagstones in world coordinates. Nominal course and stone spacing is 14 units; staggered row offsets and variable boundaries produce different proportions. Sparse three-unit course steps create occasional simple L/stepped outlines. Existing stone palette slots 6–8 are assigned per stone with 60/25/15 weighting. Slot 9 supplies one-unit joints. No textures or new palette colours are introduced.

One cell owns each joint and all ground is covered exactly once. Geometry is still coplanar axis-aligned quads at the unchanged path height, with equal cells greedily merged at load time. The pattern continues across box boundaries and bends. Route footprints remain on the 24-unit box grid; navigation, collision, defence placements and level assets are unchanged.

Rain puddles, settled snow and leaf litter replace portions of this same surface along exposed route edges. Their colours, reflectiveness and shapes are unchanged. Dry paths skip weather-edge calculations, and every saved level remains weather-off.

## Cost

Generation uses bounded scratch grids during loading or a weather toggle. Nothing runs per frame or in a shader, and there are no additional draw groups, persistent caches or render targets. Counts below include path top faces only, at 200 vertex/index bytes per quad:

| Preview | Dry quads | Dry bytes | Enabled-weather quads | Weather bytes |
| --- | ---: | ---: | ---: | ---: |
| A | 379 | 75,800 | 890 | 178,000 |
| B | 359 | 71,800 | — | — |
| C | 399 | 79,800 | 848 | 169,600 |
| D | 388 | 77,600 | 3,130 | 626,000 |

The previous dry pattern used 756 quads / 151,200 bytes in each preview. A saves 377 quads / 75,400 bytes, approximately 50%. This is a geometry reduction, not a measured frame-rate gain.

## Verification

`bun test tests/weather.test.js tests/weather-preview.test.js tests/world.test.js`: **22 passed, 0 failed**. Existing checks cover exact flat coverage, no overlapping faces, route/scenery constraints, exposed-edge weather masks and clear centres, repeatable toggles, source immutability and GPU resource disposal. Only affected test files were run.

Built-in Chrome shows all four palettes with the new slabs and the A/C/D weather edge treatments, with no console or WebGPU errors. Artist approved the A overview/close views and the final B/C/D and weather captures: route contrast remains clear, whole-slab variation stays quiet, and weather stays on exposed edges without competing with defences. No actionable art issues remain. Review captures:

- [A overview](screenshots/path-slabs-a-overview.png), [A close](screenshots/path-slabs-a-close.png), [A rain](screenshots/path-slabs-a-wet.png)
- [B](screenshots/path-slabs-b.png)
- [C](screenshots/path-slabs-c.png), [C snow](screenshots/path-slabs-c-snow.png)
- [D](screenshots/path-slabs-d.png), [D leaves](screenshots/path-slabs-d-leaves.png)

The existing game tab is reused and returned to Zone A with weather off. Final creative approval remains with the user.

## Outside stony-dirt shoulders — 18 October 2026

The user approved irregular edging outside the paving to blend its clean-cut footprint into the surrounding level. `pathShoulderQuads` in `shared/path-surface.js` now supplies a flat dirt-and-stone shoulder, integrated through `engine/world.js`'s existing terrain builder. It applies to every preview and future level using that builder, without editing saved assets.

The shoulder is normally 1–3 units wide, rarely 4, with occasional gaps. World-coordinate runs change width every 6–14 units; neighbouring runs of equal width can form a longer quiet section. Sparse groups of 2–4-unit stone patches interrupt the soil, occupying 17.4–18.3% of the shoulder in the current four layouts. Exposed convex corners use rounded steps on the same unit grid. A single material mask combines the sides and corners before greedy merging; no strips or decals overlap.

Only dry, non-route ground at the common path height receives the treatment. Water, higher/lower ground, paving, terrain banks and defence supports remain unchanged. The shoulder replaces portions of the original top face at exactly its existing height, so it adds no obstacle, collision volume or raised stones.

After reviewing the initial zone-coloured edging, the user requested predominantly mid-dark brown soil with occasional grey stones. The corrected palette is shared across A–D and independent of the stream-bed and bank colours. Its five immutable materials have emission and reflectiveness both zero:

| Material | Colour |
| --- | --- |
| Primary soil | `#76583F` |
| Lighter soil | `#876A50` |
| Darker soil | `#654B37` |
| Grey stone | `#929292` |
| Darker grey stone | `#737373` |

Broad soil patches select the three browns with 60/25/15 weighting; the current finite layouts contain 69–74% primary brown within their soil area. Stone occupancy is unchanged at 17.4–18.3% of the entire shoulder. These materials append after the active weather palette: the shoulder starts at 16 when dry, 20 for rain, 19 for snow and 21 for leaves. Existing weather starts at 16 and keeps its original indices. `pathShoulderQuads` requires an explicit valid append offset; it cannot silently produce material indices missing from the caller's palette. The shared base terrain palettes are never mutated.

Weather still changes only the approved paving treatment. The shoulder is identical with rain, snow or leaves enabled or disabled, and remains matte in rain. The simpler workshop terrain preview continues using its existing surface representation; this detailed treatment belongs to the game terrain builder, like the existing flagstones.

One 576-byte signed scratch mask is reused across boxes during a terrain build. `-1` marks consumed cells so ordinary ground material `0` is retained. Distant boxes remain single quads; there are no new persistent caches, draw groups, GPU buffers, shaders or per-frame calculations. Current dry **whole-ground** mesh counts below include the existing banks and stream beds, unlike the earlier path-only table. Levels 1 and 2 share their zone's terrain and therefore these counts:

| Zone | Before quads | After quads | Added quads | Added vertex/index bytes |
| --- | ---: | ---: | ---: | ---: |
| A | 2,127 | 2,589 | 462 | 92,400 |
| B | 1,982 | 2,541 | 559 | 111,800 |
| C | 2,103 | 2,611 | 508 | 101,600 |
| D | 1,434 | 1,863 | 429 | 85,800 |

These final brown/grey palette counts differ from the initial edging by −9/−10/+25/−15 quads for A/B/C/D: different shade partitions change greedy merging, while soil/stone footprints and terrain positions are identical. These are measured geometry sizes, not GPU timings or frame-rate claims. Water geometry is unchanged.

All **26 affected checks pass**: four new `tests/path-edges.test.js` checks, six existing weather checks, seven world checks and nine weather-preview checks. Coverage includes exact once-only top coverage, material-zero retention, bounded exposed-edge/corner reach, world-coordinate continuity, route-order independence, matte palettes, water/height exclusions and all eight saved previews with weather toggles. The lead updated the weather-preview fixture for the existing Arc dummy-light buffer and isolated its unrelated bloom work, then reran its nine checks; no renderer change was needed. Only these affected files were tested. Lead inspected A–D and the A/C/D weather variants in the existing built-in browser, with clean scene replacement and no console/WebGPU warnings or errors. Artist accepted all seven views and the A/D before/after comparisons: the broken shoulder softens the cut boundary while preserving paving width and zone readability. [Browser evidence](path-edging-browser-review.json), [A](screenshots/path-edging-a.jpg), [B](screenshots/path-edging-b.jpg), [C](screenshots/path-edging-c.jpg), [D close view](screenshots/path-edging-d-close.jpg).

That visual review preceded the brown/grey correction. After the correction, a fresh run of the same four test files passes **26 checks / 729,275 assertions**. Recorded soil-versus-stone cell-mask hashes match the initial edging in all eight previews, confirming the exact footprint was preserved. Weather comparisons use resolved colours/material properties rather than build-local material indices; they also confirm unchanged stream beds, banks and water. Lead reviewed all four zones and A/C/D weather variants without console/WebGPU errors. Artist accepted the revised A–D views and C weather: the shoulder reads as brown earth with occasional neutral-grey stones, retains paving/snow readability and avoids a continuous dark outline. [Final browser evidence](path-soil-browser-review.json), [final close view](screenshots/path-soil-d-close.jpg). The sole existing preview is left at D2, weather off, with the faster Spider roster reset.
