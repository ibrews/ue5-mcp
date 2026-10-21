#!/usr/bin/env node
import { Worker } from 'node:worker_threads';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { loadSource, MAX_BYTES } from './sources.mjs';
import { mergeBundles } from './parser.mjs';
import { report, mermaid, selectGraphs, selectNode, sliceEntry } from './report.mjs';
import { flow } from './flow.mjs';
import { analyze, compactBrief } from './analysis.mjs';
import { loadSession, saveSession, sessionDocument } from './session.mjs';

export function parseIsolated(text, source, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./parse-worker.mjs', import.meta.url), {
      workerData: { text, source }, resourceLimits: { maxOldGenerationSizeMb: 512 },
    });
    const timer = setTimeout(() => { worker.terminate(); reject(new Error('Parsing exceeded 30 seconds; split the input by graph.')); }, timeout);
    worker.once('message', result => { clearTimeout(timer); worker.terminate(); result.error ? reject(new Error(result.error)) : resolve(result.bundle); });
    worker.once('error', error => { clearTimeout(timer); reject(error); });
    worker.once('exit', code => { clearTimeout(timer); if (code !== 0) reject(new Error(`Parser worker exited (${code}).`)); });
  });
}

const help = `Blueprint reader — BlueprintUE URLs, raw clipboard text, Markdown exports, BPGraph wrappers.
Usage: node scripts/read-blueprint.mjs <file|URL> [more files...] [options]
       cat graph.txt | node scripts/read-blueprint.mjs -

  --format brief|analysis|summary|flow|json|mermaid|raw   Default: brief
  --brief                           Compact by default; shorten legacy summary lists
  --budget <bytes>                  Brief byte budget, 2000–64000 (default 8000)
  --save-session <path>              Save full text locally for later queries
  --session <path>                   Reload a saved session instead of input files
  --graph <ID|name|path>             Select one graph, e.g. s1:g2
  --node <name|GUID>                 Inspect one node and its connections
  --entry <name|GUID>                Trace execution successors and data dependencies
  --limit <count>                    Per-section summary limit (default 80)
  --include-raw                      Preserve original node blocks in JSON
  --output <path>                    Write result (exclusive creation)
  --strict                          Exit 2 for incomplete/asymmetric/invalid links

Multiple files are analyzed together; macro bodies resolve by exact export path,
or by an unambiguous heading name when the body lacks an export path.
No editor connection is needed. This tool never edits or uploads your Blueprints.
`;

export async function main(args = process.argv.slice(2)) {
  if (!args.length || args.includes('--help') || args.includes('-h')) { console.log(help); return; }
  const options = { format: 'brief', limit: 80, budget: 8000 }, inputs = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (['--brief', '--include-raw', '--strict'].includes(a)) options[a.slice(2)] = true;
    else if (['--format', '--graph', '--node', '--entry', '--limit', '--output', '--budget', '--save-session', '--session'].includes(a)) {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Missing value for ${a}.`);
      options[a.slice(2)] = args[++i];
    } else if (a.startsWith('--')) throw new Error(`Unknown option: ${a}`);
    else inputs.push(a);
  }
  if (!inputs.length && !options.session) throw new Error('Supply a file, BlueprintUE URL, - for stdin, or --session <file>.');
  if (inputs.length && options.session) throw new Error('Use --session or input files, not both.');
  if (!['brief', 'analysis', 'summary', 'flow', 'json', 'mermaid', 'raw'].includes(options.format)) throw new Error('Unsupported output format.');
  if (options.node && ['analysis', 'flow', 'mermaid'].includes(options.format)) throw new Error('--node supports brief, summary, JSON and raw; use --entry to select a flow.');
  options.budget = Number(options.budget);
  if (!Number.isInteger(options.budget) || options.budget < 2000 || options.budget > 64000) throw new Error('--budget must be 2000–64000 UTF-8 bytes.');
  options.limit = Number(options.limit);
  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 20000) throw new Error('--limit must be an integer from 1 to 20000.');
  const bundles = [], loadedSources = options.session ? await loadSession(options.session) : [];
  for (const input of inputs) {
    let loaded;
    if (input === '-') {
      const chunks = []; let size = 0;
      for await (const chunk of process.stdin) { size += chunk.length; if (size > MAX_BYTES) throw new Error('stdin exceeds 32 MiB.'); chunks.push(chunk); }
      loaded = { text: new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)), source: { name: 'stdin', kind: 'stdin' } };
    } else loaded = await loadSource(input);
    loadedSources.push(loaded);
  }
  sessionDocument(loadedSources);
  for (const [i, loaded] of loadedSources.entries()) bundles.push(await parseIsolated(loaded.text, { ...loaded.source, id: `s${i + 1}` }));
  let bundle = mergeBundles(bundles);
  if (options['save-session']) await saveSession(options['save-session'], loadedSources);
  if (options.entry) bundle = { ...bundle, graphs: [sliceEntry(selectGraphs(bundle, options.graph), options.entry)] };
  const graphs = selectGraphs(bundle, options.graph);
  let output;
  if (options.format === 'brief') output = options.node ? report(bundle, options) : compactBrief({ ...bundle, graphs }, { budget: options.budget });
  else if (options.format === 'analysis') output = JSON.stringify(analyze({ ...bundle, graphs }), null, 2) + '\n';
  else if (options.format === 'summary') output = report(bundle, options);
  else if (options.format === 'flow') output = flow(bundle, options);
  else if (options.format === 'mermaid') {
    if (options.node) throw new Error('--node is not supported with Mermaid; select a graph.');
    output = mermaid(bundle, options.graph);
  } else if (options.format === 'raw') {
    if (options.node) output = selectNode(graphs, options.node).node.raw + '\n';
    else output = graphs.map(g => g.nodes.map(n => n.raw).join('\n')).join('\n') + '\n';
  } else {
    const selected = options.node ? selectNode(graphs, options.node) : { ...bundle, graphs };
    output = JSON.stringify(selected, (key, value) => key === 'raw' && !options['include-raw'] ? undefined : value, 2) + '\n';
  }
  if (options.output) await writeFile(options.output, output, { flag: 'wx' });
  else process.stdout.write(output);
  const incomplete = graphs.some(g => g.warnings.some(w => ['missing_link_target', 'nonreciprocal_link', 'same_direction_link', 'exec_data_mismatch', 'orphaned_pin'].includes(w.code)));
  if (options.strict && incomplete) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(`blueprint-reader: ${error.message}`); process.exitCode = 1; });
}
