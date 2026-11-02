import type { ReactNode } from 'react';
import { ContentBlock, readSections } from '@/site/content';
import { gameThemes } from '@/themes/registry';
import { ThemeTour } from '@/themes/theme-tour';

// What the home page shows after a section's text, keyed by the section's file name in content/home/.
const displays: Readonly<Record<string, ReactNode>> = {
  intro: (
    <a href="/TraeStevens_Resume.pdf" download="TraeStevens_Resume.pdf" className="button">
      Download resume (PDF)
    </a>
  ),
  themes: <ThemeTour />,
};

// The theme invite has nothing to offer until a game theme is registered.
const hidden = new Set(gameThemes.length > 0 ? [] : ['themes']);

export default async function Home() {
  const sections = await readSections('home');
  return (
    <article className="prose-page" data-section="home">
      {sections
        .filter((section) => !hidden.has(section.slug))
        .map((section) => (
          <ContentBlock key={section.slug} section={section}>
            {displays[section.slug]}
          </ContentBlock>
        ))}
    </article>
  );
}
