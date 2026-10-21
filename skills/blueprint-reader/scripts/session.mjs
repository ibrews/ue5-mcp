import { readFile, stat, writeFile } from 'node:fs/promises';
import { MAX_BYTES } from './parser.mjs';

export function sessionDocument(loaded) {
  if (!Array.isArray(loaded) || !loaded.length || loaded.length > 100) throw new Error('A session needs 1–100 sources.');
  let bytes = 0;
  const sources = loaded.map(item => {
    if (typeof item.text !== 'string') throw new Error('Session source text must be a string.');
    bytes += Buffer.byteLength(item.text);
    const source = {};
    for (const key of ['kind', 'name', 'title', 'url', 'ue_version'])
      if (typeof item.source?.[key] === 'string') source[key] = item.source[key].slice(0, 2000);
    return { text: item.text, source };
  });
  if (bytes > MAX_BYTES) throw new Error('Combined session text exceeds 32 MiB; split the sources.');
  return { kind: 'blueprint-reader-session', schema_version: 1, sources };
}

export async function saveSession(path, loaded) {
  await writeFile(path, JSON.stringify(sessionDocument(loaded)), { flag: 'wx' });
}

export async function loadSession(path) {
  const info = await stat(path);
  if (!info.isFile() || info.size > MAX_BYTES * 6 + 1024 * 1024) throw new Error('Invalid or oversized session file.');
  const doc = JSON.parse(await readFile(path, 'utf8'));
  if (doc.kind !== 'blueprint-reader-session' || doc.schema_version !== 1) throw new Error('Unsupported session format.');
  // Treat saved content as untrusted input: validate its shape and reparse the
  // original text in workers, instead of trusting stored graph claims.
  return sessionDocument(doc.sources).sources;
}
