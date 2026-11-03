import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ContentBlock, readSections } from '@/site/content';
import { gameTheme, gameThemes, isGameThemeId, storyHref } from '@/themes/registry';

// One credits page per game theme, written in content/credits/<id>/. The static
// export builds exactly the registry's themes.
export const dynamicParams = false;

export function generateStaticParams() {
  return gameThemes.map((theme) => ({ theme: theme.id }));
}

export async function generateMetadata({ params }: PageProps<'/credits/[theme]'>): Promise<Metadata> {
  const { theme } = await params;
  return isGameThemeId(theme) ? { title: `Credits for the ${gameTheme(theme).name} theme · Trae` } : {};
}

export default async function Credits({ params }: PageProps<'/credits/[theme]'>) {
  const { theme } = await params;
  if (!isGameThemeId(theme)) {
    notFound();
  }
  const { name, storyTitle } = gameTheme(theme);
  const sections = await readSections(`credits/${theme}`);
  // A theme can't ship without its credits.
  if (!sections.some((section) => section.body.trim() !== '')) {
    throw new Error(`content/credits/${theme}/ has no credits written.`);
  }
  return (
    <article className="prose-page" data-section="credits" data-credit-for={theme}>
      <h1>{name} credits</h1>
      {sections.map((section) => (
        <ContentBlock key={section.slug} section={section} />
      ))}
      <p className="page-aside">
        Back to <Link href={storyHref(theme)}>{storyTitle}</Link>
      </p>
    </article>
  );
}
