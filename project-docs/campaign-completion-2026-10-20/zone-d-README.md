# Zone D layout delivery · 20 October 2026

The four Plum and Mint landscapes now have selected winding routes and visible, useful defence alternatives for the authorised B–D campaign completion. The route and placement work is technically verified for user review; creative acceptance and the complete campaign's balance remain separate. Existing Spider and Lantern are the only D species. All four complete route IDs are `main`.

| Source | Selected journey | Route length | Full surveyed plots | Original / retained scenery |
| --- | --- | ---: | ---: | ---: |
| `plum-01` | Orchard and Crescent Tour | 1176 | 40 | 308 / 200 |
| `plum-02` | Fallen Arch Return | 1152 | 47 | 305 / 189 |
| `plum-03` | Lantern Shore Return | 768 | 35 | 249 / 167 |
| `plum-04` | Crown River Tour | 1224 | 46 | 282 / 166 |

The displayed original landscape names remain Mauve Orchard, Fallen Arches, Lantern Mere and Crown Gardens. The journey names identify the comparative authoring studies, not additional levels.

Two purposeful options were studied on each immutable landscape before selection. The [comparison data](zone-d-comparison.json) and matching SVGs show both the proposed journey over its untouched landscape and the selected carve with complete 24×24 plots. D1's selected northern return involves the crescent pond and produces more distinct courts than the shorter southern circuit. D2's longer northern/central return retains the stream as scenery rather than using the shorter western crossing. D3's shore return involves the reachable mainland more evenly than the narrow western circuit while keeping the large lake uninterrupted. D4's short bridge makes the western garden part of the journey; its alternative stayed entirely east of the river.

- D1: [selected study](zone-d-orchard-crescent-tour.svg), [southern alternative](zone-d-southern-orchard-circuit.svg).
- D2: [selected study](zone-d-fallen-arch-return.svg), [stream-crossing alternative](zone-d-stream-arch-crossing.svg).
- D3: [selected study](zone-d-lantern-shore-return.svg), [western alternative](zone-d-western-grove-circuit.svg).
- D4: [selected study](zone-d-crown-river-tour.svg), [eastern alternative](zone-d-eastern-crown-circuit.svg).

D4 uses the existing one-unit wooden-deck contract over `[4,13]` and `[5,13]`, with dry banks at `[3,13]` and `[6,13]`. Its top is Y24, underside Y23, and the original Y21 river/bed remains beneath. D1–D3 use entirely natural dry support. Every route enters/leaves through exactly two boundary boxes and has interior intermediate boxes. There are no unintended neighbouring paved connections.

Every retained scenery placement is byte-for-byte equivalent to its baseline object. All original terrain, water, environment, path height, footprint and supported bird-perch metadata remain unchanged. Removal manifests identify route travel, full placement footprint or overview visibility as the reason for each of 422 removals. No scenery/model source was added or revised. Twelve ground wildlife seeds moved to connected route courts; their existing behaviour is unchanged. The frozen 69-file snapshot is rehashed by the final verifier.

The [final verification](zone-d-verification.json) binds every report to the actual source SHA256. The independent weapon survey checks nine model/stage combinations at each of 168 sites. Production placement rules allow 1462/1512 combinations; the 50 restrictions concern gun sweeps against retained scenery or the outer map bounds. Every declared plot has at least one legal weapon. The source/weapon route surveys sample 8648 actual Spider/Lantern poses in total, with no observed scenery or routed-weapon overlap. These are independent alternatives: neighbouring plots are not a promise of simultaneous rotating-gun compatibility.

Actual gun aiming and pitched muzzle visibility and deterministic Arc surface contacts are measured in one-unit journey bins. Every plot has a positive base-Arc opportunity against both D species after production placement restrictions. Base-gun use depends on the reported site restrictions. The complete per-species intervals are in each `zone-d-<journey>.coverage.json`. Examples of genuinely separated base-gun Spider opportunities are D1 `[7,12]`: `[918,1002]` and `[1062,1146]`, with a 5-second uncovered gap at its ordinary 12-unit speed; D2 `[5,6]`: `[150,234]` and `[294,378]`; D3 `[5,8]`: `[270,354]` and `[414,498]`. The measured intervals are attack opportunity, not guaranteed damage or campaign balance. Shared preview weapon values are used by this layout survey; the campaign balance harness owns play-only profiles.

The current production route envelope also encloses every sampled occupied Spider vertex: maximum radius 11.95695 within 12, maximum top 14.60219 within 14.75 above the route. Lantern's sampled radius is 9.89951 and height range 38–59, within its rotor/bank-aware contract. This checks ordinary movement; directional hit recovery keeps its existing live safety gate.

All 24 cosmetic wildlife actors complete real journeys during four 180-second/30 Hz runs, with connected meaningful ground destinations and supported bird departure/arrival. Actual animated envelopes remain clear, and teardown releases the scene references. Seventy-two finite production missile flights finish with 65 hits and seven scenery contacts; no flight expires, loses its target, leaves a live damage claim or remains active. The scenery contacts are valid physical misses, not guaranteed firing success from every time/position.

Built-in-browser normal overviews were visually inspected at 1280×720, along with the comparison drawings. The roads and intended courts remain readable, the distinct pond/stream/lake/river identities are retained, and D4's deck reads as a short crossing. Saved actual GPU captures: [D1](zone-d-plum-01-overview.png), [D2](zone-d-plum-02-overview.png), [D3](zone-d-plum-03-overview.png), [D4](zone-d-plum-04-overview.png). These are source-layout reviews, not human campaign playtests.

Reproduction:

```sh
bun scripts/d-path-carving-options.js
bun scripts/d-path-carving-comparison.js
bun scripts/d-path-carving.js --write
bun scripts/d-path-carving-audit.js
bun scripts/d-path-carving-clearance.js
bun scripts/d-path-carving-placement.js
bun scripts/d-path-carving-coverage.js
bun scripts/d-path-carving-missiles.js
bun scripts/d-path-runtime-audit.js --seconds 180
bun scripts/d-path-carving-verify.js
bun test tests/d-path-carving.test.js
```

`d-path-carving.js` reads the selected removal/site data and immutable baseline, verifies its expected hash, and regenerates only the four D sources. No comparison, geometry or coverage scan runs in the preview factory. It exports `D_CARVES`, `carvePlum` and `checkDPathEdges`. The lead integrates that factory into the existing preview entrypoint. The 24 targeted D tests pass with 1802 assertions; no full test suite was run.

Required shared documentation integration: update `docs/design-doc.md` campaign/status, current level catalogue, authoring ownership and change record for authorised B–D completion; describe D's four routes and bridge, preserve the implemented/provisional/user-review distinction, and link this record. Update project brief, Tactician notes and today's diary consistently. The lead owns those shared edits and whole-campaign evidence.
