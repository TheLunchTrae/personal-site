/**
 * The visitor's color mode: follow the system, or force light or dark. It is
 * stored in `localStorage` and set as `data-color-mode` on <html>, which
 * globals.css reads to pick the palette.
 */
export const colorModes = ['system', 'light', 'dark'] as const;
export type ColorMode = (typeof colorModes)[number];

export const colorModeKey = 'color-mode';

export function isColorMode(value: unknown): value is ColorMode {
  return typeof value === 'string' && (colorModes as readonly string[]).includes(value);
}

/** The mode a press of the color mode button switches to: system, then light, then dark, then system again. */
export const nextColorMode: Readonly<Record<ColorMode, ColorMode>> = { system: 'light', light: 'dark', dark: 'system' };

/**
 * Runs in <head> before first paint, so a stored color mode never flashes the
 * system palette. It mirrors `isColorMode`; color-mode.test.ts holds them in
 * step.
 */
export const colorModeBootScript = `(function(){var c=null;try{c=localStorage.getItem(${JSON.stringify(colorModeKey)})}catch(e){}if(${JSON.stringify(colorModes)}.indexOf(c)<0)c="system";document.documentElement.setAttribute("data-color-mode",c)})();`;
