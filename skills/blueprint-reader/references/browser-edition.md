# Browser edition

Live site: **https://ibrews.github.io/ue5-mcp/**. Version 0.3.0 introduced the static browser application; 0.3.1 adds automatic BlueprintUE imports through a dedicated fetch helper.

## Architecture

- `assets/app.js` is the shared interface. `assets/local-app.js` adapts it to the existing loopback HTTP API; `web/app.mjs` adapts it to `web/client.mjs` and a browser worker.
- `scripts/parser-core.mjs`, `session-core.mjs`, `source-core.mjs`, `text.mjs`, the analysis and report modules have no Node dependencies. The old Node entrypoints retain their synchronous API and file/HTTP behavior.
- `web/engine.mjs` uses Web Crypto for SHA-256, the same UEBlueprint grammar and the same reporting code. Original text stays in tab memory. Downloads are local blobs; reopening a session reparses its source.
- Each new import gets a candidate worker. Only success replaces the accepted worker; syntax errors and the 45-second timeout preserve the previous result. Input is capped at 32 MiB decoded text, 100 sources and the parser's structural limits. Browsers do not provide the Node worker's hard heap cap; split unusually complex inputs if the browser runs low on memory.
- The grammar imports Lit's CSS and HTML template values for colors/icons. Importing Lit's full browser barrel attempts to initialize `HTMLElement`, which is absent in workers. The build uses the actual CSS tag and Lit HTML's DOM-free SSR entry, without rendering. A bundled-worker test catches this failure before deployment.
- UEBlueprint's GUID helper mistakes workers for Node when `window` is absent and tries `import('crypto')`. The browser build aliases that import to native `globalThis.crypto`; Node/CLI imports are unchanged. A bundle regression check prevents a bare Node crypto import from reaching browsers.

## BlueprintUE links and privacy

BlueprintUE does not permit direct cross-origin browser reads. `web/fetch-link.mjs` sends only a validated BlueprintUE URL to **https://blueprint-reader-fetch.vercel.app/api/blueprint**. The helper uses the same bounded HTTP fetching and HTML textarea extraction as the CLI (`scripts/fetch-blueprint.mjs`). It never imports the graph parser or analyzes the graph. The browser hashes and parses the returned text locally. Switching from paste mode to link mode ignores stale text; copied-text fallback explicitly switches back to paste mode.

Pasted text, selected files and saved sessions never go to the helper. Link URLs and their exports pass through Vercel and BlueprintUE. The helper does not write exports, cache responses or log bodies; ordinary hosting access logs may contain request URLs/IPs. For sensitive graphs, use paste/files. No analytics, AI service, external scripts/fonts, service worker or automatic browser persistence is installed.

The page permits `connect-src https://blueprint-reader-fetch.vercel.app`, `script-src 'self'` and `worker-src 'self'`. The helper accepts GET/OPTIONS only, requires the exact `https://ibrews.github.io` Origin, validates the HTTPS BlueprintUE host/path and every redirect, forwards no credentials, and returns `Cache-Control: no-store`. Origin checking is a browser boundary, not authentication; non-browser clients can forge it. Warm-instance safeguards allow 20 imports per IP/minute, eight concurrent fetches and at most 4,096 rate-limit entries. These are best-effort process-local limits, not a distributed quota guarantee.

Upstream requests have a 20-second deadline, at most five fetch attempts across redirects, and a 32 MiB HTML cap. JSON responses are capped at 4 MiB, below [Vercel's 4.5 MB function limit](https://vercel.com/docs/functions/limitations). The browser enforces that cap while streaming and times out link fetching after 25 seconds. Private/expired/blocked/oversized links show the manual copy fallback without replacing the accepted session. Paste/files retain the 32 MiB local limit.

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

## Deploy the fetch helper

The helper is a separate Vercel project: `ibrews-projects/blueprint-reader-fetch`, Node 24, one 30-second function. No database, API key or paid add-on is required by the code. It uses the account's normal function allowance. Builds are staged in ignored `dist-helper/`; only the bundled fetch/extraction code and public metadata are uploaded. Private fixtures, work files and `.env*` are excluded.

```sh
npm run build:helper
vercel link --project blueprint-reader-fetch --scope ibrews-projects --cwd dist-helper
vercel project inspect --non-interactive --cwd dist-helper
# Verify the owner/project before publishing.
GITHUB_SHA=$(git rev-parse HEAD) npm run build:helper
vercel deploy --prod --cwd dist-helper
```

The Pages workflow builds/tests the helper artifact but does not deploy it: helper releases use the explicit Vercel CLI command above. Deploy a compatible helper before publishing a browser change that requires it. `version.json` on both hosts identifies the release when `GITHUB_SHA` is supplied. No Vercel token is embedded in the site or repository. For a fork, change `web/config.mjs` to your endpoint and `ALLOWED_ORIGIN` in `helper/handler.mjs` to your Pages origin, then rebuild both. Localhost raw/sample/file parsing works offline after assets load; localhost link imports need your own helper origin policy (the production helper only permits the live Pages origin).

## Validation

The browser engine matches the Node output on 102 real upstream Blueprint node exports. Additional tests cover the shipped worker bundle without a DOM, Unicode hashes and byte caps, branch evidence, entry/node inspection, saved-source round trips, failed-import recovery and input limits. Helper tests cover origin/method/URL restrictions, redirect escapes, oversized streams, safe errors, timeout and rate-limit recovery. Browser tests verify link imports send only the URL and failed imports preserve the previous graph. Browser smoke checks also exercise the real controls, downloads and file chooser; Node tests alone do not establish browser UI behavior.

The public example in the README is publicly accessible but marked unlisted by BlueprintUE. Keep it as a test link; do not check its full export or the private camera acceptance file into this repository.
