# Development

The site is a Next.js (App Router) project exported as a static site and hosted
on GitHub Pages. See [deployment.md](deployment.md) for how it ships.

## Stack

- Next.js 16 with `output: "export"`, React 19, and TypeScript 6 in strict mode
- Tailwind CSS 4
- Bun 1.4 for packages and scripts, pinned with [mise](https://mise.jdx.dev/)
- Oxlint (type-aware, with the React, Next.js, and jsx-a11y plugins), Oxfmt, and knip

The tooling follows the TypeScript profile of
[KrishRVH/standards](https://github.com/KrishRVH/standards), adapted to a static
Next.js site. [AGENTS.md](../AGENTS.md) holds the working rules for people and
agents.

## Local development

Install [mise](https://mise.jdx.dev/getting-started.html), then:

```sh
mise install
mise run ts:install
mise exec -- bun run dev   # http://localhost:3000
```

`mise exec --` puts the pinned Bun on `PATH`; with
[mise activated](https://mise.jdx.dev/getting-started.html#activate-mise) in
your shell, plain `bun run dev` works too.

The tasks are verified on Linux, where CI runs. On Windows, use Git Bash with
mise activated, or WSL. The mise lockfile pins checksums for Linux only, so
`MISE_LOCKED=1` (as CI sets it) works only there.

Project workflows run through mise:

| Task                       | What it does                                                                  |
| -------------------------- | ----------------------------------------------------------------------------- |
| `mise run standards`       | Applies lint autofixes and formats the tree                                   |
| `mise run standards:check` | The CI gate: secrets, hygiene, lint, types, format, audit, knip, tests, build |
| `mise run ts:build`        | Static export to `out/`                                                       |
| `mise run ts:lint`         | Suppression-form check, then Oxlint                                           |
| `mise run ts:type`         | `tsc`, after generating the Next.js route types                               |
| `mise run ts:test`         | `bun test`                                                                    |
| `mise run ts:lock`         | Refreshes `bun.lock` after a dependency change                                |

`mise tasks` lists the rest. To preview the production build, serve `out/` with
any static server, for example `bunx serve out`.

## Content and themes

The site's text lives in Markdown files under `content/`;
[content/README.md](../content/README.md) maps each file to where it appears.
[themes.md](themes.md) describes the theme system: the color mode control and
how a game theme plugs in.

## Static export limits

There is no server at runtime, so features that need one are unavailable:
Server Actions, route handlers that read the request, cookies, rewrites,
redirects, headers, ISR, and the default `next/image` optimizer (images are
served unoptimized). Dynamic routes need `generateStaticParams`. See the
[Next.js static export guide](https://nextjs.org/docs/app/guides/static-exports).
