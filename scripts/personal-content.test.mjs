import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { personalContent, personalContentInPatch } from './personal-content.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hookScript = path.join(root, 'scripts/personal-content.mjs');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const isFolder = (entry) => entry.endsWith('/');

describe('tool configs mirror the personal content list', () => {
  test('AGENTS.md lists each path', () => {
    const section = read('AGENTS.md').split("## Trae's Own Writing")[1]?.split('\n## ')[0] ?? '';
    const listed = [...section.matchAll(/^- `([^`]+)`:/gm)].map((match) => match[1]);
    assert.deepEqual(listed, personalContent);
  });

  test('Claude Code asks before editing each path', () => {
    const settings = JSON.parse(read('.claude/settings.json'));
    const expected = personalContent.map((entry) => (isFolder(entry) ? `Edit(/${entry}**)` : `Edit(/${entry})`));
    assert.deepEqual(settings.permissions.ask, expected);
  });

  test('opencode asks before editing each path', () => {
    // eslint-disable-next-line no-undef -- Bun runs the gate's tests and provides the JSONC parser.
    const config = Bun.JSONC.parse(read('opencode.jsonc'));
    const expected = Object.fromEntries(personalContent.map((entry) => [isFolder(entry) ? `${entry}*` : entry, 'ask']));
    assert.deepEqual(config.permission.edit, expected);
  });

  test('Codex runs this script before apply_patch', () => {
    const [group] = JSON.parse(read('.codex/hooks.json')).hooks.PreToolUse;
    assert.match('apply_patch', new RegExp(group.matcher));
    assert.match(group.hooks[0].command, /\/scripts\/personal-content\.mjs"$/);
  });
});

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
});

describe('the Codex hook', () => {
  const run = (patch) =>
    spawnSync('node', [hookScript], {
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

  test('allows other patches', () => {
    const result = run('*** Update File: content/credits/minecraft/credits.md');
    assert.equal(result.status, 0);
    assert.equal(result.stdout, '');
  });
});
