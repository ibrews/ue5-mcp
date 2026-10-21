import { parentPort, workerData } from 'node:worker_threads';
import { parseText } from './parser.mjs';
try { parentPort.postMessage({ bundle: parseText(workerData.text, workerData.source) }); }
catch (e) { parentPort.postMessage({ error: e.message }); }
