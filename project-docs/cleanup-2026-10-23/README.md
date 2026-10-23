# Game cleanup, 23 October 2026

This pass preserves the player's accepted reticle orbit, foreground preference, altitude, combat and visuals. It targets repeated CPU work in spectator clearance, gimbal calculation and model-light packing. No shader, GPU pass/resource, asset, gameplay tuning or critter scheduling changes.

- **High static clearance:** cache the highest terrain/water/bridge surface at world binding. A swept body entirely above both that ceiling and the current static BVH root cannot intersect either. Strict separation preserves contact rejection; reading the current root protects geometry replacement. Lower flights retain the complete original checks.
- **Imminent spawns:** compute the exact vertical interval of each transformed envelope before calculating all eight 3D corners. Vertically separated reservations skip those transforms; overlapping heights retain the former complete predicate. A sixteen-reservation high-flight fixture reduces root-matrix reads from 1,536 to 128 per query. No new reservation array.
- **Gimbal:** intermediate 120 Hz spectator substeps do not consume yaw/pitch. Derive the gimbal once from the final physical position before each displayed pose. Reticle rotation still updates immediately. The retained B4 trace at 30/60/120 Hz matches every camera statistic exactly across 4,200 displayed frames, reducing aim calls from 7,209 to 4,209 (including nine entry/manual-target calls).
- **Model lights:** retain the already packed model-light block while its source, contents, offset and count remain valid. Transient payloads continue to update and the same GPU bytes are uploaded. Model changes, compaction, prefix movement, world release and membership rebuild invalidate the cache. The largest 434-light fixture avoids 3,472 model float reads and stores on each stable-prefix transient frame, or 208,320 of each over sixty frames, with exact packet/call equality. Three scalar cache fields; no added typed storage.

The broader review covered simulation/controller ownership, audio, targeting, camera/input, rendering, light preparation and effect pools. No justified changes to gameplay, GPU quality or particle ordering were needed. Whole-frame CPU/GPU speed and frame-rate gains are **not measured**; reported savings are exact work counts in the named paths.

## Evidence

82 targeted tests pass in seven files: renderer, model lights/copy cache, camera/ownership, cleanup predicates and static packaging. The new collision checks compare 4,500 seeded cases against exhaustive geometry/reservation oracles, with boundary, water-height and replacement-geometry cases. Existing native A2/B4/D4 tests retain swept clearance and identical combat outcomes at 30/60/120 Hz. Renderer checks cover hide/show compaction, transient expiry, scene release and runtime membership rebuilding.

Run the exact previous/current camera comparison with:

```sh
bun project-docs/cleanup-2026-10-23/compare-camera.js
```

The script imports the accepted `9b9a186` camera/flight directly from Git, using unchanged dependencies, and compares against the saved cleanup commit `ef7677e` on one shared real B4 battle without touching player progress. [Recorded comparison](camera-comparison.json).

The local game package is refreshed. Native A1 browser review on a separate port/session records eleven genuine gun shots, fifteen model lights, active Drone motion, zero blocked camera moves and no captured warnings/errors. [Runtime record](browser-review.json). Active player state remains untouched; local commit only, no push/publication. The subsequent request for clearer click-drag instructions and stronger action framing is separate from this behavior-preserving cleanup.
