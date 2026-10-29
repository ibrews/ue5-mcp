import test from 'node:test';
import assert from 'node:assert/strict';
import { parseText, mergeBundles } from '../scripts/parser.mjs';
import { compactBrief } from '../scripts/analysis.mjs';
import { inputProblem } from '../assets/source-input.js';
import { fileInput } from '../assets/native-input.js';
import { BrowserReader } from '../web/engine.mjs';
import { compareNativeClipboard } from '../scripts/native-parity.mjs';

// Deliberately synthetic contract fixture, not claimed as an Unreal editor capture.
const id = n => n.toString(16).padStart(32, '0').toUpperCase();
const pin = (n, name, direction, links = [], extra = {}) => ({ pin_id: id(n), name, direction, type: 'exec', connected_to: links, ...extra });
const link = (n, p, name) => ({ node_id: id(n), pin_id: id(p), pin_name: name });
function fixture() {
  return { blueprint_path: '/Game/Test.Test', reader_schema_version: 1, package_dirty: false,
    graphs: [{ name: 'EventGraph', path: '/Game/Test.Test:EventGraph', node_count: 3, connection_count: 2, nodes: [
      { node_id: id(1), node_class: 'K2Node_Event', node_title: 'Begin Play', pins: [pin(10, 'then', 'Output', [link(2, 20, 'execute')])] },
      { node_id: id(2), node_class: 'K2Node_CallFunction', node_title: 'Print String', function_name: 'PrintString', pins: [
        pin(20, 'execute', 'Input', [link(1, 10, 'then')]), pin(21, 'then', 'Output', [link(3, 30, 'execute')]),
        pin(22, 'InString', 'Input', [], { type: 'string', default_value: '', is_hidden: true })] },
      { node_id: id(3), node_class: 'K2Node_CallFunction', node_title: 'Print String', function_name: 'PrintString', pins: [pin(30, 'execute', 'Input', [link(2, 21, 'then')])] }
    ] }] };
}
test('native graph identity, repeated titles, wires and empty hidden defaults survive', () => {
  const b = mergeBundles([parseText(JSON.stringify(fixture()))]), g = b.graphs[0];
  assert.equal(g.nodes.length, 3); assert.equal(g.edges.length, 2); assert.deepEqual(g.warnings, []);
  assert.ok(g.edges.every(e => e.reciprocal)); assert.deepEqual(g.entries, [id(1)]);
  assert.equal(g.nodes[1].pins[2].default_value, ''); assert.equal(g.nodes[1].pins[2].hidden, true);
  assert.equal(g.nodes[1].function, 'PrintString'); assert.match(compactBrief(b), /Native JSON describes loaded editor graphs/);
});
test('legacy dumps resolve internal pin names and explicitly disclose missing evidence', () => {
  const dump = fixture(); delete dump.reader_schema_version;
  for (const n of dump.graphs[0].nodes) { delete n.function_name; for (const p of n.pins) { delete p.pin_id; for (const l of p.connected_to) delete l.pin_id; } }
  const p = dump.graphs[0].nodes[0].pins[0]; p.internal_name = p.name; p.name = 'friendly display';
  const b = parseText(JSON.stringify(dump));
  assert.equal(b.graphs[0].edges.length, 2); assert.equal(b.graphs[0].nodes[1].function, null);
  assert.match(compactBrief(b), /Legacy dump: hidden pins/);
  dump.graphs[0].nodes[1].pins.push({ ...dump.graphs[0].nodes[1].pins[0] });
  assert.throws(() => parseText(JSON.stringify(dump)), /ambiguous\/duplicate pin/);
});
test('native readiness accepts full MCP envelopes and rejects errors, chunks and unknown JSON', () => {
  for (const obj of [fixture(), { structuredContent: fixture() }, { result: { content: [{ type: 'text', text: JSON.stringify(fixture()) }] } }]) {
    const text = JSON.stringify(obj); assert.equal(inputProblem({ text }), null); assert.equal(parseText(text).graphs[0].nodes.length, 3);
  }
  for (const obj of [{}, { ...fixture(), reader_schema_version: 2 }, { ...fixture(), _truncated: true },
    { ...fixture(), _meta: { continuation_token: 'chunk' } }, { isError: true, structuredContent: fixture() },
    { ...fixture(), graphs: [{ name: 'G', nodes: [], node_count: 3 }] }]) {
    assert.ok(inputProblem({ text: JSON.stringify(obj) })); assert.throws(() => parseText(JSON.stringify(obj)));
  }
  const duplicate = fixture(); duplicate.graphs[0].nodes[2].node_id = id(2);
  assert.throws(() => parseText(JSON.stringify(duplicate)), /duplicate node_id/);
});
test('JSON files are native inputs unless they identify themselves as a saved session', async () => {
  const text = JSON.stringify(fixture()), file = fileInput('native.json', text);
  assert.deepEqual(file, { name: 'native.json', text });
  const engine = new BrowserReader(), result = await engine.ingest({ files: [file] });
  assert.equal(result.analysis.stats.nodes, 3);
  assert.match(engine.inspect({ id: result.id, node: id(2) }).text, /PrintString/);
  const saved = engine.download({ id: result.id, kind: 'session' });
  const session = fileInput(saved.name, saved.text); assert.ok(session.session);
  assert.equal((await engine.ingest({ files: [session] })).brief, result.brief);
});
test('native macro paths resolve to the correct supplied body and unresolved links stay visible', () => {
  const dump = fixture();
  dump.graphs[0].nodes.push({ node_id: id(4), node_class: 'K2Node_MacroInstance', macro_path: '/Game/Test.Test:Work', pins: [] });
  dump.graphs[0].node_count++;
  dump.graphs.push({ name: 'Work', path: '/Game/Test.Test:Work', nodes: [{ node_id: id(5), node_class: 'K2Node_Tunnel', pins: [] }] });
  let b = mergeBundles([parseText(JSON.stringify(dump))]);
  assert.equal(b.graphs[0].nodes[3].macro.graph_id, 's1:g2');
  delete dump.reader_schema_version;
  const p = dump.graphs[0].nodes[0].pins[0]; p.connected_to = [{ node_id: id(2), pin_name: 'absent-hidden-pin' }];
  b = parseText(JSON.stringify(dump));
  assert.ok(b.graphs[0].warnings.some(w => w.code === 'unresolved_native_link'));
});
test('native paired comparison detects a missing wire and missing clipboard evidence', () => {
  const dump = fixture(); dump.graphs[0].nodes = dump.graphs[0].nodes.slice(0, 1);
  dump.graphs[0].nodes[0].pins[0].connected_to = []; dump.graphs[0].node_count = 1; dump.graphs[0].connection_count = 0;
  dump.graphs[0].clipboard_text = `Begin Object Class=/Script/BlueprintGraph.K2Node_Event Name="Event_0"\n NodeGuid=${id(1)}\n CustomProperties Pin (PinId=${id(10)},PinName="then",Direction="EGPD_Output",PinType.PinCategory="exec")\nEnd Object`;
  assert.equal(compareNativeClipboard(JSON.stringify(dump)).equal, true);
  dump.graphs[0].nodes[0].pins[0].connected_to = [link(9, 90, 'execute')];
  assert.equal(compareNativeClipboard(JSON.stringify(dump)).equal, false);
  delete dump.graphs[0].clipboard_text;
  assert.throws(() => compareNativeClipboard(JSON.stringify(dump)), /Missing clipboard_text/);
});
