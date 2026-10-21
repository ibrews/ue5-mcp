export function startApp(api) {
const $ = id => document.getElementById(id);
let mode = 'paste', result = null;
const bytes = n => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n / 1024) + ' KB';
function status(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
function setMode(value) {
  mode = value;
  $('paste-input').hidden = value !== 'paste' && !api.browser; $('link-input').hidden = value !== 'link';
  $('paste-mode').setAttribute('aria-pressed', value === 'paste'); $('link-mode').setAttribute('aria-pressed', value === 'link');
}
$('paste-mode').addEventListener('click', () => setMode('paste'));
$('link-mode').addEventListener('click', () => setMode('link'));
function fileStatus() {
  const files = [...$('source-files').files];
  $('file-status').textContent = files.length ? files.map(f => f.name).join(', ') : 'No files selected';
  $('clear-files').hidden = !files.length;
}
$('source-files').addEventListener('change', fileStatus);
$('clear-files').addEventListener('click', () => { $('source-files').value = ''; fileStatus(); });
function showView(view) {
  for (const button of document.querySelectorAll('[data-view]')) {
    const active = button.dataset.view === view;
    button.setAttribute('aria-pressed', active); $(button.dataset.view + '-view').hidden = !active;
  }
}
for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => showView(button.dataset.view));
function element(tag, text, className) { const el = document.createElement(tag); el.textContent = text; if (className) el.className = className; return el; }
function paragraph(title, text) { const p = element('p', ''); p.append(element('strong', title + ' '), document.createTextNode(text)); return p; }
function graphChanged() {
  $('entry-select').replaceChildren();
  const g = result.analysis.graphs.find(g => g.id === $('graph-select').value);
  for (const entry of (g?.entries || []).slice(0, 500)) {
    const option = element('option', entry.title + ' · ' + entry.id); option.value = entry.id; $('entry-select').append(option);
  }
  $('trace').disabled = !g?.entries.length;
  $('entry-note').textContent = g?.entries.length > 500 ? 'First 500 entries shown. Use the CLI or full JSON to select another entry by ID.' : '';
  if (!g?.entries.length) $('entry-select').append(element('option', 'No entry points identified'));
}
async function inspect(node) {
  const params = new URLSearchParams({ id: result.id, graph: $('graph-select').value });
  if (node) params.set('node', node); else params.set('entry', $('entry-select').value);
  $('trace-text').textContent = 'Tracing connections…';
  try {
    const data = await api.inspect(Object.fromEntries(params));
    $('trace-text').textContent = data.text;
  } catch (error) { $('trace-text').textContent = error.message; }
}
function render(data) {
  result = data; const analysis = data.analysis;
  $('results').hidden = false; $('empty').hidden = true; $('result-badge').textContent = 'STATIC ANALYSIS';
  $('stats').replaceChildren();
  for (const [key, name] of [['graphs', 'graphs'], ['nodes', 'nodes'], ['pins', 'pins'], ['warnings', 'context / link warnings']]) {
    const el = element('div', '', 'stat'); el.append(element('strong', String(analysis.stats[key])), element('span', name)); $('stats').append(el);
  }
  $('description').textContent = analysis.description;
  $('tip-count').textContent = String(analysis.findings.length);
  $('findings').replaceChildren();
  if (!analysis.findings.length) $('findings').append(element('p', 'No supported improvement patterns found. That is not a correctness verdict; trace the relevant entries and test them in Unreal.', 'hint'));
  for (const finding of analysis.findings.slice(0, 100)) {
    const card = element('article', '', 'finding');
    card.append(element('span', finding.level, 'level'), element('h3', finding.title), element('p', finding.detail), paragraph('Try:', finding.suggestion), paragraph('Verify:', finding.validation), element('p', finding.graph + ' / ' + finding.nodes.join(', '), 'evidence'));
    if (finding.nodes.length) { const button = element('button', 'Inspect evidence', 'button'); button.type = 'button'; button.addEventListener('click', () => {
      $('graph-select').value = finding.graph; graphChanged(); $('node-select').value = finding.nodes[0]; showView('explore'); inspect(finding.nodes[0]);
    }); card.append(button); }
    $('findings').append(card);
  }
  if (analysis.findings.length > 100) $('findings').append(element('p', 'Showing 100 findings; download JSON for the complete list.', 'hint'));
  $('dependencies').replaceChildren();
  const dependencies = [...analysis.dependencies].sort((a, b) => (a.kind === 'engine') - (b.kind === 'engine'));
  for (const item of dependencies.slice(0, 30)) { const p = element('p', '', 'dependency'); p.append(element('b', item.kind + ' · '), document.createTextNode(item.path + ' (' + item.calls + ' calls)')); $('dependencies').append(p); }
  if (!dependencies.length) $('dependencies').append(element('p', 'All referenced macro bodies in this export were resolved, or no macro calls were present. External function bodies and runtime values can still be missing.', 'hint'));
  if (dependencies.length > 30) $('dependencies').append(element('p', `${dependencies.length - 30} more dependencies in the full analysis.`, 'hint'));
  $('brief-text').textContent = data.brief;
  $('brief-size').textContent = `${bytes(data.source_bytes)} of source → ${bytes(data.brief_bytes)} of brief. Byte counts are not token counts. The brief summarizes and omits detail; the full source remains available.`;

  $('graph-select').replaceChildren();
  for (const g of analysis.graphs) { const option = element('option', `${g.name} · ${g.id} · ${g.nodes} nodes`); option.value = g.id; $('graph-select').append(option); }
  graphChanged(); showView('tips'); $('trace-text').textContent = 'Select an entry or a node to inspect its connections.';
}
$('ingest-form').addEventListener('submit', async event => {
  event.preventDefault(); $('analyze').disabled = true; status('Reading the graph and checking connections…');
  try {
    const chosen = [...$('source-files').files];
    if (chosen.length > 100 || chosen.reduce((n, f) => n + f.size, 0) > 32 * 1024 * 1024) throw new Error('Use at most 100 files totaling 32 MiB; split larger inputs.');
    const files = [];
    for (const file of $('source-files').files) {
      if (file.size > 32 * 1024 * 1024) throw new Error('A file exceeds 32 MiB. Split it by graph.');
      const raw = new Uint8Array(await file.arrayBuffer());
      const encoding = raw[0] === 255 && raw[1] === 254 ? 'utf-16le' : raw[0] === 254 && raw[1] === 255 ? 'utf-16be' : 'utf-8';
      const text = new TextDecoder(encoding, { fatal: true }).decode(raw);
      if (file.name.endsWith('.json')) files.push({ session: JSON.parse(text) }); else files.push({ name: file.name, text });
    }
    const body = { budget: Number($('budget').value), files, text: mode === 'paste' || api.browser ? $('source-text').value : '', url: mode === 'link' ? $('source-url').value.trim() : '' };
    const data = await api.ingest(body);
    render(data); status('Ready. Save the session for follow-up questions; copy only the brief into chat.');
  } catch (error) { status(error.message, true); } finally { $('analyze').disabled = false; }
});
$('copy-brief').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(result.brief); $('copy-brief').textContent = 'Copied'; setTimeout(() => { $('copy-brief').textContent = 'Copy AI brief'; }, 1800); }
  catch { status('Clipboard access was denied. Use Save brief, or select the brief text to copy it.', true); }
});
$('graph-select').addEventListener('change', graphChanged);
$('trace').addEventListener('click', () => inspect());
$('inspect').addEventListener('click', () => { if ($('node-select').value.trim()) inspect($('node-select').value.trim()); });

for (const kind of ['brief', 'session', 'analysis']) $('download-' + kind).addEventListener('click', async event => {
  event.preventDefault();
  try {
    const file = await api.download(kind, result.id);
    const url = URL.createObjectURL(file.blob), link = document.createElement('a');
    link.href = url; link.download = file.name; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) { status(error.message, true); }
});
}
