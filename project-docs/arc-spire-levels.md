# Arc Spire development test levels

**Current status:** the later 18 October approval activates hitscan Arc combat in these same second levels. A2/B2/D2 use the existing dogs/Walkers/Spiders; C2 has no targets. See [combat](combat.md) and [electrical effects](arc-effects.md). The original model-study milestone below records its earlier verification; it does not limit the newly approved combat.

On 18 October 2026 the user approved the completed Arc Spire models and asked to continue with a second test level for every zone. These four saved levels are paired visual studies: each deliberately retains its zone's accepted first-level route, terrain, scenery, water and authored lighting, replacing the three gun-turret sites with the Arc Spire base, upgrade 1 and upgrade 2. This keeps the surroundings comparable when switching between levels. They do not establish the second campaign level's difficulty or electric attack behaviour.

All three spires stand on dry ground at path height **24**. Their 32/42/54-unit model heights give world-space tops of 56/66/78. Each keeps the 22 × 22 footprint within its existing 24-unit defence box. All placements use quarter-turn 0, with the identity panels facing negative Z, matching the authoring baseline. The model review remains available for close inspection of their silhouettes at a larger scale.

| Zone | Source | Base box X/Z | Upgrade 1 box X/Z | Upgrade 2 box X/Z | Route boxes | Placements |
| --- | --- | --- | --- | --- | --- | --- |
| A | `assets/levels/moss-02.json` | 2, 6 | 5, 6 | 9, 10 | 30 | 106 |
| B | `assets/levels/ochre-02.json` | 4, 7 | 9, 9 | 4, 12 | 35 | 97 |
| C | `assets/levels/ice-02.json` | 4, 3 | 6, 5 | 11, 11 | 33 | 98 |
| D | `assets/levels/plum-02.json` | 10, 2 | 8, 4 | 3, 2 | 31 | 102 |

Names append “· Arc Spire study” to the corresponding first-level name. Existing paths remain distinct between zones. The same meaningful nearby clear courts and scenery masses are retained. They originally shipped as static model-and-light studies; subsequent approved combat uses provisional range, strength and cadence without claiming balanced campaign coverage. Existing zone enemies walk and can be damaged in A/B/D, while C has no enemy. Six cosmetic wildlife actors run in every study, using the same source rosters and spawn seeds as level 1; wildlife is never targeted or damaged.

The approved identity accents retain emission 1 and `castsLight: true`, with the existing A–D arsenal palettes. Each level has **five** exposed panel-light clusters: one each on base/upgrade 1 and three on upgrade 2, with no light-capacity overflow. Armour stays matte and nonemissive. Weather is saved off, matching the current project policy.

## Source and regeneration

`scripts/arc-spire-levels.js` exports `arcSpireLevel(zone)` and derives these studies from the accepted production layout generator. This produces fresh independent level data without modifying level 1. Authored changes to either saved study can be made through the existing level editor.

```sh
bun scripts/arc-spire-levels.js         # Create missing studies only.
bun scripts/arc-spire-levels.js --write # Explicitly regenerate all four studies.
```

Regeneration takes the production-generator baseline, not subsequent manual edits to saved level-1 files. Normal generation preserves existing study sources and never writes level 1 or models. No compiled level asset is needed; the runtime builds scene geometry from saved model references.

## Verification on 18 October 2026

`bun test tests/arc-spire-levels.test.js`: **2 tests, 96 assertions pass**. The checks compare every saved study with its reproducible generator, verify that terrain/path/environment/scenery match the corresponding saved level 1, and build all four worlds from actual model sources. World construction validates source assets, dry path-height support, exact solid-cell overlap, terrain/water clearance and occupied-cell route clearance. It also confirms all three fixed spire rigs, five local lights per level, no overflow and disposal of world references.

The normal create-missing command was run again and preserved all four saved studies. SHA-256 hashes of `moss-01`, `ochre-01`, `ice-01` and `plum-01` match the pre-work baseline. No full test suite was run.

## Preview controls and runtime integration

The bottom selector is immediately above the interaction instructions. **Shift+1** and **Shift+2** select the current zone's level; ordinary **1–4** changes zone and keeps the selected level number. A fresh page starts at A1. The catalogue in shared/preview-levels.js supplies available numbers; future Shift+number shortcuts need a corresponding saved catalogue entry. Unavailable levels do nothing. Buttons remain usable while loading and after a failed request, with requested/active state distinguished.

Both kinds of selection use the unchanged SceneLoader lifecycle: cancel superseded requests, unload old assets and drain submitted GPU work before allocating replacements. Night mode persists. Each loaded level restores its authored weather (off) and framed overview. Runtime enemy and cosmetic rosters resolve from the catalogue's zone; no inactive world or model geometry is cached.

World rig metadata now preserves the model role. Wildlife clearance uses that role, so static Arc Spires remain obstacles even without attack statistics; only gun turrets receive the existing recoil allowance. Arc Spires remain excluded from the gun-specific TurretPreview. The subsequent DefencePreview coordinator integrates their own controller and assigned combat stats.

## Integrated verification

**19 affected tests pass**: two level-source/light tests, seven catalogue/shortcut/selection tests, the new Arc runtime integration test, six existing SceneLoader tests, and three affected existing world/zone-roster/wildlife checks. The new runtime test simulates 60 seconds in each study, confirming only the active zone's actors are loaded, all enemies move without taking damage, the three spire clearances include their full heights, wildlife never intersects them, and disposal clears actor/rig references.

Built-in Chrome verified both levels in every zone, keyboard and button selection, retaining level 2 across zone changes, rapid successive requests, unavailable Shift+3, R, persistent night mode and restoring weather-off/overview after a level change. Each model study has five panel lights and zero overflow. Weather-off scene buffer counts are **102/78/57/117** for A2/B2/C2/D2, including runtime actors; prior scenes report zero buffers, geometry, assets, rigs, actors and visibility storage after unload. There were no captured console/WebGPU warnings or errors. These counts describe resources, not performance targets or timing claims. [Browser evidence](arc-spire-level-browser-review.json).

Artist reviewed all eight day/night captures and found no new blockers: all sites are clear of static scenery, crown/height progression remains distinct, the current orientation exposes the identity panels, and the C/D palettes retain contrast. Engineer's read-only integration review found no actionable issues. Level 1 and accepted model hashes remain unchanged.

| Zone | Day | Night |
| --- | --- | --- |
| A | [Day view](screenshots/arc-spire-level-a-day.jpg) | [Night view](screenshots/arc-spire-level-a-night.jpg) |
| B | [Day view](screenshots/arc-spire-level-b-day.jpg) | [Night view](screenshots/arc-spire-level-b-night.jpg) |
| C | [Day view](screenshots/arc-spire-level-c-day.jpg) | [Night view](screenshots/arc-spire-level-c-night.jpg) |
| D | [Day view](screenshots/arc-spire-level-d-day.jpg) | [Night view](screenshots/arc-spire-level-d-night.jpg) |
