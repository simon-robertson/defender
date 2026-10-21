# Running rollback — 20 October 2026

The user rejected the isolated gallop prototype and requested rollback of everything related to running. Work on running is deferred; earlier research and running evidence are historical only.

Removed the runtime escape-certainty/acceleration controller, faster flight for certain escapes, running Dog phase/stance/lift/body-bank changes, rounded runtime corners, following/merge reservations, and escape-only missile potential-damage helper. Finite enemies advance at their configured ordinary speed again. Impact-only aim velocities, the original diagonal Dog walk, ordinary rolling/wing clocks and authored paths remain.

Removed both disposable motion review pages, the articulated gallop clone/controller, and run-only tests/audit scripts. No production model was replaced by the sixteen-part prototype. Its partial review found unresolved limb/torso clearance issues before the user cancelled it; it was not production-ready or accepted.

The softer water rings remain: peak opacity 0.30 and restrained shading from the water tint. All other completed GUI, environment, targeting, wave, economy and balance work is retained. The original deferred A2 targeting report remains separate.

Fresh verification:

- **84 tests pass**, zero failures: 61 across `play-engine`, `articulated-gait`, `enemy-impact`, `missile-flight`; 23 across `dog-preview`, `enemy-expansion-preview`, `water-impact`. Includes exact ordinary-speed progress of 12 and 11.4 units after one second for spawn-offset Dogs, walking contact/clearance, flying-route behaviour, impact recovery, missiles and finite-game success/failure. No full suite was run.
- Browser bundle builds from `play/app.js`.
- All 85 model/level source hashes match the preserved pre-running baseline. Both water effect source hashes exactly match the softer-ripple delivery.
- No active code references remain to the removed escape/sprint/prototype controllers. Historical documentation is explicitly marked superseded.
- Actual `/play/` loads and reaches fresh A1 preparation. [Restored game](restored-game.png).

No claim of a fresh full sixteen-wave balance run is made; the retained profiles/economy/layout assets were not changed by this rollback.
