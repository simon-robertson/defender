# Vertical missile launcher concept

Created on 18 October 2026 with the built-in image-generation tool. **The user approved the design on 18 October 2026 ("The concept art looks good").** The user requested missiles that rise vertically out of the unit's top, then adjust course and automatically track their assigned enemy after the initial launch phase. After approval, the user wants a third testing level in each of A–D.

- [Final concept sheet (v2)](missile-launcher-moss-porcelain-v2.png)
- [Complete initial generation prompt](missile-launcher-moss-porcelain-v1.prompt.txt)
- [Final correction prompt](missile-launcher-moss-porcelain-v2.prompt.txt)
- [Initial sheet](missile-launcher-moss-porcelain-v1.png), retained as generation history.

## Proposed appearance

Artist proposed a low, broad fixed launch battery, distinct from the yawing gun turret and tall Arc Spire. Porcelain corner armour surrounds an upward-facing forest-green deck with square launch cells, moss braces and restrained vermilion identity marks. The shared stone pad anchors all variants. Base shows two cells; upgrade 1 shows four in a 2×2 array; upgrade 2 shows six in a 2×3 array with a taller reinforced body. The subsequent user follow-up explicitly approves a finite missile load: each launch consumes one loaded missile, the unit depletes the whole load before reloading, and reload takes a defined period during which it cannot fire. When that period finishes, the full load is available again. The proposed two/four/six visible cells therefore imply two/four/six loaded missiles if this design is approved. This does not imply simultaneous salvos. Reload duration and intervals between launches remain unspecified; no partial top-up is performed before the load is empty.

The supporting missile study uses a narrow porcelain body, stepped dark nose, vermilion band and short moss tail fins. The flight-path sketch communicates vertical departure followed by steering toward a target. Its arrows are annotations, not proposed trails. Small play-scale views compare the three silhouettes. No exhaust, smoke, explosion or audio presentation is assigned by this sheet.

## Review and remaining decisions

Lead and Artist checked the initial sheet: labels, 2/4/6 top cells, exposed launch directions, palette and miniature readability were correct. Both noticed the small missile in the flight-path sketch faced backwards. A targeted built-in image edit corrected only that missile's orientation; Lead inspected the final sheet and confirmed its nose now follows the arrow toward the target. No other visual blocker was identified.

This sheet is the approved visual reference. Its illustrative bevels have been translated into unit-grid geometry, with tested model and launch-cell clearances. The design-approval gate is satisfied; the three launcher models, projectile/magazine runtime and third test levels are implemented. Follow-up flight and impact tuning is tracked in the [project brief](../project-brief.md) and [combat notes](../missile-combat.md).

The approved next step is to implement the launcher family and missile, guided-flight preview and four third test levels through the existing shared timing, bounded pools and scene-unload ownership. Shift+3 follows the current developer navigation convention. Before combat implementation, settle provisional range, damage, cadence, costs, flight timing/speed/turn limits and target/obstacle/impact semantics within the user's approved scope. The request does not imply splash damage, chain hits, retargeting or an ammunition-purchasing economy. The finite load and timed automatic reload described above are explicitly approved.

The user also explicitly set missile-launcher purchase and each upgrade to **3 tokens**. This is shared future-game metadata, not an enabled spending UI.
