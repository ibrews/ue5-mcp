import { readFile, writeFile } from 'node:fs/promises';
import { makeSnapshot, SOURCE_URL } from './snapshot.mjs';

// Full exports stay outside the repository. Accept only the pinned source.
const path = process.argv[2];
if (!path) throw new Error('Usage: node web/guide/refresh.mjs /absolute/path/public-example.bp-session.json');
const session = JSON.parse(await readFile(path, 'utf8'));
if (session.kind !== 'blueprint-reader-session' || session.sources?.length !== 1 || session.sources[0].source.url !== SOURCE_URL) {
  throw new Error('Expected the saved session of the named public example.');
}
const snapshot = makeSnapshot(session.sources[0].text);
await writeFile(new URL('./evidence.json', import.meta.url), JSON.stringify(snapshot, null, 2) + '\n');
console.log(`Verified ${snapshot.stats.nodes} nodes; retained ${snapshot.nodes.length} nodes and ${snapshot.edges.length} connections.`);
