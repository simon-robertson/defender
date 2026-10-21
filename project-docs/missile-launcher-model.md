# Vertical missile launcher models

Created on 18 October 2026 from the user-approved [Moss & Porcelain concept, revision 2](concepts/missile-launcher-moss-porcelain-v2.png). The approval covers modelling the three launcher stages, a separate reusable guided missile, guided combat and third test levels. The user subsequently specified finite loaded rounds followed by a timed reload, a boost/coast-turn/homing-burn flight sequence, and costs of 3 tokens to purchase and 3 per upgrade. Those combat and flight behaviours are implemented separately from these model sources.

## Sources and reproduction

- [Launcher source](../assets/models/missile-launcher.json), model ID `missile-launcher`, role `defence`.
- [Missile source](../assets/models/guided-missile.json), model ID `guided-missile`.
- [Generator](../scripts/missile-launcher.js), exporting `missileLauncherModel()` and `guidedMissileModel()`.
- [Shared geometry contract](../shared/missile-model.js).
- [Focused model and clearance checks](../tests/missile-launcher-model.test.js).

`bun scripts/missile-launcher.js` creates missing sources while preserving existing authored files. `bun scripts/missile-launcher.js --write` explicitly regenerates both sources; inspect manual edits before using it. Importing the generator does not write files. Compile only these assets with:

```sh
bun scripts/compile.js assets/models/missile-launcher.json assets/models/guided-missile.json
```

The two version-3 sources use integer cells, solid face-connected geometry and one cell per occupied location. The mesher removes hidden faces and merges matching exposed faces. There are no textures, bevel polygons, overlays, baked loaded rounds, moving hatches or launcher articulation.

## Launcher family

All three variants have one fixed rigid part, `body`, rooted at `[12,0,12]`. Their shared mounting pad occupies X/Z `[1,23)`, a **22 × 22-unit** footprint inside the 24-unit placement box. Stepped pad corners and porcelain shoulders translate the illustrated concept into axis-aligned geometry. A dark forest battery, broad porcelain front panel, moss lower supports and a small red front marker retain the family identity. Additional height, depth and visible top-cell count distinguish the upgrades without enlarging the pad.

The launcher contains **real empty vertical wells**, with dark solid floors and square forest rims. Each well is 6 × 6 units, leaving a full unit of side clearance around the missile's widest fins. The base has two cells side by side, Upgrade 1 has a 2 × 2 layout and Upgrade 2 has a 2 × 3 layout. Loaded rounds are separate runtime actors and can leave an empty well without changing the launcher mesh.

| Variant | Cells | Body height | Loaded height | Occupied model cells | Compiled quads | Vertex/index bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Base | 2 | 14 | 17 | 3,576 | 158 | 31,600 |
| Upgrade 1 | 4 | 18 | 21 | 5,808 | 215 | 43,000 |
| Upgrade 2 | 6 | 22 | 25 | 7,464 | 234 | 46,800 |

All three launcher meshes total **607 quads / 1,214 triangles**, with 121,400 bytes of vertex/index data before instances. Counts are measured asset facts, not performance budgets.

## Missile and socket contract

The reusable missile has one populated variant, `base`, and one rigid part, `body`. Its occupied bounds are **X `[10,14)`, Y `[0,10)`, Z `[10,14)`**, giving a 4 × 10 × 4-unit silhouette. The narrower 2 × 2 porcelain body carries a red band, a dark square nose and four cardinal moss tail fins. It contains **64 occupied cells, 34 compiled quads / 68 triangles and 6,800 vertex/index bytes**. Unused upgrade slots remain empty.

`GUIDED_MISSILE_MODEL` supplies ID, variant and part names, `origin: [12,0,12]`, `exhaust: [12,0,12]`, `forward: [0,1,0]`, `height: 10` and `radius: Math.sqrt(5)`. The origin is the centre of the tail plane, so local **+Y points toward the nose**. The cross-sectional radius includes the fin corners; it is not the full missile's orientation-independent collision sphere. Flight code derives any full-mesh collision bound separately.

`MISSILE_LAUNCHER_SOCKETS` contains immutable root-seat XYZ positions in the launcher's authoring space. Place a loaded missile by translating its origin onto the selected socket:

| Variant | Socket positions |
| --- | --- |
| Base | `[7,7,12]`, `[17,7,12]` |
| Upgrade 1 | `[7,11,7]`, `[17,11,7]`, `[7,11,17]`, `[17,11,17]` |
| Upgrade 2 | `[7,15,5]`, `[17,15,5]`, `[7,15,12]`, `[17,15,12]`, `[7,15,19]`, `[17,15,19]` |

The seated root is seven units below `MISSILE_LAUNCHER_DECK_Y` (14/18/22), leaving the nose three units above the deck. `MISSILE_LAUNCHER_CLEAR_Y` (17/21/25) is a root height three units above that deck, reached after ten units of straight vertical departure. This leaves the entire cross-section above the launcher before the initial turn. `MISSILE_WELL_HALF_WIDTH` is 3.

The shared values describe authored geometry; they do not specify attack range, speed, damage, launch interval or reload time. Exhaust is procedural rendering owned by the flight implementation and needs no flame model. Identity-highlight emission is a separate user-approved material property, described below.

## Materials

Both sources use the same 17 material-slot meanings and Moss & Porcelain colours as the turret and Arc Spire. Palette mode is the absence of a `colorMode` override. The shared zone mapping recolours both sources consistently in A–D.

The user explicitly approved identity-highlight emission after flight and impact-response verification on 18 October. **Slots 4, 14 and 15 have emission 1 in both sources.** Launcher/silo accents use **`castsLight: true`**; missile accents explicitly use **`castsLight: false`**, so the band glows without creating a travelling model light. All other materials retain emission 0, and every material retains reflectiveness 0. Porcelain highlights and other ordinary shading slots remain nonemissive.

Visible geometry uses slot 4: each launcher stage has one exposed 2 × 2 front panel, compiled to **one light quad and one local-light cluster**. All three together therefore contribute three local lights. The missile band compiles to **four emissive side quads but no light quads or local-light clusters**, whether loaded or flying. Slots 14/15 retain the same identity contract for later edits but are currently unused by exposed geometry. Colours, cells, face assignments, parts, pivots and sockets are unchanged.

## Focused verification

At the original modelling milestone, Artist ran `bun test tests/missile-launcher-model.test.js`: **5 tests passed, 10,025 assertions**. This is historical verification before the identity-emission follow-up. The suite verifies exact generator/source agreement, canonical schema validation, integer unique cells, connected solids, footprint and heights, complete empty shafts with real floors/rims, missile bounds/fins/root convention, immutable shared sockets and independent generator results. It checks loaded rounds against each other and every occupied missile cell's **exact swept prism** through the full ten-unit vertical departure against occupied launcher cells, rather than relying on sampled launch positions. Shared whole-model transforms preserve that local separation.

That initial suite also checked all 17 palette colours against the turret in A–D, unchanged geometry under palette mapping, the then-nonemissive materials, finite compiled vertices and valid index counts. Selective compilation of both sources succeeded with the counts above. No full test suite was run. Flight behaviour and final level review are owned by the integration pass and are not implied by these geometry checks.

Artist reviewed the lead's actual [production model capture](screenshots/missile-launcher-model-review.jpg) against the approved concept. All three loaded variants have readable 2/4/6 upward wells, red-banded noses, stepped porcelain shoulders and increasing body height on the common compact pad. Matte surfaces remain crisp, and the family is visibly distinct from gun turrets and Arc Spires. No blocking art or geometry issue is visible in this capture. The [isolated production-renderer review](http://127.0.0.1:4173/tools/missile-launcher-review.html) is owned by the lead; this art acceptance does not substitute for combat integration verification.

### Identity-highlight follow-up verification

Fresh command: `bun test tests/missile-launcher-model.test.js --test-name-pattern 'generators reproduce|all zone palettes'` — **2 pass, 3 filtered, 5,751 assertions**. These checks cover source/generator agreement, all 17 colours and selective emission/light flags in A–D, finite meshes, emissive vertex values and the exact one/one/one launcher light-quad counts versus zero missile light quads. The unchanged clearance cases were not rerun. Both models were selectively compiled again; their quad and vertex/index counts remain unchanged.

An exact before/after JSON comparison verifies that only the `emission` and `castsLight` fields of material slots 4/14/15 changed. All other source fields are identical. SHA-256 of `JSON.stringify(source.variants)` is identical before and after, including every cell, face assignment, part and pivot:

| Model | Unchanged geometry SHA-256 | Updated source-file SHA-256 |
| --- | --- | --- |
| `missile-launcher` | `1b4ac039453901dd1c2188e8156e2a3268ea112c2f4a98e10970c4bf2cc3f132` | `08da848e6ab09c95114fe8af10aa4a11223d0740046f8a7daf20d121f767654a` |
| `guided-missile` | `d1e35ae385d2335eefc2904bf84b92b05bc52d7c9e67e7ea85c9ee6e935c798f` | `57d08a57785855d2bbea92c9dabbcbbd042ddafbce07e4528f0e605a94df339e` |

The lead owns live lighting/bloom appearance, scene light-capacity verification and the saved production screenshots for this follow-up.
