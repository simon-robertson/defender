# Deployer

Established 21 October 2026. **Current policy: keep deployments simple.** The user explicitly requested this simplification after the first deployment took too long. This policy supersedes the former deployment testing and evidence checklist.

## What “deploy the game” means

Prepare the current game in the repository-root `docs/` directory so it can be served as a static GitHub Pages site. This authorises local packaging only. A commit, push, hosting configuration or online publication needs a separate request.

## Default procedure

1. Run `bun run deploy:local` to create or refresh the existing package. Reuse this packaging command; do not rebuild the deployment workflow on each request.
2. Keep `docs/index.html` as the playable entry and `docs/site/` as its runtime directory. Include the required modules and assets, use relative URLs and static JSON loading, and strip development/debug code from delivery copies.
3. Report the entry path and finish once packaging succeeds. A short confirmation is enough.

`docs/` is exclusively generated hosting output. The packager clears it before writing a fresh deployment. Only runtime HTML, CSS, JavaScript and required assets belong there. Keep all project notes, Markdown/text documents, review evidence and debug files in `project-docs/`, and packaging manifests/logs in `build/deployment/`. Do not copy them into `docs/`.

The hosted game must work with `docs/` as the document root, including a repository URL prefix. It must not require the development server or `/api/` endpoints. Preserve gameplay, graphics options, ordinary controls and player-facing error handling.

## No testing by default

A deployment request does **not** request tests, browser verification or a gameplay review. Unless the user explicitly asks:

- Do not run test suites, `check:deployment`, standalone validators, campaign replays or GPU checks.
- Do not launch a preview server, open a browser, play waves, capture screenshots or exercise graphics options.
- Do not create new tests, validation tools, reports or evidence checklists, or delegate deployment reviews.

The existing packager's built-in file/path safeguards may run normally. They do not imply a separate validation task. Do not delay completion for missing test or browser evidence. If packaging fails, fix the concrete packaging problem within scope; explain any unresolved failure briefly.

`bun run preview:deployment` and `bun run check:deployment` remain optional tools for an explicit preview or validation request, respectively. Neither is part of the default deployment command.

## Preserve existing work

Project documentation and historical evidence live in `project-docs/`; preserve them there. `docs/` is disposable deployment output and is cleared on each deployment, as explicitly requested by the user. Do not use it for development notes, debug output or reports. Do not follow output symlinks outside the generated directory.

Apply deployment adaptations to delivery copies through the existing packager. Preserve development sources and canonical assets. Do not install dependencies, regenerate artwork, change gameplay or interrupt an active player session as part of deployment.

## Current package

- Entry: `docs/index.html`.
- Runtime files: `docs/site/`.
- Existing ownership record: `build/deployment/manifest.json`.
- Packaging command: `bun run deploy:local` (`scripts/deployment/build.js`).

The first local package was prepared on 21 October 2026. It has not been committed, pushed or published by this deployment task. Previous testing requirements are retired; historical results do not impose work on future deployments.
