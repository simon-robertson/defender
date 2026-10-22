# Engine performance follow-up — 22 October 2026

The user reports increased GPU usage and authorises a CPU/GPU/shader review. This pass finds useful CPU preparation/cache savings, but **does not demonstrate a GPU speedup**. The accepted 16-sample volumetric missile trails have a measurable GPU cost; their samples, density, lighting, lifetime and reflections remain intact. No deployment, remote push or active-player reload was performed. The parent task owns the local commit.

## Retained changes

- Trail admission uses one bounded scan without two newly created `find` predicates per callback.
- The main view curls, bounds and packs each trail once. The mirrored view sorts existing packets and copies them into its existing fixed storage, rather than repeating every point's trigonometry and bounds work.
- A field revision plus the main eye position avoids rebuilding/uploading unchanged main-view packets while frozen. Time, samples, reset, camera movement and completion of asynchronous pipeline preparation invalidate the cache. The latter prevents pre-ready CPU packing from suppressing the first GPU upload.
- The density shader uses squared distance directly, multiplies the squared radial kernel and rejects zero support before evaluating its fractional age power. Main-view water depth is loaded once outside the ray march. This is equivalent algebra within floating-point precision, with no quality setting reduction. GPU measurements below do not establish that this simplification is faster on this device.

Fixed typed CPU storage increases **600 bytes**, from 678,856 to **679,456 bytes**: a 576-byte packet lookup and 24-byte mirrored eye. GPU buffers remain **382,480 bytes**; passes, textures, draw counts and resource lifetime are unchanged. No simulation/combat/camera/wildlife rules change. No new hot-path array views, callbacks or temporary packet objects are introduced.

A conservative per-ray block-mask experiment did not improve local timings and was removed. More speculative GPU changes and visual quality reductions are deferred.

## Measurements and limits

`bun project-docs/engine-performance-2026-10-22/audit.js` compares against local commit `3136e67`. Main and mirrored packets are byte-identical for 1/8/36/144 synthetic histories with 64 points each. Eight alternating measured batches of 300 iterations follow warmup. These are isolated Bun packing timings, excluding rendering/simulation and using deliberately full histories:

| Histories | Original double pack | Pack plus sort/copy |
| --- | ---: | ---: |
| 1 | 0.00232 ms | 0.00176 ms |
| 8 | 0.01665 ms | 0.01040 ms |
| 36 | 0.07681 ms | 0.04823 ms |
| 144 | 0.33032 ms | 0.21089 ms |

This is about 37% less time in the 36-history packing routine, not a 37% faster game. Frozen main frames now bypass that routine entirely. [Raw CPU batches](cpu-audit.json) and [reproduction script](audit.js).

Actual built-in Chrome WebGPU measurements use the native A3 missile study, 1222×388 output, 60° perspective and the accepted 16 samples. The original and revised shader pipelines share the same frozen field/depth/lights/camera. Original/current/off alternate every frame, with 12 warmup frames followed by 32 asynchronous complete-render timestamp samples per condition; the isolated loop waits for submitted work between samples. The benchmark's deliberate waits do not enter production code.

| Frozen shot | Original volume | Revised volume | Trails off |
| --- | ---: | ---: | ---: |
| One native trail | 2.785 ms | 2.884 ms | 2.163 ms |
| Eight translated stress trails | 4.391 ms | 4.391 ms | 1.212 ms |

**There is no measured GPU saving here.** Values vary substantially within these runs; single-trail original/revised differences are small relative to that variation. Earlier block-ordered runs also varied considerably. Retain the [raw per-frame samples](gpu-audit.json), rather than treating a favourable sample as a win. CPU submission medians were around 0.2 ms in these frozen comparisons, at coarse browser timer resolution; they do not establish a whole-frame CPU improvement.

The eight trails are translated copies of one real path, not an observed campaign load or eight independently simulated missiles. Both timed shots exclude visible planar water. A separate final overview readback exercises main and reflected shaders against the original: 3,033 visible main smoke pixels have a single channel differ by 1/255; all 355 visible reflected smoke pixels match exactly. An eight-copy close-view readback matched exactly. Both pipelines compile and the final isolated page reports no captured warnings/errors. This is bounded visual equivalence evidence, not exhaustive all-view identity.

## Other contributors reviewed

The volume marcher adds significant fill/segment/noise work wherever smoke covers the viewport. Visible water adds its reflected volume draw. This makes the recent smoke integration a credible contributor to the reported increase, but the frozen samples cannot assign the player's overall GPU utilisation to it.

The accepted detailed vistas and mirrored combat effects are other plausible costs: camera movement invalidates the vista capture; active combat invalidates mirrored water and adds pooled effect draws. Existing renderer code retains its static depth/shadow/opaque/vista caches and fixed resource ownership. This pass does not freshly isolate the cost of vistas, general reflection effects, bloom or the player's actual battle, and does not remove those accepted features. Historical timing claims in engine notes are not fresh measurements here.

OS GPU usage also depends on presentation rate, other GPU work and device scheduling. Production GPU timestamps measure submitted render duration; the footer's CPU app timer is not total browser/audio/driver CPU usage. Neither is an OS utilisation measurement. No full-engine optimum, frame-rate increase or complete cause of the user's report is claimed.

## Checks and reproduction

- `bun test tests/volume-trail-field.test.js tests/renderer.test.js tests/planar-reflection.test.js`: **51 pass, 0 fail**, 2,308 assertions.
- New regressions cover frozen reuse, changed eyes/time/samples, disabled/re-enabled fields, exact mirrored packet order and preparation before asynchronous compilation completes.
- Fixed pools/reset/disposal, actual native trail identity/expiry and existing reflection projection checks remain covered by the selected tests.
- The optional developer URL `/tools/missile-volume-review.html?performance=1` adds Original volume, alternating comparison and raw pixel verification. Normal review behaviour stays available without the query. Reference shaders and measurements live under `project-docs/`; the player and deployment import neither the helper nor the reference JSON.
- [Source hashes](source-hashes.json) identify retained files and original modules. [Reference shaders](reference-shaders.json) freeze the complete pre-change main/reflected WGSL with revision `3136e67`.

No full suite or campaign replay was run because gameplay/simulation were untouched. The active external player and audio audition page were left alone. The temporary review tabs were closed after checks.
