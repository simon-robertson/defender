# Zone B path carving

19 October 2026. **B1–B4 are implemented, technically verified and now explicitly user-approved.** The user subsequently said, “The zone B levels look good to me.” Acceptance changes status only; source geometry and recorded verification are unchanged. Zone 2 means B / Ochre and Petrol. These are layout/wildlife previews without enemies or placed defences. Approved A1–A4, the eight C/D landscapes, all models and the frozen backup are preserved.

Lead selected each journey after comparing two alternatives in the production renderer. Tactician used `gpt-6.1-sol` at Extra High; Artist independently reviewed composition and Engineer reviewed source/runtime/wildlife and the continuous gun-envelope audit. [Eight alternatives and decision reasons](OPTIONS.md) · [Artist](artist-review.md) · [Engineer](ENGINEER.md) · [Current browser review](browser-review.json).

| View | Selected journey | Route boxes / lengths | Visible plots | Useful base gun / Arc | Scenery retained |
| --- | --- | --- | ---: | ---: | ---: |
| [B1](/game/?level=ochre-01&inspect) | Cistern and Mesa Circuit | 44 / 1,032 units | 39 | 38 / 39 | 201/319 |
| [B2](/game/?level=ochre-02&inspect) | Riverfold Crossing | 45 / 1,056 units | 37 | 34 / 37 | 178/281 |
| [B3](/game/?level=ochre-03&inspect) | Mesa Confluence | 45+31 / 1,056+720 units | 38 | 35 / 37 | 193/310 |
| [B4](/game/?level=ochre-04&inspect) | Aqueduct and Shore Tour | 31 / 720 units | 32 | 26 / 29 | 161/240 |

Current overviews: [B1](ochre-01-game.jpg) · [B2](ochre-02-game.jpg) · [B3](ochre-03-game.jpg) · [B4](ochre-04-game.jpg). The [read-only comparison viewer](/tools/b-layout-review.html) shows baseline, alternatives and current sources.

## Design and actual opportunities

B1 combines a northern return, eastern mesa circuit and independent southern catch. Its tiny cistern and raised islands remain; wall `[5,4]` is removed to expose full plot `[4,5]`. B2 has distinct bank courts joined by one two-box wooden crossing at `[6,6]`/`[7,6]`; deck Y23–24 retains Y20 water and Y17 bed beneath. B3's western/eastern approaches meet at `[16,9]`, then share a 552-unit southern circuit. B4 follows the eastern mainland and indented shore, preserving its broad lake. Every original wall remains in B2–B4.

Every route has boundary endpoints, interior intermediate boxes, continuous support and no extra paved joins implying shortcuts. All levels preserve 20×16, original terrain/water/environment, clear weather, three lizards and three birds. Rejected footprint removals were restored; all retained props match their original data exactly.

All **146 full 24×24 plots** pass continuous normal-overview visibility independently of LOS/clearance. **142** have positive measured opportunity against every B species with an admissible base gun or Arc. B3 `[14,7]` and B4 `[10,6]`, `[11,6]`, `[12,6]` need upgraded gun/Arc reach. These are independent alternatives, not fixed build pads, guaranteed damage or certified adjacent arrangements.

Base coverage is deliberately incomplete. For the representative Walker, B3 retains main-route Arc `[810,894]` and gun `[810,942]` gaps (eastern `[474,558]` / `[474,606]`), preserving scenery and upgrade benefit. Upgrade-1 Arc covers both approaches. B1/B2/B4 have documented shorter base gaps. Independent-site unions are possible coverage, not additive team damage or campaign balance. [Detailed trade-offs](OPTIONS.md).

## Verification and limits

All **13,767 one-unit canonical route poses** of Walker, Dune Tread and Twin Fan clear exact static scenery/terrain. Actual gun intervals check pitch and both pitched muzzle rays at zero/full recoil; Arc intervals check terminal selection, centre LOS and facing-side surface contact, including upgrade 2. Gun upgrade 2 remains inactive.

Every Arc/silo stage physically clears all 146 plots. Base/upgrade-1 gun fit counts are B1 **38/38**, B2 **34/34**, B3 **36/37**, B4 **29/29**; useful-gun counts above additionally require actual attack opportunity. Exact conservative restrictions appear in each clearance report. Height-dependent gun envelopes continuously bound all occupied voxels through yaw/pitch/recoil; Engineer independently reviewed that construction. All tested weapon envelopes have zero sampled route-body overlaps. Finite route poses exclude arbitrary impact-recovery states.

All **180 representative missile launches hit**. Another **27 deliberately late probes** produce nine Dune Tread hits and 18 Walker/Twin Fan discards when existing preview actors wrap their route before impact. These expose practical launch timing, not campaign exit rules. Across 207 probes: zero physical misses, static contacts, stuck flights or retained claims. Finite hits do not certify every trajectory/time.

| Source | Route/LOS/pitch/visibility | Physical clearance | Admissible intervals | Flights |
| --- | --- | --- | --- | --- |
| B1 | [Audit](cistern-mesa-circuit.audit.json) | [Clearance](cistern-mesa-circuit.clearance.json) | [Coverage](cistern-mesa-circuit.coverage.json) | [Flights](cistern-mesa-circuit.missiles.json) |
| B2 | [Audit](riverfold-crossing.audit.json) | [Clearance](riverfold-crossing.clearance.json) | [Coverage](riverfold-crossing.coverage.json) | [Flights](riverfold-crossing.missiles.json) |
| B3 | [Audit](mesa-confluence.audit.json) | [Clearance](mesa-confluence.clearance.json) | [Coverage](mesa-confluence.coverage.json) | [Flights](mesa-confluence.missiles.json) |
| B4 | [Audit](aqueduct-shore-tour.audit.json) | [Clearance](aqueduct-shore-tour.clearance.json) | [Coverage](aqueduct-shore-tour.coverage.json) | [Flights](aqueduct-shore-tour.missiles.json) |

Only ground wildlife seeds were relocated from trapped pockets; behaviours, species/counts and original bird perches remain. Independent **180-second/30 Hz** probes verify connected roaming, completed journeys, supported bird arrivals, animated envelopes, bounded work/storage, reset and teardown. Ground completions: B1 `[3,3,2]`, B2 `[5,5,6]`, B3 `[6,3,3]`, B4 `[3,2,11]`; all twelve birds complete multiple supported relocations. [B1](ochre-01-runtime.json) · [B2](ochre-02-runtime.json) · [B3](ochre-03-runtime.json) · [B4](ochre-04-runtime.json). Original failed-seed reports remain explicitly historical.

Engineer ran three affected runtime/catalogue/world files: **20 pass, 0 fail**, 305,524 expectations. All sixteen sources match their current deterministic factories; `bun run rebuild:previews` preserves B. No full suite was run. Lead's current-hash browser review covers path/bridge/both approaches, reset/time/weather/night, switching and preserved A1 drone combat without browser errors.

## Preservation and reproduction

[Final verification](verification.json) compares all 85 pre-task asset files: only the four B production sources changed. The other twelve production levels and all **67 model sources** are unchanged. All **69 frozen checksummed files** and the compressed archive verify; archive SHA-256 is `d3d8ae77ce5e70b0a0bac22183ecc4712aee4830871afc9955cceb8976d2098b`.

| Source | SHA-256 |
| --- | --- |
| `ochre-01.json` | `0f733a25a14d886049ef71716e368316d5496b680682763ddcc562c498ef669e` |
| `ochre-02.json` | `6e437f27aaac3f8b75212039e6bb3a6f966c25b0a20b41d38aed6c40bf5fb129` |
| `ochre-03.json` | `01a498d7720489c3837023f6f4183ba4688da1fde814907a5370a8815d874ad8` |
| `ochre-04.json` | `32516e96472e42605fdc53e74046e2b3164d1ad9549e025521e5919f39d4ed3f` |

`bun run check:previews` checks factory equality; `bun scripts/b-path-carving-verify.js` checks source/report/preservation hashes. Named `b-path-carving-*` scripts reproduce comparison, geometry, clearance, intervals and flight evidence; `b-path-runtime-audit.js` reproduces wildlife checks. The [design doc](../design-doc.md) retains current mechanics. No waves, deployment, economy, outcomes or final balance are assigned by this delivery.
