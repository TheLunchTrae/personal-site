import assert from 'node:assert/strict';
import { test } from 'node:test';

// The control reads browser globals, so stub them before it loads. Storage
// throws on every call, as it does when a browser blocks site data.
const attributes = new Map<string, string>();
const refuse = () => {
  throw new Error('storage blocked');
};
// eslint-disable-next-line standards/no-global-mutation -- the module under test reads the browser's window and document globals.
Object.assign(globalThis, {
  window: { localStorage: { getItem: refuse, setItem: refuse } },
  document: { documentElement: { setAttribute: (name: string, value: string) => attributes.set(name, value) } },
});
const { setColorMode } = await import('./color-mode-control');

await test('a color mode applies for the visit when storage refuses it', () => {
  setColorMode('dark');
  assert.equal(attributes.get('data-color-mode'), 'dark');
  setColorMode('light');
  assert.equal(attributes.get('data-color-mode'), 'light');
});
