# Isolated AO shader implementation

`tools/ao-shaders.js` supplies review-only WGSL. It is a bounded horizon-style SSAO estimator, not an exact GTAO implementation. It does not change production shaders, material sources, world geometry, simulation or the active player run. GI is excluded.

The fullscreen entrypoint is `fullscreen`. Fragment entrypoints are `prepareDepth`, `evaluateAO` and `filterAO`. Group 0 reuses the existing Frame uniform. Each module declares only its required group-1 resources:

| Module | Bindings |
| --- | --- |
| `aoPrepare` | 0: four-sample camera depth; 3: AO settings |
| `aoEvaluate` | 1: prepared `r32float` depth; 3: AO settings |
| `aoFilter` | 1: prepared depth; 2: source AO; 3: AO settings |
| `aoOpaqueBindings(2)` | Group 2 binding 1: prepared depth; 2: final AO; 3: AO settings |

Settings occupy three vec4 values / 48 bytes. `params` is world radius, strength, world bias and diagnostic mode. `size` is full width/height and half width/height. `kernel` is horizontal/vertical filter direction, steps per direction and a spare value. Two/four/six steps across four directions mean eight/sixteen/twenty-four neighbouring depth samples. AO textures store raw visibility: one is open ambient, zero fully blocked. Strength is applied by `aoAmbientFactor(pixel, world, normal)` during the opaque ambient term only.

Preparation stores the nearest valid depth from each 2×2 full-resolution region and its four MSAA samples. Reconstruction uses the current inverse view-projection and homogeneous division. Per-half-pixel world size determines sampling radius in both orthographic and perspective views. Normals use the closer valid depth neighbour on each axis to reduce discontinuity errors; degenerate reconstructions fall back towards the viewer.

The estimator keeps one maximum positive elevation per direction, with world bias, finite radius falloff and a conservative front-depth thickness heuristic, then averages their squared obstruction. It does not infer hidden geometry or true object thickness. Fixed spatial directions avoid introducing temporal noise/history into this first review.

Two five-tap separable filters reject samples that leave the reconstructed receiving plane. Opaque upsampling blends four neighbours with actual fragment-normal plane guidance, finite world-distance rejection and an unoccluded fallback when no sample matches. The final helper changes ambient only; it does not sample the attached opaque depth buffer. Water, particles, glow, vistas and GUI are not independently shaded by this helper. The root integration owns pipeline layouts, caching, debug presentation, lifetime and disabled behaviour.

[Six CPU reference tests](shader-tests.log), 32 assertions, pass. Analytic geometry independently generates depth for flat planes, one wall, a two-wall corner, distant floating geometry and absent/background samples. The reference also checks orthographic radius invariance and perspective distance scaling using actual Camera matrices. These are checks of the estimator's geometric assumptions and pipeline interface, not GPU equivalence or image-quality proof. Actual WGSL compilation and diagnostic readbacks are owned by the lead's isolated GPU review.

Known limits include nearest-depth half-resolution silhouette expansion, sparse directional sampling, reconstructed-normal error, hidden/off-screen geometry, approximate thickness and filtering across geometry smaller than a pixel. Whole-frame cost, readability and temporal behaviour must be judged from actual review evidence.
