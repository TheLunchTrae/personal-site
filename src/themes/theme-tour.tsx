'use client';

import Image from 'next/image';
import Link from 'next/link';
import { gameThemes, storyHref } from './registry';
import { setTheme, useThemeState } from './theme-store';
import { wordmarks } from './wordmarks';

/** The game themes as a tour: switch into each one, then read what that game taught me. */
export function ThemeTour() {
  const { theme: active } = useThemeState();

  return (
    <ul className="theme-tour">
      {gameThemes.map((theme) => {
        const on = theme.id === active;
        const wordmark = wordmarks[theme.id];
        return (
          <li key={theme.id} className="theme-tour__card">
            <h3 className="theme-tour__name">
              {wordmark === undefined ? (
                theme.name
              ) : (
                <Image src={wordmark} alt={theme.name} className="theme-tour__wordmark" />
              )}
            </h3>
            <p>{theme.pitch}</p>
            <div className="theme-tour__actions">
              <button
                type="button"
                className="button"
                onClick={(event) => {
                  const button = event.currentTarget;
                  setTheme(on ? 'default' : theme.id);
                  // A theme's gameplay can cover the tour; keep focus on a control the visitor can see.
                  requestAnimationFrame(() => {
                    if (button.offsetParent === null) {
                      document.querySelector<HTMLElement>('.theme-controls select')?.focus();
                    }
                  });
                }}
              >
                {on ? 'Back to the default theme' : `Switch to ${theme.name}`}
              </button>
              <Link href={storyHref(theme.id)} className="theme-tour__story">
                {theme.storyTitle}
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
