import { ThemeControls } from '@/themes/theme-controls';
import { SiteMenu } from './site-menu';

/**
 * Holds the theme controls, which stay available in every theme, with
 * gameplay on or off. Wide screens show them in the bar; narrow screens show
 * a menu button that opens them in a slide-out panel.
 */
export function SiteHeader() {
  return (
    <header className="site-header">
      <ThemeControls />
      <SiteMenu />
    </header>
  );
}
