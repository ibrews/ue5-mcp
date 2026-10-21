import { build } from 'esbuild';
import { mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const out = root + 'dist-helper/';
// Preserve only the explicit Vercel project link between builds.
await rm(out + 'api', { recursive: true, force: true });
await rm(out + 'public', { recursive: true, force: true });
await mkdir(out + 'public', { recursive: true });
const result = await build({ entryPoints: [root + 'helper/api.mjs'], outfile: out + 'api/blueprint.mjs',
  platform: 'node', target: 'node24', format: 'esm', bundle: true, metafile: true, legalComments: 'inline' });
if (Object.keys(result.metafile.inputs).some(p => /ueblueprint|parser-core|analysis\.mjs/.test(p))) throw new Error('Graph parser leaked into fetch helper.');
await writeFile(out + 'package.json', JSON.stringify({ private: true, type: 'module', engines: { node: '24.x' } }));
await writeFile(out + '.vercelignore', '.env*\nnode_modules/\n');
await writeFile(out + 'vercel.json', JSON.stringify({ version: 2, framework: null, buildCommand: '', installCommand: '',
  outputDirectory: 'public', functions: { 'api/blueprint.mjs': { maxDuration: 30 } } }, null, 2));
const { version } = JSON.parse(await readFile(root + 'package.json', 'utf8'));
await writeFile(out + 'public/index.html', '<!doctype html><title>Blueprint Reader fetch helper</title><p>BlueprintUE export fetching only. <a href="https://ibrews.github.io/ue5-mcp/">Open Blueprint Reader</a>.</p>');
await writeFile(out + 'public/version.json', JSON.stringify({ version, commit: process.env.GITHUB_SHA || null }));
let licenses = await readFile(root + 'LICENSE', 'utf8');
for (const name of ['htmlparser2', 'entities']) licenses += '\n\n' + name + '\n' + await readFile(root + 'node_modules/' + name + '/LICENSE', 'utf8');
await writeFile(out + 'public/LICENSE.txt', licenses);
console.log('Fetch helper built in ' + out);
