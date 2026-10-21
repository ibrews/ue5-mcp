import { fetchBlueprint } from '../scripts/fetch-blueprint.mjs';
import { blueprintURL } from '../scripts/source-core.mjs';
import { byteLength } from '../scripts/text.mjs';
import { HELPER_MAX_BYTES } from '../web/config.mjs';

export const ALLOWED_ORIGIN = 'https://ibrews.github.io';

export function createHandler(load = fetchBlueprint, now = Date.now) {
  // Best-effort warm-instance limits, not a distributed rate-limit guarantee.
  const clients = new Map(); let active = 0;
  return async request => {
    const origin = request.headers.get('origin');
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', Vary: 'Origin', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };
    if (origin === ALLOWED_ORIGIN) headers['Access-Control-Allow-Origin'] = origin;
    const reply = (status, data, extra = {}) => new Response(data == null ? null : JSON.stringify(data), { status, headers: { ...headers, ...extra } });
    if (origin !== ALLOWED_ORIGIN) return reply(403, { error: 'This helper serves the Blueprint Reader website.' });
    if (request.method === 'OPTIONS') return reply(204, null);
    if (request.method !== 'GET') return reply(405, { error: 'Only GET is supported.' }, { Allow: 'GET, OPTIONS' });
    const query = new URL(request.url).searchParams, input = query.get('url');
    let url;
    try {
      if (!input || input.length > 2048 || [...query.keys()].length !== 1) throw new Error();
      url = blueprintURL(input).href;
    } catch { return reply(400, { error: 'Supply one valid HTTPS BlueprintUE export URL.' }); }
    const time = now();
    for (const [key, value] of clients) if (value.until <= time) clients.delete(key);
    const ip = request.headers.get('x-real-ip') || 'unknown';
    const count = clients.get(ip) || { until: time + 60000, requests: 0 };
    if (count.requests >= 20 || active >= 8 || (!clients.has(ip) && clients.size >= 4096)) {
      return reply(429, { error: 'Too many imports. Wait a minute or use copied text.' }, { 'Retry-After': '60' });
    }
    count.requests++; clients.set(ip, count); active++;
    try {
      const loaded = await load(url);
      const data = { text: loaded.text, source: { ...loaded.source,
        title: loaded.source.title?.slice(0, 2000), ue_version: loaded.source.ue_version?.slice(0, 100) } };
      const body = JSON.stringify(data);
      if (byteLength(body) > HELPER_MAX_BYTES) return reply(413, { error: 'Export exceeds the 4 MiB automatic-import limit. Use copied text.' });
      return new Response(body, { status: 200, headers });
    } catch (error) {
      const timeout = ['TimeoutError', 'AbortError'].includes(error.name);
      return reply(timeout ? 504 : 502, { error: timeout ? 'BlueprintUE took too long to respond.' : 'BlueprintUE could not provide this export. It may be private, expired, or blocked.' });
    } finally { active--; }
  };
}
