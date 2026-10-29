import { build } from 'esbuild';
import { FETCH_HELPER } from './config.mjs';
import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = join(root, 'dist');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const result = await build({
  entryPoints: { app: join(root, 'web/app.mjs'), worker: join(root, 'web/worker.mjs'), guide: join(root, 'web/guide/app.mjs') },
  outdir: out, bundle: true, format: 'esm', platform: 'browser', target: 'es2022',
  minify: true, metafile: true, legalComments: 'linked',
  // The grammar needs css/html template values, not DOM rendering. Lit's SSR
  // html tag initializes without document; its public barrel loads HTMLElement.
  alias: { lit: join(root, 'web/lit-tags.mjs'), 'lit-html': join(root, 'node_modules/lit-html/node/lit-html.js'), crypto: join(root, 'web/crypto.mjs') },
});
if (Object.keys(result.metafile.inputs).some(x => x.startsWith('node:'))) throw new Error('Node dependency leaked into the browser build.');
// Git may check the shared HTML out with CRLF on Windows; template markers use LF.
let html = (await readFile(join(root, 'assets/index.html'), 'utf8')).replace(/\r\n/g, '\n');
const replace = (a, b) => { if (!html.includes(a)) throw new Error('Web template marker changed: ' + a); html = html.replace(a, b); };
replace('<title>', '<meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\'; worker-src \'self\'; connect-src ' + new URL(FETCH_HELPER).origin + '; img-src \'self\' data:; object-src \'none\'; base-uri \'none\'; form-action \'none\'"><meta name="description" content="Read Unreal Blueprint exports in your browser. Get a compact AI brief, improvement tips and node evidence. Free and MIT licensed."><title>');
replace('href="/app.css"', 'href="./app.css"');
const brandFiles = ['favicon.ico', 'favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'social-card.png'];
for (const file of brandFiles.filter(file => file !== 'social-card.png')) replace(`href="/${file}"`, `href="./${file}"`);
replace('src="/favicon.svg"', 'src="./favicon.svg"');
replace('</head>', `<link rel="canonical" href="https://ibrews.github.io/ue5-mcp/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Blueprint Reader">
<meta property="og:title" content="Blueprint Reader — Understand the graph. Keep the context small.">
<meta property="og:description" content="Turn Unreal Blueprint text or a BlueprintUE link into a compact brief for Codex or Claude. Free and open source. Parsing stays in your browser.">
<meta property="og:url" content="https://ibrews.github.io/ue5-mcp/">
<meta property="og:image" content="https://ibrews.github.io/ue5-mcp/social-card.png">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1730">
<meta property="og:image:height" content="909">
<meta property="og:image:alt" content="Blueprint Reader: connected nodes under a reading lens become a compact report. Alex Coulombe Presents.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Blueprint Reader">
<meta name="twitter:description" content="Understand the graph. Keep the context small. Free, open source, in your browser.">
<meta name="twitter:image" content="https://ibrews.github.io/ue5-mcp/social-card.png">
<meta name="twitter:image:alt" content="Blueprint Reader: connected nodes under a reading lens become a compact report. Alex Coulombe Presents.">
</head>`);
replace('src="/local-app.js"', 'src="./app.js"');
replace('href="/" class="brand"', 'href="./" class="brand"');
replace('Runs on your computer', 'Parsing stays in your browser');
replace('Paste an export, drop in its macros, or bring a BlueprintUE link.', 'Paste an export, add its macros, or bring a BlueprintUE link.');
replace('</p></section>\n  <div class="workspace">', '</p><div class="actions"><button class="primary" type="button" id="try-example">Try a sample graph</button><a href="./guide/">Follow a real graph →</a><a href="https://github.com/ibrews/ue5-mcp/tree/main/skills/blueprint-reader#readme" target="_blank" rel="noopener noreferrer">Get the Codex / Claude skill</a></div><p class="hint">Free and MIT licensed. No installation, account or AI API key.</p></section>\n  <div class="workspace">');
replace('Public or unlisted BlueprintUE URL', 'BlueprintUE source URL');
replace('The export is fetched directly from BlueprintUE. Private or expired links need copied text.', 'Paste a link and click Read Blueprint. Our fetch helper retrieves the export; graph parsing stays in your browser. If a link fails, open BlueprintUE, copy its text, and choose Use copied text instead.');
replace('</p></div>\n        <label class="file-zone"', '</p><button id="open-blueprintue" type="button" class="button">Open BlueprintUE ↗</button> <button id="use-copied-text" type="button" class="button">Use copied text instead</button></div>\n        <label class="file-zone"');
replace('No AI API key. No Blueprint uploads. Pasted text stays in this local session; links contact BlueprintUE.', 'Pasted text and files stay in this tab. Link imports send the URL to our Vercel helper, which sees the export but does not analyze or store it. Parsing stays local; no AI calls. Automatic imports: up to 4 MiB; paste or files: 32 MiB. Save your session before closing.');
replace('BLUEPRINT READER <span>', 'BLUEPRINT READER <a href="https://github.com/ibrews/ue5-mcp" target="_blank" rel="noopener noreferrer">Source on GitHub</a> <span>');
await writeFile(join(out, 'index.html'), html);
await writeFile(join(out, '.nojekyll'), '');
await copyFile(join(root, 'assets/app.css'), join(out, 'app.css'));
await mkdir(join(out, 'guide'), { recursive: true });
for (const file of ['index.html', 'guide.css']) await copyFile(join(root, 'web/guide', file), join(out, 'guide', file));
for (const file of ['graph-wide.png', 'graph-ui-chain.png']) await copyFile(join(root, '../../docs/trailer/captures-v2', file), join(out, 'guide', file));
for (const file of brandFiles) await copyFile(join(root, 'assets/branding', file), join(out, file));
await copyFile(join(root, 'LICENSE'), join(out, 'LICENSE.txt'));
let notices = 'Blueprint Reader is MIT licensed. See LICENSE.txt.\n\n';
for (const name of ['ueblueprint', 'parsernostrum', '@lit/reactive-element', 'lit-html', 'htmlparser2', 'entities', 'domhandler', 'domutils', 'dom-serializer', 'domelementtype']) {
  const base = join(root, 'node_modules', name);
  const pkg = JSON.parse(await readFile(join(base, 'package.json'), 'utf8'));
  let license;
  for (const file of ['LICENSE', 'LICENSE.txt', 'LICENSE.md']) {
    try { license = await readFile(join(base, file), 'utf8'); break; } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  if (!license) throw new Error('Missing bundled license: ' + name);
  notices += `${name} ${pkg.version}\n${license}\n\n`;
}
await writeFile(join(out, 'THIRD_PARTY_NOTICES.txt'), notices);
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
await writeFile(join(out, 'version.json'), JSON.stringify({ version: pkg.version, commit: process.env.GITHUB_SHA || null }) + '\n');
console.log('Browser edition built in ' + out);
