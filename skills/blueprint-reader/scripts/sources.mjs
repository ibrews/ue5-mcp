import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { MAX_BYTES, fetchBlueprint } from './fetch-blueprint.mjs';
export { MAX_BYTES, fetchBlueprint } from './fetch-blueprint.mjs';

export { blueprintURL, extractHTML } from './source-core.mjs';


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
