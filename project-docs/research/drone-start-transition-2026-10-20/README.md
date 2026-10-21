# Drone camera level-start transition investigation — 20 October 2026

**Confirmed defect; fix queued as item 2 in the [current TODO](../../../TODO.md).** The user reports that the Drone appears to fly up and away, then comes back when a level run begins. This pass investigates and records the fix; it does not change the running game or implement the correction.

The underlying problem is projection feedback during the landscape-to-Drone hand-off. It reproduces using production camera/controller code without a browser or GPU. The apparent withdrawal is a framing error; the physical Drone does not need to climb to produce it.

## Cause

1. [CameraViews.sync](../../../play/camera-views.js:21) captures a correct destination on entry: the Drone is live/perspective, so the target projection blend is 1. The transition starts from the landscape's orthographic blend 0.
2. [ViewTransition.apply](../../../play/view-transition.js:13) stores its current mixed projection on the shared camera as `transitionProjection`.
3. [DroneCamera.apply](../../../play/drone-camera.js:258) writes its own position/orientation/FOV into that camera but leaves the transition's projection field attached.
4. Each [CameraViews.advance](../../../play/camera-views.js:25) refreshes the destination with `viewPose(camera)`. [viewPose](../../../play/view-transition.js:4) prefers that attached intermediate blend over the live-mode destination value.
5. On the first frame, the intended destination blend becomes 0. It remains 0 throughout the hand-off, while zoom moves towards `900*tan(FOV/2)` under an orthographic projection. The scene shrinks dramatically. At completion, [advance](../../../play/view-transition.js:16) removes the override and ordinary perspective suddenly takes over, making the scene spring back.

The overview also uses a synthetic eye 900 units from its target, while the physical Drone starts at its safe cruise height. These are distinct camera representations. After correcting the confirmed feedback, the remaining eye/zoom/framing path still needs visual validation; the report does not claim that forcing one blend scalar alone is a complete fix.

## Reproduction

Run from the repository root:

```sh
bun docs/research/drone-start-transition-2026-10-20/replay.mjs
```

The [trace](replay.json) uses production `Camera`, `DroneCamera`, `CameraViews`, `ActionCamera` and `PlayEngine`. It mirrors the player frame order at 60 Hz: engine advance, camera coordinator advance, then `Camera.update`. It runs A1/B4's actual first wave with no defences, a 1200×800 viewport and deterministic cosmetic random 0.5. It projects a fixed 12-unit vertical marker at the opening subject to measure apparent scale. No browser, graphics device, active player state or combat configuration is modified. The five implicated source hashes are checked unchanged after the replay.

| Observation | A1 | B4 |
| --- | ---: | ---: |
| Correct destination projection at entry |1|1|
| Destination after first camera frame |0|0|
| Blend throughout active transition |0|0|
| Transition completes |1.05s|1.05s|
| Physical Drone Y range during 1.5s replay |206.21–224|224–224|
| Marker initial height |19.24px|16.03px|
| Minimum marker height |5.83px|7.01px|
| Marker-size jump on completion |4.15×|3.56×|

B4 reproduces the apparent withdrawal while the physical camera remains at Y 224, separating the projection defect from an obstacle-avoidance climb. This is a deterministic native-code reproduction, not a claim to have captured the user's exact level, camera seed or screen recording. The existing production endpoint/inverse-matrix tests and the coordinator lifecycle test in [play-polish.test.js](../../../tests/play-polish.test.js:17) do not assert intermediate projection progress or subject-scale continuity; those regressions are needed with the fix.

## Pending fix and verification

- Obtain the live destination's position/orientation/FOV/projection from the Drone's unblended state, while preserving the actual displayed source pose when a transition is interrupted or reversed. Avoid changing generic `viewPose` so it loses legitimate interrupted-transition state.
- Confirm the blend advances smoothly towards perspective, and that the camera no longer widens away from action before returning or jumps on the final frame. Revisit the synthetic overview-eye/zoom interpolation if necessary.
- Retain the accepted higher/farther flight, safe actor/scenery clearance, smooth drift, varied opening positions, pause behaviour and 1.05-second eased hand-off unless a later presentation decision changes it. No combat-drone behaviour, game balance or manual-control change is part of this fix.
- Cover 30/60/120 Hz, common viewport aspects, first/subsequent waves, retries, level changes, mid-transition pause, Drone/Auto changes and return to landscape. Include real rendered review after the CPU regressions.

No fix has been applied. The user's requested order remains indirect lighting first, this camera fix second.
