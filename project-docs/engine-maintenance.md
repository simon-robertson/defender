# Weather rollback and engine maintenance

The later **18 October full game-code review** is recorded separately in [the current performance report](performance-review-2026-10-18.md). It adds measured simulation/lighting reductions and throttled inspection snapshots while preserving the pass dependencies below. This file records the 17 October milestone.

17 October 2026. The user requested removal of the muzzle-pressure experiment, no weather processing while disabled, all levels initially clear, then an engine/shader/pipeline review and refactor. Preserve current visuals, controls, timing, geometry, attacks and targeting.

## Weather rollback

Removed the CPU pulse pool and shot hooks, GPU displacement/collision state, compute shaders/pipelines, added vertex bindings, and dedicated experiment tests/harness. Its documentation and screenshots are historical only. Ordinary flashes, sparks and lights retain their prior settings.

All six saved levels resolve to weather disabled, and A–D preview generators also default off. A/C/D retain optional rain/snow/leaves through their author switch and temporary preview button. B remains clear. Off levels create no particle field or seed buffer and do not advance weather, upload weather data, dispatch compute work or draw particles. The weather shader module/pipeline is created only on first explicit enable; cached pipeline objects do no work while off. Toggling off destroys seeds and restores dry path geometry.

Enabled optional weather still passes its production GPU checks: rain 9, snow 13, leaves 17, with identical lighting/depth readbacks. No weather shader quality, lighting, density or accepted motion was changed.

## Review and bounded refactors

Reviewed the shared rAF clock, pose hierarchy, dog gait/path motion, camera, firing/targeting/visibility, renderer resource lifecycle, pass dependencies, geometry/composite/shot/weather WGSL and render-pipeline bindings. Simulation already reuses entity state and typed storage; diagnostic JSON allocations stay opt-in through `?inspect`. Retain the existing bounded shadow filter, SSR and water math; no speculative shader arithmetic or visual-quality changes.

### Path and gait sampling

Path validation guarantees equal 24-unit segments, so path sampling now indexes directly instead of binary search. Inclusive endpoints retain the last segment and its direction. Each paw caches its fixed world-space current/next contact for a stride; the leg pose is still solved every frame. Distance keys invalidate on new contacts, skipped strides and route wraps.

For three dogs over 600 frames / 10 seconds, actual path samples fell from the previous 12,246 to 2,404. Cached anchors add 432 typed-array bytes across all three dogs, allocated once. This is an operation count, not a measured CPU time or frame-rate improvement. Existing independent gait/contact/geometry tests plus boundary/cache checks verify unchanged poses, feet, bounds and frame-rate behavior.

### Renderer

Pass invalidation now tracks camera/uniforms, camera depth, opaque shading, sky shadows and water visibility separately. The existing `dirty` field means opaque shading needs refresh; `requestDraw()` is the camera/viewport invalidation entry point. Instance changes queue their transform and invalidate depth/opaque/shadows; lighting changes invalidate only the resources they affect.

| Change | Passes refreshed (in addition to display) |
| --- | --- |
| None | None |
| Muzzle light or sky/ambient colour | Opaque |
| Camera or viewport resize | Camera depth, opaque, water visibility |
| Animated instance | Camera depth, sky shadow, opaque |
| Weather path replacement | Camera depth, opaque |
| Sky transform | Sky shadow, opaque |
| New scene | All |

Weather toggles refresh depth despite unchanged surface height: changing triangle tessellation can change depth rounding under `depthCompare: equal`. Water masks remain valid until camera/viewport/water geometry changes. Water shading/refraction/reflection still runs in display every frame. Animated shadows retain their previous behavior.

Pass-descriptor trees and the command submission array are reused. Attachment views change on resize, and the presentation view/command encoder remain frame-owned as required. Shader math, shadow resolution/filtering, SSR steps, blending and vertex formats are unchanged.

Each draw retains its packed transform array from loading. Pose callbacks copy into this reused storage and mark a dirty index span; rendering uploads the latest span once per changed draw buffer. Repeated writes to one instance within a frame retain only its final matrix; untouched indices between dirty endpoints retain their original transforms. Scene cleanup releases packed data with its draw records.

The deterministic Zone A fixture changed **40 matrix uploads to 14**, still uploading **2,560 bytes**. Retaining packed transforms costs **9,728 CPU bytes** for A's 152 instances; GPU buffer sizes remain unchanged. The tradeoff is fewer API calls with a small retained CPU copy; widely separated dirty instances may include unchanged middle instances in one upload. No frame-rate improvement is claimed without a GPU/CPU timing benchmark.

## Final verification

- **156 Bun tests pass** across 24 files, including full HTTP/asset/animation/targeting/LOS coverage.
- Renderer checks verify pass selection, latest-pose batching, unchanged GPU matrix bytes, descriptor/storage reuse, resize, teardown and repeated weather toggles.
- Cold-init checks verify only three scene/shot shader modules and six non-weather pipelines are built while weather is off; all four off-zone render traces contain no weather creation, update, upload, dispatch or draw.
- The **39 production weather GPU checks** pass with their previous pixel values. Shader arithmetic was otherwise left intact after review.
- Built-in Chrome verified A–D off defaults, A/C/D explicit on/off controls and lazy pipelines, day/night, F view at 12 units above ground with FOV80, animation/shot visuals and zone resource restoration, without console/WebGPU errors. [Captured counters](engine-maintenance-check.json).
- Off-zone scene buffers A/B/C/D = **87/42/42/45**; weather particle counts, bytes and times stay zero. Shared shot-effect buffers are **9,488 bytes**. No pressure resources remain.

Engineer reviewed/implemented GPU changes and their focused tests; lead reviewed the integrated code, handled CPU changes/defaults, ran the full suite and browser verification. The normal Zone A preview is reopened with weather off. [Preview](screenshots/moss-weather-off-refactor.png).
