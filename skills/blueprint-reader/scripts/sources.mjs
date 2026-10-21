import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
export const MAX_BYTES = 32 * 1024 * 1024;

export { blueprintURL, extractHTML } from './source-core.mjs';
import { blueprintURL, extractHTML } from './source-core.mjs';

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
    const result = extractHTML(Buffer.concat(chunks).toString('utf8'));
    return { text: result.text, source: { kind: 'blueprintue', name: url.href, url: url.href, title: result.title, ue_version: result.ue_version } };
  }
  throw new Error('Too many BlueprintUE redirects.');
}

export async function loadSource(input) {
  if (/^https?:\/\//i.test(input)) return fetchBlueprint(input);
  const path = resolve(input), info = await stat(path);
  if (!info.isFile()) throw new Error(`Not a regular file: ${path}`);
  if (info.size > MAX_BYTES) throw new Error('File exceeds 32 MiB; split it by graph.');
  const bytes = await readFile(path);
  let text;
  if (/\.rtf$/i.test(path) || bytes.subarray(0, 5).toString() === '{\\rtf') {
    if (process.platform !== 'darwin') throw new Error('Save this RTF as plain text; automatic RTF conversion currently requires macOS textutil.');
    text = execFileSync('/usr/bin/textutil', ['-convert', 'txt', '-stdout', path], { encoding: 'utf8', timeout: 10000, maxBuffer: MAX_BYTES });
  } else {
    const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' :
      bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : 'utf-8';
    text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
  }
  return { text, source: { kind: 'file', name: path } };
}
