#!/usr/bin/env node
import { cp, mkdir, access, rename, rm, symlink, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname, parse } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export async function installSkill(target = 'both', { sourceRoot = root, userRoot = homedir() } = {}) {
  if (!['codex', 'claude', 'both'].includes(target)) throw new Error('Choose codex, claude or both.');
  await access(join(sourceRoot, 'node_modules/ueblueprint/package.json'));
  if (process.platform === 'win32' && parse(await realpath(sourceRoot)).root.toLowerCase() === `${process.env.SystemDrive || 'C:'}\\`.toLowerCase())
    throw new Error('Keep the source checkout and dependencies on a verified non-system data volume before installation.');
  if (target !== 'claude') {
    const legacy = join(userRoot, '.codex', 'skills', 'blueprint-reader');
    try { await access(legacy); throw new Error(`Legacy Codex installation found: ${legacy}. Move it outside the skills folders before installing to .agents/skills; see README.md.`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const destinations = (target === 'both' ? ['codex', 'claude'] : [target]).map(x => join(userRoot, x === 'codex' ? '.agents' : '.claude', 'skills', 'blueprint-reader'));
  for (const destination of destinations) {
    try { await access(destination); throw new Error(`Already installed: ${destination}. Move the old installation aside before updating.`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  for (const destination of destinations) {
    await mkdir(dirname(destination), { recursive: true });
    if (process.platform === 'win32') {
      await symlink(sourceRoot, destination, 'junction');
      console.log(`Linked ${destination} -> ${sourceRoot}; keep this data-volume checkout available.`);
      continue;
    }
    const staging = `${destination}.install-${process.pid}`;
    try {
      await mkdir(staging);
      for (const name of ['SKILL.md', 'README.md', 'LICENSE', 'agents', 'assets', 'references', 'scripts', 'tests', 'package.json', 'package-lock.json', 'node_modules'])
        await cp(join(sourceRoot, name), join(staging, name), { recursive: true, dereference: true });
      await rename(staging, destination);
      console.log(`Installed ${destination}`);
    } finally { await rm(staging, { recursive: true, force: true }); }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length > 3) { console.error('Usage: node scripts/install-skill.mjs [codex|claude|both]'); process.exitCode = 1; }
  else installSkill(process.argv[2] || 'both').catch(error => {
    console.error(`Install failed: ${error.message}\nRun npm ci --ignore-scripts first if dependencies are missing.`); process.exitCode = 1;
  });
}
