import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  colorModes,
  gameThemes,
  isColorMode,
  isThemeId,
  type PlayPreference,
  resolvePlay,
  storageKeys,
  themeBootScript,
} from './registry';

type Stored = Partial<Record<keyof typeof storageKeys, string | null>> | 'blocked';

// Runs the pre-paint script the way the browser does, against stub globals,
// and returns the attributes it sets on <html>.
function runBootScript(stored: Stored, reducedMotion: boolean): Map<string, string> {
  const attributes = new Map<string, string>();
  const document = {
    documentElement: { setAttribute: (name: string, value: string) => attributes.set(name, value) },
  };
  const localStorage = {
    getItem: (key: string) => {
      if (stored === 'blocked') {
        throw new Error('storage blocked');
      }
      if (key === storageKeys.theme) {
        return stored.theme ?? null;
      }
      if (key === storageKeys.colorMode) {
        return stored.colorMode ?? null;
      }
      return key === storageKeys.play ? (stored.play ?? null) : null;
    },
  };
  const matchMedia = () => ({ matches: reducedMotion });
  // eslint-disable-next-line typescript/no-implied-eval -- the script ships as a string, so the test evaluates it as the browser does.
  const boot = new Function('document', 'localStorage', 'matchMedia', themeBootScript);
  Reflect.apply(boot, undefined, [document, localStorage, matchMedia]);
  return attributes;
}

await test('the boot script resolves theme, color mode and gameplay like the registry helpers', () => {
  const themes = ['default', ...gameThemes.map((theme) => theme.id), 'retired-theme', null];
  const modes = [...colorModes, 'sepia', null];
  const plays = ['on', 'off', null] as const;
  for (const theme of themes) {
    for (const colorMode of modes) {
      for (const play of plays) {
        for (const reducedMotion of [false, true]) {
          const attributes = runBootScript({ theme, colorMode, play }, reducedMotion);
          const expectedTheme = isThemeId(theme) ? theme : 'default';
          const preference: PlayPreference = play ?? 'auto';
          const label = JSON.stringify({ theme, colorMode, play, reducedMotion });
          assert.equal(attributes.get('data-theme'), expectedTheme, label);
          assert.equal(attributes.get('data-color-mode'), isColorMode(colorMode) ? colorMode : 'system', label);
          assert.equal(
            attributes.get('data-play'),
            resolvePlay(expectedTheme, preference, reducedMotion) ? 'on' : 'off',
            label,
          );
        }
      }
    }
  }
});

await test('the boot script falls back to defaults when storage is blocked', () => {
  const attributes = runBootScript('blocked', true);
  assert.deepEqual(Object.fromEntries(attributes), {
    'data-theme': 'default',
    'data-color-mode': 'system',
    'data-play': 'off',
  });
});

await test('gameplay never turns on for the default theme', () => {
  assert.equal(resolvePlay('default', 'on', false), false);
});
