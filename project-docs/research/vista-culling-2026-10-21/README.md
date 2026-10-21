# Vista culling feasibility — 21 October 2026

Research only. The user's condition is that culling must save hardware resources overall. No culling is added to production during the subsequent all-zone fidelity/blur update.

## Finding

Frustum culling is technically possible, but there is not yet evidence of a net saving in this renderer. Hold production integration. This is an unproven benefit, not a measured regression or a claim that all culling is expensive.

Our “skybox” includes actual distant terrain and vegetation. `ZoneVista.render()` submits one sky triangle and one terrain draw, and skips the pass entirely when camera, lighting and size are unchanged. Ordinary GPU clipping already prevents off-screen primitives from shading off-screen pixels; earlier culling could additionally avoid their vertex processing. It would not remove the on-screen vista colour/depth targets or the final full-screen composite.

A traditional six-plane test against the gameplay frustum would be incorrect here. The vista vertex shader uses a separate background depth mapping. In overview it also replaces orthographic projection with focal-distance perspective (`clip.xy *= 900`, `clip.w = view depth`). A valid culler must reproduce those side planes conservatively, retain bounds crossing the eye plane and avoid using the gameplay far plane. Otherwise clearly visible distant scenery can disappear.

## Cheapest candidate

Partition the static mesh into a modest number of spatial regions once at level load, retaining full triangle bounds. Test only region bounds on frames that already redraw the vista, submitting the surviving ranges from a shared vertex buffer. Bounds crossing screen edges stay. This is an engineering inference from our simple static renderer: it avoids a compute pass, GPU readback, indirect-command validation and per-tree traversal. It adds CPU bounds tests, several draws instead of one, a small bounds/range table and startup partitioning; geometry residency need not increase if the mesh is reordered in place during generation. It cannot guarantee a saving on every camera or device.

Do not start with per-triangle CPU checks, occlusion queries, depth-pyramid occlusion or a new GPU compute/indirect pipeline for this scene. Those add work or resources beyond the coarse candidate, and our vista already benefits from a static cache. Indirect culling is supported, but is not automatically cheaper: the WebGPU implementer's firsthand [indirect-draw guidance](https://toji.dev/webgpu-best-practices/indirect-draws.html) describes backend-dependent validation costs and why command buffers should be shared. Its historical measurements are not estimates for this host. The [WebGPU render-bundle guidance](https://toji.dev/webgpu-best-practices/render-bundles.html) demonstrates the GPU-culling alternative without CPU readback.

## Evidence needed for a go decision

Use the final unblurred all-zone geometry as the baseline. Alternate culling off/on in matched overview and moving Drone shots; measure full-frame GPU timestamps plus CPU cull/encode time and memory, not vertex-count reduction alone. Include wide shots where most regions remain visible and cached stationary frames. Compare edge coverage/pixels and resize, near-eye, overview/perspective and all-zone cases to rule out popping. Only integrate after a repeatable GPU or frame-time saving outweighs added CPU/command work without material memory growth. Reject it if the cost is higher or the apparent saving is within measurement noise.

The earlier Zone A fidelity timestamps and the latest all-zone timestamps compare visual revisions, not culling. They do not establish a culling benefit. No culling benchmark or hardware saving is claimed by this research result.
