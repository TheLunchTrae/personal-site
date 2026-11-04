import type { Metadata } from 'next';
import { ChapterPage } from '@/site/chapter-page';
import { chapterPlace } from '@/site/story';

export const metadata: Metadata = { title: `${chapterPlace('minecraft').chapter.title} · Trae` };

export default function MinecraftChapter() {
  return <ChapterPage id="minecraft" />;
}
