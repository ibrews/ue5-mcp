import { readFile, stat, writeFile } from 'node:fs/promises';
import { MAX_BYTES } from './parser.mjs';

export { sessionDocument } from './session-core.mjs';
import { sessionDocument } from './session-core.mjs';

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
