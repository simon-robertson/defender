# Ambient occlusion in the current Defender engine

**Retired lighting experiment:** the user rejected GI and AO on 20 October. All related executable code, viewers, bake/audit scripts, GPU timing machinery and generated GI caches have been removed. The material below records earlier work, not current capability or a pending task. Other deliveries described here retain their separate status.

20 October 2026. Research only: source inspection, primary-source reading and texture-size arithmetic. No production code, assets, GPU prototype, installation or browser state changed.

**Ambient occlusion is feasible. The best first experiment is restrained, half-resolution screen-space AO applied only to opaque ambient lighting.** It could clarify contacts, steps and mechanical recesses. Appearance and GPU cost remain unmeasured; test A1 separately before integration.

AO estimates how nearby geometry blocks diffuse environmental illumination. It darkens sheltered regions; it cannot produce grass-to-rock colour transfer or replace directional shadows. Strong AO can over-darken corners because bounced light is missing. GTAO improves the visibility estimate; its paper treats interreflection separately. [Jimenez et al., primary GTAO memo](https://www.iryoku.com/downloads/Practical-Realtime-Strategies-for-Accurate-Indirect-Occlusion.pdf), [current indirect-colour audit](../indirect-colour-audit-2026-10-20/README.md).

**What the renderer already provides.** These are inspected code facts, not performance measurements:

- Stored, sampleable **four-sample `depth32float` camera depth**, produced before opaque lighting. No additional geometry pass is needed. [Allocation](../../../engine/renderer.js:405), [prepass](../../../engine/renderer.js:50), [depth reads](../../../engine/shaders.js:91).
- Resolved `rgba8unorm` **world normals in RGB, reflectiveness in alpha**, written during opaque shading: **not available immediately after the prepass**. Silhouettes can mix normals/background. [Normal output](../../../engine/shaders.js:73), [resolve](../../../engine/renderer.js:410).
- Inverse view-projection and camera/viewport data; existing `worldAt` reconstruction and `linearDepth` support orthographic and perspective projections. [Uniforms/reconstruction](../../../engine/shaders.js:3), [camera matrices](../../../engine/camera.js:87).
- Separate ambient, sunlight, emission, local lighting and specular terms. Current `.68 + .32 * max(n.y, 0)` ambient weighting is orientation shading, not spatial AO. Debris shares this shader. [Lighting](../../../engine/shaders.js:65), [debris](../../../engine/damage-shaders.js:1).

A final-image darkening filter would also dim sunlight, muzzle illumination and glowing panels because those contributions are already combined. Instead, multiply the ambient term before composition, in linear colour, retaining the existing material colours and other lighting. This matches the usual restriction of diffuse AO to indirect illumination. [Filament lighting reference](https://google.github.io/filament/main/filament.html#lighting/occlusion).

**Technique choice.** The following costs and suitability judgments are proposals/inferences from our renderer and the cited methods.

| Approach | Fit here | Main limits |
| --- | --- | --- |
| Simple depth/normal SSAO | Smallest implementation for a diagnostic baseline; supports moving units and deployments. | Empirical kernels can produce noisy or exaggerated dark rims; sample count/filtering need review. |
| Horizon/GTAO-style screen-space AO | Recommended candidate: short world-space reach, bounded sampling, spatial denoising. | Visible depth is an incomplete representation; thin surfaces and hidden/off-screen occluders remain approximate. |
| Static world/per-vertex bake | Stable, view-independent shading with little runtime sampling. | Cannot follow deployed/moving units; large merged faces miss local detail unless subdivided or sampled differently. |
| Per-model/voxel-corner bake | Suitable for fixed self-recesses without model textures. | Inter-part motion invalidates bind-pose occlusion; does not ground a moving model in the landscape. |
| Runtime world-voxel/ray AO | Could see hidden geometry and produce view-independent contacts. | Requires a new spatial representation/update path and substantially broader investigation than a small screen-space pass. |

Intel's ASSAO documents depth preparation, optional normal reconstruction, scalable sampling and edge-aware denoising. [Intel ASSAO](https://www.intel.com/content/www/us/en/developer/articles/technical/adaptive-screen-space-ambient-occlusion.html).

XeGTAO demonstrates horizon evaluation and spatial filtering without requiring TAA; temporal sampling uses TAA when enabled. Its DirectX/HLSL implementation is archived and MIT licensed: a WGSL design reference, not a maintained WebGPU package or performance proof. [Intel XeGTAO repository](https://github.com/GameTechDev/XeGTAO).

**Proposed pass arrangement.** Propose **four additional half-resolution fullscreen passes**, then inline upsampling during existing opaque shading:

1. Prepare representative depth from each 2×2 full-resolution block, reading the four MSAA samples at each source pixel. Reject clear depth and avoid averaging unrelated surfaces.
2. Estimate horizon AO and discontinuity-aware normals from depth; compare bounded 8/16/24-neighbour settings. No model attribute is needed.
3. Filter horizontally with depth/edge rejection into a second AO image.
4. Filter vertically back into the first image. During existing opaque shading, upsample with depth agreement and apply the result to ambient only. Reject mismatched surfaces rather than smear shadows.

Each pass reads completed textures and writes a different attachment; there is no same-pass feedback. Add an AO binding, neutral disabled fallback, settings and resource lifecycle; preserve other pipeline layouts. WGSL supports explicit per-sample depth loads; multisampled textures cannot use ordinary filtered sampling. Use `textureLoad` and an appropriate unfilterable binding for prepared `r32float`, avoiding a new float32-filtering requirement. [WGSL texture operations](https://www.w3.org/TR/WGSL/#textureload), [WebGPU format capabilities](https://www.w3.org/TR/webgpu/#plain-color-formats).

Alternatively move normal output/resolve into the prepass, reusing allocated targets but adding fragment/MRT work there and changing debris/opaque pipelines. The existing normal MSAA+resolve footprint is **20×W×H bytes**: 63,283,200 bytes at 2560×1236. This is a format/sample footprint, not measured bandwidth. Moving output removes its opaque write; duplicating targets allocates that amount again. Test depth reconstruction first; retain existing normals for SSR.

**Resource estimate.** Let `H = ceil(renderWidth/2) × ceil(renderHeight/2)`. One `r32float` depth image and two `r8unorm` AO images require **6H nominal bytes**. Raster passes avoid depending on single-channel storage-texture support. These estimates exclude allocation padding/compression, small uniforms, optional mip/history/normal/edge-guide images and diagnostic targets.

| GPU target dimensions (examples) | AO dimensions | Prepared depth | AO pair | Added nominal total |
| --- | --- | ---: | ---: | ---: |
| 1920×1080, representative HD | 960×540 | 2,073,600 B | 1,036,800 B | 3,110,400 B / 2.97 MiB |
| 2560×1236, documented prior framebuffer | 1280×618 | 3,164,160 B | 1,582,080 B | 4,746,240 B / 4.53 MiB |
| 2560×1440, representative QHD | 1280×720 | 3,686,400 B | 1,843,200 B | 5,529,600 B / 5.27 MiB |
| 3840×2160, representative UHD | 1920×1080 | 8,294,400 B | 4,147,200 B | 12,441,600 B / 11.87 MiB |

Use canvas render dimensions, not CSS dimensions: the renderer applies device-pixel ratio capped at two and the device texture limit. At 2560×1236, sixteen AO neighbours mean 12,656,640 nominal locations; preparation can separately require that many depth loads. Filtering/reconstruction/upsampling add work. This does not predict milliseconds or bandwidth. If AO precision needs two `r16float` images, total proposed storage becomes **8H**. Depth mipmaps are a later optimization to evaluate if large-radius sampling is costly. Depth prefiltering/reconstruction are established bandwidth-oriented techniques. [Renderer sizing](../../../engine/renderer.js:423), [Scalable Ambient Obscurance](https://research.nvidia.com/publication/2012-06_scalable-ambient-obscurance), reproducible inventory and arithmetic (removed), [results/source hashes](inventory.json).

**Camera and material cases that decide suitability.** Overview needs parallel rays/orthographic footprints; Drone needs position-dependent rays and distance/FOV-dependent radius. Reuse inverse projection. Start with a short radius in world units, for example 2/4/8-unit comparisons against the 24-unit placement grid. A fixed pixel radius would change apparent contact scale between views.

Thin foliage, legs, barrels and silhouette edges can look like deep occluders in a depth heightfield. Half-resolution representative depths can erase thin geometry or expand it; MSAA-minimum depth can disagree with resolved normals. Reject large depth/world-distance differences, use a finite thickness/falloff and edge-aware upsampling. Flying enemies must not create a dark contact smudge on distant ground. Off-screen/back-facing occluders remain unavailable; camera motion can reveal missing occlusion.

Initially include opaque geometry/debris only. Water uses separate depth/normal and transmission/reflection; smoke, droplets and glow lack opaque representation. Exclude them as solid occluders/receivers. The bed can receive opaque AO, which then appears through existing refraction/transmission. Skybox/vistas use independent depth and should remain outside this calculation; the DOM GUI stays unaffected. [Water/display ordering](../../../engine/shaders.js:116), [render sequence](../../../engine/renderer.js:441).

**Caching and temporal stability.** Recompute AO when camera/projection/viewport, opaque geometry/debris, scene or AO settings change. Reuse it for lighting-only redraws, including transient lights, and unchanged paused views. Link invalidation to actual depth/camera changes rather than every colour update. A moving Drone normally incurs the pass cost each frame. The current renderer has MSAA, not a temporal history/reprojection or motion-vector pipeline. Begin with fixed spatial sampling/filtering. Temporal accumulation would add history storage, previous transforms, motion/disocclusion rejection and resets for immediate view switches, loads, resize and changed moving actors; static-world reprojection alone would ghost moving units.

Our greedy mesher stores eleven floats per vertex without AO. Baking requires a separate attribute/sampling representation and possibly reduced merging; albedo baking would incorrectly dim direct/emitted light. Part-local self-AO can follow rigid motion, but inter-part/world bakes become stale. [Current mesh format](../../../shared/mesher.js:35), [NVIDIA surface-element/baked-AO discussion](https://developer.nvidia.com/gpugems/gpugems2/part-ii-shading-lighting-and-shadows/chapter-14-dynamic-ambient-occlusion-and).

**Proposed isolated proof, not implementation authorization:** A1 off/on/AO-only day/night, overview and moving Drone. Check contacts, recesses, foliage/legs, flying enemies, debris, water and light events; unchanged direct/emissive/flat-plane output, no halos/contact smudges, pause/switch stability and cleanup. Measure the whole frame and individual passes using the existing optional GPU timestamp capability where supported, plus CPU/memory at actual render resolutions. Retain the existing low-poly palette; reject gains that merely make everything muddier. If future GI is integrated, avoid multiplying already visibility-resolved bounce by overlapping AO. AO must remain outside targeting, LOS and navigation. No source benchmark timing predicts this engine.
