import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { ComingSoon, hasText } from './coming-soon';
import { ContentBlock, readSections } from './content';
import { SceneSlot } from './scene-slot';
import { type ChapterId, chapterHref, chapterPlace, chapters, storyHref } from './story';

interface ChapterPageProps {
  readonly id: ChapterId;
  /** A heading before a section, keyed by the section's file name in content/influences/<id>/. */
  readonly headings?: Readonly<Record<string, string>>;
  /** What the page shows after the chapter's text, such as a link to a related page. */
  readonly children?: ReactNode;
}

/**
 * One chapter of the story: its scene, then my text from
 * content/influences/<id>/, then the way on to the next chapter.
 */
export async function ChapterPage({ id, headings = {}, children }: ChapterPageProps) {
  const { chapter, number, previous, next } = chapterPlace(id);
  const sections = await readSections(`influences/${id}`);
  // A renamed file would silently drop its heading, so the build fails instead.
  for (const slug of Object.keys(headings)) {
    if (!sections.some((section) => section.slug === slug)) {
      throw new Error(`content/influences/${id}/${slug}.md is missing; the chapter shows a heading for it.`);
    }
  }
  return (
    <article className="story-page" data-section="chapter">
      <p className="page-kicker">
        Chapter {number} of {chapters.length}
      </p>
      <h1>{chapter.title}</h1>
      <SceneSlot />
      <div className="story-page__text">
        {hasText(sections) ? (
          sections.map((section) => {
            const heading = headings[section.slug];
            return (
              <Fragment key={section.slug}>
                {heading === undefined ? null : <h2>{heading}</h2>}
                {section.body.trim() === '' ? <ComingSoon /> : <ContentBlock section={section} />}
              </Fragment>
            );
          })
        ) : (
          <ComingSoon />
        )}
        {children}
      </div>
      <nav className="story-steps" aria-label="Story">
        <Link href={previous === undefined ? storyHref : chapterHref(previous.id)} rel="prev">
          <span className="story-steps__label">Back to</span> {previous === undefined ? 'My story' : previous.name}
        </Link>
        {next === undefined ? (
          <Link href="/about/" rel="next">
            <span className="story-steps__label">That&apos;s the story so far.</span> About me
          </Link>
        ) : (
          <Link href={chapterHref(next.id)} rel="next">
            <span className="story-steps__label">Next: chapter {number + 1}</span> {next.name}
          </Link>
        )}
      </nav>
      <p className="chapter-notice">{chapter.notice}</p>
    </article>
  );
}
