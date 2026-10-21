# Production preview layouts

**20 October, current:** all16 landscapes now have complete routes. A/B remain user-approved and byte-identical; C/D carving is implemented for review for the authorised64-wave campaign. C1–C4 use Tarn and Fir Circuit (960), Meltwater Crossing and Return (888), White Ridge Confluence (840/504) and Sanctuary and Mere Fold (864). D1–D4 use Orchard and Crescent Tour (1176), Fallen Arch Return (1152), Lantern Shore Return (768) and Crown River Tour (1224). Original terrain/water/environment and all model sources remain unchanged; retained scenery and wildlife seed changes are documented. `/game/` keeps its original landscape titles and layout-only controls; `/play/` owns campaign actors and tuning. [C evidence](campaign-completion-2026-10-20/zone-c.md) · [D evidence](campaign-completion-2026-10-20/zone-d-README.md) · [Campaign](campaign-completion-2026-10-20/README.md).

**Historical accepted A/B status, 19 October:** accepted A1–A4 remain unchanged: A1 is the two-drone/two-Dog/one-Moth combat test; A2–A4 are approved scenery/wildlife layouts. The user has now explicitly accepted all four Zone B layouts after integration and verification. C/D’s eight landscapes remain path-free. All production sources retain the fixed20×16 footprint.

| Level | Selected Zone B layout | Complete route length | Character |
| --- | --- | --- | --- |
| B1 · Sunworn Cistern | Cistern and Mesa Circuit | 1,032 units | Dry mesa circuit, northern court and southern return. |
| B2 · Broken Aqueduct | Riverfold Crossing | 1,056 units | One journey through two banks, with a48-unit wooden river crossing. |
| B3 · Three Mesas | Mesa Confluence | 1,056 / 720 units | Separate western/eastern approaches and a shared southern circuit. |
| B4 · Petrol Basin | Aqueduct and Shore Tour | 720 units | Mainland and shore journey beside an uninterrupted large lake. |

All 146 surveyed full footprints are visible. After the documented physical exclusions,142 offer base-gun or base-Arc firing opportunities; B3 `[14,7]` and B4 `[10,6]`, `[11,6]`, `[12,6]` need upgraded gun/Arc range. All Arc/silo tiers fit physically, while some gun tiers have explicit site restrictions. These alternatives are not a promise of simultaneous occupation or final balance. Twenty affected tests and all four 180-second wildlife runs pass.

[Zone B comparison and evidence](zone-b-path-carving-2026-10-19/README.md) · [Read-only production comparison](/tools/b-layout-review.html) · [Design doc](design-doc.md#current-landscape-composition). No Zone B combat units, waves, economy or final balance are implied. All four B layouts are user-approved as of 19 October; campaign balance remains open.

The historical A/B preservation run retained the eight then-uncarved C/D landscapes. The current `bun run rebuild:previews` regenerates the selected C/D routes through their deterministic factories and preserves A/B. Preservation hashes confirm the other 12 production levels, all 67 model sources and 69 frozen files plus the archive are unchanged. The [fixed-size landscape catalogue](landscape-reset-2026-10-18/README.md) and [frozen backup](landscape-reset-2026-10-18/backup.md) remain unchanged. Earlier carving records below are historical and must not regenerate current sources.

## Historical four-preview density and runtime review

The dense A–D scenes are now regenerated and reviewed by Artist and Tactician. Distant ground has coherent scenery groups; useful close-path courts remain open. Final static placements are **106 / 97 / 98 / 102** for A–D. The latest appearance snapshots before autonomous-wildlife refinements are [A](screenshots/zone-a-layout-dense.png), [B](screenshots/zone-b-layout-dense.png), [C](screenshots/zone-c-layout-dense.png) and [D](screenshots/zone-d-layout-dense.png). The sparse screenshots and prior A-only results below are historical.

Final combined runtime captures include the newer wildlife, combat and turret lighting: [A](screenshots/zone-a-preview-final.png), [B](screenshots/zone-b-preview-final.png), [C](screenshots/zone-c-preview-final.png), [D](screenshots/zone-d-preview-final.png). [Browser checks](zone-preview-review-browser.json) verify all four loads and clean scene replacement.

The [current combined engineering report](zone-preview-review-engine.json) includes all six cosmetic actors per zone, the three combat actors in A/B/D, the final actor starts, and staggered cooperative targeting. All 28 showcase/alternative sites are clear in the one-unit paired-muzzle sample sweep at three recoil offsets, and their conservative rotating-head envelopes do not intersect static scenery. Camera/shadow clip checks find no out-of-bounds geometry. These are bounded correctness/resource checks, not a frame-rate benchmark or proof of final campaign balance.

In the recorded 60-Hz simulation before the latest Spider speed increase, every preview turret contributes: A 9/64/5 shots, B 12/63/4, D 10/61/8. All three enemies eventually die after 25–28 hits each. That run used Walker at 18 units/second and Spider at 8. Spider now moves at 10; ranges and attack strengths remain unchanged. Later wildlife destination choices and local-light buffers are tracked separately from these combat results.


**Current status:** the research-led A route and distinct B–D revisions are implemented. The user then said all four previews looked too empty and authorised more scenery away from the paths, including A's deferred dressing. The authoring data now adds coherent remote scenery masses while preserving every route, turret, nearby court, named alternative and terrain region. Generation and refreshed visual/LOS review follow separately. The user also authorised Walker testing in B and Spider testing in D; lead/Engineer own that integration. [Real-game reference study](research/tower-defence-layouts.md), [diagnosis and A rationale](research/layout-design-response.md). Technical signoff does not establish final campaign balance.

The four preview levels use **16 × 16 boxes**, or **384 × 384 units**. This is 256 ground boxes, compared with the original 140. Research informed the A revision first, then the authorised B–D pass. These are four visual/combat previews, not the twenty-level campaign or a final difficulty curve. The first square sources are preserved in [the archive](archive/square-preview-v1/README.md).

`scripts/production-layouts.js` owns the route corners, showcase turret positions, reserved clear ground, water, mounds and scenery composition. `scripts/production-level.js` converts this authoring data into level sources. `scripts/production.js` validates all levels and models; it writes assets only with `--write`. Artist's model catalogue is described in [production art](production-art.md).

## Route and space plan

Coordinates below are `[X,Z]` box coordinates. Every route is one ordered, nonrepeating chain of edge-connected boxes. Paths and defence ground remain dry and flat at Y24. Water and mounds use whole boxes from above; water beds are Y4 with a surface at Y12. Raised ground is scenery-only, reaching at most Y32 in the current layouts. Weather remains authored off.

| Zone | Route boxes | Centre-line length | Empty reserved boxes | Positive base-range coverage | Water boxes |
| --- | ---: | ---: | ---: | ---: | ---: |
| A Moss & Porcelain | 30 | 696 units | 59 | 41 | 18 |
| B Ochre & Petrol | 35 | 816 units | 46 | 39 | 14 |
| C Ice & Ember | 33 | 768 units | 68 | 45 | 19 |
| D Plum & Mint | 31 | 720 units | 57 | 38 | 2 |

“Empty reserved” excludes the three occupied showcase turret boxes. These sites are free of all props, water and raised terrain. **All four layouts now use explicit connected courts and selected firing corridors** instead of automatically protecting every positive-range cell. A clear 3 × 3 collar around each showcase turret helps preserve rotating-head clearance and open sightlines. The collar is an authoring precaution, not a new deployment rule. Counts measure clearance, not meaningful choice or mistake tolerance.

The `clear` reservations are authoring data; they do not implement placement eligibility or a player-facing overlay. Future deployment rules still need a separate design. **Useful close-path choices are the priority for clear ground; distant areas should be populated rather than treated as hypothetical defence space.** Scenery occupies coherent mixed-height groups outside those courts, with low inner edges and connecting detail. Deliberate gaps break up the groups without leaving entire remote bands empty. The current density pass has ample unreserved ground and therefore does not need to remove any existing court.

The current authoring placement counts, including three turrets in each zone, are **106/97/98/102**; scenery/detail counts are **62/41**, **53/41**, **54/41** and **60/39** respectively. The density pass adds **30/25/28/32** substantial props; connecting details increase by **15/15/16/14** after several tiny placeholders are replaced with larger forms. All compositions use the existing 43-model scenery library. Exact pre/post comparisons confirm routes, showcase towers, clear courts, water and mounds are unchanged in all four zones. A's previous complete source hash is historical: its newly authorised remote dressing changes that hash while preserving its tactical geometry.

A's route/turret fingerprint before and after the density pass is `02b4b03fd9dfba6c9ca1809c67ad1054734e85851174e78cbc219cf212b33924` (SHA256 of `JSON.stringify({corners,towers})` from `productionLayout('A')`). This checks the protected tactical data, not the deliberately changed scenery.

### A — The old waterway

Route corners: `[0,5] → [8,5] → [8,7] → [4,7] → [4,11] → [15,11]`.

One short return creates a recognisable land finger where base range can reach two journey intervals. Alternative positions near the tip cover the turn continuously, while positions farther along the finger have separated windows and different upgrade-range benefits. The later bend and exit stretch offer different timings. Early contact, return and late catch remain distinct; nearby outside ground permits less efficient choices without prescribing build pads.

The eastern woodland/ruin mass occupies X11–15/Z2–9, with the tallest crowns on its outer side and a low broken inner edge. Its scenery ground reaches Y32. The density pass adds a broad uneven woodland across X0–8/Z0–3, connected to the eastern grove through northern young trees and shrubs. An asymmetric western/southwestern water margin turns along the outer Z14 edge without crossing the route. Low bank transitions lead into an outer woodland tail beyond the exit; the close-path catch court stays quiet. [Research, exact comparison intervals and approval rationale](research/layout-design-response.md).

### B — The sunken aqueduct

Route corners: `[0,6] → [6,6] → [6,4] → [10,4] → [10,10] → [8,10] → [8,8] → [3,8] → [3,15]`.

Unequal offset elbows provide three different jobs: early contact that can also reach a much later return, a compact middle turn with continuous exposure, and a separate final catch. The first base's windows are 54.43–137.57 and 582.43–665.57 route units: a **444.86-unit interruption**, not rapid repeat fire. The middle upgrade sees one continuous 340.12–571.88 interval; the last base sees 702.43–785.57. Nearby single-pass and split-pocket alternatives remain clear.

The eastern mesa/aqueduct landmark has its tallest forms on the outer side and a low apron toward the route. Broken low mesas, rocks and subordinate cacti now fill the remote northwestern approach ground; dry southern groups connect toward the offset oasis. Pale paving and the open inner apron keep the ochre Walker distinct from the mesa. No water crossing or route blocking is added.

### C — The frostwater pass

Route corners: `[5,0] → [5,9] → [8,9] → [8,4] → [12,4] → [12,15]`.

The returning pass has **three-box separation**, leaving two internal rows. A base at `[6,5]` positively covers the first side while `[7,5]` covers the returning side; the opposite straight is tangent-only at range 48. Range 72 reaches both, so choosing a side before upgrading is a real geometric distinction rather than an empty middle-row trap. The selected upgrade's windows are 52.12–187.88 and 330.33–427.88 route units. The final base covers 630.43–713.57 on a separate exit stretch.

A western slate/fir bank tapers toward the pass. Its substantial remote shoulder and uneven southern tail now occupy the former open southwest band, with young trees, rocks and shrubs tapering toward the courts. An asymmetric upper lake and low eastern shore give the two unequal open courts different surroundings while leaving the dark route visible. No tall scenic line crosses the pass or final sight corridor.

### D — The violet cloister

Route corners: `[9,0] → [9,9] → [4,9] → [4,5] → [7,5] → [7,3] → [0,3]`.

A compact open cloister replaces the long perimeter circuit. The middle upgrade reaches an early passage and a later return, at 28.12–163.88 and 460.12–595.88 route units. The **296.24-unit interruption** is deliberate and must not be described as rapid re-engagement (24.69 seconds at 12 units/second, longer at a slower actor speed). A nearby alternative `[5,8]` instead covers a continuous 131.14-unit inner-corner interval, while `[8,8]` favours the entry/bottom corner. The late base covers 606.43–689.57.

The southern ruin/arch backdrop now connects to a broad remote eastern plum grove, with tall crowns mainly on X14–15 and a low inner edge at X12. A smaller western woodland tail completes the uneven frame. A quiet two-box inner basin gives the court a focal point without consuming its useful edges. Low ground near the road keeps Spider's dark legs readable against pale paving. There is no crossing, branch or new placement mechanic.

## Preview turret coverage

Turrets are listed in `scene-1`, `scene-2`, `scene-3` order. The middle turret is upgrade 1; the others are base models. Ranges remain 48/72/96 units and combat tuning is unchanged.

| Zone | Base position / coverage | Upgrade 1 position / coverage | Base position / coverage |
| --- | --- | --- | --- |
| A | `[2,6]` / 83 units | `[5,6]` / 272 units | `[9,10]` / 83 units |
| B | `[4,7]` / 166 units | `[9,9]` / 232 units | `[4,12]` / 83 units |
| C | `[4,3]` / 83 units | `[6,5]` / 233 units | `[11,11]` / 83 units |
| D | `[10,2]` / 83 units | `[8,4]` / 272 units | `[3,2]` / 83 units |

Coverage is exact route centre-line length inside a horizontal range circle, rounded above to whole units. It excludes tangent-only contact. It does not predict damage, line of sight, target competition or final balance. All three showcase positions in each zone have positive base-range coverage, so none relies on an instantaneous tangent contact to demonstrate firing.

`productionPlacementCandidates(zone)` provides additional authoring diagnostics. Its labels are provisional coverage bands: strong ≥120 units, alternative ≥70, limited >0, upgrade-dependent only at 72 units, and reserve without positive coverage at either range. Those labels are not game rules.

| Zone | Strong | Alternative | Limited | Upgrade-dependent | Reserve |
| --- | ---: | ---: | ---: | ---: | ---: |
| A | 5 | 26 | 10 | 17 | 1 |
| B | 8 | 22 | 9 | 7 | 0 |
| C | 3 | 36 | 6 | 23 | 0 |
| D | 8 | 21 | 9 | 19 | 0 |

## Named B–D alternatives for validation

These are deliberately clear, dry, flat alternatives, considered individually rather than assumed safe as simultaneous neighbouring placements. Coverage values are route units at range 48/72/96, rounded to one decimal; range 96 is geometry-only while upgrade 2 remains inactive. The actual muzzle LOS and rotating-head audits remain separate from horizontal range.

| Zone / box | Intended distinction | Coverage at 48 / 72 / 96 |
| --- | --- | --- |
| B `[2,5]` | Earlier single-pass contact | 83.1 / 115.9 / 201.4 |
| B `[5,7]` | Early passage plus delayed return | 166.3 / 281.3 / 423.1 |
| B `[9,7]` | Split exposure outside the compact turn | 118.3 / 223.5 / 456.9 |
| B `[2,12]` | Forgiving opposite-side late position | 83.1 / 135.8 / 164.9 |
| C `[7,5]` | Base coverage on the return side | 83.1 / 243.1 / 352.2 |
| C `[6,7]` | Later contact on the first pass | 83.1 / 289.5 / 348.4 |
| C `[11,7]` | Earlier part of the terminal stretch | 83.1 / 135.8 / 375.1 |
| C `[13,11]` | Forgiving opposite-side late position | 83.1 / 135.8 / 185.9 |
| D `[8,2]` | Early contact with some later return coverage | 118.3 / 203.6 / 297.4 |
| D `[5,8]` | Continuous inner-corner engagement | 131.1 / 183.8 / 296.1 |
| D `[8,8]` | Entry/bottom-corner engagement | 131.1 / 183.8 / 294.3 |
| D `[3,4]` | Late route with some inner-turn reach | 118.3 / 223.5 / 302.9 |

Each candidate's total sums its own disjoint journey intervals once. Do not sum different candidates to claim unique team coverage: their intervals overlap. Revisit time is uncovered route distance divided by actual actor speed. The current Walker/Spider speeds are 18/10 units per second; the fixed route-distance values above remain valid. These geometric distinctions do not establish final budget, wave or mistake-tolerance outcomes.

## Review and remaining scope

`bun scripts/production.js` validates all current generated levels and the 43 existing scenery sources without writing assets. `bun test tests/production-layouts.test.js` passes **five focused tests, zero failures**: empty flat courts, distinct routes, A's return, B's delayed revisit/continuous turn, C's pass-side range distinction and D's continuous inner-corner alternative. No broad test run was performed by Tactician.

Artist and Tactician previously reviewed the [B](screenshots/zone-b-layout-review.png), [C](screenshots/zone-c-layout-review.png) and [D](screenshots/zone-d-layout-review.png) overviews for route and actor readability. The subsequent user feedback that they looked too empty **supersedes the sparse composition signoff**. The density revision is source-validated and passes the five focused layout tests; refreshed visual, actual paired-muzzle LOS and rotating-head checks must use the regenerated scenes. Earlier screenshots and combat audits describe the previous dressing until those checks are repeated.

The three A dogs retain their existing 12-unit/second speed and starting distances. Its middle upgrade-1 site `[5,6]` has two geometric 135.76-unit windows separated by 56.24 units (about 4.69 seconds at current speed). The actual dressed scene produces 82 shots, distributed 16/52/14 across the turrets, and all dogs die by 46 seconds with 300 HP and 10/12 damage unchanged. Its final audit is recorded below. The [initial square report](production-engine-report.json) is historical; its earlier layouts and 31.75-second A result must not be attributed to the current routes.

The user authorised Walker testing in B and Spider testing in D alongside these layouts. Lead/Engineer integrate their accepted models and gait; C retains its turret-only preview. Per-zone preview speeds and start distances may be tuned to demonstrate firing and animation; they are not final wave design. No new enemy abilities, branching, player deployment rules, upgrade costs or final difficulty balance is added by this layout work.


### A revision closeout

Engineer completed **51 affected tests, zero failures**, without a full-suite run. Seven showcase/alternative sites were checked at the three range tiers, using 12,705 paired muzzle samples and conservative full yaw/recoil envelopes against occupied scenery. No obstruction or swept-head conflict was found; alternatives were considered individually, not as simultaneous neighbouring placements. The actual dressed scene produces 82 shots (16/52/14), with all three dogs destroyed by 46 seconds. Camera/shadow geometry fits the existing bounds, and B–D saved-level hashes are unchanged. [Engineering evidence and sampling limits](zone-a-layout-review-engine.json).

Lead reused the existing built-in browser tab for day/night and path-camera review and A→B→A lifecycle checks. Scene resources release to zero before replacement; A returned to 93 buffers and 1,243,320 geometry bytes for that earlier dressing, with weather inactive and no browser/WebGPU errors. [Browser record](zone-a-layout-review-browser.json), [day overview](screenshots/zone-a-research-overview.png), [night](screenshots/zone-a-research-night.png). Artist, Tactician and Engineer signed off that bounded study. The later B–D pass preserved A exactly; the latest density authorisation now adds remote A scenery and requires fresh scene evidence.

## Paired Arc Spire test scenes

The user approved the finished Arc Spire models on 18 October and authorised four second test levels. The saved moss-02/ochre-02/ice-02/plum-02 scenes keep these accepted first-level routes and scenery for direct model comparison, replacing the three turret sites with Arc Spire base/upgrade1/upgrade2. They introduce no attack rules or campaign difficulty progression. Shift+1/2 and the bottom selector switch between the two studies in each zone. [Details, sources and verification](arc-spire-levels.md).

## Defence-placement visibility

**Defence-placement visibility is a standing requirement (18 October):** any scenery that obscures an area where defences can be placed must be removed or replaced with something smaller. Apply this to occupied sites and usable alternative clearings in the normal gameplay overview. Physical clearance and attack line-of-sight are separate checks; a technically usable site is insufficient if the player cannot see it. Do not rely on camera orbiting to reveal intended placement ground.


## Landscape-first A4 study (18 October)

A4, **The old garden mere**, is the completed 18×16 landscape-first trial. It preserves Artist’s frozen baseline and carves a 29-box route, ten visible placement areas and four existing defence items from it. The original three studies per zone remain unchanged. [Research, before/after images and current status](design-doc.md#historical-a4-trial-the-old-garden-mere), [exact route/coverage/removal evidence](zone-a-four-layout.md), [browser checks](zone-a-four-browser-review.json). This is a development study, not a balanced fourth campaign level.
