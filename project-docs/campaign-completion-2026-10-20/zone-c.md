# Zone C authoring and technical handoff

20 October 2026. The user authorises completion of B–D as playable, balanced areas. Zone C's four active sources are now carved for that campaign integration. Technical verification and internal selection do not establish human visual or balance acceptance. Lead owns campaign configuration, browser/GPU checks, the shared design documents and diary.

| Level | Selected journey | Complete routes | Surveyed full plots | Original scenery retained |
| --- | --- | --- | --- | --- |
| C1 `ice-01` | Tarn and Fir Circuit | `main` 960 units | 39 | 192 / 300 |
| C2 `ice-02` | Meltwater Crossing and Return | `main` 888 | 41 | 185 / 275 |
| C3 `ice-03` | White Ridge Confluence | `main` 840; `northern` 504 | 48 | 181 / 298 |
| C4 `ice-04` | Sanctuary and Mere Fold | `main` 864 | 40 | 178 / 274 |

Every route has boundary endpoints and interior intermediate boxes. No nonconsecutive paved contacts remain. C2 crosses the existing river on two wooden deck boxes `[10,5]`, `[10,6]`; C3 crosses its stream on `[8,8]`. Deck tops remain at Y24, undersides Y23, above the original water and beds. C3 joins at `[12,8]` and shares a 216-unit directed tail; the branch-length difference is 336 units. Sources remain scenery/wildlife `layout` previews for `/game/`; `/play/` supplies its separately configured actors and waves.

The original terrain, water, environment, footprint, all retained scenery records and all three supported bird perch records are exact. The frozen source hashes are checked by the deterministic factory. No model, A/B layout, D source or backup is edited by these C scripts. Ground seeds were revised only to usable connected roaming ground; the three hares and three birds remain in each level.

## Compared journeys

[Comparison data](zone-c-comparison.json) and the paired same-scale SVGs record two purposeful alternatives per landscape, each starting from the same original populated source. Full plots are independent authoring alternatives, not fixed build pads or a promise that adjacent rotating weapons can coexist.

- C1's selected [tarn circuit](zone-c-tarn-circuit.svg) visits northern fir ground, the east bank and a late southern return. The [western fold](zone-c-western-tarn-fold.svg) leaves the eastern bank outside combat; its greater plot count consists mainly of western flexibility rather than a stronger landscape journey.
- C2's selected [crossing and return](zone-c-meltwater-return.svg) reaches the southern ridge and a separate southeast catch. The [upper-bank tour](zone-c-upper-bend-tour.svg) uses the same short crossing but ends north, leaving much southern dry ground scenic.
- C3's selected [confluence](zone-c-ridge-confluence.svg) creates western-only, northern-only and shared investments across both banks. The [western fold](zone-c-western-ridge-fold.svg) avoids a bridge but confines all combat to one side of the stream.
- C4's selected [sanctuary fold](zone-c-sanctuary-fold.svg) keeps the large lake uninterrupted and returns through two broad internal courts. The [shore crossing](zone-c-shore-crossing.svg) adds a two-box bridge at the lake lip and removes substantially more scenery without a stronger final catch.

The selected sources remove props only for supported route travel, full defence ground and its normal-overview visibility. Terrain or supported-perch obstructions disqualify a surveyed plot rather than altering the landscape or removing a bird anchor.

## Weapon choices and physical limits

The current native `/play/` guard admits all three Arc and missile tiers on all 168 surveyed plots. It admits guns at 8/7/7/5 second-row plots in C1–C4 respectively; exact site IDs and restrictions are in each `.placement.json`. The guard conservatively reserves a radius-12 volume to Y26.5 for tall Tripods. Adjacent gun movement can intersect that reserved volume; retain that protection. The separate second-row courts allow existing upgraded guns to contribute without weakening clearance. A base gun's 48-unit range is tangent at that distance and should not be presented as useful sustained Tripod coverage.

Shared-profile opportunity measurement finds 140 plots with a positive base Arc opportunity against both C species; the other 28 require upgraded reach. Native placement admits 27 gun positions across the four levels. These counts describe alternatives independently, not a simultaneous deployment.

The independent sampled motion survey checks actual occupied-part vertices at every one-unit route position and both endpoints, and tests complete weapon yaw/pitch/recoil envelopes against static scenery and routed enemies. Canonical Tripod samples remain within radius 11.912, bottom Y0 within floating-point tolerance and top Y26.5 above path height. This supports the conservative contract but is not a continuous proof over every animation/impact phase. Native-admitted gun courts also pass the independent sampled survey; rejected near-path combinations remain recorded rather than being silently described as universal fit.

Gun/Arc opportunity audits use shared preview profiles to compare authoring ground. Guns use one-unit midpoint bins and both actual muzzle rays at zero/full recoil. Arc contacts use four-unit midpoint quadrature with production contact/LOS checks; interval lengths are approximations within those bins. This evidence does not substitute for the campaign's play-only ranges, strengths, altitude and actual combat trials. Silo range circles establish admission only. Ninety representative production single flights across current tiers and both C species finish cleanly; 81 hit and nine contact retained scenery. Such contacts are genuine trajectory limitations, not grounds for clearing the whole landscape or claiming guaranteed hits.

## Verification and reproduction

The final [C verification](zone-c-verification.json) reconciles current source hashes against each report. The 12 C regression checks pass with 1,332 assertions. They cover exact deterministic reproduction, landscape/perch preservation, route support/edges/topology, dry surveyed ground and unchanged bridge water. The four 180-second/30 Hz production wildlife runs pass: every one of the 24 actors completes journeys, support/collision/animated-envelope checks pass, planning remains bounded and disposal releases scene references.

Reproduce only C sources with `bun scripts/c-path-carving.js --write`. It reads the immutable original landscapes, checks their hashes and applies explicit selected removals/seeds from `scripts/c-path-carving-data.js`. `scripts/c-path-carving-options.js` regenerates the separate comparison artifacts; it never writes active sources. Relevant commands are:

```sh
bun test tests/c-path-carving.test.js
bun scripts/c-path-carving-comparison.js
bun scripts/c-path-placement-audit.js
bun scripts/c-path-carving-audit.js
bun scripts/c-path-carving-clearance.js
bun scripts/c-path-carving-coverage.js
bun scripts/c-path-carving-missiles.js
bun scripts/c-path-runtime-audit.js --seconds 180
bun scripts/c-path-carving-verify.js
```

## Shared-document amendments for Lead

Update `docs/design-doc.md` landscape status and change record: C1–C4 now have the four selected supported layouts above, two wooden crossings and C3's `northern` merge. Preserve implemented versus human-accepted status. Update affected project/team/terrain/bridge/current-preview notes and the 20 October diary with the frozen-source and 24-actor runtime evidence. The campaign agent owns wave balance and final complete-run evidence; Root owns built-in browser/GPU captures. No new species, model, running feature, weather policy or engine mechanic is authorised or introduced here.
