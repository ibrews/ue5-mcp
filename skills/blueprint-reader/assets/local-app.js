import { startApp } from './app.js';
async function request(path, body) {
  const response = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
}
startApp({
  ingest: body => request('/api/ingest', body),
  inspect: params => request('/api/inspect?' + new URLSearchParams(params)),
  async download(kind, id) {
    const response = await fetch('/api/download?' + new URLSearchParams({ kind, id }));
    if (!response.ok) throw new Error((await response.json()).error);
    return { blob: await response.blob(), name: { brief: 'blueprint-brief.txt', session: 'blueprint.bp-session.json', analysis: 'blueprint-analysis.json' }[kind] };
  },
});
