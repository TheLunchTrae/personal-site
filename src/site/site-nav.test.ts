import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { creditsHref, gameThemes, type ThemeId, storyHref } from '@/themes/registry';
import { navTabs } from './site-nav';

const appRoot = path.join(import.meta.dirname, '..', 'app');

// Every route the static export builds, from the page files under src/app/.
// The one dynamic segment, [theme], builds a page per game theme; any other
// dynamic segment fails here so this list grows with it.
async function exportedRoutes(): Promise<string[]> {
  const files = await readdir(appRoot, { recursive: true });
  return files
    .filter((file) => path.basename(file) === 'page.tsx')
    .flatMap((file) => {
      const segments = path
        .dirname(file)
        .split(path.sep)
        .filter((segment) => segment !== '.');
      const route = segments.length === 0 ? '/' : `/${segments.join('/')}/`;
      if (route.includes('[theme]')) {
        return gameThemes.map((theme) => route.replace('[theme]', theme.id));
      }
      assert.ok(!route.includes('['), `${route} has a dynamic segment this test does not expand.`);
      return [route];
    });
}

// The tabs a theme shows, by the rules globals.css and each theme's reveal rule apply.
function shownTabs(theme: ThemeId): string[] {
  return navTabs
    .filter((tab) => (theme === 'default' ? tab.scope !== 'theme' : tab.scope === undefined || tab.theme === theme))
    .map((tab) => tab.href);
}

await test('every exported page is a tab, and each game theme shows Home and exactly its own pages', async () => {
  const routes = await exportedRoutes();
  const themes: ThemeId[] = ['default', ...gameThemes.map((theme) => theme.id)];
  const shown = new Set(themes.flatMap(shownTabs));
  for (const route of routes) {
    assert.ok(shown.has(route), `${route} has no tab in any theme, so it can be unreachable.`);
  }
  for (const theme of gameThemes) {
    const own = routes.filter((route) => route.startsWith(storyHref(theme.id)) || route === creditsHref(theme.id));
    assert.deepEqual(
      shownTabs(theme.id).toSorted(),
      ['/', ...own].toSorted(),
      `The ${theme.name} theme shows Home and exactly its own pages.`,
    );
  }
});

await test("each game theme's stylesheet reveals its own tabs", async () => {
  for (const theme of gameThemes) {
    const css = await readFile(path.join(appRoot, '..', 'themes', theme.id, `${theme.id}.css`), 'utf8');
    const reveal = new RegExp(
      String.raw`:root\[data-theme='${theme.id}'\]\s+\.site-nav__item\[data-nav-for='${theme.id}'\][^{]*\{[^}]*display:\s*block`,
    );
    assert.match(css, reveal, `src/themes/${theme.id}/${theme.id}.css does not reveal the theme's tabs.`);
  }
});
