# Defence roster groups and range previews

Implemented TODO items 10–11 for review on 20 October 2026.

Owned defences now sit in persistent Gun, Arc Spire and Missile launcher groups. Each group contains every owned tier in original acquisition order. Original inventory numbers, labels, IDs, selection and action buttons stay attached to their units. Ordinary updates, selection, moves and upgrades reuse the same row/control nodes; they do not sort or rewrite session ownership. Group headers use the existing moss palette and join the borderless, zero-gap roster.

Hovering a deployed unit row or focusing its selection control shows its current maximum horizontal range. Hovering/focusing its visible Upgrade control switches to the next enabled tier's range, with a dashed outline and a `NEXT I`/`NEXT II` label. An unaffordable or progression-locked upgrade may be inspected without purchasing it. Both ranges come from the active play configuration, including custom tuning, rather than shared preview defaults. Units at maximum tier have no next-tier preview. Reserves have no battlefield origin and therefore no circle.

The circle is projected from world coordinates onto the existing non-interactive SVG, centered on the same horizontal origin as combat (the gun head pivot, or Arc/silo center) at deployed ground height. Current camera, deployment, tier and viewport changes invalidate cached projection. The overlay clears outside preparation, during busy/error/pause states, and when the unit is recalled, removed or its scene is replaced. Pointer hover takes priority over keyboard focus; leaving the row restores any live focused row. No preview selects, moves, buys or upgrades a unit.

This is a maximum-range guide: it does not claim unobstructed line of sight, permitted gun pitch, a successful missile flight, or guaranteed damage. The projected SVG draws above scenery like the existing unit highlight. It allocates no renderer pass, GPU resources or model/level assets. Preparation uses the overview; an unexpected perspective circle crossing the eye plane is suppressed rather than inverted.

## Integration

The `UnitHighlight` constructor in `play/app.js` must receive `defences: config.defences`. Its existing `update` call can continue using raw session units, avoiding per-frame snapshots. No additional app hook is needed.

## Verification

- 29 Bun tests pass, 297,907 assertions: `tests/play-unit-highlight.test.js`, `tests/play-roster.test.js`, `tests/play-session.test.js`, `tests/play-config.test.js`. [Raw output](roster-tests.log).
- Five added focused checks cover immutable family grouping, persistent node/control identity, all configured families and tiers (including an overridden gun range), disabled/max-tier behavior, exact horizontal projection and cache invalidation, pointer/keyboard transitions, unaffordable upgrade inspection, reserves and lifecycle clearing.
- Browser-target bundle succeeds: 103 modules, 1.18 MB. [Build output](roster-build.log).
- Browser automation is reserved to the lead's shared runtime. No browser observation or visual acceptance is claimed by this subtask.

## Lead's browser review

1. Reuse the existing player tab. Start/deploy two Guns and at least one Arc/silo in a later-area retained setup. Confirm family headings group tiers together while labels/numbers and button actions remain attached to the original units. Inspect `#unit-list .unit-group[data-model]`.
2. In Arsenal, hover a deployed row: `#unit-highlight-overlay` exposes `data-unit`, `data-range`, `data-range-variant`, `data-range-mode="current"`. Move onto its Upgrade button: mode becomes `next`, a dashed next-tier circle appears, and the label says `NEXT I/II`. Moving back to the row restores current range immediately. Compare values with `PLAY_CONFIG.defences[model].variants[variant].stats.maxRange`.
3. Repeat with keyboard Tab onto unit selection and Upgrade. Hover another unit and leave it; the focused unit returns. Inspect an unaffordable Upgrade without clicking: it should still preview, with wallet/selection/variant unchanged.
4. Recall a unit or inspect an undeployed reserve: no battlefield preview. Upgrade a top-tier unit: only current range remains and Upgrade is absent. Start a wave, pause, return to preparation or switch a level: no stale ring survives the phase/load boundary.
5. Check the existing laptop/desktop preparation panel for scroll, continuous panel edges, portrait loading and visible controls. The shared preview `/game/` is unaffected.

Files: `play/roster.js`, `play/range-preview.js`, `play/ui.js`, `play/unit-highlight.js`, `play/style.css`; focused checks in `tests/play-roster.test.js` and `tests/play-unit-highlight.test.js`.
