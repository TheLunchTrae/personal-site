import Link from 'next/link';
import { chapterHref, chapters } from './story';

/** The chapters in story order, drawn as stops on one route. */
export function StoryRoute() {
  return (
    <ol className="story-route">
      {chapters.map((chapter, index) => (
        <li key={chapter.id}>
          <span className="story-route__number">Chapter {index + 1}</span>
          <Link href={chapterHref(chapter.id)}>{chapter.name}</Link>
        </li>
      ))}
    </ol>
  );
}
