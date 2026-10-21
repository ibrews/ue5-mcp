import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, ALLOWED_ORIGIN } from '../helper/handler.mjs';
import { fetchBlueprint } from '../scripts/fetch-blueprint.mjs';
const url = 'https://blueprintue.com/blueprint/example/';
const request = (value = url, options = {}) => new Request('https://helper.example/api/blueprint?url=' + encodeURIComponent(value), {
  ...options, headers: { Origin: ALLOWED_ORIGIN, 'x-real-ip': '127.0.0.1', ...options.headers },
});
const source = { kind: 'blueprintue', name: url, url, title: 'Example' };

test('helper restricts origins, methods, URLs and duplicate params before fetching', async () => {
  let calls = 0;
  const handler = createHandler(async () => { calls++; return { text: 'export', source }; });
  for (const bad of ['http://blueprintue.com/blueprint/a/', 'https://evil.example/', 'https://blueprintue.com:8080/blueprint/a/', 'https://user@blueprintue.com/blueprint/a/', 'https://blueprintue.com/profile/a/', 'https://127.0.0.1/blueprint/a/']) {
    assert.equal((await handler(request(bad))).status, 400);
  }
  assert.equal((await handler(request(url, { method: 'POST', body: 'private graph' }))).status, 405);
  const denied = await handler(request(url, { headers: { Origin: 'https://evil.example' } }));
  assert.equal(denied.status, 403); assert.equal(denied.headers.get('access-control-allow-origin'), null);
  assert.equal((await handler(new Request(request().url))).status, 403);
  assert.equal((await handler(new Request(request().url + '&url=duplicate', { headers: { Origin: ALLOWED_ORIGIN } }))).status, 400);
  assert.equal((await handler(request(url, { method: 'OPTIONS' }))).status, 204);
  assert.equal(calls, 0);
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), ALLOWED_ORIGIN);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('access-control-allow-credentials'), null);
  assert.deepEqual(await response.json(), { text: 'export', source });
});

test('helper caps JSON response bytes and returns safe timeout/upstream errors', async () => {
  let handler = createHandler(async () => ({ text: 'x'.repeat(4 * 1024 * 1024), source }));
  assert.equal((await handler(request())).status, 413);
  handler = createHandler(async () => { throw new Error('secret internal detail'); });
  const response = await handler(request());
  assert.equal(response.status, 502); assert.doesNotMatch(await response.text(), /secret/);
  handler = createHandler(async () => { throw new DOMException('deadline', 'TimeoutError'); });
  assert.equal((await handler(request())).status, 504);
});

test('helper limits each warm instance and recovers after the time window', async () => {
  let time = 0, calls = 0;
  const handler = createHandler(async () => { calls++; return { text: 'export', source }; }, () => time);
  for (let i = 0; i < 20; i++) assert.equal((await handler(request())).status, 200);
  const limited = await handler(request()); assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '60'); assert.equal(calls, 20);
  time = 60001; assert.equal((await handler(request())).status, 200);
});

test('shared fetcher revalidates redirects, caps streamed pages and decodes textarea once', async () => {
  let calls = 0;
  await assert.rejects(fetchBlueprint(url, async () => { calls++; return new Response(null, { status: 302, headers: { Location: 'https://127.0.0.1/' } }); }), /Expected an HTTPS/);
  assert.equal(calls, 1);
  await assert.rejects(fetchBlueprint(url, async () => new Response('x', { headers: { 'Content-Length': String(33 * 1024 * 1024) } })), /32 MiB/);
  await assert.rejects(fetchBlueprint(url, async () => new Response('x'.repeat(33 * 1024 * 1024))), /32 MiB/);
  const loaded = await fetchBlueprint(url, async () => new Response('<title>Example</title><textarea id="code_to_copy">Begin Object\nValue=&amp;lt;literal&amp;gt;\nEnd Object</textarea>'));
  assert.match(loaded.text, /&lt;literal&gt;/);
});
