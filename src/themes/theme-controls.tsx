'use client';

import { useSyncExternalStore } from 'react';
import { colorModes, gameThemes, isColorMode, isGameThemeId, isThemeId } from './registry';
import { setColorMode, setPlay, setTheme, useThemeState } from './theme-store';

const subscribeNever = () => () => undefined;

/**
 * Focuses the first visible match for a theme control. The bar and the menu
 * panel each hold a copy, and on a narrow screen the bar's copy is hidden and
 * the panel is closed, so focus goes to the menu button that opens it.
 */
export function focusThemeControl(selector: string): void {
  const visible = [...document.querySelectorAll<HTMLElement>(selector)].find((control) => control.checkVisibility());
  (visible ?? document.querySelector<HTMLElement>('.site-menu__button'))?.focus();
}

const colorModeLabels = { system: 'System', light: 'Light', dark: 'Dark' } as const;

/**
 * The always-present theme controls: the theme picker, then the color mode,
 * which belongs to the default look and shows only there, or the gameplay
 * switch, which shows only for game themes.
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
      <label className="theme-controls__field">
        <span>Chapter</span>
        <select
          value={theme}
          onChange={(event) => {
            const next = event.currentTarget.value;
            if (isThemeId(next)) {
              setTheme(next);
            }
          }}
        >
          <option value="default">Plain site</option>
          {gameThemes.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
      {isGameThemeId(theme) ? (
        <button type="button" className="theme-controls__play" aria-pressed={play} onClick={() => setPlay(!play)}>
          Gameplay{' '}
          <span className="theme-controls__state" aria-hidden="true">
            {play ? 'on' : 'off'}
          </span>
        </button>
      ) : (
        <label className="theme-controls__field">
          <span>Colors</span>
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
