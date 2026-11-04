'use client';

import { Menu } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { SiteNav } from './site-nav';

/**
 * The narrow-screen menu: a button that opens the site's pages in a modal
 * slide-out panel. Opening focuses the panel itself rather than a control.
 * The modal dialog keeps focus inside the panel, Escape closes it, and focus
 * returns to the button.
 */
export function SiteMenu() {
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const titleId = useId();

  // globals.css hides the menu on a wide screen, where the bar shows the
  // pages. Hiding it resizes it to nothing, and an open modal panel would
  // then leave the page inert behind a panel nobody can see, so it closes.
  useEffect(() => {
    const menu = menuRef.current;
    if (menu === null) {
      return undefined;
    }
    const observer = new ResizeObserver(() => {
      // No client rects means CSS has hidden the menu.
      if (menu.getClientRects().length === 0) {
        panelRef.current?.close();
      }
    });
    observer.observe(menu);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={menuRef} className="site-menu">
      <button
        ref={buttonRef}
        type="button"
        className="icon-button"
        aria-label="Menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          const panel = panelRef.current;
          panel?.showModal();
          // showModal focuses the Close button, which shows its focus ring on
          // a tap. Focusing the panel instead lets a screen reader announce
          // the menu and leaves Tab to reach the Close button and the links.
          panel?.focus();
          setOpen(true);
        }}
      >
        <Menu className="icon" strokeWidth={1.5} aria-hidden="true" />
      </button>
      {
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- the handler closes the panel for a backdrop press and for a link activation, which already has its own key handling; Escape and the Close button are the keyboard paths
        <dialog
          ref={panelRef}
          id={panelId}
          className="site-menu__panel"
          tabIndex={-1}
          aria-labelledby={titleId}
          onClose={() => {
            setOpen(false);
            // Safari does not focus a button on a click or tap, so the dialog
            // would hand focus back to the page; return it to the button.
            buttonRef.current?.focus();
          }}
          onClick={(event) => {
            // A press on the backdrop, or on a page link, which navigates away from the panel.
            if (
              event.target === event.currentTarget ||
              (event.target instanceof Element && event.target.closest('a') !== null)
            ) {
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
            <SiteNav />
          </div>
        </dialog>
      }
    </div>
  );
}
