import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchBlueprint } from '../../scripts/sources.mjs';
import { parseIsolated } from '../../scripts/read-blueprint.mjs';
import { mergeBundles } from '../../scripts/parser.mjs';
import { statistics } from '../../scripts/report.mjs';

test('public BlueprintUE dialogue graph: real HTML extraction through connected graph', async () => {
  const loaded = await fetchBlueprint('https://blueprintue.com/blueprint/6v52d8no/');
  const bundle = mergeBundles([await parseIsolated(loaded.text, loaded.source)]);
  const stats = statistics(bundle);
  assert.deepEqual([stats.graphs, stats.nodes, stats.pins, stats.exec_edges, stats.data_edges], [1, 30, 107, 18, 20]);
  assert.equal(bundle.graphs[0].name, 'HandleScriptFunction');
  assert.ok(bundle.graphs[0].warnings.every(w => w.code === 'external_macro'));
});
