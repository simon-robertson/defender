# Camera transition rollback, 20 October 2026

**Camera UI follow-up, 20 October (implemented):** Frame/Auto/Drone selectors, their phase actions/click handlers and obsolete hints are removed for now. Drone remains the run default; title/preparation overview, immediate ownership changes and pause remain. Browser checks cover title, preparation, deploy, wave and pause with no selector elements or renderer errors. [Current delivery](../water-regression-2026-10-20/README.md).

Removed the rejected timed overview↔Drone feature and its projection blending. CameraViews now gives the existing Drone controller direct view ownership immediately; return captures the restored overview immediately. The original Drone source remains unchanged, retaining its varied safe openings, high/far flight, predictive framing, continuous eased movement, zoom limits and simulation pause behaviour.

Deleted `play/view-transition.js`. Removed the mixed projection branch from `engine/camera.js`, the transition mode marker from `engine/renderer.js`, its linear-depth branch from `engine/shaders.js` and its vista branch from `engine/zone-vista.js`. Standard orthographic/perspective projection and shared inverse calculations remain. Updated campaign and indirect review viewers to use ordinary endpoints.

Replaced transition-specific tests with actual controller endpoint checks. The old CPU transition verifier is preserved only as `docs/todo-delivery-2026-10-20/verify-camera-transition.js.historical`; the active verifier now checks immediate endpoints and produces `camera-endpoints.json` here.

`play/app.js` integration is root-owned: remove transition diagnostics, pending-transfer state, wait/tick branch, run-loop overrides and transition guards; transfer immediately when settlement completes; Frame always frames immediately. Preserve the ordinary four-second effect settling phase. The parent integration report owns final live application and GPU verification. See `camera-tests.log` for exact results and the independent effects-pool test expectation reported during verification.
