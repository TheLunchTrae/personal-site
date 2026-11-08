import type { ContentSection } from './content';

/** Whether any of the sections has text, so a page can show `ComingSoon` until one does. */
export function hasText(sections: readonly Pick<ContentSection, 'body'>[]): boolean {
  return sections.some((section) => section.body.trim() !== '');
}

/** Stands in for a page's text until I write it. */
export function ComingSoon() {
  return <p className="coming-soon">This part is still being written.</p>;
}
