# First-destruction hitch investigation and preparation — 21 October 2026

The user reports occasional staggering when the first enemy is destroyed. The first event was doing graphics setup in live frames: four solid-debris pipelines, two smoke/blast pipelines, the shockwave pipeline, three buffers and a full-screen image. The first shader-backed blood mark could also compile a pipeline later. This is a credible first-use hitch mechanism, but the user's larger intermittent pause was **not reproduced** by this local controlled run.

## Change

`/play/` now awaits `renderer.prepareDeathEffects()` immediately after renderer initialization, before cameras, scene activation or the combat loop. It uses `createRenderPipelineAsync` to prepare fourteen pipelines: debris depth/shadow/colour/reflection, smoke/blast, shockwave, blood decals and the six ordinary bloom paths. It reserves the existing fixed effect buffers/uniforms; ordinary viewport setup prepares shockwave/bloom images before any destruction. Resize/world changes replace those images on the next ordinary no-effect frame. There is no compilation await, queue wait or extra effect pass in the live render loop.

No fake explosion is emitted, no RNG/health/critters are advanced for warmup, and effects are not weakened or hidden. Descriptors, shaders, pool capacities and visual/combat tuning are unchanged. Renderer previews keep their previous lazy defaults unless explicitly opted into preparation. The first-death audit deliberately retains that lazy mode for comparison.

Pipeline promises must resolve before play can initialize. Rejection takes the existing loading-error path; disposal during preparation cannot mark the renderer ready or continue creating the game. Application-owned pools/pipelines remain reusable; viewport images still retire on resize/world changes. Inspection now exposes `deathEffectsPrepared`.

## Evidence and limits

[Paired browser audit](paired-gpu.json): six fresh renderers/devices, alternating unprepared/prepared order, three actual A1 enemy death callbacks each, five rendered frames per death (including the later nonzero shockwave). All 18 destructions/90 event frames complete with no GPU errors.

| First destruction window | Lazy fallback, every sample | Prepared play, every sample |
|---|---:|---:|
| Immediate pipeline creations | 7 | 0 |
| Shader modules | 3 | 0 |
| Buffer allocations | 3 | 0 |
| Image allocations | 1 | 0 |
| Async pipeline creation during the event | 0 | 0 |

The fourteen async compilations instead take place during loading. In these warmed-driver samples, preparation took 2.2–7.0 ms. Driver caches can persist across devices; this is not a genuinely cold machine/browser benchmark. The median first-window peak CPU render submission was about 0.4 ms lazy versus 0.3 ms prepared, but queued completion times varied in both directions and frame intervals stayed near 16.7 ms. **This evidence proves removal of first-event setup, not a measured elimination of the reported occasional pause or a guaranteed FPS improvement.** The ordinary temporary cost of rendering a large explosion remains.

The [earlier initial probe](cold-gpu.json) measured only the immediate death frame and missed the subsequent shockwave setup; it is retained as diagnostic history, not used for the complete-window comparison above.

[Native CPU audit](cpu-audit.json): five real A1 two-base-gun runs. First callback explode/gib/spook median 0.042 ms, maximum 0.212 ms; later callbacks are comparable. The witness has no critters within the lethal radius. These Bun measurements exclude renderer/browser/session/camera work and cannot bound a crowded gore burst. Palettes, pools and wildlife event storage already exist before death.

## Ownership and earlier reservation

Capacity is unchanged: the existing damage pools total 143,808 GPU bytes plus the 144-byte shockwave uniform. Blood adds no buffer. Bloom retains its existing 16-byte settings uniform and quarter-resolution pair. Pipeline/driver memory is implementation-dependent and not estimated here.

Play now reserves these resources before their first visible use. At the actual 2560×1440 title viewport, the shockwave image is 14,745,600 bytes and the bloom pair is 3,686,400 bytes. They remain inactive with zero shockwave/bloom passes until an effect or visible emitter needs them. This is memory reserved earlier, not a free optimisation; idle previews remain lazy. [Fresh prepared title evidence](prepared-title.json).

## Verification

- **59 affected tests across four files pass**: renderer, damage effects, blood decals and scene-loader lifecycle. [Log](targeted-tests.log). New checks cover fourteen asynchronous pipelines/idempotence; resolved pipeline handles; allocation-free first destruction/decal/resize use; compile rejection; disposal while preparation is pending; exactly-once buffer/image destruction. Existing lazy behaviour and visual pass contracts still pass.
- Six actual GPU/device runs and the fresh production title load report no errors. The title has prepared buffers/images, zero waves/effects and inactive bloom. The user's active `/play/` tab was neither reloaded nor controlled.
- [Build](build.log): 111 browser modules, about 1.24 MB. No dependency or shader changes.

Reproduce with `/tools/first-destruction-review.html` using **Run paired comparison**. It creates separate temporary worlds/devices and leaves the player alone. `bun docs/first-destruction-2026-10-21/cpu-audit.mjs` repeats the bounded native callback audit against current production sources.

The [WebGPU specification's pipeline-creation section](https://gpuweb.github.io/gpuweb/#pipeline-creation) explains that immediate pipeline creation can defer a stall until first use/submission, whereas async pipeline creation resolves once a pipeline is ready. Its [GPUDevice reference](https://gpuweb.github.io/types/interfaces/GPUDevice.html#createrenderpipelineasync) recommends asynchronous creation to avoid compilation blocking queue work. The implementation moves that preparation into loading without waiting during combat.

The specific first-use mitigation is implemented for review; the original intermittent symptom still needs player confirmation on the next load. It cannot update the already-loaded running client without interrupting it.
