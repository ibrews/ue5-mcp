import { nativeDump } from '../assets/native-input.js';

export function nativeGraphs(text) {
  const dump = nativeDump(text), modern = dump.reader_schema_version === 1;
  const warnings = [{ code: 'native_graph_scope', message:
    'Native JSON describes loaded editor graphs, not a verified saved .uasset. Collapsed subgraphs and external bodies may be absent. Raw node output is JSON, not pasteable Blueprint code.' }];
  if (!modern) warnings.push({ code: 'legacy_native_dump', message:
    'Legacy dump: hidden pins, pin GUIDs, exact function/macro metadata and some defaults/types are absent. Pin identities are local substitutes; descriptions and checks are incomplete.' });
  if (dump.package_dirty) warnings.push({ code: 'unsaved_native_asset', message: 'The editor asset has unsaved changes.' });
  if (dump._meta) warnings.push({ code: 'native_export_metadata', message:
    `Exporter metadata: ${JSON.stringify(dump._meta).slice(0, 500)}. Confidence is not a compile or parity test.`, metadata: dump._meta });
  if (dump.compilation_status && dump.compilation_status !== 'up_to_date') warnings.push({ code: 'native_compile_status', message: `Exporter compilation status: ${dump.compilation_status}.` });
  const graphs = dump.graphs.map(g => {
    const graphWarnings = [];
    if (g.child_graph_count) graphWarnings.push({ code: 'unexpanded_native_subgraphs', count: g.child_graph_count });
    const pinId = p => p.pin_id ?? JSON.stringify([p.direction, p.internal_name ?? p.name]);
    const nodesById = new Map(g.nodes.map(n => [n.node_id, n]));
    const graph = { name: g.name, path: g.path || null, owner: g.path?.split(':')[0] || dump.blueprint_path, warnings: graphWarnings,
      native_connection_count: g.connection_count ?? null,
      nodes: g.nodes.map(n => ({
        id: n.node_id, guid: n.node_id.replaceAll('-', ''), class: n.node_class, title: n.node_title || n.node_class,
        function: n.function_name ?? null, function_owner: n.function_owner ?? null,
        variable: n.variable_name ?? null, variable_scope: n.variable_scope ?? null,
        macro: n.macro_path ? { path: n.macro_path, name: n.macro_path.split(':').at(-1), blueprint: n.macro_path.split(':')[0], graph_id: null } : null,
        comment: n.comment || '', pure: n.is_pure ?? null, position: { x: n.x ?? null, y: n.y ?? null },
        export_path: n.node_path || null, source: { format: 'ecabridge-json', graph: g.name },
        properties: {}, user_defined_pins: [], raw: JSON.stringify(n, null, 2),
        pins: n.pins.map(p => ({
          id: pinId(p), name: p.internal_name ?? p.name, direction: p.direction.toLowerCase(),
          type: { category: p.type, subcategory: p.sub_type || '', object: p.sub_type_object ?? null,
            container: p.container ?? (modern ? 'None' : null), reference: p.is_reference ?? null, const: p.is_const ?? null },
          default_value: p.default_value ?? null, default_object: p.default_object ?? null, default_text: p.default_text ?? null,
          hidden: p.is_hidden ?? false, orphaned: p.is_orphaned ?? false,
          parent_pin: p.parent_pin_id ? { node: n.node_id, pin: p.parent_pin_id } : null,
          sub_pins: (p.sub_pin_ids || []).map(pin => ({ node: n.node_id, pin })),
          links: (p.connected_to || []).flatMap(link => {
            if (link.pin_id) return [{ node: link.node_id, pin: link.pin_id }];
            const candidates = (nodesById.get(link.node_id)?.pins || []).filter(q =>
              (q.internal_name ?? q.name) === link.pin_name && q.direction !== p.direction);
            if (candidates.length !== 1) {
              graphWarnings.push({ code: 'unresolved_native_link', node: n.node_id, pin: pinId(p), target: link });
              return [];
            }
            return [{ node: link.node_id, pin: pinId(candidates[0]) }];
          })
        }))
      })) };
    return graph;
  });
  return { graphs, warnings, dump };
}
