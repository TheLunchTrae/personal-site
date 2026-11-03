'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { creditsHref, gameThemes, type GameThemeId, storyHref } from '@/themes/registry';
import { sectionHref } from './sections';

/**
 * Which themes show a tab. A tab with no scope shows in every theme. The
 * default theme shows each game theme's `story` tab. A game theme shows its
 * own `story` and `theme` tabs and hides every other theme's. CSS applies
 * these rules from the `data-theme` the head script sets before first paint,
 * so the tabs never flash another theme's; docs/themes.md lists the rule each
 * theme's stylesheet adds.
 */
type TabScope = 'story' | 'theme';

interface Tab {
  readonly href: string;
  readonly label: string;
  readonly scope?: TabScope;
  readonly theme?: GameThemeId;
}

/** Every tab in the order the bar shows it: Home, then each game theme's influence page, own pages and credits. */
export const navTabs: readonly Tab[] = [
  { href: '/', label: 'Home' },
  ...gameThemes.flatMap((theme): Tab[] => [
    { href: storyHref(theme.id), label: theme.name, scope: 'story', theme: theme.id },
    ...theme.pages.map((page): Tab => ({ href: page.href, label: page.label, scope: 'theme', theme: theme.id })),
    { href: creditsHref(theme.id), label: 'Credits', scope: 'theme', theme: theme.id },
  ]),
];

/** The site's tabs, which stay visible and work in every theme, with gameplay on or off. */
export function SiteNav() {
  const current = sectionHref(usePathname());
  return (
    <nav className="site-nav" aria-label="Site">
      <ul className="site-nav__list">
        {navTabs.map((tab) => (
          <li key={tab.href} className="site-nav__item" data-nav-scope={tab.scope} data-nav-for={tab.theme}>
            <Link href={tab.href} className="site-nav__tab" aria-current={tab.href === current ? 'page' : undefined}>
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
