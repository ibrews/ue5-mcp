// A bounded evidence excerpt, not a full Blueprint export or executable graph.
// Rebuild only from the named public example; see references/guided-example.md.
import { createHash } from 'node:crypto';
import { parseText, mergeBundles } from '../../scripts/parser.mjs';
import { analyze, compactBrief } from '../../scripts/analysis.mjs';

export const SOURCE_URL = 'https://blueprintue.com/blueprint/6v52d8no/';
export const SOURCE_SHA256 = '2fd51cbac3d40d7879c78522c824a05f87aaa3ee716ee874d5318c92c3d947fa';
export const NODE_IDS = ['K2Node_CreateWidget_1', 'K2Node_VariableSet_5', 'K2Node_CallFunction_6'];

export function makeSnapshot(text) {
  const digest = createHash('sha256').update(text).digest('hex');
  if (digest !== SOURCE_SHA256) throw new Error('Public example changed. Review the graph and guide before updating its pinned digest.');
  const bundle = mergeBundles([parseText(text, { id: 's1', kind: 'url', url: SOURCE_URL, title: 'Extended dialogue system posted by Nicola | blueprintUE | PasteBin For Unreal Engine' })]);
  const graph = bundle.graphs[0];
  const analysis = analyze(bundle);
  const nodes = NODE_IDS.map(id => {
    const node = graph.nodes.find(n => n.id === id);
    if (!node) throw new Error('Missing example node: ' + id);
    return { id: node.id, title: node.title, class: node.class, source_lines: [node.source.line, node.source.end_line],
      pins: node.pins.filter(p => !p.hidden).map(p => ({ id: p.id, name: p.name, direction: p.direction, type: p.type.category,
        ...(p.default_object ? { default_object: p.default_object } : {}), ...(p.default_value != null ? { default_value: p.default_value } : {}) })) };
  });
  const endpoint = value => {
    const node = graph.nodes.find(n => n.id === value.node);
    return { node: value.node, pin: value.pin, name: node.pins.find(p => p.id === value.pin).name };
  };
  return { schema_version: 1, verified: '2026-10-29', source: { url: SOURCE_URL, author: 'Nicola', title: 'Extended dialogue system', sha256: digest, bytes: Buffer.byteLength(text) },
    graph: { id: graph.id, name: graph.name }, stats: analysis.stats,
    brief: compactBrief(bundle), nodes,
    edges: graph.edges.filter(e => NODE_IDS.includes(e.from.node) && NODE_IDS.includes(e.to.node)).map(e => ({ kind: e.kind, from: endpoint(e.from), to: endpoint(e.to) })),
    dependencies: analysis.dependencies };
}
