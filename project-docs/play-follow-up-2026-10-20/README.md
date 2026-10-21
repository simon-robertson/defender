# Flat GUI and random level conditions — 20 October 2026

Implemented the requested finishing pass, then stop GUI iteration pending later user feedback. The turret report is recorded separately and deferred at the user’s request: [exact retained level/setup](turret-report.md).

## Delivered

Panels and buttons have flat outlines without bevel borders, offset shadows or pressed-depth movement. The main outer gutter is eight pixels, the battlefield/console gap is eight pixels, the wave-intel strip is shorter, and preparation spacing is tighter. Existing portraits, colours, control semantics, selection/focus cues and hidden Live cam functionality remain.

On entry to each playable level, choose day/night and weather on/off with independent 50/50 draws. Retain the choice across all four waves, purchases, upgrades, repositioning, pause and load retries. Entering the next level draws again; a fresh game/retry resets the choices. Title scenery stays authored. Night reuses the accepted preview sky/ambient/backdrop palette without changing light direction, intensity or shadow matrices. Weather uses the zone’s existing assigned type, including wet paving. Zone A uses rain; unsupported B weather remains clear. No saved level settings or player environment controls are added.

`play/conditions.js` owns the per-level choice. Weather is applied to the cloned play level before world construction; night is applied after renderer world activation. Load-error retry retains the pending candidate instead of accidentally retrying the previous session. The developer GUI fixture now renders each condition combination through the same production loading/lighting helpers.

## Verification and limits

- 32 affected tests pass, 10,377 assertions: [conditions, 3 tests](conditions-tests.log), [engine/deployment/presentation/session, 28 tests](affected-tests.log), and [historical A2 acquisition regression, 1 test](a2-tests.log). No full test suite was run.
- [40 screen/viewport compositions](viewport-checks.json) pass overflow, HUD, portrait-loading and hidden Live cam checks at 1280×720, 1024×768, 1920×1080 and 390×844.
- [All four condition combinations](conditions-browser.json) render through the actual WebGPU renderer. Rain states allocate 3,200 drops/102,400 seed bytes; clear states allocate zero. These are static composition checks, not a full weather campaign.
- A separate real `/play/` run randomly selected night/rain. Buying a gun and entering deployment retained both conditions and the same world load count: [browser record](actual-preparation.json), [actual game screenshot](actual-game.png). The user’s retained A2 run was read only.
- [Browser bundle builds](build.log). [All 85 asset hashes match](preservation.json); accepted layouts/models and frozen backup were not edited.

[Flat deployment](flat-deployment.png) · [Day clear](day-clear.png) · [Day rain](day-rain.png) · [Night clear](night-clear.png) · [Night rain](night-rain.png).

No targeting gameplay was changed in this finishing pass. The user could not reproduce the reported stall and explicitly deferred it. Earlier A2 experiments are limited to their recorded historical setups; the current guns/Arc arrangement is preserved for a future recurrence.
