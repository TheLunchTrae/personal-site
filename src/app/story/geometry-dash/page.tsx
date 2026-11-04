import type { Metadata } from 'next';
import Link from 'next/link';
import { ChapterPage } from '@/site/chapter-page';
import { chapterPlace } from '@/site/story';

export const metadata: Metadata = { title: `${chapterPlace('geometry-dash').chapter.title} · Trae` };

export default function GeometryDashChapter() {
  return (
    <ChapterPage id="geometry-dash">
      <p className="page-aside">
        See the levels I&apos;ve beaten and love on my <Link href="/story/geometry-dash/levels/">favorite levels</Link>{' '}
        page.
      </p>
    </ChapterPage>
  );
}
