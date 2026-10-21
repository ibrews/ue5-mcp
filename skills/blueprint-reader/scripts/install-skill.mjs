#!/usr/bin/env node
import { cp, mkdir, access, rename, rm, symlink, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from './entrypoint.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
export async function installSkill(target = 'both', { sourceRoot = root, userRoot = homedir(), claudeRoot = join(userRoot, '.claude'), legacyCodexRoot = join(userRoot, '.codex'), allowSystemDrive = false } = {}) {
  if (!['codex', 'claude', 'both'].includes(target)) throw new Error('Choose codex, claude or both.');
  await access(join(sourceRoot, 'node_modules/ueblueprint/package.json'));
  if (process.platform === 'win32' && !allowSystemDrive && parse(await realpath(sourceRoot)).root.toLowerCase() === `${process.env.SystemDrive || 'C:'}\\`.toLowerCase())
    throw new Error('Keep the source checkout and dependencies on a verified non-system data volume before installation.');
  if (target !== 'claude') {
    for (const base of new Set([join(userRoot, '.codex'), legacyCodexRoot])) {
      const legacy = join(base, 'skills', 'blueprint-reader');
      try { await access(legacy); throw new Error(`Legacy Codex installation found: ${legacy}. Move it outside the skills folders before installing to .agents/skills; see README.md.`); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  const destinations = (target === 'both' ? ['codex', 'claude'] : [target]).map(x => join(x === 'codex' ? join(userRoot, '.agents') : claudeRoot, 'skills', 'blueprint-reader'));
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
      for (const name of ['SKILL.md', 'README.md', 'LICENSE', 'agents', 'assets', 'references', 'scripts', 'tests', 'web', 'package.json', 'package-lock.json', 'node_modules'])
        await cp(join(sourceRoot, name), join(staging, name), { recursive: true, dereference: true });
      await rename(staging, destination);
      console.log(`Installed ${destination}`);
    } finally { await rm(staging, { recursive: true, force: true }); }
  }
}

if (isMainModule(import.meta.url)) {
  const args = process.argv.slice(2), allowSystemDrive = args.includes('--allow-system-drive');
  const positional = args.filter(x => x !== '--allow-system-drive');
  if (positional.length > 1) { console.error('Usage: node scripts/install-skill.mjs [codex|claude|both] [--allow-system-drive]'); process.exitCode = 1; }
  else installSkill(positional[0] || 'both', {
    claudeRoot: process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'),
    legacyCodexRoot: process.env.CODEX_HOME || join(homedir(), '.codex'),
    allowSystemDrive,
  }).catch(error => {
    console.error(`Install failed: ${error.message}\nRun npm ci --ignore-scripts first if dependencies are missing.`); process.exitCode = 1;
  });
}
