import { gameThemes } from '@/themes/registry';

/** Each game theme's not-affiliated note, in full and in a short form for gameplay overlays, shown by CSS only while that theme is on so it never flashes. */
export function SiteFooter() {
  if (gameThemes.length === 0) {
    return null;
  }
  return (
    <footer className="site-footer">
      {gameThemes.map((theme) => (
        <p key={theme.id} className="theme-credit" data-credit-for={theme.id}>
          <span className="theme-credit__full">{theme.notice}</span>
          <span className="theme-credit__short">{theme.shortNotice}</span>
        </p>
      ))}
    </footer>
  );
}
