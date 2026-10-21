import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { parseText, mergeBundles } from '../scripts/parser.mjs';
import { loadSource } from '../scripts/sources.mjs';
import { statistics } from '../scripts/report.mjs';

test('102 MIT-licensed UEBlueprint real node exports preserve every real pin', async () => {
  const root = new URL('../node_modules/ueblueprint/tests/', import.meta.url);
  let count = 0;
  for (const name of await readdir(root)) {
    if (!name.endsWith('.spec.js')) continue;
    const source = await readFile(new URL(name, root), 'utf8');
    // Read literal test data only: never evaluate fixture JavaScript.
    for (const match of source.matchAll(/value:\s*String\.raw`([^`]+)`/g)) {
      const text = match[1];
      if (!text.includes('Class=/Script/BlueprintGraph.') || text.includes('${')) continue;
      const bundle = parseText(text);
      assert.equal(statistics(bundle).pins, [...text.matchAll(/^\s*CustomProperties Pin \(/gm)].length, name);
      assert.equal(statistics(bundle).nodes, [...text.matchAll(/^\s*Begin Object /gm)].length, name);
      count++;
    }
  }
  assert.equal(count, 102, 'Pinned upstream corpus changed; review the fixture inventory.');
});

test('optional private acceptance graph: node, pin, link and macro coverage', { skip: !process.env.BLUEPRINT_ACCEPTANCE_FILE }, async () => {
  const loaded = await loadSource(process.env.BLUEPRINT_ACCEPTANCE_FILE);
  const bundle = mergeBundles([parseText(loaded.text, loaded.source)]), stats = statistics(bundle);
  assert.deepEqual([stats.graphs, stats.nodes, stats.pins, stats.exec_edges, stats.data_edges], [3, 699, 2798, 405, 447]);
  assert.equal([...loaded.text.matchAll(/^\s*CustomProperties Pin \(/gm)].length, stats.pins);
  const references = [...loaded.text.matchAll(/LinkedTo=\(([^)]*)\)/g)].reduce((n, m) => n + [...m[1].matchAll(/\w+\s+[0-9A-F]{32}/g)].length, 0);
  assert.equal(references, 2 * (stats.exec_edges + stats.data_edges));
  assert.ok(bundle.graphs.every(g => g.edges.every(e => e.reciprocal)));
  assert.ok(bundle.graphs.every(g => g.warnings.every(w => w.code === 'external_macro')));
  assert.equal(bundle.graphs.flatMap(g => g.nodes).filter(n => n.macro?.graph_id).length, 13);
});
