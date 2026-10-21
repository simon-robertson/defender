# Impact particles and local-light tuning, 20 October 2026

Removed the eighteen outward ballistic `kind=5` missile-impact fragments and their unused billboard/mask shader branches. The main fireball core and eight rolling lobes retain their previous geometry, analytic motion and fade. Impact smoke, ring and the original missile light curve remain unchanged (`.26` seconds, strength `26`, radius `52`). At `.12` seconds an isolated impact contains nine smoke particles, nine fireball particles and one ring, with no fragment particles.

Turret muzzle lights now peak at `8` instead of `10` (×0.8), retaining the fade curve, colour, radius `96`, paired flash geometry and `.085`-second flash duration. Every enemy-family destruction light uses `.336` seconds instead of `.48` (×0.7), with peak `44` and radius `96` retained. Enemy blast, shockwave and debris lifetimes are unchanged.

Missile blast capacity drops from `27` to `9` particles per blast, saving `3,456` bytes in each fixed CPU/GPU particle payload. Combined damage cube/particle GPU allocation is `51,648` bytes. The renderer regression now derives this allocation from the shared capacity constants rather than an obsolete literal.

Verification logs: `effects-tests.log` (51 effects/renderer checks), `effects-integration-tests.log` (real missile integration and water-pool checks), and `effects-shader-cleanup-tests.log` (affected damage/bloom renderer checks after unused shader branches were removed). Runtime samples/configuration are recorded in `effects-summary.json`. Actual GPU shader compilation and player visual review belong to root's browser integration pass.
