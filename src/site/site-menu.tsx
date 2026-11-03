'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ThemeControls } from '@/themes/theme-controls';

/**
 * The narrow-screen menu: a button that opens the theme controls in a modal
 * slide-out panel. The modal dialog keeps focus inside the panel, Escape
 * closes it, and focus returns to the button.
 */
export function SiteMenu() {
  const menuRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const titleId = useId();

  // globals.css hides the menu on a wide screen, where the bar shows the
  // controls. Hiding it resizes it to nothing, and an open modal panel would
  // then leave the page inert behind a panel nobody can see, so it closes.
  useEffect(() => {
    const menu = menuRef.current;
    if (menu === null) {
      return undefined;
    }
    const observer = new ResizeObserver(() => {
      if (!menu.checkVisibility()) {
        panelRef.current?.close();
      }
    });
    observer.observe(menu);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={menuRef} className="site-menu">
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
      {
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- a backdrop click is a pointer shortcut that only the dialog itself can receive; Escape and the Close button are the keyboard paths
        <dialog
          ref={panelRef}
          id={panelId}
          className="site-menu__panel"
          aria-labelledby={titleId}
          onClose={() => setOpen(false)}
          onClick={(event) => {
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
      }
    </div>
  );
}
