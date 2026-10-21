#!/usr/bin/env node
import { cp, mkdir, access, rename, rm, symlink, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname, parse } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = process.argv[2] || 'both';
if (!['codex', 'claude', 'both'].includes(target) || process.argv.length > 3) {
  console.error('Usage: node scripts/install-skill.mjs [codex|claude|both]'); process.exit(1);
}
try {
  await access(join(root, 'node_modules/ueblueprint/package.json'));
  if (process.platform === 'win32' && parse(await realpath(root)).root.toLowerCase() === `${process.env.SystemDrive || 'C:'}\\`.toLowerCase())
    throw new Error('Keep the source checkout and dependencies on a verified non-system data volume before installation.');
  const destinations = (target === 'both' ? ['codex', 'claude'] : [target]).map(x => join(homedir(), `.${x}`, 'skills', 'blueprint-reader'));
  for (const destination of destinations) {
    try { await access(destination); throw new Error(`Already installed: ${destination}. Move the old installation aside before updating.`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  for (const destination of destinations) {
    await mkdir(dirname(destination), { recursive: true });
    if (process.platform === 'win32') {
      await symlink(root, destination, 'junction');
      console.log(`Linked ${destination} -> ${root}; keep this data-volume checkout available.`);
      continue;
    }
    const staging = `${destination}.install-${process.pid}`;
    try {
      await mkdir(staging);
      for (const name of ['SKILL.md', 'agents', 'references', 'scripts', 'tests', 'package.json', 'package-lock.json', 'node_modules'])
        await cp(join(root, name), join(staging, name), { recursive: true, dereference: true });
      await rename(staging, destination);
      console.log(`Installed ${destination}`);
    } finally { await rm(staging, { recursive: true, force: true }); }
  }
} catch (error) { console.error(`Install failed: ${error.message}\nRun npm ci --ignore-scripts first if dependencies are missing.`); process.exitCode = 1; }
