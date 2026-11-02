'use client';

import { useSyncExternalStore } from 'react';
import { colorModes, gameThemes, isColorMode, isGameThemeId, isThemeId } from './registry';
import { setColorMode, setPlay, setTheme, useThemeState } from './theme-store';

const subscribeNever = () => () => undefined;

const colorModeLabels = { system: 'System', light: 'Light', dark: 'Dark' } as const;

/**
 * The always-present theme controls. The theme picker shows once a game theme
 * is registered. Color mode belongs to the default look, so it shows only
 * there; the gameplay switch shows only for game themes.
 */
export function ThemeControls() {
  const { theme, colorMode, play } = useThemeState();
  // Until hydration the controls would show the server's defaults, so CSS keeps them hidden.
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );

  return (
    <div className="theme-controls" data-hydrated={hydrated ? '' : undefined}>
      {gameThemes.length > 0 ? (
        <label className="theme-controls__field">
          <span>Theme</span>
          <select
            value={theme}
            onChange={(event) => {
              const next = event.currentTarget.value;
              if (isThemeId(next)) {
                setTheme(next);
              }
            }}
          >
            <option value="default">Default</option>
            {gameThemes.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {isGameThemeId(theme) ? (
        <button type="button" className="theme-controls__play" aria-pressed={play} onClick={() => setPlay(!play)}>
          Gameplay{' '}
          <span className="theme-controls__state" aria-hidden="true">
            {play ? 'on' : 'off'}
          </span>
        </button>
      ) : (
        <label className="theme-controls__field">
          <span>Mode</span>
          <select
            value={colorMode}
            onChange={(event) => {
              const next = event.currentTarget.value;
              if (isColorMode(next)) {
                setColorMode(next);
              }
            }}
          >
            {colorModes.map((mode) => (
              <option key={mode} value={mode}>
                {colorModeLabels[mode]}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
