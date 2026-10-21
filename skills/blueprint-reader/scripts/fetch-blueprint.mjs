import { blueprintURL, extractHTML } from './source-core.mjs';
export const MAX_BYTES = 32 * 1024 * 1024;

function concatBytes(chunks, size) {
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

export async function fetchBlueprint(input, fetchImpl = fetch) {
  let url = blueprintURL(input);
  const signal = AbortSignal.timeout(20000);
  for (let hop = 0; hop < 5; hop++) {
    const response = await fetchImpl(url, { redirect: 'manual', signal,
      headers: { 'User-Agent': 'blueprint-reader/0.1 (+https://github.com/ibrews/ue5-mcp)', Accept: 'text/html' } });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location) throw new Error('BlueprintUE redirect has no location.');
      url = blueprintURL(new URL(location, url).href); continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`BlueprintUE returned HTTP ${response.status}. Supply copied text if the link requires access.`); }
    if (Number(response.headers.get('content-length')) > MAX_BYTES) { await response.body?.cancel(); throw new Error('Page exceeds 32 MiB.'); }
    const chunks = []; let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > MAX_BYTES) throw new Error('Page exceeds 32 MiB.');
      chunks.push(chunk);
    }
    const result = extractHTML(new TextDecoder().decode(concatBytes(chunks, size)));
    return { text: result.text, source: { kind: 'blueprintue', name: url.href, url: url.href, title: result.title, ue_version: result.ue_version } };
  }
  throw new Error('Too many BlueprintUE redirects.');
}

