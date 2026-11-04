import type { Metadata } from 'next';
import Link from 'next/link';
import { ComingSoon, hasText } from '@/site/coming-soon';
import { ContentBlock, readSections } from '@/site/content';
import { storyHref } from '@/site/story';

export const metadata: Metadata = { title: 'About · Trae' };

export default async function About() {
  const sections = await readSections('about');
  return (
    <article className="prose-page" data-section="about">
      <h1>About me</h1>
      {hasText(sections) ? (
        sections.map((section) => <ContentBlock key={section.slug} section={section} />)
      ) : (
        <ComingSoon />
      )}
      <div className="actions">
        <a href="/TraeStevens_Resume.pdf" download="TraeStevens_Resume.pdf" className="button button--primary">
          Download resume (PDF)
        </a>
        <Link href={storyHref} className="button">
          Read my story
        </Link>
      </div>
    </article>
  );
}
