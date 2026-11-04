import Link from 'next/link';
import { ColorModeButton } from './color-mode-control';
import { SiteMenu } from './site-menu';
import { SiteNav } from './site-nav';

/**
 * The site's name, its pages and the color mode button. Wide screens show the
 * pages in the bar; narrow screens show a menu button that opens them in a
 * slide-out panel. The color mode button stays in the header on both.
 */
export function SiteHeader() {
  return (
    <header className="site-header">
      <Link href="/" className="site-name">
        Trae Stevens
      </Link>
      <div className="site-header__actions">
        <div className="site-header__bar">
          <SiteNav />
        </div>
        <ColorModeButton />
        <SiteMenu />
      </div>
    </header>
  );
}
