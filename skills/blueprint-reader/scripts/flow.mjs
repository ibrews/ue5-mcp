import { selectGraphs } from './report.mjs';

// Expression rendering and entry/input labels adapt the useful interface of
// AgileLens/agile-lens-kb scripts/bp-t3d/bpt3d.py (d87391c42a). Execution stays
// explicit adjacency: latent callbacks and branches are never flattened.
export function flow(bundle, { graph, limit = 80 } = {}) {
  const out = ['Static flow: labels are exact output pins; lines are not a runtime schedule.',
    'Expressions abbreviate upstream pure data. External calls/macros are not expanded.'];
  for (const g of selectGraphs(bundle, graph)) {
    const nodes = new Map(g.nodes.map(n => [n.id, n]));
    const incoming = new Map(), outgoing = new Map();
    for (const e of g.edges) {
      if (e.kind === 'data') {
        const k = `${e.to.node}/${e.to.pin}`;
        incoming.set(k, [...(incoming.get(k) || []), e]);
      } else outgoing.set(e.from.node, [...(outgoing.get(e.from.node) || []), e]);
    }
    function input(n, p, depth, seen) {
      const edges = incoming.get(`${n.id}/${p.id}`) || [];
      if (edges.length) return edges.map(e => expression(e.from, depth, seen)).join(' | ');
      return p.default_text ?? p.default_object ?? (p.default_value === null ? '<unset>' : JSON.stringify(p.default_value));
    }
    function args(n, depth, seen) {
      return n.pins.filter(p => p.direction === 'input' && p.type.category !== 'exec' && (!p.hidden || p.links.length))
        .map(p => `${p.name}=${input(n, p, depth, seen)}`).join(', ');
    }
    function expression(e, depth = 0, seen = new Set()) {
      const n = nodes.get(e.node), p = n?.pins.find(p => p.id === e.pin), key = `${e.node}/${e.pin}`;
      if (!n || !p) return `[missing ${key}]`;
      if (depth >= 6 || seen.has(key)) return `[${n.id}].${p.name}`;
      const next = new Set([...seen, key]);
      if (/K2Node_Knot$/.test(n.class)) {
        const pin = n.pins.find(p => p.direction === 'input');
        return pin ? input(n, pin, depth + 1, next) : `[${n.id}].${p.name}`;
      }
      if (/K2Node_VariableGet$/.test(n.class)) {
        const target = n.pins.find(p => p.name === 'self' && p.links.length);
        return `${target ? input(n, target, depth + 1, next) + '.' : ''}${n.variable || p.name}[${n.id}]`;
      }
      if (/K2Node_Self$/.test(n.class)) return 'self';
      if (n.pure || !n.pins.some(p => p.type.category === 'exec'))
        return `${n.title}[${n.id}](${args(n, depth + 1, next)}).${p.name}`;
      return `[${n.id}].${p.name}`;
    }
    out.push('', `${g.name} [${g.id}]${g.slice ? ` — slice ${g.slice.root}` : ''}`);
    const selected = g.nodes.filter(n => g.entries.includes(n.id) || n.pins.some(p => p.type.category === 'exec'));
    for (const n of selected.slice(0, limit)) {
      const operation = /K2Node_VariableSet$/.test(n.class) ? `Set ${n.title}` : n.title;
      out.push(`[${n.id}] ${operation}(${args(n, 0, new Set())})${g.entries.includes(n.id) ? ' [entry]' : ''}`);
      const edges = outgoing.get(n.id) || [];
      for (const e of edges) out.push(`  ${n.pins.find(p => p.id === e.from.pin)?.name} -> [${e.to.node}].${nodes.get(e.to.node)?.pins.find(p => p.id === e.to.pin)?.name}${e.reciprocal ? '' : ' [one-sided]'}`);
      if (!edges.length) out.push('  [no execution successor in this export]');
    }
    if (selected.length > limit) out.push(`${selected.length - limit} more execution nodes omitted; increase --limit or select --entry.`);
    if (!selected.length) for (const n of g.nodes.slice(0, limit)) out.push(`[${n.id}] ${n.title}(${args(n, 0, new Set())})`);
    if (g.warnings.length) out.push(`Warnings: ${g.warnings.length}; inspect --brief or JSON before drawing conclusions.`);
  }
  return out.join('\n') + '\n';
}
