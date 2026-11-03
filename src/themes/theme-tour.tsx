'use client';

import Image from 'next/image';
import Link from 'next/link';
import { chapterLabel, gameThemes, storyHref } from './registry';
import { setTheme, useThemeState } from './theme-store';
import { wordmarks } from './wordmarks';

/** The game themes as the chapters of my story: step into each one, then read how that game inspired me. */
export function ThemeTour() {
  const { theme: active } = useThemeState();

  return (
    <ul className="theme-tour">
      {gameThemes.map((theme) => {
        const on = theme.id === active;
        const wordmark = wordmarks[theme.id];
        return (
          <li key={theme.id} className="theme-tour__card">
            <span className="theme-tour__chapter">{chapterLabel(theme.id)}</span>
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
                {on ? 'Back to the plain site' : `Step into ${theme.name}`}
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
