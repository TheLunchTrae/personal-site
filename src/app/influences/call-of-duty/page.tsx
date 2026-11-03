import type { Metadata } from 'next';
import Link from 'next/link';
import { Fragment } from 'react';
import { ContentBlock, readSections } from '@/site/content';
import { creditsHref, gameTheme } from '@/themes/registry';

const theme = gameTheme('call-of-duty');

export const metadata: Metadata = { title: `${theme.storyTitle} · Trae` };

// Each gameplay menu nods to one game. Its heading, keyed by the blurb's file
// name in content/influences/call-of-duty/, comes before the blurb.
const menus: Readonly<Record<string, { readonly menu: string; readonly game: string }>> = {
  'black-ops-1': { menu: 'The TV wall', game: 'Black Ops' },
  'black-ops-2': { menu: 'The globe', game: 'Black Ops II' },
  'black-ops-3': { menu: 'The gumball machine', game: 'Black Ops III' },
};

export default async function CallOfDutyInfluence() {
  const sections = await readSections('influences/call-of-duty');
  // A renamed file would silently drop its heading, so the build fails instead.
  for (const slug of Object.keys(menus)) {
    if (!sections.some((section) => section.slug === slug)) {
      throw new Error(`content/influences/call-of-duty/${slug}.md is missing; the page shows a heading for it.`);
    }
  }
  return (
    <article className="prose-page" data-credit-for="call-of-duty">
      <h1>{theme.storyTitle}</h1>
      {sections.map((section) => {
        const heading = menus[section.slug];
        return (
          <Fragment key={section.slug}>
            {heading === undefined ? null : (
              <h2 className="cod-menu-heading">
                {heading.menu} <span className="cod-menu-game">· {heading.game}</span>
              </h2>
            )}
            {/* A blurb not written yet leaves its heading on its own. */}
            {section.body.trim() === '' ? null : <ContentBlock section={section} />}
          </Fragment>
        );
      })}
      <p className="page-aside">
        Fonts, art and other credits for this theme are on its{' '}
        <Link href={creditsHref('call-of-duty')}>credits page</Link>.
      </p>
    </article>
  );
}
