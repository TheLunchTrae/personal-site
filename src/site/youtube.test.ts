import assert from 'node:assert/strict';
import { test } from 'node:test';
import { youtubeUrl } from './youtube';

await test('YouTube links parse to the short form without share tracking', () => {
  assert.equal(youtubeUrl.parse('https://youtu.be/SR4pQa0adsk?is=yr2plskIlNubKVIk'), 'https://youtu.be/SR4pQa0adsk');
  assert.equal(youtubeUrl.parse('https://youtu.be/_9iH0St4flQ?si=abc&t=42'), 'https://youtu.be/_9iH0St4flQ?t=42');
  assert.equal(
    youtubeUrl.parse('https://www.youtube.com/watch?v=k9mLtwdIng4&feature=share'),
    'https://youtu.be/k9mLtwdIng4',
  );
});

await test('links that are not YouTube videos fail', () => {
  for (const value of [
    'not a link',
    'http://youtu.be/SR4pQa0adsk',
    'https://example.com/watch?v=SR4pQa0adsk',
    'https://www.youtube.com/@channel',
    'https://youtu.be/short',
  ]) {
    assert.equal(youtubeUrl.safeParse(value).success, false, value);
  }
});
