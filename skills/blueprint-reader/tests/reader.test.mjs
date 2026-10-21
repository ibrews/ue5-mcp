import test from 'node:test';
import assert from 'node:assert/strict';
import { parseText, mergeBundles, fields } from '../scripts/parser.mjs';
import { extractHTML, blueprintURL, fetchBlueprint } from '../scripts/sources.mjs';
import { sliceEntry, mermaid, statistics } from '../scripts/report.mjs';
import { spawnSync } from 'node:child_process';
import { flow } from '../scripts/flow.mjs';

const id = n => n.toString(16).padStart(32, '0').toUpperCase();
const pin = (n, name, direction, links = '', type = 'exec', extra = '') =>
  `   CustomProperties Pin (PinId=${id(n)},PinName="${name}",${direction === 'out' ? 'Direction="EGPD_Output",' : ''}PinType.PinCategory="${type}",${links ? `LinkedTo=(${links},),` : ''}${extra})`;
const node = (name, cls, props, pins, path) => `Begin Object Class=/Script/BlueprintGraph.${cls} Name="${name}"${path ? ` ExportPath="/Script/BlueprintGraph.${cls}'${path}.${name}'"` : ''}\n${props}\n${pins.join('\n')}\nEnd Object`;
const event = node('Event_0', 'K2Node_Event', '   EventReference=(MemberName="ReceiveBeginPlay")', [pin(1, 'then', 'out', `Branch_0 ${id(2)}`)]);
const branch = node('Branch_0', 'K2Node_IfThenElse', '', [pin(2, 'execute', 'in', `Event_0 ${id(1)}`),
  pin(3, 'then', 'out', `Print_0 ${id(6)}`), pin(4, 'else', 'out', `Print_1 ${id(6)}`), pin(5, 'Condition', 'in', '', 'bool', 'DefaultValue="true",')]);
const a = node('Print_0', 'K2Node_CallFunction', '   FunctionReference=(MemberName="PrintString")', [pin(6, 'execute', 'in', `Branch_0 ${id(3)}`), pin(7, 'InString', 'in', '', 'string', 'DefaultValue="yes, (now)",')]);
const b = node('Print_1', 'K2Node_CallFunction', '   FunctionReference=(MemberName="PrintString")', [pin(6, 'execute', 'in', `Branch_0 ${id(4)}`)]);
const fragment = [event, branch, a, b].join('\n');

test('UEBlueprint grammar resolves both branch arms and node-scoped duplicate PinIds', () => {
  const bundle = mergeBundles([parseText(fragment)]), g = bundle.graphs[0];
  assert.equal(g.nodes.length, 4); assert.equal(g.edges.length, 3);
  assert.deepEqual(g.warnings, []); assert.deepEqual(g.entries, ['Event_0']);
  assert.equal(g.nodes[1].pins[3].default_value, 'true');
  assert.equal(g.nodes[2].pins[1].default_value, 'yes, (now)');
  assert.ok(g.edges.every(e => e.reciprocal));
  assert.equal(sliceEntry([g], 'Event_0').nodes.length, 4);
  assert.match(mermaid(bundle), /else/);
});

test('dangling, asymmetric, wrong-direction and orphaned pins remain explicit', () => {
  const asymmetric = fragment.replace(`LinkedTo=(Branch_0 ${id(3)},),`, '');
  const g = parseText(asymmetric).graphs[0];
  assert.equal(g.edges.length, 3); assert.equal(g.warnings[0].code, 'nonreciprocal_link');
  const missing = parseText(event).graphs[0];
  assert.equal(missing.warnings[0].code, 'missing_link_target');
  const wrong = parseText(fragment.replace('PinName="execute",PinType', 'PinName="execute",Direction="EGPD_Output",PinType')).graphs[0];
  assert.ok(wrong.warnings.some(w => w.code === 'same_direction_link'));
  const orphan = parseText(node('N', 'K2Node_CallFunction', '   bIsPureFunc=True', [pin(8, 'V', 'in', '', 'int', 'bOrphanedPin=True,bHidden=True,PinType.bIsReference=True,')])).graphs[0];
  assert.equal(orphan.nodes[0].pure, true);
  assert.equal(orphan.nodes[0].pins[0].hidden, true);
  assert.equal(orphan.nodes[0].pins[0].type.reference, true);
  assert.ok(orphan.warnings.some(w => w.code === 'orphaned_pin'));
});

test('exact textual int64 defaults and unknown properties survive normalization', () => {
  const raw = node('N_0', 'K2Node_CallFunction', '   FutureProperty=(Value="unknown, (nested)")', [pin(8, 'Value', 'in', '', 'int64', 'DefaultValue="9223372036854775807",')]);
  const n = parseText(raw).graphs[0].nodes[0];
  assert.equal(n.pins[0].default_value, '9223372036854775807');
  assert.equal(n.properties.FutureProperty, '(Value="unknown, (nested)")');
  assert.equal(n.raw, raw);
});

test('user-defined pin declarations are metadata, not extra connection pins', () => {
  const raw = node('C_0', 'K2Node_CustomEvent', '   CustomFunctionName="Run"', [pin(1, 'then', 'out'),
    '   CustomProperties UserDefinedPin (PinName="Count",PinType=(PinCategory="int"),DesiredPinDirection=EGPD_Output)']);
  const n = parseText(raw).graphs[0].nodes[0];
  assert.equal(n.pins.length, 1); assert.equal(n.user_defined_pins[0].name, 'Count');
});

test('relative macros resolve against their owning Blueprint, not another asset with the same name', () => {
  const owner = '/Game/BP_Test.BP_Test';
  const macro = node('Macro_0', 'K2Node_MacroInstance', `   MacroGraphReference=(MacroGraph=/Script/Engine.EdGraph'"DoThing"',GraphBlueprint=/Script/Engine.Blueprint'"${owner}"')`, [], `${owner}:EventGraph`);
  const tunnel = path => node('Tunnel_0', 'K2Node_Tunnel', '', [pin(1, 'then', 'out')], path);
  const bundle = mergeBundles([parseText([macro, tunnel(`${owner}:DoThing`), tunnel('/Game/Other.Other:DoThing')].join('\n'))]);
  assert.equal(bundle.graphs.length, 3);
  assert.equal(bundle.graphs[0].nodes[0].macro.graph_id, 's1:g2');
  assert.equal(bundle.graphs[0].nodes[0].macro.match, 'relative_path');
});

test('headings disambiguate raw exports; ambiguous macro bodies are not guessed', () => {
  const macro = node('M_0', 'K2Node_MacroInstance', '   MacroGraphReference=(MacroGraph=/Script/Engine.EdGraph\'"DoThing"\')', []);
  const tunnel = node('Tunnel_0', 'K2Node_Tunnel', '', [pin(1, 'then', 'out')]);
  const bundle = mergeBundles([parseText(`EventGraph:\n${macro}\n## DoThing\n${tunnel}\n## DoThing\n${tunnel}`)]);
  assert.equal(bundle.graphs[0].nodes[0].macro.graph_id, null);
  assert.ok(bundle.graphs[0].warnings.some(w => w.code === 'ambiguous_macro'));
});

test('whole-function BPGraph wrapper keeps all nodes in the same graph', () => {
  const wrapped = `BPGraph(GraphName="MyFunction",GraphType=GT_Function,NodesString=${JSON.stringify(fragment)})`;
  const g = parseText(wrapped).graphs[0];
  assert.equal(g.name, 'MyFunction'); assert.equal(g.nodes.length, 4); assert.equal(g.edges.length, 3);
});

test('cycles terminate in graph slicing without discarding data edges', () => {
  const one = node('One', 'K2Node_CallFunction', '', [pin(1, 'Out', 'out', `Two ${id(2)}`, 'float'), pin(2, 'In', 'in', `Two ${id(1)}`, 'float')]);
  const two = node('Two', 'K2Node_CallFunction', '', [pin(1, 'Out', 'out', `One ${id(2)}`, 'float'), pin(2, 'In', 'in', `One ${id(1)}`, 'float')]);
  const g = sliceEntry(parseText(one + '\n' + two).graphs, 'One');
  assert.equal(g.nodes.length, 2); assert.equal(g.edges.length, 2);
});

test('malformed/truncated/duplicate input fails rather than producing a plausible partial graph', () => {
  assert.throws(() => parseText(event.replace('End Object', '')), /Unterminated/);
  assert.throws(() => parseText(event + '\n' + event), /Duplicate node/);
  assert.throws(() => parseText('Hello world'), /No Blueprint objects/);
  assert.throws(() => parseText(event.replace('EventReference=', '__proto__.polluted=')), /Unsafe/);
  assert.equal({}.polluted, undefined);
});

test('textarea entity decoding occurs once and never executes page scripts', () => {
  const text = 'Begin Object Class=/Script/X Name="&amp;"\nEnd Object';
  const escaped = text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('/', '&#47;');
  assert.equal(extractHTML(`<title>Graph &amp; test</title><textarea id="code_to_copy">${escaped}</textarea><script>throw 1</script>`).text, text);
  assert.equal(extractHTML(`<textarea id="pastebin_data">${escaped}</textarea>`).text, text);
  assert.throws(() => extractHTML('<html>login required</html>'), /No Blueprint text/);
});

test('URL validation rejects unrelated hosts, credentials, and redirect escapes', async () => {
  for (const url of ['http://blueprintue.com/blueprint/abc/', 'https://example.com/blueprint/abc/', 'https://blueprintue.com@evil.test/blueprint/abc/', 'https://blueprintue.com:8080/blueprint/abc/']) assert.throws(() => blueprintURL(url));
  await assert.rejects(fetchBlueprint('https://blueprintue.com/blueprint/abc/', async () => new Response(null, { status: 302, headers: { location: 'https://evil.test/' } })), /Expected an HTTPS/);
});

test('CLI reads stdin in a bounded parser worker; strict flags incomplete fragments', () => {
  const run = (raw, args) => spawnSync(process.execPath, ['scripts/read-blueprint.mjs', '-', ...args], { input: raw, encoding: 'utf8' });
  const complete = run(fragment, ['--format', 'json', '--strict']);
  assert.equal(complete.status, 0, complete.stderr); assert.equal(statistics(JSON.parse(complete.stdout)).nodes, 4);
  const incomplete = run(event, ['--strict']); assert.equal(incomplete.status, 2);
  const truncated = run('Begin Object', []); assert.equal(truncated.status, 1); assert.equal(truncated.stdout, '');
});

test('balanced field reader preserves nested values and string punctuation', () => {
  const f = fields('A="x, (y)",B=(Value="z"),C="\\\"quoted\\\""');
  assert.equal(f.A, '"x, (y)"'); assert.equal(f.B, '(Value="z")');
});

test('flow preserves both branch labels and input-key entries', () => {
  const rendered = flow(parseText(fragment));
  assert.match(rendered, /then -> \[Print_0\]/);
  assert.match(rendered, /else -> \[Print_1\]/);
  const input = node('Key_0', 'K2Node_InputKey', '   InputKey=Nine\n   bControl=True', [pin(1, 'Pressed', 'out'), pin(2, 'Released', 'out')]);
  const g = parseText(input).graphs[0];
  assert.deepEqual(g.entries, ['Key_0']); assert.equal(g.nodes[0].title, 'Control+Nine');
});
