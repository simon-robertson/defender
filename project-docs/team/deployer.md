# Deployer

**Audio ownership, 22 October:** include every primary/fallback declared by `shared/audio-assets.js` under `docs/site/assets/audio/`. Packager tracks hashes/ownership, checks filenames and mono Ogg Opus/WAV headers, and fails before output deletion for missing/invalid files. Runtime URLs must retain the repository prefix. Serve Ogg as `audio/ogg` and WAV as `audio/wav`; keep authoring masters, diagnostics and external tools out. Manifest is currently empty; no production sound cues are approved/assigned. This process update does not request a deployment. [Activation and delivery evidence](../research/web-audio-implementation-2026-10-22/activation.md).

Established 21 October 2026. **Current policy: keep deployments simple.** The user explicitly requested this simplification after the first deployment took too long. This policy supersedes the former deployment testing and evidence checklist.

## What “deploy the game” means

**Repository policy (21 October): local commits are allowed; pushing changes to any remote repository is NOT allowed.** Do not push or publish through Git or an equivalent tool/API. This supersedes earlier statements that local commits require a separate request.

Prepare the current game in the repository-root `docs/` directory so it can be served as a static GitHub Pages site. This authorises local packaging only. Under the standing user instruction of 22 October, commit any task changes after completion, including generated deployment output; do not create empty commits. Pushing, hosting configuration and online publication are not authorised.

## Default procedure

1. Run `bun run deploy:local` to create or refresh the existing package. Reuse this packaging command; do not rebuild the deployment workflow on each request.
2. Keep `docs/index.html` as the playable entry and `docs/site/` as its runtime directory. Include the required modules and assets, use relative URLs and static JSON loading, and strip development/debug code from delivery copies.
3. Once packaging succeeds, commit any task changes locally under the standing user instruction, then report the entry path. A short confirmation is enough.

`docs/` is exclusively generated hosting output. The packager clears it before writing a fresh deployment. Only runtime HTML, CSS, JavaScript and required assets belong there. Keep all project notes, Markdown/text documents, review evidence and debug files in `project-docs/`, and packaging manifests/logs in `build/deployment/`. Do not copy them into `docs/`.

**Keep the bottom-bar FPS, frame interval, CPU and GPU data in every deployment**, as explicitly requested by the user. Preserve its HTML/CSS, `FramePerformance`, CPU sampling and asynchronous GPU timestamp support, including pending/unsupported/paused states. This readout is approved player UI and is exempt from debug stripping. Continue removing inspector datasets, inspect query switches, developer controls and unrelated diagnostics.

The hosted game must work with `docs/` as the document root, including a repository URL prefix. It must not require the development server or `/api/` endpoints. Preserve gameplay, graphics options, ordinary controls and player-facing error handling.

## Proportionate testing

**User clarification, 22 October 2026:** the earlier “do not test” instruction applied only to its specific task. It is not a general restriction and does not carry into later tasks.

Run tests and validation appropriate to the change unless the current task explicitly asks to skip them. Use targeted automated tests for logic changes and browser/GPU checks when they resolve relevant visual or rendering concerns. A packaging-only request should remain focused; a full campaign replay or exhaustive review is not automatically necessary.

The packager's built-in safeguards may run normally. Preserve the user's active game session and use a separate session for browser checks when needed. Keep development evidence outside `docs/` and avoid unnecessary reports or validation tooling.

## Preserve existing work

Project documentation and historical evidence live in `project-docs/`; preserve them there. `docs/` is disposable deployment output and is cleared on each deployment, as explicitly requested by the user. Do not use it for development notes, debug output or reports. Do not follow output symlinks outside the generated directory.

Apply deployment adaptations to delivery copies through the existing packager. Preserve development sources and canonical assets. Do not install dependencies, regenerate artwork, change gameplay or interrupt an active player session as part of deployment.

## Current package

- Entry: `docs/index.html`.
- Runtime files: `docs/site/`.
- Existing ownership record: `build/deployment/manifest.json`.
- Packaging command: `bun run deploy:local` (`scripts/deployment/build.js`).

The first local package was prepared on 21 October 2026. It has not been committed, pushed or published by this deployment task. Historical results do not mandate repeating every check on future deployments; follow the proportionate testing policy above.
