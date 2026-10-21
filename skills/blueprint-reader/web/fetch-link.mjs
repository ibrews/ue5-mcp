import { blueprintURL } from '../scripts/source-core.mjs';
import { FETCH_HELPER, HELPER_MAX_BYTES } from './config.mjs';

export async function fetchLinkedBlueprint(input, fetchImpl = globalThis.fetch) {
  const url = blueprintURL(input).href;
  const endpoint = new URL(FETCH_HELPER);
  endpoint.searchParams.set('url', url);
  try {
    // Send the URL only: no pasted graph, files, cookies, or referrer.
    const response = await fetchImpl(endpoint, { credentials: 'omit', referrerPolicy: 'no-referrer',
      redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(25000) });
    if (Number(response.headers.get('content-length')) > HELPER_MAX_BYTES) {
      await response.body?.cancel(); throw new Error('Export is too large for automatic import.');
    }
    const reader = response.body.getReader(), chunks = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > HELPER_MAX_BYTES) throw new Error('Export is too large for automatic import.');
        chunks.push(value);
      }
    } finally { await reader.cancel(); reader.releaseLock(); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error.slice(0, 500) : `Helper returned HTTP ${response.status}.`);
    if (typeof data.text !== 'string' || !data.text.trim()) throw new Error('Helper returned no Blueprint text.');
    const resolved = blueprintURL(data.source?.url).href;
    // Accept only same-export redirects; don't silently analyze an unrelated graph.
    if (new URL(resolved).pathname.split('/')[2] !== new URL(url).pathname.split('/')[2]) throw new Error('Helper returned a different Blueprint.');
    return { text: data.text, source: { kind: 'blueprintue', name: resolved, url: resolved,
      title: typeof data.source.title === 'string' ? data.source.title.slice(0, 2000) : undefined,
      ue_version: typeof data.source.ue_version === 'string' ? data.source.ue_version.slice(0, 100) : undefined } };
  } catch (error) {
    throw new Error(`Automatic import failed: ${error.message}. Use Open BlueprintUE → Copy → Use copied text instead.`);
  }
}
