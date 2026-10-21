import { MAX_BYTES } from './parser-core.mjs';
import { byteLength } from './text.mjs';

export function sessionDocument(loaded) {
  if (!Array.isArray(loaded) || !loaded.length || loaded.length > 100) throw new Error('A session needs 1–100 sources.');
  let bytes = 0;
  const sources = loaded.map(item => {
    if (typeof item.text !== 'string') throw new Error('Session source text must be a string.');
    bytes += byteLength(item.text);
    const source = {};
    for (const key of ['kind', 'name', 'title', 'url', 'ue_version'])
      if (typeof item.source?.[key] === 'string') source[key] = item.source[key].slice(0, 2000);
    return { text: item.text, source };
  });
  if (bytes > MAX_BYTES) throw new Error('Combined session text exceeds 32 MiB; split the sources.');
  return { kind: 'blueprint-reader-session', schema_version: 1, sources };
}

