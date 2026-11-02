import { ThemeControls } from '@/themes/theme-controls';

/** Holds the theme controls, which stay available in every theme, with gameplay on or off. */
export function SiteHeader() {
  return (
    <header className="site-header">
      <ThemeControls />
    </header>
  );
}
