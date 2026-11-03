import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ContentBlock, readSections } from '@/site/content';
import { type FavoriteLevel, favoriteLevel, type ProgressLevel, progressLevel } from '@/themes/geometry-dash/levels';
import { gameTheme, storyHref } from '@/themes/registry';

export const metadata: Metadata = { title: 'Favorite Geometry Dash levels · Trae' };

const statusLabels: Record<ProgressLevel['status'], string> = {
  hardest: 'Hardest beaten',
  next: 'Playing now',
};

function LevelLink({ level }: { readonly level: FavoriteLevel }) {
  return (
    <>
      <a href={level.url} rel="noreferrer">
        {level.title}
      </a>
      {level.creator === undefined ? null : <> by {level.creator}</>}
    </>
  );
}

export default async function FavoriteLevels() {
  const [sections, progress, favorites] = await Promise.all([
    readSections('levels'),
    readSections('levels/progress', { schema: progressLevel }),
    readSections('levels/favorites', { schema: favoriteLevel }),
  ]);
  // What the page shows after a section's text, keyed by the section's file name in content/levels/.
  const displays: Readonly<Record<string, ReactNode>> = {
    progress: (
      <ul className="level-list" data-list="progress">
        {progress.map(({ slug, fields }) => (
          <li key={slug}>
            <span className="level-list__label">{statusLabels[fields.status]}:</span> <LevelLink level={fields} />
            {fields.progress === undefined ? null : <>, best {fields.progress}%</>}
          </li>
        ))}
      </ul>
    ),
    // The files keep the order; the list shows no positions, since rankings shift.
    favorites: (
      <ul className="level-list" data-list="favorites">
        {favorites.map(({ slug, fields }) => (
          <li key={slug}>
            <LevelLink level={fields} />
          </li>
        ))}
      </ul>
    ),
  };
  for (const slug of Object.keys(displays)) {
    if (!sections.some((section) => section.slug === slug)) {
      throw new Error(`content/levels/${slug}.md is missing; the levels page shows a list after it.`);
    }
  }
  return (
    <article className="prose-page" data-section="levels" data-credit-for="geometry-dash">
      <h1>Favorite levels</h1>
      {sections.map((section) => (
        <ContentBlock key={section.slug} section={section}>
          {displays[section.slug]}
        </ContentBlock>
      ))}
      <p className="page-aside">
        Back to <Link href={storyHref('geometry-dash')}>{gameTheme('geometry-dash').storyTitle}</Link>
      </p>
    </article>
  );
}
