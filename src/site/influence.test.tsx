import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { InfluenceSections, readInfluence } from './influence';

async function contentRoot(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'influences-'));
  for (const [name, text] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await writeFile(path.join(root, name), text);
  }
  return root;
}

await test('sections read in front matter order, then by file name', async () => {
  const root = await contentRoot({
    'game/black-ops-2.md': '---\r\ntitle: Black Ops 2\r\norder: 2\r\n---\r\nSecond.\r\n',
    'game/black-ops-1.md': '---\ntitle: Black Ops 1\norder: 1\n---\nFirst.\n',
    'game/intro.md': 'No front matter.\n',
    'game/notes.txt': 'Not a blurb.',
  });
  const sections = await readInfluence('game', root);
  assert.deepEqual(
    sections.map(({ slug, title, order, body }) => [slug, title, order, body]),
    [
      ['intro', undefined, 0, 'No front matter.\n'],
      ['black-ops-1', 'Black Ops 1', 1, 'First.\n'],
      ['black-ops-2', 'Black Ops 2', 2, 'Second.\n'],
    ],
  );
});

await test('a theme with no blurbs has no sections', async () => {
  assert.deepEqual(await readInfluence('missing', await contentRoot({})), []);
});

await test('a mistyped front matter key fails the build', async () => {
  const root = await contentRoot({ 'game/blurb.md': '---\ntitel: Typo\n---\nText.\n' });
  await assert.rejects(readInfluence('game', root), /titel: Typo/u);
});

await test('blurbs render GitHub-flavored Markdown without raw HTML', () => {
  const html = renderToStaticMarkup(
    <InfluenceSections
      sections={[{ slug: 'a', title: 'Title', order: 0, body: '| A |\n| - |\n| 1 |\n\n<script>alert(1)</script>\n' }]}
    />,
  );
  assert.match(html, /<h2>Title<\/h2>/u);
  assert.match(html, /<table>/u);
  assert.doesNotMatch(html, /<script>/u);
});

await test('a theme can replace the element rendered for a Markdown node', () => {
  const html = renderToStaticMarkup(
    <InfluenceSections
      sections={[{ slug: 'a', title: undefined, order: 0, body: '- one\n' }]}
      components={{ ul: ({ children }) => <ul className="inventory">{children}</ul> }}
    />,
  );
  assert.match(html, /<ul class="inventory">/u);
});
