import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { BrowserReader } from '../web/engine.mjs';
import { example } from '../web/example.mjs';
import { parseText, mergeBundles, sha256 } from '../scripts/parser.mjs';
import { analyze, compactBrief } from '../scripts/analysis.mjs';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('the shipped browser bundle starts without a DOM and parses in a worker', { timeout: 15000 }, async t => {
  const built = spawnSync(process.execPath, [fileURLToPath(new URL('../web/build.mjs', import.meta.url))], { encoding: 'utf8' });
  assert.equal(built.status, 0, built.stderr);
  const url = new URL('../dist/worker.js', import.meta.url).href;
  const worker = new Worker(`const { parentPort } = require('node:worker_threads');
    globalThis.self = globalThis;
    self.postMessage = data => parentPort.postMessage(data);
    import(${JSON.stringify(url)}).then(() => {
      parentPort.on('message', data => self.onmessage({ data }));
      parentPort.postMessage({ ready: true });
    });`, { eval: true });
  t.after(() => worker.terminate());
  assert.deepEqual((await once(worker, 'message'))[0], { ready: true });
  const response = once(worker, 'message');
  worker.postMessage({ id: 'sample', action: 'ingest', body: { text: example } });
  const [message] = await response;
  assert.equal(message.error, undefined);
  assert.equal(message.result.analysis.stats.nodes, 3);
});

test('browser engine matches Node on all 102 upstream real Blueprint fixtures', async () => {
  const root = new URL('../node_modules/ueblueprint/tests/', import.meta.url);
  let count = 0;
  for (const name of await readdir(root)) {
    if (!name.endsWith('.spec.js')) continue;
    const source = await readFile(new URL(name, root), 'utf8');
    for (const match of source.matchAll(/value:\s*String\.raw`([^`]+)`/g)) {
      const text = match[1];
      if (!text.includes('Class=/Script/BlueprintGraph.') || text.includes('${')) continue;
      const reader = new BrowserReader();
      const actual = await reader.ingest({ text });
      const bundle = mergeBundles([parseText(text, { kind: 'paste', name: 'Pasted Blueprint', id: 's1' })]);
      assert.deepEqual(reader.current.bundle, bundle, name);
      assert.deepEqual(actual.analysis, analyze(bundle), name);
      assert.equal(actual.brief, compactBrief(bundle), name);
      count++;
    }
  }
  assert.equal(count, 102);
});

test('browser sample exposes exact branch evidence, entry flow and lossless saved source', async () => {
  const reader = new BrowserReader();
  const text = example.replace('Hello from Blueprint Reader', 'Hello 🌍 café');
  const data = await reader.ingest({ text, budget: 2000 });
  assert.equal(data.analysis.stats.nodes, 3);
  assert.ok(data.analysis.findings.some(f => f.rule === 'identical_branch_targets' && f.nodes.includes('Branch_0')));
  assert.ok(data.brief_bytes <= 2000);
  assert.equal(reader.current.bundle.sources[0].sha256, sha256(text));
  assert.match(reader.inspect({ id: data.id, graph: 's1:g1', entry: 'Event_0' }).text, /PrintString/);
  assert.match(reader.inspect({ id: data.id, graph: 's1:g1', node: 'Branch_0' }).text, /Condition/);
  const saved = reader.download({ id: data.id, kind: 'session' });
  const doc = JSON.parse(saved.text);
  assert.equal(doc.sources[0].text, text);
  doc.graphs = [{ nodes: ['tampered'] }];
  const reopened = await new BrowserReader().ingest({ files: [{ session: doc }], budget: 2000 });
  assert.deepEqual(reopened.analysis, data.analysis);
  assert.equal(reopened.brief, data.brief);
});

test('failed imports preserve the accepted browser session and stale IDs fail', async () => {
  const reader = new BrowserReader();
  const good = await reader.ingest({ text: example });
  await assert.rejects(reader.ingest({ text: 'Begin Object broken' }), /Unterminated/);
  assert.equal(reader.download({ id: good.id, kind: 'brief' }).text, good.brief);
  const next = await reader.ingest({ text: example });
  assert.notEqual(next.id, good.id);
  assert.throws(() => reader.download({ id: good.id, kind: 'session' }), /expired/);
  assert.throws(() => reader.download({ id: next.id, kind: '__proto__' }), /Unknown/);
});

test('guided BlueprintUE imports validate URLs and never send graph text over the network', async t => {
  const network = t.mock.method(globalThis, 'fetch', () => { throw new Error('Network use is forbidden'); });
  const reader = new BrowserReader(), url = 'https://blueprintue.com/blueprint/6v52d8no/';
  await assert.rejects(reader.ingest({ url }), /Open the BlueprintUE link/);
  await assert.rejects(reader.ingest({ url: 'https://evil.example/blueprint/a/', text: example }), /Expected an HTTPS/);
  await reader.ingest({ url: url + '?tracking=discarded#fragment', text: example });
  assert.equal(reader.current.sources[0].source.url, url);
  assert.equal(network.mock.callCount(), 0);
});

test('browser rejects oversized, unsafe, RTF and invalid saved inputs before replacing state', async () => {
  const reader = new BrowserReader();
  await assert.rejects(reader.ingest({ text: example, budget: 1999 }), /budget/);
  await assert.rejects(reader.ingest({ files: [{ session: { kind: 'blueprint-reader-session', schema_version: 8, sources: [] } }] }), /Unsupported/);
  await assert.rejects(reader.ingest({ text: '{\\rtf1 test}' }), /plain text/);
  await assert.rejects(reader.ingest({ text: example.replace('EventReference=', '__proto__.polluted=') }), /Unsafe/);
  await assert.rejects(reader.ingest({ files: Array(101).fill({ text: example }) }), /100 files/);
  await assert.rejects(reader.ingest({ files: Array(3).fill({ name: 'large', text: 'x'.repeat(12 * 1024 * 1024) }) }), /32 MiB/);
});
