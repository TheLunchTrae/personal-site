'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ThemeControls } from '@/themes/theme-controls';

// Matches the width at which globals.css shows the theme controls in the bar and hides this menu.
const wideScreen = '(min-width: 40rem)';

/**
 * The narrow-screen menu: a button that opens the theme controls in a modal
 * slide-out panel. The modal dialog keeps focus inside the panel, Escape
 * closes it, and focus returns to the button.
 */
export function SiteMenu() {
  const panelRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const titleId = useId();

  // The bar shows the controls on a wide screen, so the panel closes when the screen widens.
  useEffect(() => {
    const query = window.matchMedia(wideScreen);
    const closeWhenWide = () => {
      if (query.matches) {
        panelRef.current?.close();
      }
    };
    query.addEventListener('change', closeWhenWide);
    return () => query.removeEventListener('change', closeWhenWide);
  }, []);

  return (
    <div className="site-menu">
      <button
        type="button"
        className="site-menu__button"
        aria-label="Menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          panelRef.current?.showModal();
          setOpen(true);
        }}
      >
        <svg className="site-menu__icon" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M2 3.5h12M2 8h12M2 12.5h12" />
        </svg>
      </button>
      <dialog
        ref={panelRef}
        id={panelId}
        className="site-menu__panel"
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        // A press on the backdrop lands on the dialog itself, outside the panel's body, and closes it.
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            event.currentTarget.close();
          }
        }}
      >
        <div className="site-menu__body">
          <div className="site-menu__top">
            <h2 id={titleId} className="site-menu__title">
              Menu
            </h2>
            <button type="button" className="site-menu__close" onClick={() => panelRef.current?.close()}>
              Close
            </button>
          </div>
          <ThemeControls />
        </div>
      </dialog>
    </div>
  );
}
