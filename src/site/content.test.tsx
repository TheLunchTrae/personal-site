import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ContentBlock, readSections } from './content';

async function contentRoot(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'content-'));
  for (const [name, text] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await writeFile(path.join(root, name), text);
  }
  return root;
}

await test('sections read in front matter order, then by file name', async () => {
  const root = await contentRoot({
    'page/black-ops-2.md': '---\r\norder: 2\r\n---\r\nSecond.\r\n',
    'page/black-ops-1.md': '---\norder: 1\n---\nFirst.\n',
    'page/intro.md': 'No front matter.\n',
    'page/README.md': 'Notes for writers.',
    'page/notes.txt': 'Not a section.',
  });
  const sections = await readSections('page', root);
  assert.deepEqual(
    sections.map(({ slug, order, body }) => [slug, order, body]),
    [
      ['intro', 0, 'No front matter.\n'],
      ['black-ops-1', 1, 'First.\n'],
      ['black-ops-2', 2, 'Second.\n'],
    ],
  );
});

await test('a folder that does not exist has no sections', async () => {
  assert.deepEqual(await readSections('missing', await contentRoot({})), []);
});

await test('a mistyped front matter key fails the build', async () => {
  const root = await contentRoot({ 'page/blurb.md': '---\nordre: 1\n---\nText.\n' });
  await assert.rejects(readSections('page', root), /ordre: 1/u);
});

await test('sections render GitHub-flavored Markdown without raw HTML', () => {
  const html = renderToStaticMarkup(
    <ContentBlock section={{ slug: 'a', order: 0, body: '| A |\n| - |\n| 1 |\n\n<script>alert(1)</script>\n' }} />,
  );
  assert.match(html, /<table>/u);
  assert.doesNotMatch(html, /<script>/u);
});

await test('a theme can replace the element rendered for a Markdown node', () => {
  const html = renderToStaticMarkup(
    <ContentBlock
      section={{ slug: 'a', order: 0, body: '- one\n' }}
      components={{ ul: ({ children }) => <ul className="inventory">{children}</ul> }}
    />,
  );
  assert.match(html, /<ul class="inventory">/u);
});
