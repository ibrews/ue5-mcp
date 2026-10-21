import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, access, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { installSkill } from '../scripts/install-skill.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
async function sandbox(t) {
  const work = join(root, 'work'); await mkdir(work, { recursive: true });
  const path = await mkdtemp(join(work, 'install-test-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}

test('fresh Codex and Claude installations include licenses, docs and working dependencies', async t => {
  const userRoot = await sandbox(t);
  await installSkill('both', { userRoot, allowSystemDrive: true });
  for (const client of ['.agents', '.claude']) {
    const installed = join(userRoot, client, 'skills', 'blueprint-reader');
    assert.equal(await readFile(join(installed, 'LICENSE'), 'utf8'), await readFile(join(root, 'LICENSE'), 'utf8'));
    assert.match(await readFile(join(installed, 'README.md'), 'utf8'), /Things to Try/);
    await access(join(installed, 'node_modules/ueblueprint/LICENSE'));
    const result = spawnSync(process.execPath, [join(installed, 'scripts/read-blueprint.mjs'), '-'], {
      encoding: 'utf8', input: 'Begin Object Class=/Script/BlueprintGraph.K2Node_Event Name="Start"\nEventReference=(MemberName="ReceiveBeginPlay")\nEnd Object',
    });
    assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /BLUEPRINT BRIEF/);
  }
  await assert.rejects(installSkill('both', { userRoot, allowSystemDrive: true }), /Already installed/);
});

test('legacy Codex installation blocks a duplicate before either destination is written', async t => {
  const userRoot = await sandbox(t);
  await mkdir(join(userRoot, '.codex/skills/blueprint-reader'), { recursive: true });
  await assert.rejects(installSkill('both', { userRoot, allowSystemDrive: true }), /Legacy Codex installation/);
  await assert.rejects(access(join(userRoot, '.agents/skills/blueprint-reader')));
  await assert.rejects(access(join(userRoot, '.claude/skills/blueprint-reader')));
});

test('CLI runs through a directory symlink or Windows junction', async t => {
  const work = await sandbox(t), linked = join(work, 'reader-link');
  await symlink(root, linked, process.platform === 'win32' ? 'junction' : 'dir');
  const result = spawnSync(process.execPath, [join(linked, 'scripts/read-blueprint.mjs'), '-'], {
    encoding: 'utf8', input: 'Begin Object Class=/Script/BlueprintGraph.K2Node_Event Name="Start"\nEventReference=(MemberName="ReceiveBeginPlay")\nEnd Object',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /BLUEPRINT BRIEF/);
});

test('installer supports a relocated Claude config directory', async t => {
  const userRoot = await sandbox(t), claudeRoot = join(userRoot, 'relocated-claude');
  await installSkill('claude', { userRoot, claudeRoot, allowSystemDrive: true });
  await access(join(claudeRoot, 'skills/blueprint-reader/SKILL.md'));
  await assert.rejects(access(join(userRoot, '.claude/skills/blueprint-reader')));
});
