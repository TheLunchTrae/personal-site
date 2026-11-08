/**
 * The personal story: one chapter per game that inspired me, read in this
 * order. A chapter's place here is its number, so reordering the entries
 * reorders the story. docs/story.md describes how the section fits together.
 */
export type ChapterId = 'minecraft' | 'geometry-dash' | 'call-of-duty';

export interface Chapter {
  /** The chapter's page slug under /story/ and its text folder under content/influences/. */
  readonly id: ChapterId;
  /** The game's name. */
  readonly name: string;
  /** The chapter page's title. */
  readonly title: string;
  /**
   * The short not-affiliated line under the chapter, in the wording the game's
   * owner asks for when it has one. The credits page carries the full statement.
   */
  readonly notice: string;
}

export const chapters: readonly Chapter[] = [
  {
    id: 'minecraft',
    name: 'Minecraft',
    title: 'How Minecraft inspired me',
    // Mojang's usage guidelines require this exact wording on fan websites.
    notice: 'NOT AN OFFICIAL MINECRAFT WEBSITE. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.',
  },
  {
    id: 'geometry-dash',
    name: 'Geometry Dash',
    title: 'How Geometry Dash inspired me',
    // RobTop Games publishes no required wording, so this states the relationship plainly.
    notice: 'Not affiliated with or endorsed by RobTop Games.',
  },
  {
    id: 'call-of-duty',
    name: 'Call of Duty',
    title: 'How Zombies inspired me',
    // Activision publishes no required wording for fan sites, so this states the relationship plainly.
    notice: 'Not affiliated with or endorsed by Activision.',
  },
];

export const storyHref = '/story/';

export function chapterHref(id: ChapterId): string {
  return `${storyHref}${id}/`;
}

/** The chapter, its number from 1, and its neighbors in story order. */
export function chapterPlace(id: ChapterId): {
  readonly chapter: Chapter;
  readonly number: number;
  readonly previous: Chapter | undefined;
  readonly next: Chapter | undefined;
} {
  const index = chapters.findIndex((chapter) => chapter.id === id);
  const chapter = chapters[index];
  if (chapter === undefined) {
    throw new Error(`The story has no chapter with id ${id}.`);
  }
  return { chapter, number: index + 1, previous: chapters[index - 1], next: chapters[index + 1] };
}
