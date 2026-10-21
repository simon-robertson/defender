# Single-bounce indirect lighting feasibility — 20 October 2026

**Retired lighting experiment:** the user rejected GI and AO on 20 October. All related executable code, viewers, bake/audit scripts, GPU timing machinery and generated GI caches have been removed. The material below records earlier work, not current capability or a pending task. Other deliveries described here retain their separate status.

**Finding:** feasible in this renderer. The best first experiment is cached, world-space diffuse lighting from static scenery and the fixed directional light, sampled by scenery and moving units. Implementation complexity is moderate; frame cost and appearance still require an isolated prototype. This research does not enable indirect lighting or authorise production changes. The user is playing the existing game; no browser, GPU workload, runtime source or asset was changed by this study.

The user also accepts the preceding B4 layout and missile presentation. That accepted appearance is the comparison baseline.

## Visual purpose and first scope

One bounce means **light → landscape surface → receiving surface → camera**. Sunlit moss could softly tint nearby porcelain, ochre banks warm a rover's underside, and pale snow lift shaded sides. This is reflected diffuse colour, evaluated in linear light. It need not soften the existing direct shadows or blur models. Bloom, water reflection, missile lighting and the distant vista remain separate.

For a first prototype, use terrain, opaque scenery and bridge surfaces as static reflecting/blocking geometry. Use the actual primary directional illumination for the selected level: day, afternoon, evening or blue night lighting. Moving enemies, defences and ordinary opaque debris can receive the cached bounce. They would not initially cast indirect shadows or reflect light back into the cache. Dynamic weapon/eye/panel lights, smoke, water transmission/refraction/caustics and the distant vista would not generate bounce in this first scope. These are proposed limits, not accepted implementation decisions.

The main benefit should be subtle spatial colour and better shaded-side form. Existing ambient lighting already fills shadows, so simply adding GI at full strength risks flattening the scene. An experimental indirect-strength/ambient pair needs comparison against the accepted baseline; no global ambient or exposure retuning is implied by this research.

## What the source already provides

| Finding from this repository | Consequence |
| --- | --- |
| [Opaque shading](../../../engine/shaders.js:64) already has world position, geometric normal and linear material RGB before lighting. | A diffuse irradiance term has a clear integration point, multiplied by the receiver's colour. No painted model textures or UV unwrap are necessary. |
| [Current colour targets](../../../engine/renderer.js:405) are `rgba8unorm`, with four-sample colour/normal and resolved images. Colour already includes ambient, direct light, emission and local lights. | This is not a direct-light/albedo G-buffer. Screen-colour reuse cannot reliably recover material colour or unclipped source energy. A global HDR conversion would be a separate resource change. |
| [Static visibility](../../../engine/visibility.js:44) stores exact occupied cuboids in a BVH. Its query returns obstruction, not the nearest hit's material or normal. | Useful visibility architecture exists, but a GI baker still needs a separate nearest-hit surface/material representation. Do not modify targeting visibility to carry experimental lighting state. |
| [Meshing](../../../shared/mesher.js:39) retains exposed quads, normals, material values and instance transforms. | A bake can derive actual world-space reflecting faces, including bridges and quarter-turn scenery. Shared model instances must retain distinct world-space illumination. |
| [Level conditions](../../../play/conditions.js:15) apply explicit evening/night overrides beyond authored time alone. | Cache keys must use effective light direction, intensity and colours; baking only `environment.timeOfDay` would give the wrong night result. Geometry/material hashes must also invalidate caches. |
| Renderer work is invalidated separately for camera, geometry, shadows and lighting. Vista geometry is deliberately outside gameplay geometry. | Static GI can remain valid while Drone or enemies move. The vista should remain outside the GI scene and keep its accepted background treatment. |
| [Device creation](../../../engine/renderer.js:62) requests no optional features; present timing is CPU submission time. | There is no existing hardware-ray-query or GPU timestamp measurement path to reuse. Small submission times are not GPU frame-time evidence. |

The [offline source audit](audit.json), recorded before removal of its reproduction script, builds four scenery-only worlds through production CPU code. All are 480×384 units:

| Landscape | Scenery placements | Instanced opaque quads | Static solid cuboids | Existing static BVH bytes |
| --- | ---: | ---: | ---: | ---: |
| A1 |229|43,228|8,873|496,860|
| B4 |126|20,161|2,963|165,900|
| C2 |185|34,866|6,463|361,900|
| D4 |166|28,926|5,319|297,836|

Those counts support a bounded offline bake; they do not measure its duration or a new GPU effect. Hashes confirm all 93 audited runtime/asset inputs remained unchanged.

## Approaches compared

| Approach | Fit here | Main limitation | Recommendation |
| --- | --- | --- | --- |
| Precomputed world-space irradiance cache/probes | Stable under camera motion; no repeated bounce tracing during combat. Moving units can sample landscape lighting. | Visibility-aware interpolation, source baking and cache invalidation are real work. Moving objects do not affect cached transport. | **First experiment.** |
| Reflective shadow map (RSM), optionally gathered into probes | Uses light-view rasterisation to obtain candidate reflecting surfaces. Can update on lighting or geometry changes. | Current shadow map has depth only; flux/normal data and secondary visibility are missing. Unshadowed virtual lights can leak. One sun RSM does not supply all local-light bounces. | Useful second candidate if runtime updates are essential. |
| Screen-space GI | Uses much of the existing depth/normal infrastructure and responds to visible action. | Missing/offscreen/hidden surfaces, Drone disocclusion, history rejection and filtering. Requires careful direct-source separation. | Less suitable as the first foundation. |
| GPU voxel/cone-traced GI | Geometry style is compatible with a spatial voxel representation; can support dynamic transport. | Existing authoring voxels are not a filtered GPU radiance volume. Voxelisation, opacity filtering, injection and thin-surface visibility would all be new. | Larger project than this first bounce needs. |
| Hardware-ray-traced DDGI/path tracing | Stronger dynamic visibility and moving-light support. | Cannot assume a portable browser hardware ray-query interface. A compute software tracer would be additional infrastructure. | Defer. |

The static-world/dynamic-receiver split has a research precedent in [McGuire et al., precomputed light-field probes (2017)](https://research.nvidia.com/publication/2017-02_real-time-global-illumination-using-precomputed-light-field-probes). That method stores visibility with the lighting; it is not evidence that a plain colour grid will be sufficient here.

[Majercik et al. (2019), sections3–5](https://jcgt.org/published/0008/02/01/paper-lowres.pdf), identify visibility as a major source of probe leakage and describe distance moments, backface weighting and biased interpolation. Those ideas inform the proposed safeguards. This proposal is a simpler precomputed one-bounce cache, not an implementation or performance reproduction of full DDGI.

RSMs represent reflecting surfaces as virtual sources; [Prutkin and Kaplanyan (2012)](https://cg.ivd.kit.edu/publications/2012/RSMC/RSMC.pdf) discuss clustering using position, normal and flux. Our resource estimates below are an engine-specific proposed layout. [Epic's SSGI documentation](https://dev.epicgames.com/documentation/unreal-engine/post-process-effects-in-unreal-engine) documents its visible-screen restriction. Inferring that this is a poor first fit for our roaming Drone is our judgement, not an Unreal performance comparison.

[Crassin et al. (2011)](https://research.nvidia.com/labs/rtr/publication/crassin2011givoxels/) use a dynamically updated, hierarchical GPU voxel representation. Their reported framerates are not transferable to this engine or current browser hardware.

As checked 20 October 2026, [GPUWeb's WGSL `rayQuery` request remains open](https://github.com/gpuweb/gpuweb/issues/11055). Browser hardware RT therefore cannot be a baseline requirement. Software ray tracing in compute or an offline CPU baker remains possible.

## Concrete experiment and resource envelope

1. Build a separate static surface BVH from production quads/materials. Trace from probe locations to the first surface, evaluate **only that surface's directly lit diffuse outgoing radiance**, including its shadow ray to the primary directional source, and integrate it. Never sample the GI result as source energy; that would add further bounces. Treat escaped rays as no reflected-surface bounce. Sky/ambient handling stays explicitly separate.
2. Store low-frequency directional RGB irradiance, initially four spherical-harmonic coefficients per colour (first order). Use actual geometry to reject or relocate probes inside solids. Add visibility/distance data and normal-aware interpolation; a bare trilinear colour grid is not an acceptable final result around ruins and thin walls.
3. Load one validated cache for the current level/lighting state. Sample in opaque shading, before material modulation and display conversion. Compare per-vertex interpolation with per-fragment lookup; the cheaper choice needs visual testing on large flat terrain faces and close-up moving units. Ordinary debris shares the opaque fragment shader, so its layout must remain compatible.
4. Keep preparation moves and combat independent of cache validity in this limited static-landscape scope. Level, source material/geometry or effective light changes invalidate the cache. Preview day/night overrides need matching caches or an explicit no-GI fallback, never a stale daytime cache. Optional caches should fail cleanly and preserve baseline rendering.

Planning arithmetic, not measured memory allocations:

| Candidate | Probe count | RGB first-order SH at 12 half-floats/probe | Two lighting buffers |
| --- | ---: | ---: | ---: |
|24-unit XYZ spacing, Y 24–168 |2,499|59,976 bytes /58.6 KiB|117.1 KiB|
|12-unit XZ, 24-unit Y, same range |9,471|227,304 bytes /222 KiB|444 KiB|

This illustrative region covers the platform and airborne receivers, with a negligible-bounce fallback above/outside it; it is not the Drone's flight volume. Counts exclude boundary guards, relocation/masks, visibility, bake data and alignment. Three `rgba16float` 3D textures could pack the SH values. Visibility-aware eight-corner blending cannot be obtained from just three hardware trilinear samples; its extra fetches must be budgeted.

For scale, an illustrative 8×8 directional distance-moment map per probe, padded to 10×10 in `rg16float`, adds about 0.95 MiB/coarse grid or 3.61 MiB/fine grid before atlas padding. Resolution and filtering remain provisional. First-order SH may also prove too coarse; higher order increases storage and lookup work. 128–256 rays/probe gives roughly 0.32–0.64 million primary bake rays/coarse grid or 1.21–2.42 million/fine grid, plus shadow rays at hits. No bake-time estimate is claimed.

An RSM with `rgba16float` flux and normal plus `depth32float`, reconstructing positions, needs 1.25 MiB at 256² or 5 MiB at 512², before gather targets. At a physical 1920×1080, one half-resolution `rgba16float` GI image needs 3.96 MiB; two history images need 7.91 MiB. An extra full-resolution RGBA8 four-sample albedo attachment plus resolve adds 39.55 MiB. Upgrading the existing four-sample/resolve opaque colour pair to RGBA16F also adds 39.55 MiB. These alternatives are not all required together; doubling each physical dimension multiplies these screen-sized costs by four. [Audit arithmetic](audit.json).

Cached shading avoids continuous ray tracing and temporal noise history, but it does add shader fetches. GPU time, bandwidth and MSAA tile cost are unmeasured. The first pass should be opt-in on a separate review page; do not add GPU benchmarking load during the current playthrough. Use optional [`timestamp-query`](https://www.w3.org/TR/webgpu/#timestamp-query) where available; otherwise report whole-frame/queue timing with its limitations and never label CPU submission timing as GPU execution time.

## Review criteria before integration

- Start with a small neutral/coloured corner test, then A1 daylight/night and the moving Drone. Add B4 water/bridge, C snow and D ruins after the lighting model is credible.
- Demonstrate one bounce and occlusion: a coloured wall transfers colour only with a lit reflecting face and an unobstructed transfer path; a blocking wall prevents the transfer. Black reflectors emit no reflected energy. Thin ruins, canopy undersides, bridge deck/bank boundaries and probe-inside-solid cases must be checked.
- Show static colour spill reaching a moving enemy without popping or view-dependent disappearance. Clearly demonstrate the limited moving-object occlusion scope.
- Keep the existing sharp silhouettes, direct shadows, source bloom, darker vista and missile-light curve. Use indirect-only and off/on views. Compare controlled ambient adjustment separately so it cannot disguise leaking or washout.
- Measure GPU/CPU frame time and allocation at real laptop/desktop resolutions and representative combat loads. No hardware target or numeric performance gate is approved yet. Include cold load/bake/cache behaviour, pause, resize, reload, level switches, rapid aborts and actual release of optional resources.
- No production integration until the user reviews the isolated result and its measured cost. This is a proposed next step; **research is complete, GI is not implemented**.
