// Parsing runs in a worker, never on a server or the interface thread. Keep the
// accepted worker while a new one parses so failures/timeouts preserve the session.
export class BrowserClient {
  browser = true;
  worker = null;
  createWorker() { return new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }); }
  request(worker, action, body) {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const cleanup = () => { clearTimeout(timer); worker.removeEventListener('message', message); worker.removeEventListener('error', error); };
      const message = ({ data }) => {
        if (data.id !== id) return;
        cleanup(); data.error ? reject(new Error(data.error)) : resolve(data.result);
      };
      const error = event => { cleanup(); reject(new Error(event.message || 'The browser worker stopped. Try a smaller graph or reload the page.')); };
      const timer = setTimeout(() => { cleanup(); reject(new Error('Reading took more than 45 seconds. Split the input into smaller graphs.')); }, 45000);
      worker.addEventListener('message', message); worker.addEventListener('error', error);
      worker.postMessage({ id, action, body });
    });
  }
  async ingest(body) {
    const candidate = this.createWorker();
    try {
      const result = await this.request(candidate, 'ingest', body);
      this.worker?.terminate(); this.worker = candidate; return result;
    } catch (error) { candidate.terminate(); throw error; }
  }
  inspect(params) {
    if (!this.worker) throw new Error('Read a Blueprint first.');
    return this.request(this.worker, 'inspect', params);
  }
  async download(kind, id) {
    if (!this.worker) throw new Error('Read a Blueprint first.');
    const file = await this.request(this.worker, 'download', { id, kind });
    return { name: file.name, blob: new Blob([file.text], { type: file.type + ';charset=utf-8' }) };
  }
}
