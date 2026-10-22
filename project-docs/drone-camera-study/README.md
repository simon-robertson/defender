# Drone camera study

Work happens on `drone-cam-logic-rebuild`. The current game director is retained while the player provides examples for a replacement.

Start the development server with `PORT=4290 bun server.js`, then open [the study tool](http://127.0.0.1:4290/tools/camera-study.html). It runs independently of the game on port 4289, uses the production renderer and native finite combat, and never loads or writes player progress. Critters are omitted from these tactical study scenes.

Choose a situation, adjust battle time, step a second, or find the next combat event. Watch battle lets the scene run; Freeze battle stops it again. Camera movement does not advance frozen combat or its effects. Rewinding reconstructs the same seeded simulation from its start. Times past wave completion show the actual completed time.

Click the viewport and use WASD to fly, Q/E for down/up, Shift for faster movement, and drag to look. Hold the on-screen movement buttons as an alternative. The camera can fly outside the board. Adjust the lens, aim at a selected enemy/defence, or use Whole level to reset. Tab while the viewport has focus hides/restores the controls; Full screen maximises the view.

Choose “A view I want” or “A view to avoid”, explain the reason, then Save shot + notes. Each save writes a new PNG and JSON pair in `shots/`, with a generated UUID. JSON retains the camera pose and viewport size, scenario/version, level/wave/time, placements, enemy/weapon/missile positions and recent combat events. Saved examples restore their moment and pose. Replays depend on the retained scenario definitions and current game sources; the PNG and recorded state remain evidence if those change later. Notes are only recorded when Save is pressed; keep them in the text box if a save fails.

The local API is append-only and checks same-origin writes, record bounds and PNG headers. This development tool and its notes stay outside the generated `docs/` deployment.

When examples are ready, inspect the saved PNG/JSON pairs together, derive framing and handover rules from the preferred/avoid notes, and then implement the replacement director. Static shots establish composition; use notes and different moments of the same fight to describe transitions, dwell time and priorities.
