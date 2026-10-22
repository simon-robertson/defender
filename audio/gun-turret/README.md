# Gun-turret sound review — 22 October 2026

**Selected: A · Dry autocannon.** The user listened in the audio preview and accepts this direction for now. Keep its three takes together for natural variation. B/C remain comparison candidates. No firing sounds have been added to gameplay; the runtime audio manifest remains empty until the integration task.

## The three directions

| Direction | Authored character | Duration per pulse |
| --- | --- | --- |
| A · Dry autocannon | Dry noise crack, firm mid/low body, short metallic breech/return | 0.38 s |
| B · Heavy punch | Deeper pressure impulse, broader filtered muzzle body, darker mechanism | 0.52 s |
| C · Industrial snap | Sharper attack, textured midrange, brief metallic resonances | 0.36 s |

Each has three independently seeded takes with small pitch/filter/timing differences. One clip represents the simultaneous paired barrels and one real damage pulse, not a prerecorded multi-shot burst. No projectile whistle, hit, enemy-death, large room reverb or Arc/missile sound is baked into these cues. Layered noise, short resonances and shaped pressure impulses follow the accepted richer sound-design direction.

All masters are mono, 48 kHz, PCM24. The factory sets explicit master gains to approximately 0.052 RMS over the first 140 ms, with a 0.76 peak cap. This helps comparison without promising equal perceived loudness. Current master peaks are 0.306–0.688; all decoded Opus peaks remain below 1. First/last master samples are zero. Preview volume defaults to 55%; no automatic gain control or runtime synthesis is used.

## Rebuild and listen

```sh
bun run audio:turret
bun run audio:preview
```

The factory [scripts/audio/gun-turret.js](../../scripts/audio/gun-turret.js) is authoritative. It regenerates this folder's `recipes.json`, `masters/*.wav` and `audit.json`, and builds an ignored audition snapshot under `build/audio/`. Changing a preset then rebuilding overwrites those owned source assets. The committed lossless masters preserve exactly what was reviewed. Derived Ogg and float-decoded comparisons remain in the snapshot; no external encoder is stored here.

The preview at `http://127.0.0.1:4292/` presents three grouped cards. Single shot cycles takes; base cadence plays three rounds one second apart. Upgrade I/II audition three/five pulses at 0.12 s spacing, read from current `PLAY_CONFIG`, including overlapping tails. These are isolated finite schedules, not game burst logic or a promise that a live burst can never cancel. The preview reuses decoded buffers, schedules with the Web Audio clock, stops old auditions when switching and cancels scheduled pulses on Stop/hide. It is development tooling, not the final allocation-conscious mixer.

Expand a card for individual master WAV / encoded Ogg / decoded WAV comparisons. The global volume applies to both native file controls and Web Audio auditions. No autoplay occurs.

## Position and distance requirement

The user explicitly requires sounds to match their source positions on-screen and attenuate with distance from the camera. This supersedes the research's initial proposal for a stable battlefield listening point. Keep source files mono and apply spatialisation during playback, using the actual camera pose and world-space emitter position. Start with pooled stereo panners and scalar distance attenuation; avoid assuming HRTF is needed to satisfy left/right placement. Measure the real mix in dense battles before making cost or quality claims. Panning/attenuation tuning, moving-camera updates and voice/admission limits remain runtime integration work; this comparison plays centrally so timbre can be judged.

## Verification

`bun test tests/audio-authoring.test.js tests/gun-audio.test.js`: **15 pass, 221 assertions**. Checks cover preserved master hashes/mono/frame count, finite/clipping/DC/endpoints, matched short-window energy, differing takes, exact current firing schedules, metadata bounds, real encoder round trips and audition scheduling/cache/stop behaviour. Initial formatting assertions and an asynchronous test-fixture identifier were corrected; final checks pass.

The actual nine-file build runs `opusinfo` and float decoding and checks exact mono rate/frame count. `audit.json` records lossless/delivery/decoded hashes, peaks, RMS/DC, tool versions and core source hashes. Built-in Chrome successfully decoded all three takes of each direction at 48 kHz; A/B singles and C's five-shot audition showed the expected status with no captured warnings/errors. User listening, rather than these numerical checks, selected A.

No game combat/audio hook, asset-manifest entry, gameplay timing, deployment or remote push is changed by this review. Dense-battle sound performance and final spatial mix are not measured here.
