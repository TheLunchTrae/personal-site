import assert from 'node:assert/strict';
import { test } from 'node:test';
import { foundAmong } from './progress';

await test('finds count only pages that still exist', () => {
  const run = { points: 0, visited: ['story', 'about', 'resume'], awards: [], newRound: null };
  assert.equal(foundAmong(run, ['story']), 1);
  assert.equal(foundAmong(run, []), 0);
});
