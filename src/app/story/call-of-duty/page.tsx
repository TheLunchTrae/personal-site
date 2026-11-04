import type { Metadata } from 'next';
import { ChapterPage } from '@/site/chapter-page';
import { chapterPlace } from '@/site/story';

export const metadata: Metadata = { title: `${chapterPlace('call-of-duty').chapter.title} · Trae` };

// Each blurb in content/influences/call-of-duty/ is about one game.
const headings = { 'black-ops-1': 'Black Ops', 'black-ops-2': 'Black Ops II', 'black-ops-3': 'Black Ops III' };

export default function CallOfDutyChapter() {
  return <ChapterPage id="call-of-duty" headings={headings} />;
}
