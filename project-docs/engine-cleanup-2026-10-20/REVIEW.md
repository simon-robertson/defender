# Independent engine cleanup review

20 October 2026. Read-only review by a separate agent that authored none of the runtime changes. Compared the preserved source snapshot at `/private/tmp/defender-engine-20261020-euzacphu` with the current nine changed runtime files and inspected the three changed test files, production bloom GPU harness and recorded equivalence probes.

**Disposition: no actionable regression or blocking finding in the reviewed changes.** This approves the bounded cleanup for integration review; it does not establish a whole-game frame-rate improvement or replace the user's visual review.

## Correctness and ownership

- Bloom's composite now receives the renderer's local-light capacity. The default remains the preview capacity; the player shader can use all allocated sources. Blast extraction starts after both smoke and water particles, matching the ordinary display draw. No emitter class, blur setting, pass count or target size changes.
- Camera input registrations retain the exact target, handler and options required for removal. Disposal removes canvas and document handlers, clears references and movement state, and suppresses detached mode-change callbacks. Renderer disposal is idempotent, calls camera disposal, and ignores late errors from its retired device. Scene-only camera resets retain ordinary controls.
- Water-pool guards use counters maintained on allocation, expiry, collision and reset. Empty preparation still clears `particleCount`. Hoisted drag, square root and trigonometry retain the original arithmetic values and RNG call order; scalar writes restore every reused slot field. No lifetime, strength, collision, capacity or exhaustion rule changes.
- Spawn-cursor ordering relies on the existing ordered-time validation in `play/config.js`. The actor state array follows that validated source order; active actors preserve the same order through insertion/removal. Cursor reset occurs in `prepare()`, including wave restart. Spawn-relative motion, boundary splitting, health/lifecycle filtering and callback order are retained.
- Passing the active actor view to pose updates omits already inactive slots without changing active pose order. Moth wings retain the original two phase groups, multiplication order and reset signed-zero behavior. Explicit typed-vector arguments preserve the original component count and argument ordering throughout camera visibility, clearance, speed and anticipation calls.

## Evidence assessed

- New camera lifecycle test dispatches real `EventTarget` events across disposal/recreation and verifies retired handlers no longer intercept input or invalidate the old view.
- New renderer test checks expanded bloom shader declarations/loop bounds, identical extraction/display blast offsets, repeat disposal and ignored late device errors.
- New finite-spawn test checks simultaneous callback order, one pose batch, exhaustion and restart using the same active-view storage. Existing integration tests cover fixed-tick rates, spawn-relative motion and exit ordering.
- `cpu-results.json` records four matching before/after trace hashes, including active IDs, events/times, rig matrices, camera state, weapon state, wildlife, pause, settling and restart. Operation counts demonstrate the intended reductions; instrumented timings are not a browser frame-time measurement.
- `water-results.json` records matching seeded state/packed-particle hashes through idle, overflow, collisions, long/zero deltas and reset. Its isolated Bun timings and operation counts support only that fixture.
- `gpu-bloom.json` records 25 passing production GPU checks, including smoke/water prefixes, a light beyond the former preview limit and byte-identical bloom/ordinary water with zero emission. The corresponding harness constructs expanded bindings and exercises the actual composite and extraction pipelines.

No production files changed during this review. No browser driven and no duplicate test suite run: the lead owns the in-progress final focused integration run and browser review. Authored assets, accepted appearance, gameplay tuning and the running rollback are outside the cleanup changes reviewed here.

## Addendum: fixed player conditions

The user subsequently requested removing level-entry day/night and weather randomness, defaulting to daytime with weather disabled. Independently reviewed the additional changes to `play/conditions.js` and `tests/play-conditions.test.js`: **no actionable issue found**. `forLevel()` now returns a frozen `{night:false,weather:false}` while preserving same-level identity, retry behavior and `reset()`. The production caller supplies no RNG constructor argument. Existing composition applies the explicit false weather choice to the runtime clone, while each current Zone A source retains authored daytime at 10.5. The night-lighting helper and explicit condition fixtures remain available without being selected by normal player entry.

The revised test forbids `Math.random` during all sixteen configured wave-entry calls and after fresh-run reset, restores the global in `finally`, and retains the other two composition/runtime tests. No additional tests or browser actions were run by this reviewer. The lead reports the preceding cleanup integration completed with 150 passing tests and 2,239,025 assertions plus balanced preview/player resources; the lead owns the separate three-test conditions run and fresh-game browser check for this addendum.
