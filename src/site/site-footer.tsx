import Link from 'next/link';
import { creditsHref, gameThemes } from '@/themes/registry';

/** Each game theme's small not-affiliated line and a link to its credits, shown by CSS only while that theme is on so it never flashes. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      {gameThemes.map((theme) => (
        <p key={theme.id} className="theme-credit" data-credit-for={theme.id}>
          <span>{theme.notice}</span> <Link href={creditsHref(theme.id)}>Credits</Link>
        </p>
      ))}
    </footer>
  );
}
