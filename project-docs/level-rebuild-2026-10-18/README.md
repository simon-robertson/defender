# Sixteen-level rebuild

**Archived after user review.** The user accepts the landscapes but requests more winding routes and more worthwhile defence choices. The current levels are being reset to 20×16 populated landscapes without paths/enemies. Sources for the carved versions documented here are preserved in [the reset archive](../landscape-reset-2026-10-18/previous-level-hashes.json); the comparison viewer uses those historical sources. Game links open the current landscape previews. These technical checks do not imply user acceptance of the carved layouts.

All four levels in each zone now use distinct populated landscapes followed by tactical carving. Water varies from dry ground and a small cistern to broad lakes, winding rivers and narrow streams; the first repetitive compact-pool pass is archived. Bridges are an approved design option but are not implemented in these levels. A4 retains its accepted route, terrain and sites; three additional obstructing trees were removed to expose its generator support ground. Selected later levels use two complete approaches merging into one directed shared tail and exit. These remain development studies, with fixed finite rosters and provisional combat values; campaign waves, deployment, economy and difficulty balance remain open.

Use **1–4** for zones and **Shift+1–4** for levels. The [before/after viewer](/tools/landscape-review.html) includes every frozen landscape and its carved result.

| Level | Size in boxes | Route topology | Complete route length, units | Candidate areas | Preview |
| --- | --- | --- | --- | --- | --- |
| A1 · Limestone Orchard | 16×14 | Single | 456 | 9 | [Open](/game/?inspect&level=moss-01) · [Compare](/tools/landscape-review.html?level=moss-01) |
| A2 · The Broadwater Garden | 18×16 | Single | 768 | 9 | [Open](/game/?inspect&level=moss-02) · [Compare](/tools/landscape-review.html?level=moss-02) |
| A3 · Cypress Rise | 20×16 | Two approaches → shared tail | 696 / 456 | 9 | [Open](/game/?inspect&level=moss-03) · [Compare](/tools/landscape-review.html?level=moss-03) |
| A4 · The old garden mere | 18×16 | Single | 672 | 10 | [Open](/game/?inspect&level=moss-04) · [Compare](/tools/landscape-review.html?level=moss-04) |
| B1 · Sunworn Cistern | 16×14 | Single | 480 | 9 | [Open](/game/?inspect&level=ochre-01) · [Compare](/tools/landscape-review.html?level=ochre-01) |
| B2 · Broken Aqueduct | 18×16 | Single | 720 | 9 | [Open](/game/?inspect&level=ochre-02) · [Compare](/tools/landscape-review.html?level=ochre-02) |
| B3 · Three Mesas | 20×16 | Single | 624 | 9 | [Open](/game/?inspect&level=ochre-03) · [Compare](/tools/landscape-review.html?level=ochre-03) |
| B4 · Petrol Basin | 18×18 | Two approaches → shared tail | 624 / 336 | 9 | [Open](/game/?inspect&level=ochre-04) · [Compare](/tools/landscape-review.html?level=ochre-04) |
| C1 · Slate Tarn | 16×14 | Single | 528 | 9 | [Open](/game/?inspect&level=ice-01) · [Compare](/tools/landscape-review.html?level=ice-01) |
| C2 · The Meltwater Bend | 18×16 | Single | 648 | 9 | [Open](/game/?inspect&level=ice-02) · [Compare](/tools/landscape-review.html?level=ice-02) |
| C3 · White Ridge | 20×16 | Two approaches → shared tail | 480 / 264 | 9 | [Open](/game/?inspect&level=ice-03) · [Compare](/tools/landscape-review.html?level=ice-03) |
| C4 · Shattered Sanctuary | 18×18 | Single | 648 | 9 | [Open](/game/?inspect&level=ice-04) · [Compare](/tools/landscape-review.html?level=ice-04) |
| D1 · Mauve Orchard | 16×14 | Single | 456 | 9 | [Open](/game/?inspect&level=plum-01) · [Compare](/tools/landscape-review.html?level=plum-01) |
| D2 · Fallen Arches | 18×16 | Single | 528 | 9 | [Open](/game/?inspect&level=plum-02) · [Compare](/tools/landscape-review.html?level=plum-02) |
| D3 · Lantern Mere | 20×16 | Single | 480 | 9 | [Open](/game/?inspect&level=plum-03) · [Compare](/tools/landscape-review.html?level=plum-03) |
| D4 · Crown Gardens | 18×18 | Two approaches → shared tail | 600 / 384 | 9 | [Open](/game/?inspect&level=plum-04) · [Compare](/tools/landscape-review.html?level=plum-04) |

Candidate areas are visible alternatives, not a fixed-pad deployment mechanic. Each full area is 24×24 units at dry path height. They include the occupied weapon sites and worthwhile alternatives; generators occupy additional adjacent support ground. All terrain and retained scenery match their path-free baselines. Removals are recorded individually for routes, local clearings and overview visibility.

Level 1 compares gun turrets (A1 also has a base generator); level 2 compares the three Arc variants; level 3 compares silo variants; level 4 mixes a base gun, Arc and silo with a base generator adjoining exactly one recipient. This convention is not a campaign unlock rule. The original A/B seven, C four and D five enemies remain, with six cosmetic wildlife actors per scene. Existing models, strengths, costs, effects and launch cadence are unchanged; all weather defaults off.

## Implementation and reproducibility

The additive v4 route contract uses primary `path` (ID `main`), extra complete `routes`, and `actorRoutes`. Each actor owns its route throughout the shared tail. The renderer and terrain use one path union; motion, forecasts and time-to-exit use the appropriate full route. The same shared targeting thinker and missile damage claims serve both approaches. No general pathfinding or new avoidance mechanism was added.

The workshop can select and inspect both routes; merged geometry remains source-authored. The game URL records the selected level, and a valid `?level=...` opens it directly. Authored `previewWildlife` supplies safe ground seeds and retained supported perches. Model preloading still loads only current-scene assets.

`bun run rebuild:previews` reproduces all 16 sources and manifests; `bun run seed:previews` creates missing sources without replacing existing ones. Landscape factories and snapshots live under [landscapes](../landscapes/README.md), with tactical definitions in `scripts/level-rebuild-layouts.js`, `scripts/level-rebuild-c.js` and `scripts/level-rebuild-d.js`. The 13 previous previews are preserved in [the archive](before-assets.json).

## Verification

[Verification records](verification.md) are scoped to this rebuild. The route engine has 62 affected checks; seven final enhancer/plasma checks preserve exact A1 damage, reset and fixed-surface links; saved-level clearance/combat tests cover every authored level, and runtime tests cover rosters, wildlife support, route ownership, lights, reset and disposal. Additional checks preserve legacy single-route fixtures and accepted A4 route/terrain geometry. No full test suite was requested or run.

The per-level audits sample occupied enemy-part envelopes along every complete route and actual gun range/pitch/muzzle LOS from candidate ground. Combat checks exercise current weapons, both merge approaches, the shared thinker, missile commitments, reset and disposal. Route support proves dry path boxes; the occupied-part probe checks obstruction, not continuous sole contact over every possible shoreline offset. Their fixed 120-second observation is not a campaign balance proof or an affordability test.

Artist independently checked 150 complete 24×24 placement areas (145 attack alternatives and 5 generator supports) from the default overview using 86,400 rays and continuous projected cuboids, with zero blockers: [A](visibility-a.json), [B](visibility-b.json), [C](visibility-c.json), [D](visibility-d.json). This does not claim visibility from every arbitrary camera orbit.

[Tactical comparisons and limits](layouts.md) explain the actual coverage choices.

[Browser evidence](browser-review.json) records live scene loads, roster/route counts, no light overflow and cleared previous-scene resources. Representative night/weather, slow-motion, reset, path-camera and workshop checks supplement the sixteen daytime captures below. [Preservation hashes](preservation.json) record unchanged model sources and frozen baselines.

## Production views

### A1 · Limestone Orchard

A compact return on the dry orchard mainland between northern limestone fragments and scattered southern groves; distinct early contact and eastward exit choices.

![Limestone Orchard, production overview](screenshots/moss-01.jpg)

[Source](../../assets/levels/moss-01.json) · [Removal manifest](moss-01.manifest.json) · [Clearance and combat audit](moss-01.audit.json)

### A2 · The Broadwater Garden

A western mainland return creates repeat exposure beside the limestone garden before the route follows the broad lake’s southern shore. The late catch adds southern shoreline coverage away from the early court.

![The Broadwater Garden, production overview](screenshots/moss-02.jpg)

[Source](../../assets/levels/moss-02.json) · [Removal manifest](moss-02.manifest.json) · [Clearance and combat audit](moss-02.audit.json)

### A3 · Cypress Rise

Two dry approaches thread the western knolls and southern orchard, merging below the winding stream into a shared southern tail. Branch-specific and shared coverage compete without crossing water or raising defence ground.

![Cypress Rise, production overview](screenshots/moss-03.jpg)

[Source](../../assets/levels/moss-03.json) · [Removal manifest](moss-03.manifest.json) · [Clearance and combat audit](moss-03.audit.json)

### A4 · The old garden mere

Preserve the accepted old garden mere single route and ten attack sites as a later single-route counterpoint, with three extra local tree removals exposing the generator support ground.

![The old garden mere, production overview](screenshots/moss-04.jpg)

[Source](../../assets/levels/moss-04.json) · [Removal manifest](moss-04.manifest.json) · [Clearance and combat audit](moss-04.audit.json)

### B1 · Sunworn Cistern

A compact offset return above the southern mesas leaves the northwest cistern and sandstone groups intact; compare the first approach, inner elbow and eastward catch.

![Sunworn Cistern, production overview](screenshots/ochre-01.jpg)

[Source](../../assets/levels/ochre-01.json) · [Removal manifest](ochre-01.manifest.json) · [Clearance and combat audit](ochre-01.audit.json)

### B2 · Broken Aqueduct

The winding river separates two banks. A northern return and descending eastern-bank route preserve its aqueduct groups, while southern sites provide a distinct final catch without crossing water.

![Broken Aqueduct, production overview](screenshots/ochre-02.jpg)

[Source](../../assets/levels/ochre-02.json) · [Removal manifest](ochre-02.manifest.json) · [Clearance and combat audit](ochre-02.audit.json)

### B3 · Three Mesas

A later single route crosses the irregular plain between three mesa masses. Separated launch sites cover a western turn, central crossing and eastern edge of the northern mesa.

![Three Mesas, production overview](screenshots/ochre-03.jpg)

[Source](../../assets/levels/ochre-03.json) · [Removal manifest](ochre-03.manifest.json) · [Clearance and combat audit](ochre-03.audit.json)

### B4 · Petrol Basin

A northeast approach follows the large oasis’s eastern shore while a second approaches from the south. They merge below the mesa into a common southern tail; a gun, enhanced branch Arc and shared-tail silo demonstrate distributed coverage.

![Petrol Basin, production overview](screenshots/ochre-04.jpg)

[Source](../../assets/levels/ochre-04.json) · [Removal manifest](ochre-04.manifest.json) · [Clearance and combat audit](ochre-04.audit.json)

### C1 · Slate Tarn

A readable western approach steps around the western bank of the long narrow tarn, then follows its southern shore. The northern gun, central elbow and separate southern exit compare useful exposure while retaining the icy ridges and lake.

![Slate Tarn, production overview](screenshots/ice-01.jpg)

[Source](../../assets/levels/ice-01.json) · [Removal manifest](ice-01.manifest.json) · [Clearance and combat audit](ice-01.audit.json)

### C2 · The Meltwater Bend

The broad southern river bank carries a stepped return followed by a descent around the southwest face of the eastern ridge. Early, inner-return and southern-shore catches remain separated; the meltwater river is preserved across the full landscape.

![The Meltwater Bend, production overview](screenshots/ice-02.jpg)

[Source](../../assets/levels/ice-02.json) · [Removal manifest](ice-02.manifest.json) · [Clearance and combat audit](ice-02.audit.json)

### C3 · White Ridge

Two approaches occupy the dry western bank of the shallow stream: the longer northern approach bends through an offset, while a short western entrance joins its southern descent. Dedicated approach sites and a shared late catch contrast with the untouched eastern white ridge.

![White Ridge, production overview](screenshots/ice-03.jpg)

[Source](../../assets/levels/ice-03.json) · [Removal manifest](ice-03.manifest.json) · [Clearance and combat audit](ice-03.audit.json)

### C4 · Shattered Sanctuary

A single later route winds beneath the sanctuary ruins before descending the western shore of the deep angular lake. The central return offers continuous corner coverage, with a separate enhanced silo guarding the long southern shoreline exit.

![Shattered Sanctuary, production overview](screenshots/ice-04.jpg)

[Source](../../assets/levels/ice-04.json) · [Removal manifest](ice-04.manifest.json) · [Clearance and combat audit](ice-04.audit.json)

### D1 · Mauve Orchard

A compact orchard return below the crescent pond. Early approach, inner-return and late-exit choices sit between unequal plum groves rather than in a perimeter band.

![Mauve Orchard, production overview](screenshots/plum-01.jpg)

[Source](../../assets/levels/plum-01.json) · [Removal manifest](plum-01.manifest.json) · [Clearance and combat audit](plum-01.audit.json)

### D2 · Fallen Arches

From the western entrance, the route skirts the north bank of the shallow stream and turns south between the two detached arch groups. The final elbow opens a separate southern catch without flattening the stream or groves.

![Fallen Arches, production overview](screenshots/plum-02.jpg)

[Source](../../assets/levels/plum-02.json) · [Removal manifest](plum-02.manifest.json) · [Clearance and combat audit](plum-02.audit.json)

### D3 · Lantern Mere

The large eastern lake determines a west-bank route that descends through two offsets toward a southern exit. Silos compare early woodland contact, a repeated central corner and the last shoreline interception; the lake remains a major landform.

![Lantern Mere, production overview](screenshots/plum-03.jpg)

[Source](../../assets/levels/plum-03.json) · [Removal manifest](plum-03.manifest.json) · [Clearance and combat audit](plum-03.audit.json)

### D4 · Crown Gardens

On the eastern bank of the winding river, a long northern approach wraps around the high grove while a short eastern approach joins its lower corner. Early gun and branch Arc placements trade immediate exposure against the shared downstream silo, which alone receives the generator bonus.

![Crown Gardens, production overview](screenshots/plum-04.jpg)

[Source](../../assets/levels/plum-04.json) · [Removal manifest](plum-04.manifest.json) · [Clearance and combat audit](plum-04.audit.json)
