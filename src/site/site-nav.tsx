'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { storyHref } from './story';

const links = [
  { href: '/', label: 'Home' },
  { href: '/about/', label: 'About' },
  { href: storyHref, label: 'My story' },
] as const;

/** Normalizes a pathname to the trailing-slash form that `trailingSlash: true` serves. */
function withSlash(pathname: string): string {
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

/**
 * The site's pages. On a chapter page the story link is marked as the current
 * section (`aria-current="true"`), since it links to a different page.
 */
export function SiteNav() {
  const pathname = withSlash(usePathname());
  return (
    <nav className="site-nav" aria-label="Site">
      <ul>
        {links.map(({ href, label }) => {
          const within = href !== '/' && pathname.startsWith(href);
          const current = pathname === href ? 'page' : within ? 'true' : undefined;
          return (
            <li key={href}>
              <Link href={href} aria-current={current}>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
