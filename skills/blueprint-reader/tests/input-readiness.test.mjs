import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { looksLikeBlueprint, inputProblem } from '../assets/source-input.js';
import { example } from '../web/example.mjs';

test('readiness rejects empty, unrelated and incomplete text but accepts exports and wrappers', () => {
  for (const text of ['', '   ', 'hello', 'Begin Object\nEnd Object', example.replace(/End Object\s*$/, ''),
    'End Object\n' + example, '{\\rtf1 ' + example, example + '\0']) {
    assert.ok(inputProblem({ text }), text.slice(0, 60));
  }
  assert.equal(inputProblem({ text: example }), null);
  assert.equal(inputProblem({ text: '# Main graph\n```\n' + example + '\n```' }), null);
  assert.equal(inputProblem({ text: `BPGraph(GraphName="Test",NodesString=${JSON.stringify(example)})` }), null);
});

test('the readiness gate accepts all 102 real Blueprint fixtures used by the parser', async () => {
  const root = new URL('../node_modules/ueblueprint/tests/', import.meta.url);
  let count = 0;
  for (const name of await readdir(root)) {
    if (!name.endsWith('.spec.js')) continue;
    const source = await readFile(new URL(name, root), 'utf8');
    for (const [, text] of source.matchAll(/value:\s*String\.raw`([^`]+)`/g)) {
      if (!text.includes('Class=/Script/BlueprintGraph.') || text.includes('${')) continue;
      assert.equal(looksLikeBlueprint(text), true, name);
      count++;
    }
  }
  assert.equal(count, 102);
});

test('only allowed BlueprintUE URL shapes are ready; input checks do not fetch them', () => {
  for (const url of ['https://blueprintue.com/blueprint/6v52d8no/', 'https://www.blueprintue.com/render/test-1/?x=1#view']) {
    assert.equal(inputProblem({ url }), null);
  }
  for (const url of ['https://blueprintue.com/', 'https://blueprintue.com/blueprint/', 'https://example.com/blueprint/test/',
    'http://blueprintue.com/blueprint/test/', 'https://blueprintue.com.evil.test/blueprint/test/',
    'https://user:pass@blueprintue.com/blueprint/test/', 'https://blueprintue.com:444/blueprint/test/', 'not a link']) {
    assert.ok(inputProblem({ url }), url);
  }
});

test('files and saved sessions can supply the source; malformed attachments keep the action unavailable', () => {
  const file = { name: 'graph.txt', text: example };
  const session = { session: { kind: 'blueprint-reader-session', schema_version: 1, sources: [{ text: example }] } };
  assert.equal(inputProblem({ files: [file] }), null);
  assert.equal(inputProblem({ files: [session] }), null);
  assert.ok(inputProblem({ text: example, files: [{ name: 'notes.txt', text: 'just notes' }] }));
  assert.ok(inputProblem({ files: [{ session: { kind: 'unrelated', sources: [] } }] }));
  assert.ok(inputProblem({ files: [{ session: { ...session.session, sources: [] } }] }));
  assert.ok(inputProblem({ files: Array(101).fill(file) }));
  assert.ok(inputProblem({ url: 'bad URL', files: [file] }));
});
