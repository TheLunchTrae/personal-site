// Trae's own writing, which agents change only with Trae's explicit permission.
// AGENTS.md states the rule and lists the paths; keep this list matching it.
// A path ending in `/` covers everything under it.
//
// This is the Codex PreToolUse hook in .codex/hooks.json: it denies an
// apply_patch call that adds, updates, deletes, or moves a file here. Codex lets
// a call through when its hook fails, so a hook error exits 2, which blocks the
// call.
import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { exit, stderr, stdin, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';

const personalContent = ['content/home/', 'content/influences/', 'content/levels/', 'public/TraeStevens_Resume.pdf'];

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Codex trims each patch line before it reads a header, so headers can be indented.
const patchPath = /^[ \t]*\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/gm;

// Windows and macOS file systems ignore case, so `Content/Home/` is `content/home/`.
function isPersonalContent(relativePath) {
  const normalized = relativePath.replaceAll('\\', '/').toLowerCase();
  return personalContent.some((entry) => {
    const lowered = entry.toLowerCase();
    return entry.endsWith('/') ? normalized.startsWith(lowered) : normalized === lowered;
  });
}

// Node gives import.meta.url the real path, so resolve links in patch paths too.
// A file being added doesn't exist yet, so resolve its nearest existing folder.
function realPath(filePath) {
  let existing = filePath;
  while (!existsSync(existing) && path.dirname(existing) !== existing) {
    existing = path.dirname(existing);
  }
  return path.join(realpathSync(existing), path.relative(existing, filePath));
}

// Patch paths are relative to the session's working directory unless absolute.
// Returns the repository-relative paths that the patch would change.
function personalContentInPatch(patch, cwd) {
  return [...patch.matchAll(patchPath)]
    .map((match) => path.relative(repositoryRoot, realPath(path.resolve(cwd, match[1].trim()))).replaceAll('\\', '/'))
    .filter(isPersonalContent);
}

async function readStdin() {
  let input = '';
  for await (const chunk of stdin) {
    input += chunk;
  }
  return input;
}

async function main() {
  const event = JSON.parse(await readStdin());
  const patch = event.tool_input?.command;
  if (typeof patch !== 'string') {
    return;
  }
  const blocked = personalContentInPatch(patch, event.cwd ?? repositoryRoot);
  if (blocked.length === 0) {
    return;
  }
  stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `Trae's own writing: ${blocked.join(', ')}. Agents never change it without Trae's explicit permission; see "Trae's Own Writing" in AGENTS.md. Codex cannot make this edit, so ask Trae to make it.`,
      },
    }),
  );
}

try {
  await main();
} catch (error) {
  stderr.write(`personal-content hook failed, so the edit is blocked: ${String(error)}\n`);
  exit(2);
}
