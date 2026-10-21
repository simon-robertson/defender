# Additional enemies — ground and airborne concepts v1

**Later revision (18 October):** the user replaced D Concertina with a rolling-ball trial (Tumbler), then requested one large central wheel with body housings on either side (Monowheel). The user then removed this enemy completely while considering a different design. None of its three forms remains active. The linked-module drawing on this sheet is retained as historical concept art; see the [current model notes](../enemy-expansion.md).

**Approved 18 October 2026:** the user accepted all eight designs and authorised modelling, provisional defaults and mixed existing-level previews. See [production notes](../enemy-expansion.md). Earlier proposal wording below records the concept stage.

**18 October 2026 — proposals awaiting user selection.** The user requested more than one enemy type per zone, including ground and airborne types. These two comparison sheets explore one new ground and one airborne candidate for each zone. Names are working labels, not approved canonical model IDs. Existing Dog, Walker and four-legged Spider remain unchanged; no candidate has been modelled or added to a level.

## Ground candidates

![Four additional ground enemy concepts](enemy-ground-expansion-v1.png)

| Zone | Working name | Visual identity |
| --- | --- | --- |
| A · Moss and Porcelain | Roller | Two dominant stepped wheels around a narrow upright core; porcelain shoulders, forest mechanisms, moss panels and a vermilion sensor. |
| B · Ochre and Petrol | Dune Tread | Low wedge body between two exposed track pods; petrol mechanisms, ochre/sand armour and a turquoise sensor. No gun or turret. |
| C · Ice and Ember | Tripod | Raised sensor body on three articulated legs with broad separate feet; navy/slate structure, ice-white plates and an ember sensor. |
| D · Plum and Mint | Concertina | Three short linked armour sections on inset wheels; charcoal mechanisms, plum/mauve casing, sparse mint and a coral sensor. |

## Airborne candidates

![Four additional airborne enemy concepts](enemy-airborne-expansion-v1.png)

| Zone | Working name | Visual identity |
| --- | --- | --- |
| A · Moss and Porcelain | Moth | Small mechanical centre with four hinged rectangular wing plates: larger front pair, smaller rear pair. |
| B · Ochre and Petrol | Twin Fan | Two open square fan frames beside a slim fuselage, with one upright tail. |
| C · Ice and Ember | Ray | Broad shallow flying wing, stepped panel outline, raised central spine and split tail; no legs. |
| D · Plum and Mint | Lantern | Vertical pod suspended below one square rotor frame, with two lower fins around an open gap. |

## Design and implementation boundary

Artist proposed the roster and palette/readability direction; Lead generated and reviewed both sheets. Distinct movement silhouettes broaden the existing roster without returning to the rejected Dog-like Brambleback/Cinderhaul proposals. Ground versus airborne is the only proposed categorisation here: no attack, armour, speed, HP, resistance, payload or special ability is assigned by the illustration or working name.

The concepts use polished illustrative geometry. Chamfers, round wheel hubs, track detail, panel seams and diagonal wing edges must be translated into the established clean, texture-free, axis-aligned authoring grid during any separately authorised modelling. Sensor glow follows the existing visual language, not a new light budget. Exact 24-unit footprint, moving-part clearance, wheel/track/gait/wing animation and flight plausibility have not been validated. Airborne navigation, altitude, collisions, route/exit behaviour and defence target eligibility remain design work after selection. No implementation or wave placement follows automatically from an art choice.

Artist's image review found no blocking artifacts: all eight working names, zone headings and intended component counts are clear. Concertina's length and Moth/Ray wingspans need deliberate 24-unit fitting. Twin Fan's pictured fan planes are nearly vertical; later design must provide a clear lift orientation or tilt joint rather than treating the illustration as proof of flight mechanics. This internal review does not substitute for user selection or approve new runtime lighting.

## Generation records

Both sheets were generated with the built-in `image_gen` tool through the **imagegen** skill. No external reference-game imagery was copied. Saved project outputs and full prompts:

- [Ground artwork](enemy-ground-expansion-v1.png) · [ground prompt](enemy-ground-expansion-v1.prompt.txt).
- [Airborne artwork](enemy-airborne-expansion-v1.png) · [airborne prompt](enemy-airborne-expansion-v1.prompt.txt).

The earlier [enemy lineup](enemy-lineup-v1.md) remains a historical selection record for Walker/Spider, not an approval of these new proposals.
