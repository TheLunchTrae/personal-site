import { ThemeControls } from '@/themes/theme-controls';
import { SiteNav } from './site-nav';

/** Holds the site's tabs and the theme controls, which stay available in every theme, with gameplay on or off. */
export function SiteHeader() {
  return (
    <header className="site-header">
      <SiteNav />
      <ThemeControls />
    </header>
  );
}
