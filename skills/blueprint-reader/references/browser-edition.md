# Browser edition

Live site: **https://ibrews.github.io/ue5-mcp/**. Version 0.3.0 adds a static browser application alongside the installed reader.

## Architecture

- `assets/app.js` is the shared interface. `assets/local-app.js` adapts it to the existing loopback HTTP API; `web/app.mjs` adapts it to `web/client.mjs` and a browser worker.
- `scripts/parser-core.mjs`, `session-core.mjs`, `source-core.mjs`, `text.mjs`, the analysis and report modules have no Node dependencies. The old Node entrypoints retain their synchronous API and file/HTTP behavior.
- `web/engine.mjs` uses Web Crypto for SHA-256, the same UEBlueprint grammar and the same reporting code. Original text stays in tab memory. Downloads are local blobs; reopening a session reparses its source.
- Each new import gets a candidate worker. Only success replaces the accepted worker; syntax errors and the 45-second timeout preserve the previous result. Input is capped at 32 MiB decoded text, 100 sources and the parser's structural limits. Browsers do not provide the Node worker's hard heap cap; split unusually complex inputs if the browser runs low on memory.
- The grammar imports Lit's CSS and HTML template values for colors/icons. Importing Lit's full browser barrel attempts to initialize `HTMLElement`, which is absent in workers. The build uses the actual CSS tag and Lit HTML's DOM-free SSR entry, without rendering. A bundled-worker test catches this failure before deployment.

## BlueprintUE links and privacy

BlueprintUE pages did not send an `Access-Control-Allow-Origin` header in the 2026-10-21 checks. A browser-only page therefore cannot read their exports directly. Link mode opens a validated HTTPS BlueprintUE URL in a separate tab, lets the user copy its export, and records the source URL with that pasted text. It neither claims nor attempts automatic fetching through an undisclosed proxy.

The generated page has `connect-src 'none'`, `script-src 'self'` and `worker-src 'self'`. No raw source leaves the page, no external scripts/fonts are loaded, no analytics or AI service is called, and no public fetch relay is used. GitHub Pages serves the static assets and has its ordinary access logs. Opening the source link contacts BlueprintUE. No service worker or automatic browser persistence is installed.

## Build and publish

From `skills/blueprint-reader`:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run build:web
python3 -m http.server 8080 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:8080/` for development. `dist/` is generated and ignored. The build bundles pinned dependencies, emits relative paths for project Pages hosting, copies MIT/third-party license notices and writes `version.json`. Use HTTPS or localhost for Web Crypto; do not open the HTML as a `file:` URL.

`.github/workflows/blueprint-reader-pages.yml` tests and builds changes, then publishes the artifact from `main` with the official GitHub Pages action. The repository's Pages source is **GitHub Actions**. Pull requests build/test but do not deploy. `version.json` records `GITHUB_SHA` so a live deployment can be checked against the published commit.

## Validation

The browser engine matches the Node output on 102 real upstream Blueprint node exports. Additional tests cover the shipped worker bundle without a DOM, Unicode hashes and byte caps, branch evidence, entry/node inspection, saved-source round trips, failed-import recovery and input limits. Browser smoke checks also exercise the real controls, downloads and file chooser; Node tests alone do not establish browser UI behavior.

The public example in the README is publicly accessible but marked unlisted by BlueprintUE. Keep it as a test link; do not check its full export or the private camera acceptance file into this repository.
