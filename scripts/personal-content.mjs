// Trae's own writing, which agents change only with Trae's explicit permission.
// AGENTS.md states the rule. This list is the source of truth: the Claude Code
// and opencode configs and AGENTS.md mirror it, and personal-content.test.mjs
// fails when they drift. A path ending in `/` covers everything under it.
//
// Run as a script, this is the Codex PreToolUse hook in .codex/hooks.json: it
// denies an apply_patch call that adds, updates, deletes, or moves a file here.
import path from 'node:path';
import { argv, stdin, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';

export const personalContent = [
  'content/home/',
  'content/influences/',
  'content/levels/',
  'public/TraeStevens_Resume.pdf',
];

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const patchPath = /^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/gm;

export function isPersonalContent(relativePath) {
  const normalized = relativePath.replaceAll('\\', '/');
  return personalContent.some((entry) => (entry.endsWith('/') ? normalized.startsWith(entry) : normalized === entry));
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
        permissionDecisionReason: `${blocked.join(', ')} is Trae's own writing. Agents never change it without Trae's explicit permission; see "Trae's Own Writing" in AGENTS.md. Ask Trae to make this edit.`,
      },
    }),
  );
}

if (argv[1] && path.resolve(argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
