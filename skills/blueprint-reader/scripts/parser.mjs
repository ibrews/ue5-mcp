import { createHash } from 'node:crypto';
import { parseTextWithDigest } from './parser-core.mjs';
export * from './parser-core.mjs';

export const sha256 = text => createHash('sha256').update(text).digest('hex');
export const parseText = (text, source = {}) => parseTextWithDigest(text, source, sha256(text));
