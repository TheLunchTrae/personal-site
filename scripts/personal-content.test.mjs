import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { personalContentInPatch } from './personal-content.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hookScript = path.join(root, 'scripts/personal-content.mjs');

describe('personalContentInPatch', () => {
  test('finds added, updated, deleted, and moved-to personal files', () => {
    const patch = [
      '*** Begin Patch',
      '*** Add File: content/home/about.md',
      '*** Update File: src/app/page.tsx',
      '*** Update File: content/credits/minecraft/credits.md',
      '*** Move to: content/influences/minecraft/influence.md',
      `*** Delete File: ${path.join(root, 'public/TraeStevens_Resume.pdf')}`,
      '*** End Patch',
    ].join('\n');
    assert.deepEqual(personalContentInPatch(patch, root, root), [
      'content/home/about.md',
      'content/influences/minecraft/influence.md',
      'public/TraeStevens_Resume.pdf',
    ]);
  });

  test('resolves paths against the session directory', () => {
    const patch = '*** Update File: home/intro.md';
    assert.deepEqual(personalContentInPatch(patch, path.join(root, 'content'), root), ['content/home/intro.md']);
    assert.deepEqual(personalContentInPatch(patch, path.join(root, 'src'), root), []);
  });

  test('matches folders by whole path segment', () => {
    assert.deepEqual(personalContentInPatch('*** Add File: content/homepage.md', root, root), []);
  });

  test('reads indented headers and ignores case, as Codex and the file system do', () => {
    const patch = '*** Begin Patch\n  *** Update File: content/home/intro.md\n\t*** Delete File: Content/Levels/x.md';
    assert.deepEqual(personalContentInPatch(patch, root, root), ['content/home/intro.md', 'Content/Levels/x.md']);
  });
});

describe('the Codex hook', () => {
  const run = (patch, script = hookScript) =>
    spawnSync('node', [script], {
      encoding: 'utf8',
      input: JSON.stringify({ cwd: root, tool_name: 'apply_patch', tool_input: { command: patch } }),
    });

  test('denies a patch to a personal file', () => {
    const result = run('*** Update File: content/home/intro.md');
    assert.equal(result.status, 0);
    const output = JSON.parse(result.stdout).hookSpecificOutput;
    assert.equal(output.permissionDecision, 'deny');
    assert.match(output.permissionDecisionReason, /content\/home\/intro\.md/);
  });

  test('denies when run through a linked folder', () => {
    const linkDirectory = mkdtempSync(path.join(tmpdir(), 'personal-content-'));
    try {
      const link = path.join(linkDirectory, 'repository');
      // A junction needs no admin rights on Windows; other systems ignore the type.
      symlinkSync(root, link, 'junction');
      const result = run('*** Update File: content/home/intro.md', path.join(link, 'scripts/personal-content.mjs'));
      assert.equal(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, 'deny');
    } finally {
      rmSync(linkDirectory, { recursive: true, force: true });
    }
  });

  test('blocks the call when the hook fails', () => {
    const result = spawnSync('node', [hookScript], { encoding: 'utf8', input: 'not json' });
    assert.equal(result.status, 2);
  });

  test('allows other patches', () => {
    const result = run('*** Update File: content/credits/minecraft/credits.md');
    assert.equal(result.status, 0);
    assert.equal(result.stdout, '');
  });
});
