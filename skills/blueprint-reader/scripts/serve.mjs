#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { isMainModule } from './entrypoint.mjs';
import { parseIsolated } from './read-blueprint.mjs';
import { mergeBundles, MAX_BYTES } from './parser.mjs';
import { fetchBlueprint } from './sources.mjs';
import { analyze, compactBrief } from './analysis.mjs';
import { sessionDocument } from './session.mjs';
import { flow } from './flow.mjs';
import { selectGraphs, sliceEntry, nodeReport, selectNode } from './report.mjs';

const assets = new Map([['/', ['index.html', 'text/html']], ['/app.css', ['app.css', 'text/css']], ['/app.js', ['app.js', 'text/javascript']], ['/local-app.js', ['local-app.js', 'text/javascript']]]);
assets.set('/source-input.js', ['source-input.js', 'text/javascript']);
assets.set('/native-input.js', ['native-input.js', 'text/javascript']);
for (const [file, type] of [['favicon.ico', 'image/x-icon'], ['favicon.svg', 'image/svg+xml'],
  ['favicon-32.png', 'image/png'], ['apple-touch-icon.png', 'image/png']]) {
  assets.set('/' + file, ['branding/' + file, type]);
}
export function createReaderServer() {
  // One local session at a time. Raw exports are never sent to an LLM or uploaded
  // to BlueprintUE. Restarting the server clears its in-memory session.
  let current = null, busy = false;
  return createServer(async (req, res) => {
    const origin = `http://127.0.0.1:${req.socket.localPort}`;
    const send = (status, body, type = 'application/json', extra = {}) => {
      res.writeHead(status, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'", ...extra });
      res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
    };
    try {
      if (req.headers.host !== `127.0.0.1:${req.socket.localPort}`) return send(403, { error: 'Use the printed 127.0.0.1 address.' });
      const url = new URL(req.url, origin);
      if (req.method === 'GET' && assets.has(url.pathname)) {
        const [file, type] = assets.get(url.pathname);
        return send(200, await readFile(new URL(`../assets/${file}`, import.meta.url)), type);
      }
      if (req.method === 'POST' && url.pathname === '/api/ingest') {
        if (req.headers.origin !== origin || !req.headers['content-type']?.startsWith('application/json')) return send(403, { error: 'Only same-origin JSON requests are accepted.' });
        if (busy) return send(429, { error: 'A Blueprint is being parsed. Try again when it finishes.' });
        busy = true;
        try {
          const chunks = []; let size = 0;
          for await (const chunk of req) { size += chunk.length; if (size > MAX_BYTES * 2) throw new Error('Upload is too large; split the input.'); chunks.push(chunk); }
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          const budget = body.budget ?? 8000;
          if (!Number.isInteger(budget) || budget < 2000 || budget > 64000) throw new Error('Invalid brief budget.');
          let sources = [];
          if (body.url) sources.push(await fetchBlueprint(body.url));
          if (body.text?.trim()) sources.push({ text: body.text, source: { name: 'Pasted Blueprint', kind: 'paste' } });
          if (body.files != null && !Array.isArray(body.files)) throw new Error('Invalid file input.');
          if ((body.files?.length || 0) > 100) throw new Error('At most 100 text files per session.');
          for (const file of body.files || []) {
            if (file.session) {
              if (file.session.kind !== 'blueprint-reader-session' || file.session.schema_version !== 1) throw new Error('Unsupported session file.');
              sources.push(...sessionDocument(file.session.sources).sources);
            } else sources.push({ text: file.text, source: { name: String(file.name).slice(0, 300), kind: 'file' } });
          }
          sources = sessionDocument(sources).sources;
          if (sources.some(s => s.text.startsWith('{\\rtf'))) throw new Error('Use a plain-text export here. On macOS the CLI can also convert RTF.');
          const bundles = [];
          for (const [i, source] of sources.entries()) bundles.push(await parseIsolated(source.text, { ...source.source, id: `s${i + 1}` }));
          const bundle = mergeBundles(bundles), analysis = analyze(bundle), brief = compactBrief(bundle, { budget, analysis });
          current = { id: randomUUID(), sources, bundle, analysis, brief };
          return send(200, { id: current.id, analysis, brief, brief_bytes: Buffer.byteLength(brief), source_bytes: bundle.sources.reduce((n, s) => n + s.bytes, 0) });
        } finally { busy = false; }
      }
      if (req.method === 'GET' && ['/api/download', '/api/inspect'].includes(url.pathname)) {
        if (!current || url.searchParams.get('id') !== current.id) return send(404, { error: 'Session expired or replaced. Analyze the source again.' });
        if (url.pathname === '/api/download') {
          const kind = url.searchParams.get('kind');
          const outputs = { brief: [current.brief, 'blueprint-brief.txt', 'text/plain'],
            session: [JSON.stringify(sessionDocument(current.sources)), 'blueprint.bp-session.json', 'application/json'],
            analysis: [JSON.stringify(current.analysis, null, 2), 'blueprint-analysis.json', 'application/json'] };
          if (!outputs[kind]) throw new Error('Unknown download format.');
          const [text, name, type] = outputs[kind];
          return send(200, text, type, { 'Content-Disposition': `attachment; filename="${name}"` });
        }
        let graphs = selectGraphs(current.bundle, url.searchParams.get('graph'));
        const entry = url.searchParams.get('entry'), node = url.searchParams.get('node');
        if (entry) graphs = [sliceEntry(graphs, entry)];
        let result;
        if (node) { const selected = selectNode(graphs, node); result = nodeReport(selected.graph, selected.node); }
        else result = flow({ ...current.bundle, graphs }, { limit: 60 });
        // Explicit drill-down can be larger than the brief, but cannot swamp a
        // browser/agent with an unbounded inline expression expansion.
        const cap = 60000;
        if (result.length > cap) result = result.slice(0, cap) + '\n[Display truncated. Inspect individual nodes or use CLI JSON.]';
        return send(200, { text: result });
      }
      return send(404, { error: 'Not found.' });
    } catch (error) { if (!res.headersSent) send(400, { error: error.message }); }
  });
}

if (isMainModule(import.meta.url)) {
  const port = Number(process.argv[2] ?? 0);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Supply a port number from 0 to 65535; 0 chooses an available port.');
  const server = createReaderServer();
  server.requestTimeout = 120000;
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Blueprint Reader: http://127.0.0.1:${server.address().port}\nLocal only. Press Ctrl+C to stop.`));
}
