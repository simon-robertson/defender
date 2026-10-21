# Player-loop refinements — 19 October 2026

Implemented the user's first gameplay feedback at `/play/`. Gameplay acceptance and final balance remain open; this delivery changes presentation and scene continuity, not accepted assets or combat tuning.

- **Title:** closer fixed orthographic view covers the viewport. Manual zoom, orbit and pan are disabled on title and restored after Play. Corner coverage is checked at portrait, square, standard and ultrawide sizes.
- **Deployment:** placement, moves, removal and tier upgrades update existing bounded GPU slots. The loaded world, static scenery/water, visibility index, camera and live wildlife remain intact. Same-level waves reuse six Dog slots with fresh finite spawn identities. New landscapes and fresh runs retain normal scene loading/cleanup.
- **Wave ending:** after the last enemy resolves successfully, effects and wildlife continue for four seconds before the reward/preparation or final completion. Buying and deployment remain locked. P pauses this settling period; resuming does not consume paused time. `play/config.js` exposes `waveSettleSeconds: 4`. Defeat remains immediate.

## Verification

**81 unique affected checks pass; no full-suite run.** Recorded execution results are in [tests.txt](tests.txt).

- 20 camera/configuration/session/presentation checks: title coverage and disabled input, four-second reward gate, pause, invalid time, reset, exact-once progression and existing camera controls.
- 61 engine/world/renderer/model-light/wildlife/deployment checks: real A1/A2 edits, 96 repeated changes without new GPU scene buffers, once-only disposal, retained wildlife identities/poses/journeys/flights, atomic occupied-ground rejection, selective future-route recovery, actual same-map wave turnover without fetching, complete eight-wave success and ten-miss failure.
- Built-in browser: title coverage/zoom lock; place → remove → move → upgrade without a reload; first successful wave settles before rewarding; P freezes the remaining settlement and presentation time; four A1 waves complete with zero misses, eight tokens after spending two, and one subsequent load for A2. Scene counts remain **2 loads / 1 unload** throughout A1 edits and all four waves, then **3 / 2** on A2. No console/WebGPU warnings or errors were captured.
- A final fresh build check verifies the corrected title accessibility label, initial safe wildlife setup, occupied-ground rejection without mutation, and successful placement on clear ground without reloading. The earlier live four-wave run began before the initial-seed follow-up; final A2 initial-load/deployment coverage is provided by the real-world automated check.

See [browser observations](browser-review.json), [title](title.png), [deployment](deployment.png), [settling](settling.png), [paused settlement](settling-paused.png) and [A2 transfer](level-transfer.png).

## Wildlife and resource limits

Initial play composition chooses connected usable wildlife seeds, including when no guns are placed. This corrects confined A2 source homes only in the player scene. Later edits never reseed live actors: valid journeys persist, invalid future routes replan after a safe current edge, and an edit overlapping a current animal/flight or isolating its ground is rejected with a retry message.

The two gun-tier pools reserve sixteen slots each, but at most sixteen deployed guns contribute draw/light membership. Six allocated Dogs plus actual guns remain within **72 model / 120 combined light slots**, with zero observed overflow. CPU navigation and planner data may be rebuilt during an edit; the claim is preserved scene/GPU ownership, not zero allocations or a measured hardware frame-time target. Browser visual review used 1280×720; other viewport coverage was checked mathematically.

All **85 active asset sources**, **69 frozen snapshot files** and the frozen archive hash remain unchanged. [Asset comparison](asset-preservation.json), [backup comparison](backup-preservation.json).
