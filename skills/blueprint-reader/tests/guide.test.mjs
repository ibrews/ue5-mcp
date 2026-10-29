import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildPrompt, steps } from '../web/guide/content.mjs';
import { makeSnapshot, SOURCE_SHA256 } from '../web/guide/snapshot.mjs';

const evidence = JSON.parse(await readFile(new URL('../web/guide/evidence.json', import.meta.url), 'utf8'));

test('guide evidence retains distinct execution and object-reference connections with resolvable endpoints', () => {
  assert.equal(evidence.source.sha256, SOURCE_SHA256);
  assert.equal(evidence.nodes.length, 3);
  assert.equal(evidence.stats.nodes, 30);
  assert.equal(evidence.edges.filter(e => e.kind === 'exec').length, 2);
  assert.equal(evidence.edges.filter(e => e.kind === 'data').length, 2);
  for (const edge of evidence.edges) {
    const pins = ['from', 'to'].map(end => evidence.nodes.find(n => n.id === edge[end].node)?.pins.find(p => p.id === edge[end].pin));
    assert.ok(pins.every(Boolean));
    assert.equal(pins[0].direction, 'output');
    assert.equal(pins[1].direction, 'input');
    assert.equal(edge.from.name, pins[0].name);
    assert.equal(edge.to.name, pins[1].name);
    assert.equal(edge.kind === 'exec', pins[0].type === 'exec');
    assert.equal(pins[0].type, pins[1].type);
  }
  const widget = evidence.nodes[0];
  assert.equal(widget.pins.find(p => p.name === 'Class').default_object, '/Game/Misc/UI_HIRED.UI_HIRED_C');
  assert.equal(evidence.edges.find(e => e.to.name === 'self').from.name, 'Output_Get');
  assert.ok(!JSON.stringify(evidence).includes('Begin Object'));
  assert.ok(evidence.nodes.every(n => !('raw' in n) && !('properties' in n)));
});

test('guided steps select real evidence and copied prompt preserves scope and unknowns', () => {
  assert.equal(steps.length, 5);
  for (const step of steps) if (step.node) assert.ok(evidence.nodes.some(n => n.id === step.node));
  const prompt = buildPrompt(evidence);
  assert.ok(prompt.includes(evidence.brief));
  for (const edge of evidence.edges) assert.ok(prompt.includes(`${edge.from.node}.${edge.from.name} → ${edge.to.node}.${edge.to.name}`));
  assert.match(prompt, /Only 3 of 30 nodes/);
  assert.match(prompt, /Do not claim a bug or runtime outcome/);
  assert.match(prompt, /ForEachLoop/);
  assert.match(prompt, /concrete Unreal test/);
  assert.match(prompt, /Nicola/);
});

test('snapshot generation rejects a changed or unrelated source before parsing', () => {
  assert.throws(() => makeSnapshot('Begin Object unrelated'), /Public example changed/);
});
