import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentBlock, readSections } from '@/site/content';
import { creditsHref, gameTheme, themePageHref } from '@/themes/registry';

const theme = gameTheme('geometry-dash');
const levelsHref = themePageHref('geometry-dash', 'levels');

export const metadata: Metadata = { title: `${theme.storyTitle} · Trae` };

export default async function GeometryDashInfluence() {
  const sections = await readSections('influences/geometry-dash');
  return (
    <article className="prose-page" data-credit-for="geometry-dash">
      <h1>{theme.storyTitle}</h1>
      {sections.map((section) => (
        <ContentBlock key={section.slug} section={section} />
      ))}
      <p className="page-aside">
        My <Link href={levelsHref}>favorite levels</Link> and where I&apos;m at have their own page. Fonts, art and
        other credits for this theme are on its <Link href={creditsHref('geometry-dash')}>credits page</Link>.
      </p>
    </article>
  );
}
