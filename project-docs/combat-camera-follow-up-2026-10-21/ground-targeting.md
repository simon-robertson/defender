# Ground-first gun targeting — 21 October 2026

Implemented the user's rule: a stationary gun turret cannot acquire, retain or fire on a flying enemy while any active living ground enemy is inside that gun's inclusive horizontal range. Range uses the enemy actor root, matching the existing gun range contract. Articulated aim offsets and height do not change ground presence. Scheduled, dead, escaped, removed and out-of-range ground enemies do not suppress air targeting.

Ground presence deliberately includes enemies obscured by scenery, beyond the gun's pitch limits, or already covered by incoming/cooperative damage. Actual ground shots still require the existing live range, pitch, yaw and both-muzzle LOS validation. If there is no valid ground shot, the gun waits. Air resumes after ground presence ends and that gun receives its next ordinary thinker turn.

## Ownership and implementation

- `game/turret-preview.js` opts stationary guns into the policy and applies an O(1) cached priority guard during ordinary live shot validation. This automatically covers standalone gun studies, `DefencePreview` and finite `PlayCombat`; no coordinator or `play/engine.js` changes are needed.
- `engine/target-planner.js` keeps a lifecycle-owned array of opted-in guns. Before each ranked thinker pass, one cheap active-roster traversal updates every gun's `groundInRange` flag. It then revokes affected air locks, pending bursts and air reservations for **all** guns, including guns whose thinker turn is later. Acquisition holds, short holds, urgency and covered-health scoring cannot preserve an air lock.
- The same policy guard excludes air candidates and air forecast/commitment credit from affected guns. Cooperative reservations cannot reintroduce an air assignment in that step.
- Arc, missile and mobile Drone states do not opt in and retain their existing family targeting policy. The existing Arc retry identity ownership and smooth airborne routes are untouched.

There remains exactly one ranked acquisition/LOS pass per combat step. The new broad check is O(guns × active actors), with early skips for guns already known to have ground in range; there are no extra LOS rays or per-shot roster searches. The current campaign capacity reports 128 affordable guns and at most 26 wave actors, bounding this check at 3,328 root-distance comparisons per step. Storage is one fixed gun-reference array plus boolean state, released with the planner. No GPU buffer, texture, pass, asset, combat statistic or economy value changes.

## Validation

Five focused planner/controller regressions cover:

1. Ground beating extreme air urgency, fully covered ground health, air reservations and burst/acquisition holds.
2. Inclusive diagonal range, actor-root versus aim-point range, invalid coordinates, death and removal.
3. Independent gun ranges, unchanged Arc/missile ranking and one ranked thinker per step.
4. Immediate cancellation of a **non-thinking** gun's live air burst when ground enters.
5. Independently LOS-blocked or pitch-unreachable ground suppressing air, with air resumption after death, range exit or removal.

`tests/play-ground-targeting.test.js` exercises real `PlayEngine`, actual gun tiers Base/Upgrade I/Upgrade II and accepted Dog/Moth models. An air-only opening fires normally while future ground actors remain scheduled. A real ground spawn suppresses all subsequent air hits and receives ground fire. Killing that ground compacts the active list; the gun resumes firing on air while another future ground actor remains inactive. Restart clears the cached state. The fixture uses explicit larger range/health overrides to isolate policy, without changing production profiles.

The new real-engine regression fails with the gun opt-in disabled and passes with the policy enabled. Final focused command:

```sh
bun test tests/target-planner.test.js tests/play-ground-targeting.test.js tests/targeting.test.js tests/lead-targeting.test.js tests/turret-pitch.test.js tests/play-target-commitment.test.js tests/routes.test.js tests/enhancer-integration.test.js tests/play-mixed-combat.test.js -t '^(?!production gun|LOS acquires|A showcase)'
```

Result: **81 passed, 0 failed, 3 filtered out**, 23,652 assertions, across nine affected files. Existing acquisition/cooldown commitment, articulated aim/range, generator damage, actual surface impacts, mixed finite lifecycle and Arc identity regressions pass.

Three existing expectation failures are excluded rather than rewritten: the archived missile-only deterministic snapshot; the LOS spy that expects six ray arguments although production already supplies the defence self-exclusion ID; and an archived showcase sightline expectation with 270 blocked samples. Each still fails with the gun opt-in disabled. The missile-only witness contains no opted-in gun and is also recorded in the prior Arc fix evidence. No claim that the entire historical suite passes is made.

No active browser was reloaded. This is native policy/integration verification; no browser appearance or full-campaign balance claim is made. A gun can conservatively wait until the next planner step after another gun kills the last ground target during the current step; it never uses that cache delay to fire prematurely at air.
