// Trae's own writing, which agents change only with Trae's explicit permission.
// AGENTS.md states the rule. This list is the source of truth: the Claude Code
// and opencode configs and AGENTS.md mirror it, and personal-content.test.mjs
// fails when they drift. A path ending in `/` covers everything under it.
//
// Run as a script, this is the Codex PreToolUse hook in .codex/hooks.json: it
// denies an apply_patch call that adds, updates, deletes, or moves a file here.
// Codex lets a call through when its hook fails, so a hook error exits 2, which
// blocks the call.
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { argv, exit, stderr, stdin, stdout } from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const personalContent = [
  'content/home/',
  'content/influences/',
  'content/levels/',
  'public/TraeStevens_Resume.pdf',
];

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

// Patch paths are relative to the session's working directory unless absolute.
// Returns the repository-relative paths that the patch would change.
export function personalContentInPatch(patch, cwd, root = repositoryRoot) {
  return [...patch.matchAll(patchPath)]
    .map((match) => path.relative(root, path.resolve(cwd, match[1].trim())).replaceAll('\\', '/'))
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

// Node gives import.meta.url the real path, so resolve links in the script path too.
function isEntryPoint() {
  try {
    return argv[1] !== undefined && pathToFileURL(realpathSync(argv[1])).href === import.meta.url;
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  try {
    await main();
  } catch (error) {
    stderr.write(`personal-content hook failed, so the edit is blocked: ${String(error)}\n`);
    exit(2);
  }
}
