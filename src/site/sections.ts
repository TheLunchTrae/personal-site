import { gameTheme, type GameThemeId, storyHref } from '@/themes/registry';

/**
 * The pages a game theme's gameplay can reach: the site's pages, then the
 * active theme's own influence page, which every game theme calls `story`.
 */
export interface GameSection {
  readonly id: 'home' | 'story';
  readonly href: string;
  readonly label: string;
  /** Short uppercase name for in-game signage. */
  readonly tag: string;
}

export type GameSectionId = GameSection['id'];

const sitePages: readonly GameSection[] = [{ id: 'home', href: '/', label: 'Home', tag: 'HOME' }];

// One stable list per theme, so gameplay effects keyed on it do not restart on every render.
const gameSectionLists = new Map<GameThemeId, readonly GameSection[]>();

/** The pages a game theme's gameplay navigation offers, in order. */
export function gameSections(theme: GameThemeId): readonly GameSection[] {
  let list = gameSectionLists.get(theme);
  if (list === undefined) {
    list = [...sitePages, { id: 'story', href: storyHref(theme), label: gameTheme(theme).name, tag: 'STORY' }];
    gameSectionLists.set(theme, list);
  }
  return list;
}

/** Normalizes a pathname to the trailing-slash form that `trailingSlash: true` serves. */
export function sectionHref(pathname: string): string {
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}
