# More detailed zone vistas

20 October 2026. TODO 12 implementation, ready for visual review. The lead owns browser/GPU verification and the shared delivery record.

All four distant landscapes now use `engine/vista-geometry.js`; the lead integrated the existing A compatibility entry and production dispatch in `engine/zone-vista.js`. The background rendering, softness, day/night response and gameplay composition remain owned by the existing renderer. The geometry generator adds no world actors, collision, route, targeting or authored asset data.

Terrain sampling changes from 190-unit to 160-unit facets across the same ±7,200-unit footprint. Coherent low ridges, riverbank bands and meadow openings add structure instead of simply increasing scattered object density. Vegetation remains deterministic and uses connected groves with quieter gaps; more detailed shapes share the same immutable buffer.

| Biome | Added detail |
| --- | --- |
| A — Moss and Porcelain | Broad wooded ridges, quieter meadow/shore bands, fuller faceted oak crowns among cypress spires, layered limestone benches and fallen slabs. |
| B — Ochre and Petrol | Terraced ground colour bands; wider mesa shoulders with an exposed middle stratum, upper cap and detached butte; branching cacti and low scrub. |
| C — Ice and Ember | Connected snowy ridges, exposed slate on steeper terrain, broad mountain skirts with smaller snow caps and secondary shoulders, grouped tiered firs with alpine openings. |
| D — Plum and Mint | Grey-earth ridges and bank clearings; varied plum/green canopy groves; broken sanctuary groups with unequal columns, partial lintels and fallen masonry. |

All geometry stays more than 243 units below Y0, with the closest maximum in A at Y−243.04. Colours remain restrained: the highest stored component is 0.355 in C's snow. All vertices/colours are finite and triangles are nondegenerate. Centering remains correct when battlefield dimensions change.

| Zone | Triangles | Vertex-buffer bytes | Previous bytes | Change |
| --- | ---: | ---: | ---: | ---: |
| A | 45,711 | 3,291,192 | 3,307,536 | −16,344 |
| B | 46,893 | 3,376,296 | 3,714,480 | −338,184 |
| C | 37,472 | 2,697,984 | 4,159,584 | −1,461,600 |
| D | 46,430 | 3,342,960 | 4,042,944 | −699,984 |

Every biome remains below the existing 4 MiB bound. Reduced repeated vegetation/landmark counts offset the finer terrain and more composed shapes. Only the current biome's buffer is loaded. Geometry changes add no draw calls, render targets or shader features. Existing background caching, half-resolution targets and scene release remain verified by the renderer tests. Smaller geometry is a bounded workload/storage result, not a promise of improved GPU frame time.

[Focused tests](vista-tests.log): 30 pass, 0 fail, 1,685 assertions across `tests/zone-vista.test.js` and `tests/renderer.test.js`. These cover deterministic/distinct biomes, geometry and colour bounds, nondegenerate triangles, battlefield centering, all sixteen ID mappings, A dispatch, resource lifecycle, cached rendering, resize and relighting. The former unchanged-A hash assertion is superseded by the user's explicit request to revisit every vista.

[Reproducible audit](vista-geometry-audit.mjs), [geometry measurements/hashes](vista-geometry.json), [audit output](vista-geometry.log). Nine warm generation samples per biome gave CPU medians of 5.83/6.94/5.93/5.45 ms for A/B/C/D on this host. This measures one-time CPU mesh generation, not frame rendering, GPU time or whole-game loading.

For visual/GPU review, reuse `/tools/zone-vista-review.html` in the built-in browser. Refresh that isolated review tab to load the changes. Select A1/B1/C1/D1 and compare Overview, High, Low and Night; check that landforms read after filtering while foreground silhouettes remain sharp. The tool's all-level check produces 64 actual GPU compositions. Browser work and any GPU timing measurements are the lead's remaining integration checks; this agent did not reload the player's active run or automate a browser.
