import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentBlock, readSections } from '@/site/content';
import { chapterLabel, creditsHref, gameTheme } from '@/themes/registry';

const theme = gameTheme('minecraft');

export const metadata: Metadata = { title: `${theme.storyTitle} · Trae` };

export default async function MinecraftInfluence() {
  const sections = await readSections('influences/minecraft');
  return (
    <article className="prose-page" data-credit-for="minecraft">
      <p className="page-kicker">
        {chapterLabel(theme.id)} · {theme.name}
      </p>
      <h1>{theme.storyTitle}</h1>
      {sections.map((section) => (
        <ContentBlock key={section.slug} section={section} />
      ))}
      <p className="page-aside">
        Fonts, art and other credits for this chapter&apos;s look are on its{' '}
        <Link href={creditsHref('minecraft')}>credits page</Link>.
      </p>
    </article>
  );
}
