# Rebuild verification record

The checks below concern the final sources. Tests were run in affected batches, with failed cases corrected and rerun; this is not a full-suite result. Repeated checks are not added into an aggregate claim.

| Area | Final result |
| --- | --- |
| Multi-route engine and compatibility | 62 affected checks pass; editor bundle syntax passes. |
| Reproducible layout, occupied-part clearance, real coverage and combat | All 16 level checks pass. A: 4 /2,198 assertions. B: 4 /2,178. C: 4 /2,155, followed by C1-only refresh after seed correction (1 /430). D1–3 plus final D4 pass; D4-only final check has588 assertions. |
| Saved-scene lifecycle and legacy source expectations | Engineer reports28 distinct checks pass, including all16 runtime scenes, source reproducibility, wildlife metadata, legacy factories and accepted A4 exception comparison. |
| Preview catalogue | 7 checks /98 assertions pass. |
| A1 enhancer and plasma fixture migration | 7 checks /133,937 assertions pass; exact effective damage12.5/12/10, reset/noncompounding, fixed-surface links and disposal preserved. |
| Independent placement-ground visibility | All150 full areas pass:86,400 rays plus continuous projected cuboids. |
| Asset preservation | All66 model source hashes unchanged; all13 prior level archives match; all16 source/manifest/audit/visibility records agree with their baselines. |
| Browser | All16 final levels reviewed in the same built-in tab; expected rosters/routes, six wildlife per level, weather off, zero light overflow and cleared previous-scene resources. Current C3 additionally checked night/snow, T0.1×, R, F and level-retaining reload. No warnings/errors after final reload. |
| Documentation | Main design doc:237 link/image targets,14 images, zero missing targets or stripped links. Rebuild catalogue:131 targets,16 images, zero missing targets or stripped links. |

Resolved during review: D4's initial turret site clipped the Spider on its turn and moved to the adjacent clear site. C1's initial wildlife seed overlapped its middle turret and moved to an empty authored clearing; retry, lifecycle, geometry and visibility then passed. Saved A1 tests were migrated from old placement IDs to model/variant/cardinal-adjacency selection. The missile review tool now uses absolute elapsed motion time across unequal route loops.

Detailed reproducible evidence is linked from [the catalogue](README.md), [tactical analysis](layouts.md), [browser record](browser-review.json) and [hash preservation](preservation.json). These checks do not establish campaign balance or a hardware performance target.
