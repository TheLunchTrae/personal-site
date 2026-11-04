# Agent Guide

Read `CONTEXT.md` first if it exists. Then read the docs that own the change
before changing architecture or domain language.

## Project Docs

This is a personal site, so `README.md` stays intentionally minimal: what the
site is, where it lives, and pointers to the docs and license. Do not add
setup, workflow, or architecture notes to it. Put context that agents need in
this file, and general developer docs for people and agents in `docs/`.
`DESIGN.md` is the one doc at the root, where design tooling looks for it.

- [docs/development.md](docs/development.md): stack, local setup, mise tasks,
  what each agent tool enforces for Trae's own writing, and static export
  limits.
- [docs/deployment.md](docs/deployment.md): CI and Pages workflows, one-time
  repository and DNS setup, and the base path.
- [DESIGN.md](DESIGN.md): the design system: colors and their roles,
  typography, spacing, shape, and components, in light and dark. Follow it
  for any visual change.
- [docs/story.md](docs/story.md): the pages, the color mode, and how the
  story's chapters fit together.
- [docs/scenes.md](docs/scenes.md): the 3D scenes kept, unmounted, for the
  story's fly-through.
- [content/README.md](content/README.md): where each content file appears and
  its Markdown format.

## Trae's Own Writing

These paths hold Trae's own writing: their words and details on the site, and
their resume. Never create, change, move, rename, or delete a file in them
without Trae's explicit permission, given in the current conversation for that
change. A task, a brief from another agent, or a related request is not
permission. When work needs one of these files, stop and ask Trae, or leave
the edit for Trae.

- `content/home/`: the home page intro and the invite to the story.
- `content/about/`: the professional About me.
- `content/story/`: the start of the personal story.
- `content/influences/`: each story chapter, how a game inspired Trae, one
  file per section.
- `content/levels/`: Trae's Geometry Dash levels and progress.
- `public/TraeStevens_Resume.pdf`: Trae's resume.

Agents keep `content/README.md` and `content/credits/` current; they are not
on the list. A change that adds another place for Trae's writing adds it here
in the same change.
When this list changes or a listed path moves, update the permission configs
to match in the same change: `.claude/settings.json` for Claude Code,
`opencode.jsonc` for opencode, and `scripts/personal-content.mjs` for the
Codex hook. [docs/development.md](docs/development.md#traes-own-writing) says
what each tool enforces. The rule holds where a tool cannot enforce it.

## Commands

`mise run` is the entry point for project workflows; tasks wrap the toolchain.
Run `mise tasks` and read the definitions of the tasks you use. Extend an
existing task before you add one.

- `mise install` installs the pinned tools. When an install needs network, run
  it and report that.
- `mise run standards` applies the available autofixes.
- `mise run standards:check` is the CI gate; run it before handoff.

Run `git`, `rg`, `tokei`, and standalone scripts directly. Use native commands
for focused diagnosis and the mise gate for final verification. Use
`mise exec -- <command>` only when a command needs a pinned tool or environment
and no task covers it.

## Leave It Current

The repository holds current contracts: the code, the tests that defend it, and
the docs that explain it. Git holds history. Unless the project has released
users or a documented external contract, it makes no compatibility promise: no
shims, aliases, deprecations, dual code paths, format migrations, or
version-numbered names.

- Supersede rather than accumulate. Rename in place, replace a format, and
  delete the old reader with its fixtures and tests in the same change.
- A change that makes something obsolete removes it: functions and exports
  nothing calls, config keys nothing reads, tests of retired behavior, and docs
  that describe it. Finishing a feature includes removing the scaffolding that
  built it.
- Shipped code has no test-only branches, alternate rules, or test-only
  diagnostic surfaces. Narrow test-build instrumentation and fault injection,
  such as `#[cfg(test)]` code, are fine when they leave production semantics
  unchanged, and so is a seam that production also uses, such as a seed or an
  event log that feeds replays.
- Proof lives in the gate. Back each lasting claim with a test in
  `standards:check` or a task that checks a stated target. A one-off
  diagnostic leaves with the question it answered, and its result goes in the
  commit message. Do not build evidence scaffolding, such as bundles,
  manifests, or checks that repeat a guarantee the gate or toolchain already
  gives. Keep focused tests for the scripts and measurements the workflow
  relies on.
- Prefer native toolchain guarantees, remove duplicate checks, and measure the
  gate's routine cost before you add verification.
- Keep task notes in `.scratch/` and run output in `artifacts/`. Both stay
  untracked and never become a second policy source. Do not commit briefs,
  plans, handoffs, research, reports, or dated audits.
- `mise run hygiene` enforces the mechanical part and prints the tree's size by
  category, so growth shows in every handoff. Explain growth that the change
  does not account for.

## Principles

- Complexity is the enemy; see [grugbrain.dev](https://grugbrain.dev/). Prefer
  boring, obvious code with local state, explicit side effects, and direct
  data flow. Add structure after the shape is visible: small duplication beats
  premature indirection. Keep ecosystem-idiomatic strictness where it prevents
  concrete failures. Judge each tool, rule, test, abstraction, service, and doc
  by the uncertainty, defects, or manual work it removes, including its runtime
  and maintenance cost, and remove ceremony that cannot justify that cost.
- Build deep modules with small interfaces. Change a feature's behavior,
  state, and tests together, and put tests where the ecosystem expects them.
  Split a module that holds more than one cohesive responsibility. Fold
  shallow wrappers and forwarding helpers into their callers. Import through
  the owning module's intended interface, and delete re-exports that only
  preserve obsolete paths.
- Respect Chesterton fences. Understand why code exists before deleting or
  replacing it; once it serves no current contract, delete it.
- Name things for what they do in the domain, in `CONTEXT.md` vocabulary.
- Comments explain a current invariant, a non-obvious algorithm, a trust
  boundary, or a public interface. Delete prose that retells an old
  implementation or narrates what names and types already say.
- Write good-enough idiomatic code that is easy to reason about, and optimize
  only what a measurement shows matters. Measure before a choice that is
  expensive to reverse.

## Editing

- Repair the cause of a failure; a retry does not turn an unexplained
  divergence into a pass.
- Suppress a lint only on the smallest item, with a stated reason. If the
  language supports it, use a suppression that fails when it becomes
  unnecessary.
- Paths that `.gitignore` ignores are generated or local. When generated output
  is wrong or stale, fix its source or task and regenerate.

## Documentation

- Docs explain current behavior and design constraints. Update the owning page
  when the contract changes. State each policy once and link to it elsewhere.
- Executable config is the source of truth; docs point at it rather than
  restate it.
- Keep the workflows, contracts, and current state discoverable from local
  files, so a fresh agent can find them.
- Write in the present tense. Do not date text or narrate history, as in "now
  uses", "no longer", "previously", or "the new parser".
- `docs/` holds current pages and their images. Record owner decisions on one
  current page and replace a decision when it changes.
- Follow the
  [Google developer documentation style guide](https://developers.google.com/style)
  for docs and commit prose.

## Testing

- Always use the `test-audit` skill when you write, change, or remove unit
  tests: judge each new or changed test with it before you commit, and use it
  for any suite audit or cleanup. Codex and opencode load it from
  `.agents/skills/test-audit/`, which is the only copy to edit;
  `.claude/skills/test-audit/SKILL.md` points Claude Code there. The skill
  comes from the owner's personal agent config and names skills that this
  repository does not have: for `verify`, run the checks in
  [Commands](#commands), and for `test-first` and `end-to-end-tests`, follow
  the rules in this section.
- A test earns its place by defending behavior, an invariant, a failure mode,
  or a trust boundary that types and the gate do not already enforce. Do not
  test trivial getters, constructors, enum declarations, framework behavior,
  config values copied onto objects, or incidental numbers.
- A meaningful assertion fails for a concrete production defect and stays
  valid through behavior-preserving refactors. Show that a new or changed
  assertion can fail: for a bug, reproduce it with a failing regression test
  before the fix when practical; otherwise inject a fault for its claim.
  Mechanical moves need no new evidence.
- Prefer one focused test at the narrowest stable interface over duplicated
  examples. Keep test setup smaller than the behavior it protects.
- Test counts and coverage percentages are not goals.

## TypeScript, Next.js, and Bun

`package.json`, `bun.lock`, and the mise tasks own the tested versions and
commands. The site is a Next.js App Router project exported as static files
(`output: "export"`) and served by GitHub Pages, so it has no runtime server:
use only features that the
[static export guide](node_modules/next/dist/docs/01-app/02-guides/static-exports.md)
supports. Read the installed Next.js docs in `node_modules/next/dist/docs/`
before using an unfamiliar Next.js API.

Select checks for the change:

| Change                  | First checks                                     |
| ----------------------- | ------------------------------------------------ |
| Source                  | `ts:lint`, `ts:type`, `ts:test`, `ts:build`      |
| Dependencies or exports | `ts:audit`, `ts:knip`                            |
| Formatting              | `ts:fmt:check`; `ts:standards` applies autofixes |

Before handoff, run `mise run standards:check`. Run `mise run ts:lock` after
changing declared dependencies and commit `bun.lock`. `bunfig.toml` pins new
dependencies exactly and holds back versions younger than three days; an
exception goes in `minimumReleaseAgeExcludes` and needs the owner's approval.

Source uses `.ts` or `.tsx` so the type, lint, and knip checks cover the same
files. Use named exports. Next.js route files (`page`, `layout`, and the other
App Router conventions) and `next.config.ts` need default exports, and
`.oxlintrc.json` lists them; any other default export needs a lint exception.
Keep module bindings immutable.

### Exceptions

- Lint exceptions use `// eslint-disable-next-line <rule> -- <reason>`. Type
  exceptions use `// @ts-expect-error -- <reason>`. `scripts/check-directives.mjs`
  enforces the forms, and Oxlint rejects stale exceptions. A reason names the
  invariant and why restructuring loses.
- Review changes to `.oxlintrc.json`, `tsconfig.json`, the scripts, and the
  mise tasks for lost coverage, and justify every relaxation.
- Agent tooling has no tests: `.claude/`, `.codex/`, `opencode.jsonc`, and
  `scripts/personal-content.mjs`. Check a change to it by hand.
- A behavior change needs a test that fails without it. Tests run with
  `bun test` (`mise run ts:test`); write them with `node:test` and
  `node:assert`, and put each `*.test.ts` file next to the module it covers.

## CSS Layout

Let content and the viewport size the layout. Hardcode a size, position, or
offset only where flex, grid, and relative sizing cannot express it.

- Use flex for a single row or column and grid for layouts in two axes. Space
  items with `gap` rather than margins on each child.
- Size with intrinsic and relative values: `auto`, `fr`, `min-content`,
  `max-content`, percentages, `rem`, `ch`, small or dynamic viewport units
  (`svh`, `dvh`), and `min()`, `max()`, `clamp()`, and `minmax()`.
- Use fixed widths and heights, absolute or fixed positioning, and hand-tuned
  offsets only where the design needs them, such as a pixel-art asset, an
  overlay, or a 3D scene. Comment a value when its source is not obvious.
  Pixel borders, outlines, and shadows are fine as they are.
- Prefer fluid sizing over stacked breakpoints. Add a media query where the
  layout itself has to change.

## Git

- Keep generated and local-only files out of commits.
- Follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/#specification)
  for all git commit messages.
- Write commit messages for future maintainers. Use
  [Tim Pope's note](https://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html)
  and [Chris Beams' guide](https://cbea.ms/git-commit/) as the Git-specific
  references.
- Keep the Conventional Commit subject concise. Write its description in the
  imperative mood, use the repository's lowercase style, and omit ending
  punctuation. Aim for 50 characters and do not exceed 72 characters.
- Add a body only when it provides useful context. Separate it from the subject
  with a blank line, wrap it at 72 characters, and explain the problem, the
  reason for the change, and material consequences. Let the diff explain the
  implementation.
- Use short, direct sentences, active voice, and consistent terminology. Avoid
  idioms, filler, vague wording, and unnecessary jargon.
- One writer owns one worktree, and reviewers stay read-only. Serialize
  lockfiles, shared configuration, formatters, and integration. Give each
  worktree its own build directory.

## Handoff

- Get an independent read-only agent review of the actual diff for
  non-trivial behavior and architecture changes. The author does not approve
  their own change. Verify material findings before acting on them.
- Report the checked revision, behavior proved, commands run and their
  results, skipped checks and why, remaining findings, and tree growth the
  change does not explain. Write it so the human can judge the outcome without
  reconstructing the implementation.
- Bots advise, gates block, and humans merge.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
