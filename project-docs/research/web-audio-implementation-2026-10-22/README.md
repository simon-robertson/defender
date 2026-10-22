# Web Audio implementation and Ogg production for Defender

**Implementation follow-up, 22 October:** user subsequently authorised Homebrew `opus-tools` installation and starting authoring tooling. Installed encoder/decoder use libopus1.6.1; the initial Bun recipe/WAV/Ogg/inspection/audition pipeline is documented in [the audio tool guide](../../../audio/README.md). Seven focused checks include real encoding/decoding. The inventory and proposals below remain the original research record, not a current tool-availability claim. Game audio integration is still absent.

Research · 22 October 2026 · source review, primary documentation and read-only tool/arithmetic audit. No audio implementation, sounds, installations, encoder run, browser playback, deployment or performance benchmark.

## Recommendation

**Start with cached, pre-rendered samples and a bounded native Web Audio voice manager.** Pool the voice records, gain/pan chains and event storage; create only the short-lived source node required for an admitted sound. This is the best-supported first design for Defender's present static deployment, not a measured proof of the fastest implementation.

**Do not claim that Web Audio source nodes are reusable or that this design produces zero garbage.** `AudioBufferSourceNode` is one-use, while its decoded `AudioBuffer` can be shared. Mozilla describes source creation as inexpensive, but that is not a game-specific GC guarantee. Unbounded fire-and-forget playback would violate this game's policy even though it is valid API usage. [Mozilla source lifetime](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode).

If the GC rule is interpreted as **no application-created per-shot audio objects**, the native candidate does not satisfy it; the stronger candidate is one persistent `AudioWorklet` sample mixer with fixed voice arrays and a shared event ring. It needs a real comparison against native playback and a hosting capability decision. It is not automatically cheaper: our code then owns resampling/pitch, mixing, envelopes, looping and real-time correctness. The existing no-third-party-runtime rule remains appropriate.

| Candidate | Allocation behaviour | Decision for this game |
| --- | --- | --- |
| Native sources + cached samples + fixed voice chains | One new source per admitted one-shot; fixed application bookkeeping | First implementation/profiling baseline; simplest fit to current delivery |
| Persistent worklet + batched MessagePort commands | Removes per-shot source nodes; messages/cloning/transferred wrappers can still allocate | Possible intermediate trial; cannot advertise allocation-free playback |
| Persistent worklet + SharedArrayBuffer event ring | Application command and mix hot paths can avoid per-shot allocations after initialization | Strongest strict-allocation candidate, conditional on cross-origin isolation and measured DSP cost |

`MessagePort` can clone data or transfer ownership; neither is a blanket promise of no receiver-side objects. Cross-origin isolation enables shared buffers and requires appropriate response headers/permissions. The checked development/static-server sources do not establish that isolation; do not silently require it from the deployed game or introduce a service-worker workaround. A worklet itself does not require SharedArrayBuffer; the shared-memory command transport does. [MessagePort](https://developer.mozilla.org/en-US/docs/Web/API/MessagePort/postMessage), [isolation requirements](https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated).

## What the current game actually needs

The [read-only audit](audit.json), reproducible with `bun project-docs/research/web-audio-implementation-2026-10-22/audit.js`, fingerprints the inspected sources and computes these **economic upper bounds**, ignoring placement, range, enemy availability, targeting delays and burst cancellation:

- 64 waves and a maximum 128-token wallet before the final wave; ownership capacity is 128 units.
- Spending that entire budget on 64 Upgrade I guns yields about **155 shots/s** under uninterrupted ideal firing: `64 × 3 / (1 + 2 × 0.12)`. This is not an observed campaign rate.
- The physical missile pool has 36 actors. There is no reason to create an audio graph for every possible owned weapon or attach sound to every trail sample.

[Application hooks](../../../play/app.js) already distinguish gun shots, bullet contacts, Arc/secondary hits, missile launch/impact and deaths/escapes. Use those actual events. Paired muzzle flashes represent one gun event; lightning segments and missile volume samples are visual detail, not extra sounds. Do not pre-render a complete multi-shot burst that would continue audibly after the combat controller cancels its remaining shots. A future sustained missile-engine loop would also need actual burn/cutoff/release ownership; `onLaunch` alone cannot identify its whole lifetime.

Audio must remain an observer. It may drop or merge masked cues but must never alter targeting, hits, cadence, critter scheduling or gameplay RNG. Use a separate cosmetic random stream for sample variations. Do not add routine enemy footsteps, every critter or every spark before the core battle mix has been auditioned.

## Allocation-conscious native design

The following are **proposed starting budgets**, to tune through listening and profiling rather than treating them as established capacity requirements:

1. One application `AudioContext`, three persistent SFX/UI/ambience buses and a master gain. Initialize/resume directly from an accepted player gesture; `latencyHint:'interactive'` is a request, not a latency guarantee. Handle suspended/failed startup without blocking gameplay. Keep the device's usable context rate rather than forcing 48 kHz solely because masters use it. [AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext), [Chrome autoplay policy](https://developer.chrome.com/blog/autoplay/#web-audio).
2. **32 fixed voice slots**: initially reserve 4 for UI, 8 for important impacts/escapes/destruction, 16 for routine weapon cues and 4 for sustained loops. A priority policy may lend idle capacity while preserving reserved access. A gain and stereo panner per slot plus those buses is 68 persistent processing nodes, excluding the destination and temporary sources. This bounds our graph/records, not every retired object a browser might retain before GC.
3. A **256-entry typed event ring**, e.g. eight Float64 scalars per entry (16 KiB). Use numeric cue IDs and scalar position/time/priority data. No new event object, closure, spread-built array, `filter`/`map`, promise, JSON, DOM operation or log per sound. Preallocate fixed coalescing/rate-limit storage; bound scanning and overflow behaviour too. Do not build a fresh graph, oscillator/noise buffer or filter stack for each hit.
4. A proposed rolling-second admission ceiling of **64 one-shots**, with at most 48 routine weapon cues and 16 reserved for important/UI cues. Reject or merge before source creation; cap voices and creation rate separately. A short clip can otherwise cause high object churn despite a low simultaneous-voice count. Same-family, nearby, near-simultaneous events are candidates for one louder bounded cue, not linear unbounded gain addition. Report dropped/merged counters without hot-path logging.
5. Each admitted event references an immutable, already-decoded sample. Create one source, connect it to the selected persistent chain, start it and retain it only through its fixed slot. Reuse each slot's completion handler and verify source identity before freeing it; an old `ended` event must not release a replacement voice. Count stopping voices against the physical pool; do not turn voice stealing into unlimited fading tails. A fixed pending replacement may wait for a short fade/release instead of allocating another voice.
6. Prefer **mono effects with StereoPannerNode** and simple distance gain. Bake complicated layered weapon design into samples offline. Avoid per-voice HRTF, convolution or live synth graphs initially. The native stereo panner supplies equal-power stereo placement; the choice to use it here is an architectural recommendation, not a measured speedup over HRTF. [StereoPannerNode](https://developer.mozilla.org/en-US/docs/Web/API/StereoPannerNode).
7. Keep short one-shots' spatial parameters fixed at admission. Update only genuinely moving sustained sources, provisionally 20 Hz, with short ramps and change thresholds. Do not append AudioParam automation every animation frame or retain expired scheduling records indefinitely. Cache listener/battlefield transforms. Start with a stable battlefield listening reference and gently changing screen-relative pan, then audition actual Drone-following spatial audio; its rapid movement should not make the whole mix surge or swing unexpectedly.

The sample bank should be prepared during loading, never decoded on the first shot. Retain a small common weapon/UI bank across levels; scene-owned ambience can be replaced and released with an explicit peak transition budget. Treat `getChannelData` as load-time work, not something to call on every trigger. Sharing native AudioBuffers does not require copying sample arrays per voice; the specification defines how nodes acquire immutable audio contents. [Web Audio 1.0 Recommendation](https://www.w3.org/TR/webaudio-1.0/#acquire-the-content), [channel access](https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer/getChannelData).

A decoded bank needs approximately `seconds × contextSampleRate × channels × 4` bytes, plus engine overhead. Our arithmetic gives 96,000 bytes for 0.5 s mono at 48 kHz; twenty such variations plus two 10 s stereo loops total 9.6 MB. Compressed Ogg bytes do not replace this PCM storage. Bound both the persistent bank and peak fetch/decode/copy memory; a provisional 16 MiB decoded-bank target would cover that example. Long future music should get a separate streaming decision. Decoding resamples to the context rate. [Audio decoding](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData).

## Timing, pause and scene ownership

Use a simulation-time event ring and one audio flush after the frame's fixed steps. Existing `PlayEngine.advance` can process a backlog; do not play every historical shot at once. Provisional policy: discard or merge cues older than 80 ms, retain the timestamps of recent cues, and schedule only a short horizon on `AudioContext.currentTime`. Rebase the simulation/audio mapping on resume or a discontinuity. These thresholds need listening tests. JavaScript timers/rAF drive control updates, not exact sample timing; scheduled audio uses its own clock. [Two-clock scheduling guidance](https://web.dev/articles/audio-scheduling).

Respect `session.paused`, the leave-area confirmation, screenshot mode, defeat, hidden tabs and scene disposal—not merely whether rAF happens to be running. Screenshot mode deliberately renders while simulation is paused. Continue valid settling missile impacts until their actual end.

Recommended pause policy: fade/cancel combat one-shots and freeze owned loop phase in reusable records; allow UI cues through the same running context when desired. Recreate a loop source on resume at its saved phase, which is an infrequent lifecycle allocation. Suspend the whole context when hidden; its suspension would also silence UI, so do not promise audible menus while globally suspended. Apply an epoch to pending loads/events and clear obsolete scene sounds. On teardown stop/disconnect sources, release scene buffers and close the owned context. Resume rejection or a missing sound must leave the game playable.

## When the worklet becomes worthwhile

A custom mixer is the escalation route if native source churn causes measured GC/frame problems, or the player chooses stricter hot-path allocation guarantees. Preload one PCM bank and fixed voice/cursor/envelope arrays. On initialization, copy/transfer owned PCM once; do not transfer an AudioBuffer's internal channel storage blindly or retain two full banks accidentally.

For a SharedArrayBuffer backend, use a single-producer/single-consumer ring: write numeric payload first, publish its index with Atomics, consume only committed entries, and never overwrite unread commands. Do not block the audio render thread. An independent epoch/stop control must still stop old voices if the event queue is full. Capacity/overflow and ownership of indices must be explicit; initialization and rare lifecycle messages may allocate. This is a proposed design, not implemented concurrency code.

`process()` should allocate no application arrays, objects, functions, views or promises; avoid logging, exceptions-as-control-flow, I/O and unbounded loops. Inspect the supplied output length rather than assuming 128 forever. A common 128-frame quantum is about 2.67 ms at 48 kHz, and all audio processing shares that deadline. Browser-managed objects/JIT/GC remain outside an absolute no-GC guarantee. WASM may help an already-proven DSP need, but does not justify adding a codec or toolchain by default. [AudioWorklet processing contract](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process), [Chrome worklet design patterns](https://developer.chrome.com/blog/audio-worklet-design-pattern/), [worklet architecture](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_AudioWorklet).

A non-isolated MessagePort backend can batch commands instead of posting per event, but cloning/transfer callbacks can still pressure the worklet heap. Do not describe that fallback as allocation-free. A shared ring is not required merely to play Ogg files; both architectures can use browser-decoded PCM.

## Producing sound data and making Ogg files

Proposed authoring path:

`versioned seeded recipes / licensed recorded layers → offline PCM synthesis/mix → lossless WAV masters + manifest → offline encoder → Ogg Opus delivery → browser decode/cache`

I can produce actual PCM/WAV data with built-in Bun code for oscillator/noise/filter/envelope recipes; more elaborate Web Audio graphs can be rendered with OfflineAudioContext. Neither method automatically produces Ogg. Authoring allocations happen offline, outside gameplay; it is unnecessary to force the authoring tool into the runtime's hot-path constraints. Retain recipes/seeds and clean lossless masters, with sample rate, channels, hashes, loop boundaries, gain/pitch ranges and category metadata. Use 48 kHz, 24-bit PCM WAV masters as a sensible initial production format; mono for positioned effects, stereo when ambience needs it. These are proposed settings awaiting sounds/listening. [OfflineAudioContext](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext).

**Ogg is the container; choose Opus as the codec.** The focused encoder is `opusenc`, which accepts WAV/FLAC and produces Ogg Opus. The usual `.opus` extension also contains Ogg; an explicitly encoded `.ogg` file is suitable when that extension is desired. Renaming a WAV to `.ogg` is not conversion. Suggested starting auditions are 64–96 kbit/s mono effects and 96–128 kbit/s stereo ambience, not promised quality thresholds. [Official opusenc manual](https://opus-codec.org/docs/opus-tools/opusenc.html).

Example future commands; **not executed**:

```sh
opusenc --bitrate 80 --vbr --comp 10 --framesize 20 \
  masters/arc-hit.wav assets/audio/arc-hit.ogg
opusinfo assets/audio/arc-hit.ogg
opusdec --float assets/audio/arc-hit.ogg review/arc-hit-decoded.wav
```

`opusinfo` checks container/stream defects and reports duration/channel information. `opusdec` supplies an offline decoded comparison; browser decoding is still the final runtime check. Start with normal file encoding rather than tuning streaming-delay options. Smaller codec packets are not automatically lower game-event latency once the whole sample is already decoded. [opusinfo](https://www.opus-codec.org/docs/opus-tools/opusinfo.html), [opusdec](https://www.opus-codec.org/docs/opus-tools/opusdec.html).

Alternative, if an FFmpeg build includes `libopus`:

```sh
ffmpeg -i masters/arc-hit.wav -ac 1 -ar 48000 \
  -c:a libopus -b:a 80k -vbr on -compression_level 10 \
  -application audio -frame_duration 20 -f ogg assets/audio/arc-hit.ogg
```

This example is for a mono effect; do not downmix stereo ambience indiscriminately. Check the actual encoder build/options and record its version. FFmpeg's libopus wrapper implements the relevant application/frame/VBR options. [FFmpeg codec implementation](https://www.ffmpeg.org/doxygen/trunk/libopusenc_8c_source.html).

The refreshed host inventory finds Bun, Homebrew and `afconvert`, but **no `opusenc`, `opusinfo`, `opusdec`, `ffmpeg` or `ffprobe` on this process's PATH**. That is a PATH result, not a search of every disk location. `opus-tools` provides the three focused utilities; the published Homebrew command is `brew install opus-tools`. Installing it or an FFmpeg build would need approval under this repository's dependency restriction. Nothing was installed. No encoder or WASM codec belongs in the shipped game. [Official Homebrew formula](https://formulae.brew.sh/formula/opus-tools).

For loops, author a matching boundary/crossfade and explicit start/end metadata, then check the **encoded file after decoding at actual context rates**. Ogg Opus pre-skip/end trimming handle codec delay but do not repair a discontinuous sound. Convert manifest master-frame markers to playback time; do not assume original integer indices survive browser resampling or that Web Audio imports loop comments automatically. Compare several repetitions at 44.1/48 kHz and intended pitch changes; retain WAV for any small exact loop whose lossy seam remains audible. [Ogg Opus framing/trimming, RFC 7845](https://www.rfc-editor.org/rfc/rfc7845.html#section-4.2), [Web Audio loop controls](https://www.w3.org/TR/webaudio-1.0/#AudioBufferSourceNode).

Do not use MediaRecorder as the deterministic asset compiler or add a custom WebCodecs/Ogg muxer merely to avoid an offline development encoder. Recording format support varies; runtime decode should be probed with real bytes. Safari's Ogg Opus/Vorbis support arrived with specific 18.4/newer OS combinations, so a generic Safari version assumption is insufficient. Provide a short essential-effect WAV fallback if the eventual supported browser/OS matrix requires it. [Recording capability query](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static), [WebKit release detail](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/#media).

## Project work required before integration

- Add an owned audio asset manifest, bounded async loader/cache, numeric event adapter and lifecycle/volume preferences. Keep optional decode/startup failure out of the simulation's success path.
- Add a confined read-only development audio route with correct `audio/ogg`/`audio/wav` MIME types. Existing server static allowlists do not serve those audio assets.
- Extend the existing deployment manifest/packager: new resource fetches outside `play/engine.js` are currently rejected; audio bytes/manifest and a possible worklet module need explicit ownership and relative URLs. Test under the repository prefix. Keep masters/recipes/review files out of `docs/`; ship delivery files only.
- For a shared-memory worklet, establish real cross-origin isolation on the intended host and validate response/CSP behaviour. No hosting changes are part of this research.

Before choosing a measured optimum, compare identical native battle event traces with audio disabled, the capped native backend and any worklet candidate. Record allocation/GC traces, p50/p95/p99 frame and main-thread costs, audio-render deadlines/glitches, active/retiring voice counts, admission/drop rates, decoded/peak memory and retained memory after repeated level switches. The current CPU-app/GPU HUD does **not** measure total audio-thread cost. Chrome exposes audio metrics and allocation instrumentation, but profiling overhead must be accounted for. [Chrome WebAudio metrics](https://developer.chrome.com/docs/devtools/webaudio/), [allocation profiling](https://developer.chrome.com/docs/devtools/memory-problems/allocation-profiler/).

Acceptance also needs listening: clear weapon identities without a wall of noise; lossless-versus-encoded transients and loop seams; mute/unmute, pause/leave/screenshot/hidden/resume; old-load rejection and unload; voice exhaustion and no delayed shot storms. No such implementation, listening test or performance result is claimed here. All external references were checked on 22 October 2026. This deepens the [20 October workflow notes](../audio-workflow-2026-10-20/README.md); the original research remains historical.
