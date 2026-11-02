# Deployment

The site is served at [traejks.dev](https://traejks.dev) from GitHub Pages. Two
workflows in `.github/workflows` check and deploy it:

- `quality.yml` runs `mise run standards:check` on every pull request,
  merge-queue group, and push to `main` (it can also be run manually). Its job
  is named `quality`.
- `pages.yml` builds the site and deploys `out/` to GitHub Pages on every push
  to `main` (it can also be run manually).

## One-time setup

Do step 1 before the first merge to `main`, otherwise the first `Pages` run
fails. If it already failed, re-run it from the Actions tab (it supports manual
runs).

1. In the repo's Settings → Pages, set **Source** to **GitHub Actions**.
2. In the same page, set **Custom domain** to `traejks.dev`. With Actions-based
   deployment GitHub ignores a `CNAME` file, so the domain lives only in this
   setting. Turn on **Enforce HTTPS** once the certificate is issued.
3. At the DNS provider (Porkbun), point the apex at `thelunchtrae.github.io`
   with an `ALIAS` record and add a `CNAME` for `www` to the same host.
   Verifying the domain in your GitHub account settings (Settings → Pages) is
   recommended to prevent takeover.
4. Protect `main` with a ruleset that requires a pull request and the `quality`
   check, and blocks force pushes and deletion. Committed files cannot
   configure these settings. Leave **Require review from Code Owners** off
   while the repo has a single owner: GitHub doesn't let authors approve their
   own pull requests, so with no bypass nothing could merge. Turn it on, with
   stale approvals dismissed on new commits, once a second reviewer exists.

## Base path

The site is served from the domain root, so no `basePath` is configured. If it
is ever served from `thelunchtrae.github.io/personal-site/` instead, set
`basePath: "/personal-site"` in `next.config.ts`.
