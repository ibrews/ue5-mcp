import { parseTextWithDigest, mergeBundles } from '../scripts/parser-core.mjs';
import { sessionDocument } from '../scripts/session-core.mjs';
import { blueprintURL } from '../scripts/source-core.mjs';
import { byteLength, utf8 } from '../scripts/text.mjs';
import { analyze, compactBrief } from '../scripts/analysis.mjs';
import { selectGraphs, sliceEntry, selectNode, nodeReport } from '../scripts/report.mjs';
import { flow } from '../scripts/flow.mjs';

export class BrowserReader {
  current = null;
  async ingest(body) {
    const budget = body.budget ?? 8000;
    if (!Number.isInteger(budget) || budget < 2000 || budget > 64000) throw new Error('Invalid brief budget.');
    let sources = [];
    if (body.url) {
      const url = blueprintURL(body.url).href;
      if (!body.text?.trim()) throw new Error('Open the BlueprintUE link, use Copy on that page, then paste its Blueprint text below. BlueprintUE does not permit direct browser imports.');
      sources.push({ text: body.text, source: { kind: 'blueprintue', name: 'Copied BlueprintUE export', url } });
    } else if (body.text?.trim()) sources.push({ text: body.text, source: { kind: 'paste', name: 'Pasted Blueprint' } });
    if (body.files != null && !Array.isArray(body.files)) throw new Error('Invalid file input.');
    if ((body.files?.length || 0) > 100) throw new Error('At most 100 files per session.');
    for (const file of body.files || []) {
      if (file.session) {
        if (file.session.kind !== 'blueprint-reader-session' || file.session.schema_version !== 1) throw new Error('Unsupported session file.');
        sources.push(...sessionDocument(file.session.sources).sources);
      } else sources.push({ text: file.text, source: { name: String(file.name).slice(0, 300), kind: 'file' } });
    }
    sources = sessionDocument(sources).sources;
    const bundles = [];
    for (const [i, source] of sources.entries()) {
      if (source.text.startsWith('{\\rtf')) throw new Error('Save RTF documents as plain text before using the browser reader.');
      const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', utf8(source.text)))].map(x => x.toString(16).padStart(2, '0')).join('');
      bundles.push(parseTextWithDigest(source.text, { ...source.source, id: `s${i + 1}` }, digest));
    }
    const bundle = mergeBundles(bundles), analysis = analyze(bundle), brief = compactBrief(bundle, { budget, analysis });
    const id = crypto.randomUUID();
    this.current = { id, sources, bundle, analysis, brief };
    return { id, analysis, brief, brief_bytes: byteLength(brief), source_bytes: bundle.sources.reduce((n, s) => n + s.bytes, 0) };
  }
  get(id) {
    if (!this.current || id !== this.current.id) throw new Error('Session expired or replaced. Read the source again.');
    return this.current;
  }
  inspect({ id, graph, entry, node }) {
    const current = this.get(id);
    let graphs = selectGraphs(current.bundle, graph);
    if (entry) graphs = [sliceEntry(graphs, entry)];
    let text;
    if (node) { const selected = selectNode(graphs, node); text = nodeReport(selected.graph, selected.node); }
    else text = flow({ ...current.bundle, graphs }, { limit: 60 });
    if (text.length > 60000) text = text.slice(0, 60000) + '\n[Display truncated. Inspect individual nodes.]';
    return { text };
  }
  download({ id, kind }) {
    const current = this.get(id);
    const formats = {
      brief: [current.brief, 'blueprint-brief.txt', 'text/plain'],
      session: [JSON.stringify(sessionDocument(current.sources)), 'blueprint.bp-session.json', 'application/json'],
      analysis: [JSON.stringify(current.analysis, null, 2), 'blueprint-analysis.json', 'application/json'],
    };
    if (!Object.hasOwn(formats, kind)) throw new Error('Unknown download format.');
    const [text, name, type] = formats[kind]; return { text, name, type };
  }
}
