// Shared intake contract for native dump_blueprint_graph JSON. This is data,
// never executable code or Blueprint clipboard text to paste back into Unreal.
const object = x => x && typeof x === 'object' && !Array.isArray(x);
const string = x => typeof x === 'string' && x.length > 0;
const guid = x => string(x) && /^[a-f0-9]{32}$/i.test(x.replaceAll('-', '')) && !/^0+$/.test(x.replaceAll('-', ''));
function require(condition, message) { if (!condition) throw new Error(`Native graph JSON: ${message}`); }
function complete(value) {
  require(object(value), 'expected an object.');
  require(!value.isError && !value.error && value.success !== false, 'the tool returned an error.');
  require(!value.truncated && !value._truncated && !value._continuation_token &&
    !value.continuation_token && !value._meta?.continuation_token,
  'response is incomplete; retrieve and reassemble every continuation chunk first.');
}
export function nativeDump(text) {
  let value = JSON.parse(text);
  for (let depth = 0; depth < 4; depth++) {
    complete(value);
    if (Array.isArray(value.graphs)) break;
    if (object(value.structuredContent)) value = value.structuredContent;
    else if (object(value.result)) value = value.result; // JSON-RPC envelope
    else if (Array.isArray(value.content)) {
      const blocks = value.content.filter(x => x.type === 'text');
      require(blocks.length === 1, 'expected one complete JSON text block.');
      value = JSON.parse(blocks[0].text);
    } else break;
  }
  complete(value);
  require(string(value.blueprint_path) && Array.isArray(value.graphs) && value.graphs.length > 0,
    'expected a dump_blueprint_graph result with blueprint_path and graphs.');
  require(value.reader_schema_version === undefined || value.reader_schema_version === 1,
    'unsupported reader_schema_version.');
  const modern = value.reader_schema_version === 1;
  for (const g of value.graphs) {
    require(object(g) && string(g.name) && Array.isArray(g.nodes), 'invalid graph.');
    if (g.node_count !== undefined) require(g.node_count === g.nodes.length, 'node_count mismatch.');
    const nodes = new Set();
    for (const n of g.nodes) {
      require(object(n) && string(n.node_id) && string(n.node_class) && Array.isArray(n.pins), 'invalid node.');
      require(!nodes.has(n.node_id), 'duplicate node_id; cannot resolve links safely.'); nodes.add(n.node_id);
      require(!modern || guid(n.node_id), 'version 1 requires a valid node GUID; inspect invalid IDs in the editor.');
      const pins = new Set();
      for (const p of n.pins) {
        require(object(p) && typeof p.name === 'string' && ['Input', 'Output'].includes(p.direction) &&
          typeof p.type === 'string', 'invalid pin.');
        require(!modern || guid(p.pin_id), 'version 1 requires a valid pin_id.');
        for (const key of ['default_value', 'default_object', 'default_text', 'internal_name'])
          require(p[key] === undefined || typeof p[key] === 'string', `${key} must preserve text exactly.`);
        const key = p.pin_id ?? JSON.stringify([p.direction, p.internal_name ?? p.name]);
        require(!pins.has(key), 'ambiguous/duplicate pin identity.'); pins.add(key);
        require(p.connected_to === undefined || Array.isArray(p.connected_to), 'invalid connected_to.');
        for (const link of p.connected_to || []) require(object(link) && string(link.node_id) &&
          (modern ? string(link.pin_id) : typeof link.pin_name === 'string'), 'invalid link endpoint.');
      }
    }
  }
  return value;
}

export function fileInput(name, text) {
  if (name.toLowerCase().endsWith('.json')) {
    const doc = JSON.parse(text);
    if (doc.kind === 'blueprint-reader-session') return { session: doc };
  }
  return { name, text };
}
