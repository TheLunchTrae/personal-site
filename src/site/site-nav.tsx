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

/** The site's pages. The story link stays current on every chapter page. */
export function SiteNav() {
  const pathname = withSlash(usePathname());
  return (
    <nav className="site-nav" aria-label="Site">
      <ul>
        {links.map(({ href, label }) => {
          const current = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link href={href} aria-current={current ? 'page' : undefined}>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
