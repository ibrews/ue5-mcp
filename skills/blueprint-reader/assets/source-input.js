// Fast input-shape checks for button readiness, not a second Blueprint parser.
// UEBlueprint still validates the full grammar when the user reads the graph.
export const INPUT_LIMIT = 32 * 1024 * 1024;
const bytes = text => new TextEncoder().encode(text).byteLength;

export function blueprintURL(input) {
  const url = new URL(input);
  if (url.protocol !== 'https:' || !['blueprintue.com', 'www.blueprintue.com'].includes(url.hostname) ||
      url.port || url.username || url.password || !/^\/(?:blueprint|render)\/[\w-]+\/?$/.test(url.pathname)) {
    throw new Error('Expected an HTTPS blueprintue.com/blueprint/<id>/ or /render/<id>/ URL.');
  }
  url.search = ''; url.hash = '';
  return url;
}

export function looksLikeBlueprint(text, depth = 0) {
  if (typeof text !== 'string' || !text.trim() || text.length > INPUT_LIMIT || depth > 8 ||
      text.includes('\0') || text.trimStart().startsWith('{\\rtf')) return false;
  // Function exports can wrap escaped clipboard text inside BPGraph NodesString.
  let wrapped = false;
  if (/^\s*BPGraph\s*\(/m.test(text)) {
    const values = [...text.matchAll(/\bNodesString="((?:\\.|[^"\\])*)"/g)];
    if (!values.length) return false;
    for (const [, value] of values) {
      const raw = value.replace(/\\([\\"'nrt])/g, (_, c) => ({ n: '\n', r: '\r', t: '\t' }[c] ?? c));
      if (!looksLikeBlueprint(raw, depth + 1)) return false;
    }
    wrapped = true;
  }
  let nesting = 0, objects = 0;
  for (const line of text.split(/\r\n?|\n/)) {
    if (/^\s*Begin Object(?:\s|$)/.test(line)) {
      if (nesting === 0 && (!/\bClass=(?:"[^"\r\n]+"|\S+)/.test(line) ||
          !/\bName=(?:"[^"\r\n]+"|\S+)/.test(line))) return false;
      if (++nesting > 128) return false;
    } else if (/^\s*End Object\s*$/.test(line)) {
      if (nesting === 0) return false;
      if (--nesting === 0) objects++;
    }
  }
  return nesting === 0 && (objects > 0 || wrapped);
}

export function inputProblem({ text = '', url = '', files = [] }) {
  if (url) {
    try { blueprintURL(url); }
    catch { return 'Enter a valid HTTPS BlueprintUE blueprint or render link.'; }
  }
  const sources = text.trim() ? [text] : [];
  if (files.length > 100) return 'Use at most 100 files totaling 32 MiB.';
  for (const file of files) {
    if (file.session) {
      const doc = file.session;
      if (doc.kind !== 'blueprint-reader-session' || doc.schema_version !== 1 ||
          !Array.isArray(doc.sources) || !doc.sources.length || doc.sources.length > 100) {
        return 'Choose a saved Blueprint Reader session or Blueprint text file.';
      }
      sources.push(...doc.sources.map(source => source?.text));
    } else sources.push(file.text);
  }
  if (!url && !sources.length) return 'Add Blueprint text, files or a BlueprintUE link to continue.';
  if (sources.some(source => !looksLikeBlueprint(source))) {
    return 'Use complete Blueprint clipboard text (Begin Object … End Object) or a saved session.';
  }
  if (sources.length > 100 || sources.reduce((n, text) => n + bytes(text), 0) > INPUT_LIMIT) {
    return 'Use at most 100 sources totaling 32 MiB.';
  }
  return null;
}
