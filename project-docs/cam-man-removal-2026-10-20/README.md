# Cam man removal — 20 October 2026

The user requested complete removal of Cam man. This supersedes earlier ground-camera approvals and restoration milestones.

Removed `play/live-camera.js`, its dedicated ground navigation and tests, the UI control/action, runtime ownership and diagnostics. Updated the campaign and Zone A review tools to use Drone. Drone is the sole optional action view; its viewfinder now has Drone-specific identifiers.

Replaced `engine/live-film.js` with `engine/camera-lens.js`: removed handheld profiles, grain, colour ageing, crop, distortion, fringing, vignette and film-time inputs. Drone retains its original depth-of-field arithmetic, lazy viewport target and pipeline reuse. Its settings buffer is now 32 bytes. Auto/Frame restore the overview and release the extra colour target.

Drone flight, anticipation and composition remain unchanged. No gameplay configuration, campaign balance, asset, layout, weather policy or combat-drone controller changes were made. Historical evidence remains as history.

## Verification

- 68 affected tests pass, with 221,434 assertions, across camera views, anticipation, Drone, automatic overview, shared camera and renderer. No full suite run.
- Eight actual WebGPU checks pass: production shader compilation, zero-error colour/framing identity without blur, sharp focus, near/far blur, resource reuse, pixel-identical paused frames and no validation errors. [GPU results](gpu-lens.json).
- Player and three affected review-tool entry points bundle successfully (100 modules).
- Refreshed the existing `/play/?inspect` tab. Verified absence of the Cam man element, Drone arming in preparation, Drone activation in combat, frozen Drone state across pause, and Auto/Frame restoration with lens bytes returning to zero. [Browser record](browser.json).
- Left a fresh A1 preparation open for review. [Screenshot](preparation.png).

These checks cover camera removal and retained rendering/lifecycle behaviour. They do not constitute new campaign balance acceptance.
