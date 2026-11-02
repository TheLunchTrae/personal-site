import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { type ContentSection, ContentBlock, readSections } from './content';

// Writes the files to a fresh content root, reads one folder, and removes the root.
async function read(files: Record<string, string>, folder = 'page'): Promise<readonly ContentSection[]> {
  const root = await mkdtemp(path.join(tmpdir(), 'content-'));
  try {
    for (const [name, text] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(root, name)), { recursive: true });
      await writeFile(path.join(root, name), text);
    }
    return await readSections(folder, root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

await test('sections read in front matter order, then by file name', async () => {
  const sections = await read({
    'page/black-ops-2.md': '﻿---\r\norder: 2\r\n--- \r\nSecond.\r\n',
    'page/black-ops-1.md': '---\norder: 1\n---\nFirst.\n',
    'page/intro.md': 'No front matter.\n',
    'page/empty.md': '---\n---\nEmpty front matter.\n',
    'page/README.md': 'Notes for writers.',
    'page/notes.txt': 'Not a section.',
  });
  assert.deepEqual(
    sections.map(({ slug, order, body }) => [slug, order, body]),
    [
      ['empty', 0, 'Empty front matter.\n'],
      ['intro', 0, 'No front matter.\n'],
      ['black-ops-1', 1, 'First.\n'],
      ['black-ops-2', 2, 'Second.\n'],
    ],
  );
});

await test('a folder that does not exist has no sections', async () => {
  assert.deepEqual(await read({}, 'missing'), []);
});

await test('front matter mistakes fail the build', async () => {
  await assert.rejects(read({ 'page/a.md': '---\nordre: 1\n---\nText.\n' }), /ordre: 1/u);
  await assert.rejects(read({ 'page/a.md': '---\norder: 1\norder: 2\n---\nText.\n' }), /order: 2/u);
  await assert.rejects(read({ 'page/a.md': '---\norder: 1\nText.\n' }), /never closes/u);
});

await test('sections render GitHub-flavored Markdown with raw HTML as text', () => {
  const html = renderToStaticMarkup(
    <ContentBlock section={{ slug: 'a', order: 0, body: '| A |\n| - |\n| 1 |\n\n<script>alert(1)</script>\n' }} />,
  );
  assert.match(html, /<table>/u);
  assert.doesNotMatch(html, /<script>/u);
});
