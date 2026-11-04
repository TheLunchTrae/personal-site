import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readSections } from './content';
import { chapterPlace } from './story';

// Mojang's usage guidelines require this exact wording on fan sites, so the
// chapter's notice and the credits page both carry it verbatim.
await test('the Minecraft notice uses the wording Mojang requires', async () => {
  const required = 'NOT AN OFFICIAL MINECRAFT WEBSITE. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.';
  assert.equal(chapterPlace('minecraft').chapter.notice, required);
  const credits = await readSections('credits');
  assert.ok(
    credits.some((section) => section.body.includes(required)),
    'content/credits/ carries the notice',
  );
});
