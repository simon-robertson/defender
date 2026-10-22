# Particle missile trails — 22 October 2026

User direction: remove the GPU-heavy 3D-volume trial and restore thicker particle smoke. This is a selective rollback, retaining unrelated gameplay, audio activation and UI changes.

## Delivered

`/play/` and `/game/` route native powered-missile samples to `DamageEffects.missileTrail` again. Emission rises from 24 to 48 samples/second; the accepted two-second lifetime, radius, rise, colour and particle shader remain. Samples carry their exact age relative to the end of an advance, so long/variable frames do not give old puffs an extra lifetime. Flight physics, damage, launches, contact checks and flight RNG remain unchanged.

Trails own a fixed 768-entry ring in addition to the original 384 ordinary smoke entries. This holds eight continuously powered two-second histories at 48 Hz; native powered flights are often shorter. Under heavier pressure, the ring recycles in admission order, which is not necessarily global age order when different missiles report samples with different lags. Launch, impact and damaged-enemy smoke retain all 384 original entries. No effect objects/arrays are created per emission.

Removed production volume storage, shaders, preparation, expiry, launch identity, draws and extra mirrored-volume pass, together with volume-only preview executables and checks. Ordinary particle smoke still participates in the existing planar water reflection pass, using its existing separate ordering scratch. No added pass or image. Historical review material remains; the earlier CPU audit now obtains both historical volume implementations by Git revision so its evidence script does not depend on a deleted live module.

## Fixed resources and traffic

Compared with the volume-integrated engine:

| Resource | Removed volume | Added denser particle capacity | Net reduction |
|---|---:|---:|---:|
| GPU buffers/uniforms | 382,480 bytes | 73,728 bytes | 308,752 bytes |
| Typed CPU storage | 679,456 bytes | 90,624 bytes | 588,832 bytes |

The added particle GPU capacity is 36,864 bytes per main/mirrored buffer. Main CPU additions are 36,864-byte packed data, 1,536-byte order and 6,144-byte depth; mirrored CPU additions are 36,864-byte packed data, 3,072-byte order and 6,144-byte depth. The volume CPU total includes the later 600-byte packing cache. JS heap changes include 768 extra smoke records and removal of 144 volume history records; exact heap sizes were not measured.

Live packing/uploads cost 48 bytes per visible puff per main view, and 48 more when preparing a planar reflection. At full trail capacity this is 36,864 bytes per main upload plus 36,864 for the mirror, excluding ordinary smoke and other effects. Additional particle vertices, blending and transparency sorting remain real costs. This is removal of the volume workload, not a measured campaign FPS or GPU-utilisation result.

## Verification

- 72 tests pass across damage effects, missile effects, water impacts, renderer and planar reflection (26,255 assertions).
- 34 additional missile-flight tests pass (2,950 assertions), including native 30/60/120 Hz particle sample age/cadence, identical hit/impact outcomes without callbacks and identical next flight RNG draws.
- The unfiltered flight file has three existing failures: obsolete one-second-gap expectation and two held-magazine expectations. All three reproduce against unchanged `4c2d309` in a fresh `/tmp` Git archive, before these changes. No balance changes were made to satisfy them.
- Read-only deployment `gather()` succeeds with 116 JavaScript modules and zero volume modules; it writes no deployment output.
- `git diff --check` passes.

Isolated native A3 missile review at 1.2 simulation seconds renders 14 trail puffs plus eight launch puffs, with no drops/recycles. Main close view and day/night water overview compile/render with no reported GPU/console warnings or errors. Planar reflection is active in the overview. Captures: [attack](attack.png), [day/water](water.png), [night/water](night-water.png); DOM diagnostics accompany them. This frozen preview produces too few render submissions for a valid GPU timestamp sample; its stale/pending readout is not a timing measurement.

Parent follow-up: `bun test tests/play-audio.test.js tests/audio-deployment.test.js` passes **9 checks / 49 assertions**, including the real delegated click handlers and read-only production gather after removal. No additional output was generated.

## Bounded CPU preparation measurement

Run `bun project-docs/particle-missile-trails-2026-10-22/cpu-audit.js`. Raw alternating batches are in [cpu-audit.json](cpu-audit.json). The script invokes actual main and mirrored smoke preparation; GPU writes are stubbed. Frozen two-second synthetic histories use opposing main/mirror depth axes. It excludes simulation, actual GPU transfer/rendering, browser overhead and all unrelated frame work.

| Fixture | Active puffs | Main median | Main + mirror median |
|---|---:|---:|---:|
| One full trail | 96 | 0.0056 ms | 0.0127 ms |
| Eight full trails | 768 | 0.2153 ms | 0.5908 ms |
| Entire bank, adversarial ordering | 1,152 | 0.4616 ms | 1.3154 ms |

Bun 1.4.2, eight measured batches of 100 preparations after warmup. The last case deliberately forces reverse insertion in both views. Existing insertion sorts remain quadratic within fixed capacity: at most 663,552 shifts per sort at 1,152 particles. This records a saturation limit rather than claiming whole-frame improvement; replacing the general sorter was left outside this smoke rollback.

No deployment, push, local commit or active player-session reload was performed by this subagent. The root agent owns the final notes and commit.
