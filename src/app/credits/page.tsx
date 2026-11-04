import type { Metadata } from 'next';
import { ContentBlock, readSections } from '@/site/content';

export const metadata: Metadata = { title: 'Credits · Trae' };

export default async function Credits() {
  const sections = await readSections('credits');
  // The site can't ship without its credits.
  if (!sections.some((section) => section.body.trim() !== '')) {
    throw new Error('content/credits/ has no credits written.');
  }
  return (
    <article className="prose-page" data-section="credits">
      <h1>Credits</h1>
      {sections.map((section) => (
        <ContentBlock key={section.slug} section={section} />
      ))}
    </article>
  );
}
