#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { parseText } from './parser.mjs';
import { nativeDump } from '../assets/native-input.js';
import { isMainModule } from './entrypoint.mjs';

const guid = x => String(x).replaceAll('-', '').toUpperCase();
function topology(graph) {
  const ids = new Map(graph.nodes.map(n => [n.id, guid(n.guid)]));
  if (new Set(ids.values()).size !== ids.size || [...ids.values()].some(x => !/^[A-F0-9]{32}$/.test(x) || /^0+$/.test(x))) {
    throw new Error('Parity requires unique, valid NodeGuid values.');
  }
  return {
    nodes: graph.nodes.map(n => ({ guid: ids.get(n.id), class: n.class.split('.').at(-1),
      pins: n.pins.map(p => ({ id: guid(p.id), name: p.name, direction: p.direction, category: p.type.category,
        default_value: p.default_value ?? '', default_object: p.default_object ?? '', hidden: p.hidden,
        orphaned: p.orphaned })).sort((a, b) => a.id.localeCompare(b.id))
    })).sort((a, b) => a.guid.localeCompare(b.guid)),
    wires: graph.edges.map(e => JSON.stringify([ids.get(e.from.node), guid(e.from.pin), ids.get(e.to.node), guid(e.to.pin), e.kind])).sort()
  };
}

export function compareNativeClipboard(text) {
  const dump = nativeDump(text);
  if (dump.reader_schema_version !== 1) throw new Error('Paired comparison requires reader_schema_version 1.');
  const native = parseText(text);
  const graphs = dump.graphs.map((g, i) => {
    if (typeof g.clipboard_text !== 'string') throw new Error(`Missing clipboard_text for ${g.name}; export with include_clipboard:true.`);
    if (!g.nodes.length && !g.clipboard_text.trim()) return { name: g.name, nodes: 0, pins: 0, wires: 0, equal: true };
    const clipboard = parseText(g.clipboard_text);
    if (clipboard.graphs.length !== 1) throw new Error(`Expected one clipboard graph for ${g.name}; found ${clipboard.graphs.length}.`);
    const a = topology(native.graphs[i]), b = topology(clipboard.graphs[0]);
    const differences = Object.keys(a).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
    const topologyWarnings = [...native.graphs[i].warnings, ...clipboard.graphs[0].warnings];
    // Orphaned pins are graph defects, but matching orphaned flags are still
    // comparable evidence. Keep the warning without calling it a mismatch.
    const blockingWarnings = topologyWarnings.filter(w => w.code !== 'orphaned_pin');
    return { name: g.name, nodes: a.nodes.length, pins: a.nodes.reduce((s, n) => s + n.pins.length, 0),
      wires: a.wires.length, equal: !differences.length && !blockingWarnings.length, differences, topology_warnings: topologyWarnings };
  });
  return { schema_version: 1, engine_version: dump.engine_version ?? null, package_dirty: dump.package_dirty ?? null,
    source_sha256: native.sources[0].sha256, equal: graphs.every(g => g.equal), graphs,
    scope: 'Same loaded graph: node/pin GUIDs, classes, pin names/directions/categories, string/object defaults, hidden/orphaned flags and wires. Not a saved-binary comparison, compile, runtime test, or full property/text/type fidelity check.' };
}

if (isMainModule(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node scripts/native-parity.mjs paired-dump.json');
    const result = compareNativeClipboard(await readFile(process.argv[2], 'utf8'));
    console.log(JSON.stringify(result, null, 2));
    if (!result.equal) process.exitCode = 1;
  } catch (e) { console.error(e.message); process.exitCode = 2; }
}
