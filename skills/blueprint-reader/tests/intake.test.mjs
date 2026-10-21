import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { get } from 'node:http';
import { parseText } from '../scripts/parser.mjs';
import { analyze, compactBrief } from '../scripts/analysis.mjs';
import { loadSession, saveSession, sessionDocument } from '../scripts/session.mjs';
import { createReaderServer } from '../scripts/serve.mjs';
import { flow } from '../scripts/flow.mjs';

const raw = 'Begin Object Class=/Script/BlueprintGraph.K2Node_Event Name="Start"\n   EventReference=(MemberName="ReceiveBeginPlay")\nEnd Object';
const p = (id, name, direction = 'input', category = 'exec', value = null) => ({ id, name, direction, type: { category }, default_value: value, links: [] });
const n = (id, cls, pins = [], extra = {}) => ({ id, class: 'K2Node_' + cls, pins, title: id, properties: {}, ...extra });
const e = (from, out, to, pin, kind = 'exec') => ({ from: { node: from, pin: out }, to: { node: to, pin }, kind, reciprocal: true });
const bundle = (nodes, edges, entries = ['Tick']) => ({ sources: [], warnings: [], graphs: [{ id: 's1:g1', name: 'Graph', kind: 'event', nodes, edges, entries, warnings: [] }] });
function motion(variable = 'Rotation', event = 'ReceiveTick') {
  return bundle([
    n('Tick', 'Event', [p('out', 'then', 'output')], { function: event }),
    n('Set', 'VariableSet', [p('in', 'execute'), p('value', variable, 'input', 'real')], { variable }),
    n('Add', 'PromotableOperator', [p('a', 'A', 'input', 'real'), p('b', 'B', 'input', 'real', '0.3'), p('out', 'ReturnValue', 'output', 'real')], { function: 'Add_DoubleDouble' }),
    n('Get', 'VariableGet', [p('out', variable, 'output', 'real')], { variable }),
  ], [e('Tick', 'out', 'Set', 'in'), e('Add', 'out', 'Set', 'value', 'data'), e('Get', 'out', 'Add', 'a', 'data')]);
}

test('brief obeys small UTF-8 budgets and exposes omissions without raw source', () => {
  const b = parseText(raw);
  b.graphs[0].name = '🙂'.repeat(300);
  const a = analyze(b);
  a.graphs = Array.from({ length: 50 }, (_, i) => ({ ...a.graphs[0], id: 'g' + i }));
  for (const budget of [2000, 4000, 8000]) {
    const text = compactBrief(b, { budget, analysis: a });
    assert.ok(Buffer.byteLength(text) <= budget);
    assert.doesNotMatch(text, /\uFFFD|Begin Object/);
    assert.match(text, /omitted|truncated/);
    assert.match(text, /Static evidence|truncated/);
  }
  assert.throws(() => compactBrief(b, { budget: 1999 }), /budget/);
});

test('branch findings require identical nonempty destination pin sets', () => {
  const branch = n('Branch', 'IfThenElse', [p('yes', 'then', 'output'), p('no', 'else', 'output')]);
  const b = bundle([branch, n('A', 'CallFunction'), n('B', 'CallFunction')], [e('Branch', 'yes', 'A', 'in'), e('Branch', 'no', 'A', 'in')], []);
  assert.equal(analyze(b).findings.filter(f => f.rule === 'identical_branch_targets').length, 1);
  b.graphs[0].edges[1].to.node = 'B';
  assert.equal(analyze(b).findings.length, 0);
  b.graphs[0].edges = [];
  assert.equal(analyze(b).findings.length, 0);
});

test('flow abbreviates huge defaults and argument lists and reports omitted data nodes', () => {
  const b = bundle([n('Data', 'CallFunction', Array.from({ length: 30 }, (_, i) => p('p' + i, 'Argument' + i, 'input', 'string', 'x'.repeat(20000)))), n('Other', 'CallFunction')], [], []);
  const text = flow(b, { limit: 1 });
  assert.ok(text.length < 6000);
  assert.match(text, /abbreviated/); assert.match(text, /more pins/); assert.match(text, /1 more data nodes omitted/);
});

test('fixed motion increment check excludes counters, setup and linked increments', () => {
  assert.ok(analyze(motion()).findings.some(f => f.rule === 'tick_constant_step'));
  for (const b of [motion('Counter'), motion('Rotation', 'ReceiveBeginPlay')])
    assert.ok(!analyze(b).findings.some(f => f.rule === 'tick_constant_step'));
  const b = motion(); b.graphs[0].nodes[2].pins[1].links.push({ node: 'Delta' });
  assert.ok(!analyze(b).findings.some(f => f.rule === 'tick_constant_step'));
});

test('Tick analysis follows explicit self calls but not calls on another object', () => {
  const b = motion(), g = b.graphs[0];
  g.nodes.push(n('Call', 'CallFunction', [p('in', 'execute'), p('self', 'self', 'input', 'object')], { function: 'Move', properties: { FunctionReference: '(MemberName="Move",bSelfContext=True)' } }),
    n('Move', 'CustomEvent', [p('out', 'then', 'output')], { function: 'Move' }));
  g.edges[0] = e('Tick', 'out', 'Call', 'in'); g.edges.push(e('Move', 'out', 'Set', 'in'));
  assert.ok(analyze(b).findings.some(f => f.rule === 'tick_constant_step'));
  g.nodes[4].pins[1].default_object = '/Game/Other';
  assert.ok(!analyze(b).findings.some(f => f.rule === 'tick_constant_step'));
});

test('costly Tick work is a conditional review with runtime validation', () => {
  const b = bundle([n('Tick', 'Event', [], { function: 'ReceiveTick' }), n('Lookup', 'CallFunction', [], { function: 'GetAllActorsOfClass' })], [e('Tick', 'out', 'Lookup', 'in')]);
  const f = analyze(b).findings.find(f => f.rule === 'tick_work');
  assert.match(f.detail, /guards can limit/); assert.match(f.validation, /Measure/);
  b.graphs[0].edges = [];
  assert.ok(!analyze(b).findings.some(f => f.rule === 'tick_work'));
});

test('saved sessions preserve source, reject versions and refuse overwrites', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'blueprint-session-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'saved.json');
  const sources = [{ text: raw, source: { name: 'test', url: 'https://invalid.test/no-refetch', extraneous: true } }];
  await saveSession(path, sources);
  assert.equal((await loadSession(path))[0].text, raw);
  assert.equal((await loadSession(path))[0].source.extraneous, undefined);
  await assert.rejects(saveSession(path, sources), /EEXIST/);
  await writeFile(path, JSON.stringify({ kind: 'blueprint-reader-session', schema_version: 99, sources }));
  await assert.rejects(loadSession(path), /Unsupported/);
  assert.throws(() => sessionDocument([]), /1–100/);
  assert.throws(() => sessionDocument([{ text: 'x'.repeat(32 * 1024 * 1024 + 1) }]), /32 MiB/);
});

test('CLI defaults to a brief and reloads saved sources for exact node queries', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'blueprint-cli-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'saved.json');
  const run = args => spawnSync(process.execPath, ['scripts/read-blueprint.mjs', ...args], { input: raw, encoding: 'utf8' });
  const first = run(['-', '--budget', '2000', '--save-session', path]);
  assert.equal(first.status, 0, first.stderr); assert.match(first.stdout, /BLUEPRINT BRIEF/); assert.ok(Buffer.byteLength(first.stdout) <= 2000);
  const node = run(['--session', path, '--node', 'Start', '--format', 'raw']);
  assert.equal(node.status, 0, node.stderr); assert.equal(node.stdout.trim(), raw);
  const findings = run(['--session', path, '--format', 'analysis']);
  assert.equal(findings.status, 0, findings.stderr); assert.equal(JSON.parse(findings.stdout).stats.nodes, 1);
  assert.equal(run(['--session', path, '-']).status, 1);
});

test('local intake enforces origin/host and supports bounded briefs, inspection and session restore', async t => {
  const server = createReaderServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const post = (body, headers = {}) => fetch(origin + '/api/ingest', { method: 'POST', headers: { origin, 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const wrongHost = await new Promise((resolve, reject) => get(origin, { headers: { host: 'evil.test' } }, res => { res.resume(); resolve(res.statusCode); }).on('error', reject));
  assert.equal(wrongHost, 403);
  assert.equal((await post({ text: raw }, { origin: 'https://evil.test' })).status, 403);
  assert.equal((await post({ url: 'file:///etc/passwd' })).status, 400);
  const res = await post({ text: raw, budget: 2000 }); assert.equal(res.status, 200);
  const first = await res.json(); assert.equal(first.analysis.stats.nodes, 1); assert.ok(first.brief_bytes <= 2000); assert.doesNotMatch(first.brief, /Begin Object/);
  const inspect = await (await fetch(`${origin}/api/inspect?id=${first.id}&graph=s1:g1&node=Start`)).json(); assert.match(inspect.text, /Start/);
  const saved = await (await fetch(`${origin}/api/download?id=${first.id}&kind=session`)).json(); assert.equal(saved.sources[0].text, raw);
  assert.equal((await post({ text: 'invalid' })).status, 400);
  assert.equal((await fetch(`${origin}/api/download?id=${first.id}&kind=brief`)).status, 200, 'failed parsing must preserve previous session');
  const restored = await post({ files: [{ session: saved }] }); assert.equal(restored.status, 200);
  assert.equal((await restored.json()).analysis.stats.nodes, 1);
  assert.equal((await fetch(`${origin}/api/download?id=${first.id}&kind=brief`)).status, 404);
  const page = await fetch(origin); assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.match(await page.text(), /Copy AI brief/);
});
