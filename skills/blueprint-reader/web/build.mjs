import { build } from 'esbuild';
import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = join(root, 'dist');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const result = await build({
  entryPoints: { app: join(root, 'web/app.mjs'), worker: join(root, 'web/worker.mjs') },
  outdir: out, bundle: true, format: 'esm', platform: 'browser', target: 'es2022',
  minify: true, metafile: true, legalComments: 'linked',
  // The grammar needs css/html template values, not DOM rendering. Lit's SSR
  // html tag initializes without document; its public barrel loads HTMLElement.
  alias: { lit: join(root, 'web/lit-tags.mjs'), 'lit-html': join(root, 'node_modules/lit-html/node/lit-html.js') },
});
if (Object.keys(result.metafile.inputs).some(x => x.startsWith('node:'))) throw new Error('Node dependency leaked into the browser build.');
let html = await readFile(join(root, 'assets/index.html'), 'utf8');
const replace = (a, b) => { if (!html.includes(a)) throw new Error('Web template marker changed: ' + a); html = html.replace(a, b); };
replace('<title>', '<meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\'; worker-src \'self\'; connect-src \'none\'; img-src \'self\' data:; object-src \'none\'; base-uri \'none\'; form-action \'none\'"><meta name="description" content="Read Unreal Blueprint exports in your browser. Get a compact AI brief, improvement tips and node evidence. Free and MIT licensed."><title>');
replace('href="/app.css"', 'href="./app.css"');
replace('src="/local-app.js"', 'src="./app.js"');
replace('href="/" class="brand"', 'href="./" class="brand"');
replace('Runs on your computer', 'Parsing stays in your browser');
replace('Paste an export, drop in its macros, or bring a BlueprintUE link.', 'Paste an export, add its macros, or import copied text from BlueprintUE.');
replace('</p></section>\n  <div class="workspace">', '</p><div class="actions"><button class="primary" type="button" id="try-example">Try a sample graph</button><a href="https://github.com/ibrews/ue5-mcp/tree/main/skills/blueprint-reader#readme" target="_blank" rel="noopener noreferrer">Get the Codex / Claude skill</a></div><p class="hint">Free and MIT licensed. No installation, account or AI API key.</p></section>\n  <div class="workspace">');
replace('Public or unlisted BlueprintUE URL', 'BlueprintUE source URL');
replace('The export is fetched directly from BlueprintUE. Private or expired links need copied text.', 'Open the link, use Copy on BlueprintUE (or select its Code to copy field and copy it), then paste the text below. BlueprintUE blocks direct browser imports; no third-party relay is used.');
replace('</p></div>\n        <label class="file-zone"', '</p><button id="open-blueprintue" type="button" class="button">Open BlueprintUE ↗</button></div>\n        <label class="file-zone"');
replace('No AI API key. No Blueprint uploads. Pasted text stays in this local session; links contact BlueprintUE.', 'Your graph is parsed in this browser tab. No uploads, AI calls or third-party fetch relay. Save the full session before closing or reloading this page.');
replace('BLUEPRINT READER <span>', 'BLUEPRINT READER <a href="https://github.com/ibrews/ue5-mcp" target="_blank" rel="noopener noreferrer">Source on GitHub</a> <span>');
await writeFile(join(out, 'index.html'), html);
await writeFile(join(out, '.nojekyll'), '');
await copyFile(join(root, 'assets/app.css'), join(out, 'app.css'));
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
