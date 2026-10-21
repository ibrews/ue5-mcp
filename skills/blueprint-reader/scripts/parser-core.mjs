import { byteLength } from './text.mjs';
import ObjectEntity from 'ueblueprint/js/entity/ObjectEntity.js';
import initializeSerializerFactory from 'ueblueprint/js/serialization/initializeSerializerFactory.js';

initializeSerializerFactory();
export const MAX_BYTES = 32 * 1024 * 1024;
const str = x => x == null ? '' : String(x);
const ref = x => x?.path || x?.type || '';
const yes = x => str(x?.value ?? x).toLowerCase() === 'true';
const short = x => x.split(/[./:]/).at(-1);

// Used for document wrappers and exact literal preservation. Node syntax is parsed
// by UEBlueprint, not by regex. Keep quoted commas and nested values intact.
export function fields(text) {
  const result = Object.create(null);
  let start = 0, quote = '', depth = 0;
  const add = end => {
    const s = text.slice(start, end).trim(), eq = s.indexOf('=');
    if (eq > 0) result[s.slice(0, eq).trim()] = s.slice(eq + 1).trim();
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) { add(i); start = i + 1; }
  }
  add(text.length);
  return result;
}

export function unquote(s = '') {
  if (!s.startsWith('"') || !s.endsWith('"')) return s;
  return s.slice(1, -1).replace(/\\([\\"'nrt])/g, (_, c) => ({ n: '\n', r: '\r', t: '\t' }[c] ?? c));
}

function checkInput(text) {
  if (byteLength(text) > MAX_BYTES) throw new Error('Input exceeds the 32 MiB limit; split the document by graph.');
  if (text.includes('\0')) throw new Error('Binary input is unsupported. Supply Blueprint clipboard text, not a .uasset.');
  // UEBlueprint assigns parsed property keys onto objects. Reject unsafe property
  // segments before entering its grammar; quoted string contents remain data.
  let outside = '', quote = '', depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; outside += ' '; }
    else if (c === '"' || c === "'") { quote = c; outside += ' '; }
    else {
      outside += c;
      if (c === '(' && ++depth > 128) throw new Error('Nesting exceeds 128 levels.');
      if (c === ')') depth--;
    }
  }
  if (/(?:^|[\s,(.])(?:__proto__|prototype|constructor)\s*(?:[=.([)]|$)/m.test(outside)) {
    throw new Error('Unsafe object property name in input.');
  }
}

function labelFromLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('```') || /^[-=*_]{3,}$/.test(trimmed)) return null;
  return trimmed.replace(/^#+\s*/, '').replace(/^(?:macro|function|graph|event graph)\s*:\s*/i, '').trim();
}

// Documents may concatenate exports under headings or contain whole-function
// BPGraph wrappers. A scope is never inferred from a repeated PinId.
export function extractBlocks(text, defaultLabel = 'Clipboard') {
  checkInput(text);
  const lines = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [], warnings = [];
  let start = -1, depth = 0, label = defaultLabel, section = 0, intervening = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (start < 0 && /^\s*BPGraph\s*\(/.test(line)) {
      let wrapper = line.trim(), end = i;
      while (!/\)\s*$/.test(wrapper) && ++end < lines.length) wrapper += '\n' + lines[end];
      if (end >= lines.length) throw new Error(`Unterminated BPGraph wrapper at line ${i + 1}.`);
      const f = fields(wrapper.slice(wrapper.indexOf('(') + 1, wrapper.lastIndexOf(')')));
      if (!f.NodesString) throw new Error(`BPGraph at line ${i + 1} has no NodesString.`);
      const nested = extractBlocks(unquote(f.NodesString), unquote(f.GraphName) || label);
      section++;
      for (const b of nested.blocks) blocks.push({ ...b, section, wrapper_line: i + 1,
        label: unquote(f.GraphName) || label, wrapper: { graph_type: f.GraphType, original_blueprint: unquote(f.OriginalBlueprint) } });
      warnings.push(...nested.warnings);
      i = end; intervening = true; continue;
    }
    if (/^\s*Begin Object(?:\s|$)/.test(line)) {
      if (depth++ === 0) { start = i; if (intervening) section++; intervening = false; }
      if (depth > 128) throw new Error('Object nesting exceeds 128 levels.');
    } else if (/^\s*End Object\s*$/.test(line)) {
      if (depth === 0) throw new Error(`Unexpected End Object at line ${i + 1}.`);
      if (--depth === 0) {
        blocks.push({ raw: lines.slice(start, i + 1).join('\n'), line: start + 1, end_line: i + 1, label, section });
        start = -1;
      }
    } else if (start < 0) {
      const next = labelFromLine(line);
      if (next) { label = next.slice(0, 300); intervening = true; }
      if (/^\s*(CustomProperties|NodeGuid|FunctionReference)\b/.test(line)) {
        throw new Error(`Orphan Blueprint property at line ${i + 1}; an object boundary may be missing.`);
      }
    }
    if (blocks.length > 20000) throw new Error('More than 20,000 objects; split the input by graph.');
  }
  if (depth) throw new Error(`Unterminated Begin Object at line ${start + 1}.`);
  if (!blocks.length) throw new Error('No Blueprint objects found. Expected Begin Object … End Object or BPGraph(...).');
  return { blocks, warnings };
}

function pinReference(x) { return x ? { node: str(x.objectName), pin: str(x.pinGuid) } : null; }
function nodeFromEntity(e, block) {
  const rawPins = new Map();
  for (const line of block.raw.split('\n')) {
    const match = line.match(/^\s*CustomProperties\s+Pin\s*\((.*)\)\s*$/);
    if (match) { const f = fields(match[1]); rawPins.set(f.PinId, f); }
  }
  const properties = Object.create(null);
  for (const line of block.raw.split('\n')) {
    const m = line.match(/^\s*([\w.]+(?:\(\d+\))?)=(.*)$/);
    if (m) properties[m[1]] = m[2];
  }
  const customProperties = e.CustomProperties?.values ?? [];
  const pins = customProperties.filter(p => p.lookbehind === 'Pin').map(p => {
    const id = str(p.PinId), original = rawPins.get(id) ?? {};
    return {
      id, name: str(p.PinName), direction: str(p.Direction) === 'EGPD_Output' ? 'output' : 'input',
      type: { category: str(p.PinType?.PinCategory), subcategory: str(p.PinType?.PinSubCategory),
        object: ref(p.PinType?.PinSubCategoryObject), container: str(p.PinType?.ContainerType) || 'None',
        reference: yes(p.PinType?.bIsReference), const: yes(p.PinType?.bIsConst) },
      // Preserve exact values as text, including int64 and localized text expressions.
      default_value: original.DefaultValue == null ? null : unquote(original.DefaultValue),
      default_object: ref(p.DefaultObject) || null,
      default_text: original.DefaultTextValue ?? null,
      hidden: yes(p.bHidden), orphaned: yes(p.bOrphanedPin),
      links: (p.LinkedTo?.values ?? []).map(pinReference),
      parent_pin: pinReference(p.ParentPin), sub_pins: (p.SubPins?.values ?? []).map(pinReference),
    };
  });
  const cls = e.getClass();
  const fn = str(e.FunctionReference?.MemberName || e.EventReference?.MemberName || e.CustomFunctionName);
  const variable = str(e.VariableReference?.MemberName);
  const macroPath = ref(e.MacroGraphReference?.MacroGraph);
  const input = str(e.InputKey || e.InputActionName || e.InputAxisName) || ref(e.InputAction);
  const modifiers = ['Control', 'Shift', 'Alt', 'Command'].filter(m => yes(e[`b${m}`])).join('+');
  return {
    id: str(e.Name), guid: str(e.NodeGuid), class: cls,
    title: str(e.NodeTitle) || fn || variable || (input ? [modifiers, input].filter(Boolean).join('+') : '') || (macroPath ? short(macroPath) : '') || short(cls),
    function: fn || null, function_owner: ref(e.FunctionReference?.MemberParent || e.EventReference?.MemberParent) || null,
    variable: variable || null, variable_scope: str(e.VariableReference?.MemberScope) || null,
    macro: macroPath ? { path: macroPath, blueprint: ref(e.MacroGraphReference?.GraphBlueprint), name: short(macroPath), graph_id: null } : null,
    comment: str(e.NodeComment), pure: yes(e.bIsPureFunc) || yes(e.bDefaultsToPureFunc),
    position: { x: Number(str(e.NodePosX) || 0), y: Number(str(e.NodePosY) || 0) },
    export_path: ref(e.ExportPath?.valueOf?.() ?? e.ExportPath),
    source: { line: block.line, end_line: block.end_line, ...(block.wrapper_line ? { wrapper_line: block.wrapper_line } : {}) },
    pins, properties,
    user_defined_pins: customProperties.filter(p => p.lookbehind === 'UserDefinedPin').map(p => ({
      name: str(p.PinName), direction: str(p.DesiredPinDirection), default_value: str(p.PinDefaultValue),
      type: { category: str(p.PinType?.PinCategory), object: ref(p.PinType?.PinSubCategoryObject) },
    })),
    raw: block.raw,
  };
}

function graphIdentity(node, block) {
  const path = node.export_path;
  const colon = path.lastIndexOf(':');
  if (colon >= 0) {
    const dot = path.lastIndexOf('.');
    if (dot > colon) return { path: path.slice(0, dot), name: path.slice(colon + 1, dot), owner: path.slice(0, colon) };
  }
  return { path: null, name: block.label, owner: null };
}

const endpointKey = p => JSON.stringify([p.node, p.pin]);
export function connectGraph(graph) {
  const index = new Map(), edges = new Map(), names = new Set();
  const warn = (code, detail) => graph.warnings.push({ code, ...detail });
  for (const n of graph.nodes) {
    if (names.has(n.id)) throw new Error(`Duplicate node name ${n.id} in ${graph.name}. Separate exports with graph headings.`);
    names.add(n.id);
    for (const p of n.pins) {
      if (!p.id) throw new Error(`Missing PinId on ${n.id}.`);
      const key = endpointKey({ node: n.id, pin: p.id });
      if (index.has(key)) throw new Error(`Duplicate pin ${p.id} within ${n.id}.`);
      index.set(key, { node: n, pin: p });
      if (p.orphaned) warn('orphaned_pin', { node: n.id, pin: p.id });
    }
  }
  for (const n of graph.nodes) for (const p of n.pins) for (const target of p.links) {
    const source = { node: n.id, pin: p.id }, other = index.get(endpointKey(target));
    if (!other) { warn('missing_link_target', { from: source, to: target }); continue; }
    if (p.direction === other.pin.direction) { warn('same_direction_link', { from: source, to: target }); continue; }
    const from = p.direction === 'output' ? source : target, to = p.direction === 'output' ? target : source;
    const key = JSON.stringify([from.node, from.pin, to.node, to.pin]);
    const reciprocal = other.pin.links.some(l => l.node === n.id && l.pin === p.id);
    const kind = p.type.category === 'exec' ? 'exec' : 'data';
    if ((p.type.category === 'exec') !== (other.pin.type.category === 'exec')) warn('exec_data_mismatch', { from, to });
    if (!edges.has(key)) {
      edges.set(key, { from, to, kind, reciprocal });
      if (!reciprocal) warn('nonreciprocal_link', { from, to });
    }
  }
  graph.edges = [...edges.values()];
  graph.entries = graph.nodes.filter(n => /K2Node_(?:.*Event|FunctionEntry|InputKey|InputAction|EnhancedInputAction|InputTouch)$/.test(short(n.class)) ||
    /K2Node_Tunnel$/.test(n.class) && n.pins.some(p => p.direction === 'output' && p.type.category === 'exec')).map(n => n.id);
  graph.kind = graph.nodes.some(n => /K2Node_Tunnel$/.test(n.class)) ? 'macro' :
    graph.nodes.some(n => /K2Node_FunctionEntry$/.test(n.class)) ? 'function' : 'graph';
  if (graph.kind === 'function' && graph.name === 'Clipboard') {
    graph.name = graph.nodes.find(n => /K2Node_FunctionEntry$/.test(n.class))?.function || graph.name;
  }
  return graph;
}

export function resolveMacros(bundle) {
  for (const graph of bundle.graphs) for (const node of graph.nodes) if (node.macro) {
    const absolute = !node.macro.path.includes(':') && !node.macro.path.includes('/') && (node.macro.blueprint || graph.owner)
      ? `${node.macro.blueprint || graph.owner}:${node.macro.path}` : node.macro.path;
    let candidates = bundle.graphs.filter(g => g.path && g.path === absolute);
    let match = absolute === node.macro.path ? 'exact_path' : 'relative_path';
    if (!candidates.length) {
      candidates = bundle.graphs.filter(g => g.kind === 'macro' && !g.path && g.name === node.macro.name);
      match = 'unique_name';
    }
    if (candidates.length === 1) node.macro = { ...node.macro, graph_id: candidates[0].id, match };
    else graph.warnings.push({ code: candidates.length ? 'ambiguous_macro' : 'external_macro', node: node.id, path: node.macro.path });
  }
  return bundle;
}

export function parseTextWithDigest(text, source, digest) {
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error('A SHA-256 source digest is required.');
  const { blocks, warnings } = extractBlocks(text);
  const groups = new Map();
  for (const block of blocks) {
    let entity;
    try { entity = ObjectEntity.grammar.parse(block.raw.trim()); }
    catch (error) { throw new Error(`UEBlueprint could not parse object at line ${block.wrapper_line ?? block.line}: ${String(error.message).slice(0, 600)}`); }
    const node = nodeFromEntity(entity, block), identity = graphIdentity(node, block);
    const key = identity.path || `section:${block.section}`;
    if (!groups.has(key)) groups.set(key, { ...identity, nodes: [], warnings: [] });
    groups.get(key).nodes.push(node);
  }
  const id = source.id || 's1';
  const graphs = [...groups.values()].map((g, i) => connectGraph({ ...g, id: `${id}:g${i + 1}`, source_id: id }));
  return { schema_version: 1, parser: 'ueblueprint@3.0.0', sources: [{ ...source, id, sha256: digest, bytes: byteLength(text) }], graphs, warnings };
}

export function mergeBundles(bundles) {
  return resolveMacros({ schema_version: 1, parser: 'ueblueprint@3.0.0', sources: bundles.flatMap(b => b.sources),
    graphs: bundles.flatMap(b => b.graphs), warnings: bundles.flatMap(b => b.warnings) });
}
