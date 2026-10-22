# Gesture activation and delivery ownership — 22 October 2026

User authorises starting the sound player from New Game/Continue after checking browser policy, and asks that deployment include every game audio asset. Implemented a lazy context foundation and manifest-owned delivery. No audible game cues, full sample mixer, production audio bank or deployment refresh is part of this change.

## Browser evidence

The concern is correct, with browser-policy differences. Web Audio 1.0 permits initial context startup to depend on user activation. Chrome documents creating the context in a click or calling `resume()` after a gesture. WebKit's current implementation checks transient activation (with exceptions for capture and a compatibility quirk) while removing its user-gesture audio restriction. Its resume promise may stay pending when startup is disallowed. This is current engine source, not a claim that every shipped Safari release behaves identically.

Primary sources checked on 22 October:

- [Web Audio Recommendation: allowed to start](https://www.w3.org/TR/webaudio-1.0/#allowed-to-start).
- [Chrome autoplay guidance: Web Audio](https://developer.chrome.com/blog/autoplay/#web_audio).
- [WebKit AudioContext.cpp: activation check, resume and playback restrictions](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/Modules/webaudio/AudioContext.cpp).
- [WebKit's explanation of direct gesture handlers](https://webkit.org/blog/6784/new-video-policies-for-ios/). This article discusses media elements; the AudioContext source above is the specific Web Audio evidence.

Safe project rule: construct/reuse the single player `AudioContext` and invoke `resume()` **synchronously within the genuine click handler, before any loading/decode await, timer or promise continuation**. An `async` handler still runs synchronously until its first await. A promise may complete later; the initiation is what belongs inside the gesture. Do not assume a prior unrelated click or a synthetic dispatched click grants playback permission. Native button activation also handles keyboard-generated clicks.

This is initialisation/resumption of the shared context, not a requirement to click for every subsequent sound. Never await successful audio activation before allowing level loading/gameplay: policy/device failure or a pending browser promise must not freeze the game. If still suspended/interrupted, a later start gesture retries the existing context. No silent-source/autoplay bypass or extra context per cue is added.

## Implementation

`play/audio.js` owns one lazy `AudioPlayer`. Constructing its plain JavaScript wrapper on page load opens no audio device. Valid New Game/Continue actions call `startFromGesture()` directly, ahead of the existing level rebuild; defeat retry follows the same path. A running context is reused. Unsupported APIs, constructor errors and rejected resume promises stay inside the audio owner, and a later gesture can retry even if an earlier resume promise remains pending. Page teardown closes/releases the context once. No per-frame audio processing, voices, sound fetch/decode, oscillators or test sound is added.

The existing development dataset exposes the context state/error for checks and is still stripped from packaged copies. Pause/visibility/scene voice policies and a real sample bank remain part of future runtime integration; this context-only foundation emits nothing while those are absent. Do not introduce another context for the later mixer.

## Delivery

`shared/audio-assets.js` is the explicit runtime manifest. Entries are `{id, file, fallback?}` under `assets/audio/`; delivery files are mono `.ogg` (Opus) or `.wav`, with optional mono WAV fallback. It starts empty because no study has been assigned as a final game cue. `audioAssetURL()` resolves from its module with `../assets/audio/`, retaining the repository prefix in both development and packaged modules.

The existing packager gathers every listed primary/fallback into `docs/site/assets/audio/`, tracks its bytes/hash/source ownership in the deployment manifest and counts audio files. It rejects missing files, duplicate/unsafe entries and wrong container/channel headers before clearing output. Header sanity checks do not replace the authoring pipeline's full encoder inspection/decode. Unlisted files, masters, diagnostic studies and tools are not copied. New sound additions must use this manifest; do not add unaccounted fetches or hardcoded root URLs.

Development serves only manifest-listed files on `/assets/audio/`, with GET/HEAD, explicit MIME and symlink confinement. The deployment fixture also explicitly uses `audio/ogg` / `audio/wav`, and its validator accepts/checks those MIME types at root/repository-prefix paths. No online hosting changes or publication occur here.

## Verification

- `bun test tests/play-audio.test.js tests/audio-deployment.test.js tests/static-deployment.test.js`: 14 pass, 60 assertions.
- `bun test tests/server.test.js`: 11 pass, 93 assertions.
- Actual captured app handler tests prove synchronous construction/resume before rebuild for New Game, Continue and retry; invalid Continue/busy controls/title return open no device. Covers reuse, failed devices, pending/rejected resume and disposal.
- Fixture audio collection checks exact declared bytes, missing/stereo rejection, portable prefix resolution and read-only route/MIME/path confinement. Production `gather()` includes the new audio modules and zero delivery sounds, without writing `docs/`.
- Isolated built-in Chrome at loopback4293: real title shows `uninitialised`; New Game click reaches `loadout` with audio `running`, no audio error or captured warnings/errors. No wave started, purchases/save writes or preferences changed; test tab closed. Continue's saved-game path is automated handler coverage, not a native saved-session browser test.

Safari was researched, not launched or tested (project browser automation is built-in Chrome only). No cross-browser audibility, pause lifecycle, real sound loading or audio-performance claim is made. User's player and audition session remain untouched. No deployment or remote push.
