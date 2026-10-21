import { BrowserReader } from './engine.mjs';
const reader = new BrowserReader();
self.onmessage = async ({ data: { id, action, body } }) => {
  try {
    if (!['ingest', 'inspect', 'download'].includes(action)) throw new Error('Unknown reader action.');
    self.postMessage({ id, result: await reader[action](body) });
  } catch (error) { self.postMessage({ id, error: String(error.message).slice(0, 2000) }); }
};
