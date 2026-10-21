# Higher and farther Drone camera

20 October 2026. User requested higher altitude and more distance from enemies. Implemented for visual review.

| Camera preference | Before | Now |
| --- | --- | --- |
| Filming height above path | 60 / 96 / 128 | 120 / 152 / 184 |
| Preferred horizontal standoff | 128–140 | 176–192 |
| Useful horizontal holding band | 100–180 | 148–236 |
| Minimum height above authored flying aim | 60 | 100 |
| Clearance above reserved flight-lane top | 12 | 24 |
| Minimum transit height above path | 120 | 200 |

Candidate scoring, subject selection, encounter anticipation and shot retention use the farther preference. Destination separation from actual enemies and forecast encounters now rejects distances below 150 units, and rejects horizontal gaps below 132 when vertical gaps are below 112. These are composition preferences, not a guarantee of a fixed distance from every moving actor during travel. Swept physical clearance remains authoritative.

Smooth flight, survey drift, gimbal response, 51.266–76° lens limits, depth of field, pause and overview restoration remain unchanged. No assets, layouts, combat settings or renderer changes.

## Verification

20 affected tests pass with 217,986 assertions. [Baseline](before.log) and [final checks](after.log) cover actual A1/A2 flights at 30/60/120 Hz, current A2–A4 airborne waves, enabled/disabled combat equality, static and actor clearance, anticipation, motion rate limits and pause/restoration. Test fixtures now exercise the higher stations and assert the farther held framing.

| Actual wave sample | Previous closest flyer distance | New closest flyer distance | New minimum vertical gap |
| --- | ---: | ---: | ---: |
| A2 | 100.33 | 126.54 | 100.28 |
| A3 | 108.62 | 152.84 | 100.02 |
| A4 | 89.29 | 133.18 | 100.65 |

No sampled physical overlaps or stalled frames occurred. A3/A4 each recorded one rejected movement step, handled by the existing clearance fallback. These finite runs do not certify all possible deployments.

Refreshed the existing player preview and observed the active A1 Drone at approximately Y149 (125 above the path), 212 horizontal units from its focus. Clean depth of field and smooth survey motion remain active. Pause preserves camera state; Auto releases the lens target and restores overview. [Browser evidence](browser.json) · [Aerial screenshot](drone.png).

Left a fresh A1 preparation open with Drone armed. Final appearance remains for user review.
