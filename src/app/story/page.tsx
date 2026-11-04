import type { Metadata } from 'next';
import Link from 'next/link';
import { ComingSoon, hasText } from '@/site/coming-soon';
import { ContentBlock, readSections } from '@/site/content';
import { SceneSlot } from '@/site/scene-slot';
import { chapterHref, chapters } from '@/site/story';
import { StoryRoute } from '@/site/story-route';

export const metadata: Metadata = { title: 'My story · Trae' };

export default async function Story() {
  const sections = await readSections('story');
  const [first] = chapters;
  return (
    <article className="story-page" data-section="story">
      <h1>My story, in games</h1>
      <SceneSlot />
      <div className="story-page__text">
        {hasText(sections) ? (
          sections.map((section) => <ContentBlock key={section.slug} section={section} />)
        ) : (
          <ComingSoon />
        )}
      </div>
      <StoryRoute />
      {first === undefined ? null : (
        <div className="actions">
          <Link href={chapterHref(first.id)} className="button button--primary">
            Begin with {first.name}
          </Link>
        </div>
      )}
    </article>
  );
}
