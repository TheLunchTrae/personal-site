import Link from 'next/link';
import { ColorModeControl } from './color-mode-control';
import { SiteMenu } from './site-menu';
import { SiteNav } from './site-nav';

/**
 * The site's name, its pages and the color mode. Wide screens show the pages
 * and the control in the bar; narrow screens show a menu button that opens
 * them in a slide-out panel.
 */
export function SiteHeader() {
  return (
    <header className="site-header">
      <Link href="/" className="site-name">
        Trae Stevens
      </Link>
      <div className="site-header__bar">
        <SiteNav />
        <ColorModeControl />
      </div>
      <SiteMenu />
    </header>
  );
}
