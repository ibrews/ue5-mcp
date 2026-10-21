import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Node resolves the module URL through symlinks/junctions, but argv retains
// the path used by the client. Compare physical paths for installed commands.
export function isMainModule(url) {
  if (!process.argv[1]) return false;
  try { return realpathSync(fileURLToPath(url)) === realpathSync(process.argv[1]); }
  catch { return false; }
}
