import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type ColorMode,
  colorModeBootScript,
  colorModeKey,
  colorModes,
  isColorMode,
  nextColorMode,
} from './color-mode';

// Runs the pre-paint script the way the browser does, against stub globals,
// and returns the color mode it sets on <html>.
function runBootScript(stored: string | null, blocked = false): string | undefined {
  const attributes = new Map<string, string>();
  const document = {
    documentElement: { setAttribute: (name: string, value: string) => attributes.set(name, value) },
  };
  const localStorage = {
    getItem: (key: string) => {
      if (blocked) {
        throw new Error('storage blocked');
      }
      return key === colorModeKey ? stored : null;
    },
  };
  // eslint-disable-next-line typescript/no-implied-eval -- the script ships as a string, so the test evaluates it as the browser does.
  const boot = new Function('document', 'localStorage', colorModeBootScript);
  Reflect.apply(boot, undefined, [document, localStorage]);
  return attributes.get('data-color-mode');
}

await test('the boot script resolves a stored color mode like isColorMode', () => {
  for (const stored of [...colorModes, 'sepia', '', null]) {
    assert.equal(runBootScript(stored), isColorMode(stored) ? stored : 'system', String(stored));
  }
});

await test('the boot script falls back to the system mode when storage is blocked', () => {
  assert.equal(runBootScript('dark', true), 'system');
});

await test('pressing the color mode button visits every mode once and returns to the first', () => {
  const visited: string[] = [];
  let mode: ColorMode = 'system';
  for (const _press of colorModes) {
    visited.push(mode);
    mode = nextColorMode[mode];
  }
  assert.deepEqual(new Set(visited), new Set(colorModes));
  assert.equal(mode, 'system');
});
