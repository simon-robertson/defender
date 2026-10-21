# Audio authoring and playback feasibility

Research only · 20 October 2026 · no audio/editor implementation, generated sounds, package installation, game reload or player-run change.

**A small team-operated sound workbench plus native Web Audio should be sufficient for this game's effects.** Give the team editable synthesis/layer recipes, waveform inspection and auditioning, then render reusable samples. Retain lossless masters and use an established offline encoder for compressed delivery. A general-purpose DAW is optional for complex recordings/music; building our own codec or full DAW would add little value initially. This is an architectural recommendation, not a sound-quality or performance result.

**Ogg is a suitable delivery container, but does not automatically make an arbitrary sound loop perfectly.** The codec, authored boundary, decoder and playback method all matter. The strongest first direction is Ogg Opus with an explicit loop manifest, with Vorbis as an alternative worth comparing on actual material.

## Existing project evidence

- [package.json](../../../package.json) has no dependency declarations or audio commands. A targeted search of `engine/`, `game/`, `play/`, `shared/` and `tools/` found no `AudioContext`, `AudioBuffer`, `decodeAudioData` or `MediaRecorder` subsystem; no audio files were found under `assets/`.
- [Server](../../../server.js) exposes model/level JSON and restricts application static files to HTML/JS/CSS. Future audio needs a confined read-only asset route, correct MIME types and appropriate caching. Existing JSON save endpoints cannot save a sound library. No route is changed here.
- [PlayEngine](../../../play/engine.js) already exposes gun shots, Arc shots, bullet contacts, missile callbacks, deaths and escapes. [Application wiring](../../../play/app.js) attaches visual effects to actual events around lines 130–136; this is the natural future audio integration point. Triggering from visible particles would duplicate or lose events.
- [Frame clock](../../../engine/clock.js) uses delta seconds. The play loop stops for pause/hidden documents in `play/app.js`; future audio must follow those state changes explicitly. Audio should observe gameplay, never influence targeting or simulation timing.
- [Current constraints](../../../AGENTS.md) require native JavaScript/Bun, no third-party dependencies and no implemented sound yet. [Project brief](../../project-brief.md) already anticipates Web Audio and a possible sound generator. This request authorises research; external encoding tooling and implementation remain proposals.

## What Web Audio supplies

The standard provides scheduled buffer playback, oscillators, filtering, gain automation, mixing and spatial panning. Its buffer loop algorithm joins consecutive loop regions without a JavaScript callback between repetitions, including subsample loop positions. Use `AudioBufferSourceNode.loop`, `loopStart` and `loopEnd` for short exact loops. [Web Audio Recommendation: interfaces and looping](https://www.w3.org/TR/2021/REC-webaudio-20210617/#AudioBufferSourceNode).

Reuse decoded buffers and bounded voice records; create a fresh source node per playback because a source can start only once. Persistent gain/panning chains can be reused. Set priorities, per-family concurrency limits and a fade/steal policy before adding large numbers of simultaneous weapons. Exact capacities require a representative battle measurement. [Mozilla: source lifetime and shared buffers](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode).

Start/resume the context through an actual player gesture such as New game; handle rejected/suspended startup without blocking gameplay. Chrome explicitly applies autoplay policy to Web Audio. [Chrome autoplay policy](https://developer.chrome.com/blog/autoplay/#web-audio).

Recommended runtime design: one application context, separate effects/UI/ambience gains, decoded sample cache owned by the active sound set, and an audio event adapter. Map simulation event times to context time; do not schedule one loop iteration with `setTimeout` or replay a backlog of stale shots after a frame stall. Suspend combat audio on pause/visibility loss and rebase scheduling on resume; stop/disconnect scene voices and discard superseded loads on transfer/retry. Choose a stable battlefield listening point initially: the distant, moving Drone camera would otherwise cause large mix changes. Full camera-following 3D audio is a later listening comparison.

## Loop accuracy and compression

There are three separate issues:

1. **Correct decoded duration.** Vorbis granule positions support exact end trimming. Ogg Opus specifies pre-skip for encoder delay and end trimming of its final packet. These mechanisms support gapless decoded output when correctly implemented; Ogg alone is only the container. [Vorbis specification](https://www.xiph.org/vorbis/doc/Vorbis_I_spec.html), [RFC 7845 §§4.2–4.4](https://www.rfc-editor.org/rfc/rfc7845.html#section-4.2).
2. **No scheduler gap.** Native decoded-buffer looping avoids waiting for an `ended` event before starting the next iteration. This also works with a suitable WAV source; compression is not a prerequisite for seamless repetition. [Web Audio looping algorithm](https://www.w3.org/TR/2021/REC-webaudio-20210617/#looping-AudioBufferSourceNode).
3. **No audible seam.** End/start amplitude, phase, spectral texture and reverberation must agree. Xiph explicitly explains that even gapless Vorbis can click at a boundary because lossy compression perturbs samples. Author overlapping/crossfaded loop material or use a lossless/synthesised periodic loop where necessary. The browser is not promised to apply libvorbisfile's crosslap functions. [Xiph's boundary/crosslap explanation](https://www.xiph.org/vorbis/doc/vorbisfile/crosslap.html).

Store loop start and exclusive end as sample-frame indices plus the master sample rate in project JSON. Convert to seconds for playback and validate against the decoded duration. Do not depend on `LOOPSTART`/`LOOPLENGTH` comments being honoured automatically: Vorbis comments are extensible text fields and the Web Audio buffer API supplies no standard loop-tag importer. [Vorbis comments](https://xiph.org/vorbis/doc/v-comment.html), [Web Audio source attributes](https://www.w3.org/TR/2021/REC-webaudio-20210617/#AudioBufferSourceNode).

Test the **final encoded file after browser decoding**, at common 44.1/48 kHz context rates and actual playback pitch variations, with repeated listening plus frame-count/boundary inspection. `decodeAudioData` resamples to the context rate and consumes complete files, so decoded indices need not match the master. [Mozilla: decoding behaviour](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData). No decoder/loop experiment or listening test has been performed in this research pass.

Ogg reduces disk/download bytes; decoded `AudioBuffer` remains float PCM. Raw sample storage is approximately `seconds × sampleRate × channels × 4` bytes, excluding overhead. [Web Audio buffer representation](https://www.w3.org/TR/2021/REC-webaudio-20210617/#AudioBuffer). Illustrative arithmetic, not measurements:

| Material at 48 kHz | Float PCM in memory | PCM16 WAV payload | Compressed payload example |
| --- | ---: | ---: | ---: |
| 0.5 s mono effect | 96,000 B | 48,000 B | 4,000 B at 64 kbit/s |
| 30 s stereo ambience | 11,520,000 B | 5,760,000 B | 360,000 B at 96 kbit/s |

Container headers add bytes; variable-rate results and audible quality vary. For tiny effects headers matter proportionally more. Keep short loops modest, share buffers between voices and avoid retaining both compressed and decoded copies unnecessarily. Long music may favour streaming, with a separate continuity test before promising exact musical loops.

## Browser and export choices

Chromium lists Ogg, Vorbis and Opus playback support. Safari added Ogg Opus/Vorbis in Safari 18.4 **on macOS Sequoia 15.4 and corresponding newer Apple systems**; an older OS/browser combination must not be assumed compatible. Probe with a small real decode and provide a WAV fallback for essential short effects if supporting such systems. No cross-browser playback claim is verified here; project automation remains restricted to built-in Chrome. [Chromium formats](https://www.chromium.org/audio-video/#codec-and-container-support), [WebKit release notes](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/#media).

| Export path | Assessment |
| --- | --- |
| Custom recipe → PCM/WAV → offline encoder | Recommended. Inspectable masters and scripted batch export; keeps codecs out of the game. |
| `MediaRecorder` | Useful for an audition recording, not the preferred asset compiler. Supported codec/container combinations are implementation-dependent and must be probed. [Recording specification](https://www.w3.org/TR/mediastream-recording/#dom-mediarecorder-istypesupported). |
| WebCodecs `AudioEncoder` + custom Ogg muxer | Technically possible where Opus encoding is supported, but encoded chunks still require Ogg framing, headers, granules and trimming. Codec support is not mandated. More format work than warranted here. [WebCodecs](https://www.w3.org/TR/webcodecs/#audioencoder-interface), [Ogg Opus framing](https://www.rfc-editor.org/rfc/rfc7845.html). |
| Full external DAW/editor | Useful if recordings, sophisticated music or multitrack processing become important; not required to establish the initial game effects. |

For a proposed external encoder, **`opusenc`** is a focused WAV/FLAC-to-Ogg-Opus command-line option; **FFmpeg with `libopus` and `libvorbis`** covers both codecs and inspection through ffprobe. Select actual codec builds, record tool version/options and derive all delivery files from lossless masters. No tool is installed or approved by this report. [opusenc manual](https://opus-codec.org/docs/opus-tools/opusenc.html), [FFmpeg codec wrappers](https://ffmpeg.org/ffmpeg-codecs.html#libopus-1).

Read-only host inventory: `bun` and `/usr/bin/afconvert` are available; `ffmpeg`, `ffprobe`, `oggenc`, `opusenc` and `sox` were absent from this process's PATH. `afconvert -hf` lists Ogg/Vorbis/Opus formats, but that listing alone does not prove working encoding. A Core Audio capability query advertises an Ogg writable container but only PCM/A-law/μ-law encode format IDs in this process; compressed encoding remains unproven. See [probe and exact inventory](tool-availability.py), [captured result](tool-availability.json). No audio was converted. A verified encoder is still needed before choosing the final build path.

Keep any proposed encoder an offline development tool; do not bundle it or a WASM codec into the runtime by default. If distributing an encoder, inspect that particular build's license: FFmpeg licensing varies with configuration; Opus has a published permissive codec license. These are concrete build-selection considerations, not a requirement to add a runtime library. [FFmpeg licensing](https://ffmpeg.org/legal.html), [Opus license](https://www.opus-codec.org/license/).

## Proposed minimum team workbench and first review

Use a versioned JSON recipe/manifest and Bun batch commands as the primary team interface. A compact HTML audition/waveform view can follow; the user needs no authoring controls. Minimum editing operations: layered oscillator/seeded-noise/imported samples, gain and pitch envelopes, filters, trim/fade, loop markers/crossfade, peak/DC/boundary inspection, and master WAV plus metadata export. Browser `OfflineAudioContext` can render graphs without real-time playback; Bun PCM generation is an alternative for script-first recipes. Preserve recipes and seeds, but do not assume identical floating-point output across every browser implementation. [Mozilla: offline rendering](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext).

Proposed first content, subject to later approval: a small family of gun/Arc/missile launch and impact sounds, destruction, and a few UI cues; then one sustained mechanical loop to prove the loop pipeline. Audition variants in a dense battle before adding wildlife, per-footstep sounds, continuous ambience or music. A low-poly visual style does not require chiptune sound: synthesis is a flexible authoring method, and imported recorded layers should remain possible.

Before production integration, demonstrate: distinguishable weapon identities, an encoded loop without audible seams, acceptable decode/voice costs in a representative busy wave, pause/hidden/resume and unload correctness, mute/volume behaviour, and graceful decode/startup failure. These are proposed acceptance checks, not completed tests or numerical budgets. A full soundtrack/editor is unnecessary to answer those initial questions.
