# Offline sound authoring

The user authorised machine-installed Opus tools and development audio tooling on 22 October 2026. This pipeline is isolated from the game: no playback integration, runtime encoder, asset route or deployment change. All sound files must be **mono, single channel**, as instructed by the user on 22 October. The recipe validator rejects stereo. The bundled recipes are **diagnostics, not approved game sounds**.

## Host tools

Install encoders using Homebrew, outside this repository:

```sh
brew install opus-tools
bun run audio:doctor
```

On this Mac they are `/opt/homebrew/bin/opusenc`, `opusdec` and `opusinfo`; `opus-tools` Homebrew package `0.2_2`, encoder/decoder `0.2` with libopus `1.6.1` at installation. Use PATH discovery rather than hardcoding that prefix on other machines. Do not vendor binaries, add a package dependency or ship a browser/WASM encoder. Homebrew manages dependencies; this installation also installed its OpenSSL 4 dependency and upgraded its CA certificates. Historical research inventories predate this installation.

Manual equivalents:

```sh
opusenc --bitrate 80 --vbr --comp 10 --framesize 20 input.wav output.ogg
opusinfo output.ogg
opusdec --quiet --float output.ogg decoded.wav
```

`opusinfo` uses **`-V`**, not `--version`. Ogg is the container and Opus is the codec. `.ogg` here contains actual encoded Ogg Opus bytes.

## Build and audition

```sh
bun run audio:build
bun run audio:build --recipes audio/diagnostics.json
bun run audio:preview
```

Open the printed loopback address (default `http://127.0.0.1:4292/`) in the built-in browser. Set `AUDIO_PORT` if occupied. The preview serves a fixed build snapshot, never writes recipes and never accesses saves/the player. Rebuild then restart the preview to select a newer snapshot. Playback always requires a control click; Stop all and hiding the page stop playback. Loop buttons use Web Audio decoded buffers with explicit loop times; ordinary audio controls are useful for one-shot comparisons. This authoring page can allocate during decoding and playback; it is not the proposed low-allocation game mixer.

Builds go to unique, ignored `build/audio/<timestamp>-<suffix>/` folders; `build/audio/latest.json` identifies the last successful one. Each contains:

- `recipes.json`: the exact input bundle.
- `masters/*.wav`: lossless 48 kHz, 24-bit PCM WAV.
- `delivery/*.ogg`: mono 80 kbit/s target VBR, complexity 10, 20 ms packets.
- `decoded/*.wav`: floating-point decoder comparisons.
- `manifest.json`: recipes, seeds, source/tool versions and hashes, flags, byte counts, peak/RMS/DC, frame counts, loop boundary/slope jumps and decoded error RMS.
- `review.html`: waveform and master/encoded/decoded auditions.

Use `--wav-only` for synthesis checks without host encoders. Failed builds clean their staging directory and leave the latest successful pointer alone. Builds preserve older snapshots; remove unneeded directories manually. Before adopting real sound assets, retain approved lossless masters as source assets or in agreed durable authoring storage; ignored diagnostic output is not the final asset archive. Nothing is copied to `assets/` or `docs/` automatically.

## Sound direction and richer synthesis

The user confirmed playback works but found the original diagnostic transient too 8-bit. Aim for detailed, fuller, natural/material-based sound design using layered generators, filtered noise, resonances, modulation and shaped transients. Synthesis is an authoring method, not a chiptune style requirement. All output remains mono. The user subsequently reviewed the layered transient and confirmed its quality is better; use it as the quality reference for subsequent sound design. This accepts the direction, not a final weapon assignment or the full sound palette.

The first card, **Layered transient study**, combines a broad filtered-noise attack, a swept resonant noise body, a restrained low impulse and a modulated filtered tail. The original transient remains a comparison and the periodic tone remains a loop test. Neither defines the final game sound palette.

Additional optional per-layer controls:

- `filters`: up to four cascaded `{type, cutoff, endCutoff?, q}` filters. Types are `lowpass`, `highpass` and constant-peak `bandpass`; cutoff 10–20,000 Hz and Q 0.1–10. Optional endCutoff sweeps logarithmically across the layer. Coefficients use the [W3C Audio EQ Cookbook](https://www.w3.org/TR/audio-eq-cookbook/).
- `decay`: exponential amplitude time constant in seconds, combined with attack/release.
- `pitchCurve`: `linear` (default) or `exponential` frequency glide.
- `pitchMod`: `{rateHz, depthCents}` sine pitch modulation for tonal generators.
- `amplitudeMod`: `{rateHz, depth}` sine amplitude modulation for any layer.

These modules render offline into the same cached-sample delivery format. Their oscillators/filter updates do not add game-frame or audio-thread work. Extreme modulation, resonant sweeps and triangle harmonics need listening/aliasing review; validation bounds parameters and rejects clipping, not every undesirable timbre. Imported recorded layers, richer modulation routing and loop crossfade editing are future additions when sound design calls for them.

## Recipe version 1

Use `diagnostics.json` as an example. A bundle has `version: 1` and 1–32 unique recipes. Each recipe declares id, name, purpose, seed, sampleRate, channels, duration, gain, fadeIn, fadeOut and 1–16 layers. Unknown fields are rejected to catch typos.

- Masters: 48,000 Hz, mono only (`channels: 1`), 0.02–30 seconds. Seeds are integers 1–4,294,967,295. IDs use lowercase letters/digits/hyphens and start with a letter.
- Layers: `sine`, `triangle` or seeded `noise`, with gain, start/duration, linear attack/release and pan fixed at 0. Tonal layers have frequency/endFrequency for a linear sweep. Optional cutoff applies a one-pole low-pass. This is a small offline synthesiser, not a full DAW; triangle waves are not band-limited, so high-pitched production use needs an aliasing review.
- All layers are mono and share one deterministic recipe-local noise stream. It never uses the game's/global random source.
- Layer and master gain are explicit. Clipping/non-finite data fail the build; no silent auto-normalisation or limiter changes a recipe. WAV export rounds to PCM24 without dither.
- Optional `loop: {startFrame, endFrame}` uses master sample frames with an exclusive end. Markers are inspected, not automatically crossfaded. A discontinuous authored loop needs editing; the encoder does not repair it. Playback converts markers to seconds so context resampling does not reuse incorrect original frame indices.

The complete sequence checks Ogg/Opus headers, runs `opusinfo`, decodes with `opusdec` and requires exact expected rate/channels/frame count. Fixed stream serials plus recorded tools/flags permit repeatable local encoding. Float synthesis and codec bytes are not promised identical across architectures/tool versions. Sample boundary/error statistics are diagnostic, not perceptual-quality scores; decoded peaks may exceed master peaks. Browser decoding, repeated listening at actual context rates and dense-battle performance remain separate acceptance work.

## Verification and next steps

```sh
bun test tests/audio-authoring.test.js
```

Ten focused checks cover seeded reproducibility, PCM24 and odd-byte padding, periodic boundaries, schema/work bounds/clipping, HTML escaping, actual host encoding/decoding and confined GET/HEAD-only loopback serving, independently measured filter pass/stop-band response, swept synthesis and invalid modulation controls. The external encoder integration skips if the host toolchain is absent; use `audio:doctor` to require it explicitly. Loopback permission is needed for the HTTP check.

Next: author a small weapon/UI sound palette for listening, add imported-layer editing/filters/crossfade only where useful, then implement and profile the bounded native runtime candidate from the [audio research](../project-docs/research/web-audio-implementation-2026-10-22/README.md). No final sound identity, game audio implementation, cross-browser loop quality or performance result is claimed by this tooling.
