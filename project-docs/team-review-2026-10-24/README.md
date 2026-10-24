# Team review — 24 October 2026

The user authorised the whole team to review and improve the game where justified, excluding audio, followed by engine cleanup, local commit and deployment. Artist, Tactician, Engineer and Researcher used `gpt-6.1-sol` at `high` effort for their bounded diagnostic assignments; the lead owned GUI changes, browser review and integration.

## Delivered improvements

- Deployment feedback and Cancel remain beside the heading, outside the scrolling roster. The 390×844 deployment console gains 60 pixels to retain a complete visible roster row alongside guidance. Ordinary desktop layout remains seamless.
- Entering deployment with an undeployed unit, or explicitly selecting a unit during deployment, focuses the board without scrolling. Existing arrows/Enter/Escape controls now have visible and accessible instructions. Loadout selection retains its focus.
- Shop and upgrade locks use actual configured zone-local area/wave labels: A2, A3, or B1 · WAVE 3. Eligibility, prices and numerical balance are unchanged. Already unlocked items skip this new lookup and object allocation.
- The speed control's accessible name agrees with its current target action and tooltip.
- Removed two unused per-landscape placement closures left by defence Drone removal. Corrected the model-aesthetics test's fixture directory after the documentation migration.

Artist validated and compiled all 67 canonical model sources in memory: finite vertices, matte materials, 176,383 authored cells and 15,402 exposed quads across variants. Fresh A3/B2/C3/D4 captures retain distinct biome palettes, visible courts and readable routes. No model, palette, scenery, effect or balance change was justified. Preparation captures do not establish contrast for every moving enemy or human difficulty acceptance.

## Engine cleaning and optimisation decision

The final engine review covered renderer invalidation, planar reflection reuse and re-enable, particle expiry, model-light ownership and scene release. No further production engine change was justified.

A water AABB support-corner rewrite initially matched 12,000 ordinary comparisons. Adversarial exact-boundary inputs exposed floating-point regrouping differences; preserving original corner arithmetic near the boundary fixed the sampled discrepancy, but its extra absolute-value/max work made the resulting helper slower. The entire rewrite and its temporary tests were discarded. `engine/planar-reflection.js` remains byte-identical to the prior commit.

| Isolated warmed Bun microbenchmark | Original | Rejected candidate |
| --- | ---: | ---: |
| 500,000 classifications over 256 native-scale camera/water-bound fixtures | 10.7–11.2 ms | 17.3–17.5 ms |

These are helper CPU measurements on mostly visible fixtures, not whole-frame CPU/GPU time or FPS. No new production GPU resource/pass or engine cache is added. Reproduce the rejected experiment with `bun project-docs/team-review-2026-10-24/frustum-benchmark.js`; it also compares 100,000 deliberately on-plane cases. The two experiment scripts in this evidence folder are not game dependencies and are excluded from deployment.

## Fresh verification

- Final GUI/session/briefing/speed/model-aesthetics check: **41 passes**, six files. Command: `bun test tests/play-review-ui.test.js tests/play-session.test.js tests/play-ui-follow-up.test.js tests/play-speed.test.js tests/play-briefing.test.js tests/enemy-aesthetics.test.js`.
- Artist's nine model/rig/material suites: **37 passes**. Files: power-generator, turret, enemy-eyes, wildlife-models, enemy-aesthetics, enemy-models, missile-launcher-model, arc-spire and enemy-expansion-models tests. Counts overlap the final check; do not add them together.
- Tactician's bounded session/config/briefing/conditions/native simultaneous-entry/placement/route/roster/UI checks: **57 distinct passes** in its review. These also overlap the checks above.
- Isolated built-in Chrome native A1: build, upgrade, precise locked Upgrade II/A2 label, Deploy→board focus, arrow selection and Enter placement, Start, 2× state/name, Drone output and return to preparation. First wave: three kills, zero escapes, +2 tokens. Explicit deployed-roster selection returns focus to the board. No reported console/WebGPU warning/error or game error.
- Current A3/B2/C3/D4 day composition fixtures inspected. Deployment at 1280×720 and 390×844 retains zero panel seams, no horizontal overflow and loaded portraits. Narrow roster scroll viewport is 119 pixels with 53-pixel rows.
- Actual A2 production water at overview and close perspective: planar active, reflection off then re-enable restores 43 mirrored draws, no reported errors. This is a composition/lifecycle check, not a GPU-performance comparison.

Three existing `play-deployment.test.js` pose-preservation assertions fail identically on untouched HEAD: current safe wildlife relocation conflicts with their older exact-pose expectations. The older `play-a2-bridge.test.js` species-shot assertion also fails identically on untouched HEAD. These baseline failures were classified, not converted into speculative gameplay changes. No full test-suite or fresh full-campaign balance claim is made.

## Screenshots and delivery

[Packaged revised deployment](packaged-deployment.jpg), [native revised deployment](native-deployment.jpg), [narrow revised deployment](narrow-deployment.jpg), [A3 before](a3-deployment-before.jpg), [B2](b2-arsenal.jpg), [C3](c3-arsenal.jpg), [D4](d4-arsenal.jpg), [A2 water](a2-water.jpg).

Local package: `docs/index.html`, generated by `bun run deploy:local`: 206 files, 116 modules, 16 levels, 65 runtime models, 20,709,460 bytes. Existing delivery audio files are copied by the unchanged packager; no audio source, preference, behavior or asset was edited. `bun run check:deployment` passes: output hashes, correct MIME/exact bytes and runtime-only boundaries at both / and /defender/, all sixteen packaged levels and all 64 wave starts, portrait coverage and critter-off ownership. A separate static-only browser at /defender/ verifies New Game, purchase, Deploy→board focus, the revised guidance and zero reported errors. Task changes and generated package are included in the local delivery commit. No remote push/publication or reload of an existing player session.
