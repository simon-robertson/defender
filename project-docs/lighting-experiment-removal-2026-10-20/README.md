# Indirect lighting and AO removal — 20 October 2026

The user rejected both lighting experiments because their visual contribution was too small and authorised complete removal. Both are now removed, rather than disabled behind retained experimental controls.

Removed the GI probe baker/cache/interpolation implementation, GI and AO review renderers/viewers, AO shaders/fixtures, experiment-only tests, research audit scripts, generated day/night GI probe/BVH data and the experimental GPU-query/readback machinery. The production renderer no longer has the optional `afterDepthPass` callback or the experimental `timestampQueries` option/device-feature request. Removed four experiment-only cases from the renderer test file and its subclass injection/import. [Exact 23-file removal list](removed-files.json).

Historical reports, measurements and screenshots remain labelled as retired evidence. Their viewers and executable reproduction scripts no longer exist. Design/rendering notes and TODO status reflect the rejection; no GI/AO integration or optimisation follow-up remains. GPU HUD timing is still independently queued as TODO 14; TODOs 15–19 are also unchanged.

Existing ambient fill, directional/local lighting, shadows, SSR, water, bloom, vistas, gameplay and authored assets are preserved. No browser action, server restart, player-tab reload or run reset was performed.

## Verification

- **44 affected tests pass**, 1,812 assertions: renderer pass order/invalidation/resources/effects, biome vistas, footer performance and isolated server integration. [Renderer/vista/performance log](affected-tests.log) · [Server log](server-tests.log).
- **Three browser bundles build**: player, preview and editor, resolving web-root imports through a build-only plugin. [Build log](build.log).
- All **86 model/level sources** and every captured frozen-backup file have identical SHA-256 hashes. All captured existing code outside the renderer and its test file is either unchanged or explicitly listed for removal. [Verification](verification.json).
- No executable imports, shader symbols, timing options or hooks belonging to either experiment remain in the active source tree; removed files and generated GI caches are absent.

The initial plain CLI build could not resolve the project's browser-root imports; the build-only resolver fixed the check without changing project code. The initial server-test attempt could not bind a temporary local port inside the sandbox; the same existing tests passed with local-socket access. No new GPU visual comparison was run: production shaders/assets are unchanged and this removes an unused extension point and optional device feature.
