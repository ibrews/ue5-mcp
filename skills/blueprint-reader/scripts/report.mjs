const inline = s => String(s).replace(/[\r\n]+/g, ' ').replace(/`/g, "'").replace(/\|/g, '\\|');
const code = s => '`' + inline(s) + '`';
const short = s => s.split(/[./:]/).at(-1);
const endpoint = (g, e) => {
  const n = g.nodes.find(n => n.id === e.node), p = n?.pins.find(p => p.id === e.pin);
  return `${e.node}.${p?.name || p?.id || e.pin}`;
};

export function statistics(bundle) {
  return { sources: bundle.sources.length, graphs: bundle.graphs.length,
    nodes: bundle.graphs.reduce((n, g) => n + g.nodes.length, 0),
    pins: bundle.graphs.reduce((n, g) => n + g.nodes.reduce((v, x) => v + x.pins.length, 0), 0),
    exec_edges: bundle.graphs.reduce((n, g) => n + g.edges.filter(e => e.kind === 'exec').length, 0),
    data_edges: bundle.graphs.reduce((n, g) => n + g.edges.filter(e => e.kind === 'data').length, 0),
    warnings: bundle.warnings.length + bundle.graphs.reduce((n, g) => n + g.warnings.length, 0) };
}

export function selectGraphs(bundle, selector) {
  if (!selector) return bundle.graphs;
  const graphs = bundle.graphs.filter(g => g.id === selector || g.name === selector || g.path === selector);
  if (!graphs.length) throw new Error(`No graph matches ${selector}. Use summary to list graph IDs.`);
  if (graphs.length > 1) throw new Error(`Graph name is ambiguous; choose one of: ${graphs.map(g => g.id).join(', ')}`);
  return graphs;
}

export function selectNode(graphs, selector) {
  const matches = graphs.flatMap(g => g.nodes.filter(n => n.id === selector || n.guid === selector).map(n => ({ graph: g, node: n })));
  if (matches.length !== 1) throw new Error(matches.length ? 'Node name is ambiguous; add --graph <id>.' : `Node not found: ${selector}`);
  return matches[0];
}

export function sliceEntry(graphs, selector) {
  const { graph, node } = selectNode(graphs, selector);
  const selected = new Set([node.id]), exec = [node.id];
  for (let i = 0; i < exec.length; i++) {
    for (const edge of graph.edges) if (edge.kind === 'exec' && edge.from.node === exec[i] && !selected.has(edge.to.node)) {
      selected.add(edge.to.node); exec.push(edge.to.node);
    }
  }
  // Include the data dependencies of this execution slice; pure nodes may form
  // cycles, and input data can originate outside the selected execution path.
  const pending = [...selected];
  for (let i = 0; i < pending.length; i++) for (const edge of graph.edges) {
    if (edge.kind === 'data' && edge.to.node === pending[i] && !selected.has(edge.from.node)) {
      selected.add(edge.from.node); pending.push(edge.from.node);
    }
  }
  return { ...graph, slice: { root: node.id, description: 'Execution successors and upstream data dependencies; custom calls and macros are not expanded.' },
    nodes: graph.nodes.filter(n => selected.has(n.id)), edges: graph.edges.filter(e => selected.has(e.from.node) && selected.has(e.to.node)),
    entries: graph.entries.filter(id => selected.has(id)) };
}

export function report(bundle, { graph, node, limit = 80, brief = false } = {}) {
  const graphs = selectGraphs(bundle, graph);
  if (node) { const selected = selectNode(graphs, node); return nodeReport(selected.graph, selected.node); }
  const stats = statistics({ ...bundle, graphs });
  const out = ['# Blueprint reader', '', `${stats.graphs} graphs · ${stats.nodes} nodes · ${stats.pins} pins · ${stats.exec_edges} execution wires · ${stats.data_edges} data wires · ${stats.warnings} warnings`, '',
    'Static graph evidence. External function bodies, runtime values and unexported assets are not inferred.', ''];
  for (const s of bundle.sources) out.push(`Source ${code(s.id)}: ${inline(s.title || s.name || 'stdin')} (${s.bytes} bytes, SHA-256 ${s.sha256})`);
  for (const g of graphs) {
    out.push('', `## ${inline(g.name)} [${g.id}]`, '', `${g.kind}; ${g.nodes.length} nodes; ${g.edges.length} wires.`,
      `Entries: ${g.entries.map(id => `${inline(g.nodes.find(n => n.id === id)?.title)} [${code(id)}]`).join(', ') || 'none identified (may be a fragment or data-only graph)'}.`);
    if (g.slice) out.push(`Slice from ${code(g.slice.root)}: ${g.slice.description}`);
    if (g.path) out.push(`Graph path: ${code(g.path)}`);
    const macros = g.nodes.filter(n => n.macro);
    for (const n of macros) out.push(`Macro ${code(n.id)} → ${code(n.macro.path)}: ${n.macro.graph_id ? `included as ${code(n.macro.graph_id)} (${n.macro.match})` : 'body not resolved in this input'}.`);
    if (g.warnings.length) {
      out.push('', 'Warnings:');
      for (const w of g.warnings.slice(0, limit)) out.push(`- ${code(w.code)}: ${inline(JSON.stringify(w))}`);
      if (g.warnings.length > limit) out.push(`- ${g.warnings.length - limit} more warnings; use JSON for the complete list.`);
    }
    if (brief) continue;
    out.push('', '### Nodes', '', '| ID | Operation / class | Inputs with defaults |', '|---|---|---|');
    for (const n of g.nodes.slice(0, limit)) {
      const defaults = n.pins.filter(p => p.direction === 'input' && !p.links.length && !p.hidden &&
        (p.default_value !== null || p.default_object || p.default_text)).map(p => `${p.name}=${p.default_value ?? p.default_object ?? p.default_text}`);
      out.push(`| ${code(n.id)} | ${inline(n.title)} (${short(n.class)})${n.comment ? ': ' + inline(n.comment) : ''} | ${inline(defaults.join('; ')).replace(/\|/g, '\\|')} |`);
    }
    if (g.nodes.length > limit) out.push('', `${g.nodes.length - limit} more nodes omitted; use --node or --limit.`);
    out.push('', '### Execution connections', '', 'These are exact wires, not a prediction of runtime scheduling. Output labels preserve branches, loop bodies/completion and asynchronous callbacks.', '');
    const exec = g.edges.filter(e => e.kind === 'exec');
    for (const e of exec.slice(0, limit)) out.push(`- ${code(endpoint(g, e.from))} → ${code(endpoint(g, e.to))}${e.reciprocal ? '' : ' [one-sided link]'}`);
    if (!exec.length) out.push('No execution wires in this export.');
    if (exec.length > limit) out.push(`- ${exec.length - limit} more execution wires; use --limit or --format json.`);
    out.push('', '### Data connections', '');
    const data = g.edges.filter(e => e.kind === 'data');
    for (const e of data.slice(0, limit)) out.push(`- ${code(endpoint(g, e.from))} → ${code(endpoint(g, e.to))}`);
    if (data.length > limit) out.push(`- ${data.length - limit} more data wires; use --node or --format json.`);
  }
  return out.join('\n') + '\n';
}

export function nodeReport(graph, node) {
  const out = [`# ${inline(node.title)} [${node.id}]`, '', `Graph: ${code(graph.id)} · class: ${code(node.class)} · GUID: ${code(node.guid)}`, '',
    '```json', JSON.stringify({ ...node, raw: undefined }, null, 2), '```', '', 'Connections:', ''];
  for (const e of graph.edges.filter(e => e.from.node === node.id || e.to.node === node.id)) out.push(`- ${e.kind}: ${code(endpoint(graph, e.from))} → ${code(endpoint(graph, e.to))}`);
  return out.join('\n') + '\n';
}

export function mermaid(bundle, selector) {
  const graphs = selectGraphs(bundle, selector), out = ['flowchart LR'], ids = new Map();
  let count = 0;
  const escape = s => inline(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '&#124;');
  for (const [i, g] of graphs.entries()) {
    out.push(`  subgraph G${i}["${escape(g.name)}"]`);
    for (const n of g.nodes) {
      const id = `N${count++}`; ids.set(`${g.id}/${n.id}`, id);
      out.push(`    ${id}["${escape(n.title)} — ${escape(n.id)}"]`);
    }
    for (const e of g.edges) {
      const from = ids.get(`${g.id}/${e.from.node}`), to = ids.get(`${g.id}/${e.to.node}`);
      const a = g.nodes.find(n => n.id === e.from.node).pins.find(p => p.id === e.from.pin);
      const b = g.nodes.find(n => n.id === e.to.node).pins.find(p => p.id === e.to.pin);
      out.push(`    ${from} ${e.kind === 'exec' ? '-->' : '-.->'}|"${escape(a.name)} → ${escape(b.name)}"| ${to}`);
    }
    out.push('  end');
  }
  return out.join('\n') + '\n';
}
