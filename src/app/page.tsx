import Link from 'next/link';
import type { ReactNode } from 'react';
import { ContentBlock, readSections } from '@/site/content';
import { storyHref } from '@/site/story';
import { StoryRoute } from '@/site/story-route';

// What the home page shows after a section's text, keyed by the section's file name in content/home/.
const displays: Readonly<Record<string, ReactNode>> = {
  intro: (
    <div className="actions">
      <a href="/TraeStevens_Resume.pdf" download="TraeStevens_Resume.pdf" className="button button--primary">
        Download resume (PDF)
      </a>
      <Link href="/about/" className="button">
        About me
      </Link>
    </div>
  ),
  themes: (
    <>
      <StoryRoute />
      <div className="actions">
        <Link href={storyHref} className="button">
          Start the story
        </Link>
      </div>
    </>
  ),
};

export default async function Home() {
  const sections = await readSections('home');
  // A renamed file would silently drop its display, so the build fails instead.
  for (const slug of Object.keys(displays)) {
    if (!sections.some((section) => section.slug === slug)) {
      throw new Error(`content/home/${slug}.md is missing; src/app/page.tsx shows a display after it.`);
    }
  }
  return (
    <article className="prose-page" data-section="home">
      {sections.map((section) => (
        <ContentBlock key={section.slug} section={section}>
          {displays[section.slug]}
        </ContentBlock>
      ))}
    </article>
  );
}
