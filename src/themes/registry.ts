/**
 * The site's looks. `default` is the plain site, which follows a color mode
 * (system, light or dark). Every other theme is a game theme: it restyles the
 * whole site and offers gameplay navigation that the visitor can turn off.
 * docs/themes.md describes how a game theme plugs in.
 */

/**
 * Every game theme's id. A theme's id goes here and its entry goes in
 * `gameThemes`; `players` in play-layer.tsx is keyed by this type, so the
 * build fails until the theme's gameplay plugs in. While no game theme is
 * registered, it is `never`.
 */
export type GameThemeId = never;

export interface GameTheme {
  /** Value of `html[data-theme]`, the theme's folder under src/themes/, and its influence page slug. */
  readonly id: GameThemeId;
  /** The game's name, used as the theme's name. */
  readonly name: string;
  /** The not-affiliated note shown while the theme is on, in the wording the game's owner asks for when it has one. */
  readonly notice: string;
  /** A short form of the note for gameplay that covers the page; the same text as `notice` when the owner's wording is required. */
  readonly shortNotice: string;
  /** One line for the home page tour. */
  readonly pitch: string;
  /** Title of the theme's influence page. */
  readonly storyTitle: string;
}

/**
 * The game themes, in the order the site shows them: the home page tour, the
 * theme picker, and the footer credits all follow this list. Reorder the
 * entries to change that order.
 */
export const gameThemes: readonly GameTheme[] = [];

// eslint-disable-next-line typescript/no-redundant-type-constituents -- no game theme is registered, so GameThemeId is never; this exception fails as unused once one is.
export type ThemeId = 'default' | GameThemeId;

export const colorModes = ['system', 'light', 'dark'] as const;
export type ColorMode = (typeof colorModes)[number];

/** A stored gameplay choice; `auto` means the visitor has not chosen. */
export type PlayPreference = 'on' | 'off' | 'auto';

export const storageKeys = { theme: 'theme', colorMode: 'color-mode', play: 'play' } as const;

const themeIds: readonly string[] = ['default', ...gameThemes.map((theme) => theme.id)];
const gameThemeIds: readonly string[] = gameThemes.map((theme) => theme.id);

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && themeIds.includes(value);
}

export function isGameThemeId(value: unknown): value is GameThemeId {
  return typeof value === 'string' && gameThemeIds.includes(value);
}

export function isColorMode(value: unknown): value is ColorMode {
  return typeof value === 'string' && (colorModes as readonly string[]).includes(value);
}

export function gameTheme(id: GameThemeId): GameTheme {
  const theme = gameThemes.find((entry) => entry.id === id);
  if (theme === undefined) {
    throw new Error('A game theme id has no entry in gameThemes.');
  }
  return theme;
}

export function storyHref(id: GameThemeId): string {
  // String() only satisfies restrict-template-expressions while GameThemeId is
  // never; no-unnecessary-type-conversion flags it once a theme is registered.
  return `/influences/${String(id)}/`;
}

/** Gameplay is on for a game theme unless the visitor turned it off, or never chose and prefers reduced motion. */
export function resolvePlay(theme: ThemeId, preference: PlayPreference, reducedMotion: boolean): boolean {
  if (!isGameThemeId(theme)) {
    return false;
  }
  return preference === 'auto' ? !reducedMotion : preference === 'on';
}

/**
 * Runs in <head> before first paint, so a stored theme, color mode or
 * gameplay choice never flashes the default. It mirrors `isThemeId`,
 * `isColorMode` and `resolvePlay`; registry.test.ts holds them in step.
 */
export const themeBootScript = `(function(){var d=document.documentElement;function g(k){try{return localStorage.getItem(k)}catch(e){return null}}var t=g(${JSON.stringify(storageKeys.theme)});if(${JSON.stringify(themeIds)}.indexOf(t)<0)t="default";var c=g(${JSON.stringify(storageKeys.colorMode)});if(${JSON.stringify(colorModes)}.indexOf(c)<0)c="system";var p=g(${JSON.stringify(storageKeys.play)});var rm=false;try{rm=matchMedia("(prefers-reduced-motion: reduce)").matches}catch(e){}var on=${JSON.stringify(gameThemeIds)}.indexOf(t)>-1&&(p==="on"||(p!=="off"&&!rm));d.setAttribute("data-theme",t);d.setAttribute("data-color-mode",c);d.setAttribute("data-play",on?"on":"off")})();`;
