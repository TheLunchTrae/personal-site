import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Influence blurbs are Markdown files under content/influences/<theme id>/,
 * one file per section. They are read and rendered at build time by server
 * components, so no Markdown parser ships to the browser. docs/themes.md
 * describes the file format.
 */
export interface InfluenceSection {
  /** The file name without `.md`. */
  readonly slug: string;
  /** The section heading from the file's front matter, if it has one. */
  readonly title: string | undefined;
  /** Sort key from the front matter; sections without one sort first, then by slug. */
  readonly order: number;
  /** The Markdown after the front matter. */
  readonly body: string;
}

const influenceRoot = path.join(process.cwd(), 'content', 'influences');
const frontMatter = /^---\n([\s\S]*?)\n---(?:\n|$)/u;

function parseSection(slug: string, source: string, file: string): InfluenceSection {
  // Files written on Windows use CRLF line endings.
  const text = source.replaceAll('\r\n', '\n');
  const match = frontMatter.exec(text);
  let title: string | undefined;
  let order = 0;
  for (const line of (match?.[1] ?? '').split('\n')) {
    if (line.trim() === '') {
      continue;
    }
    const separator = line.indexOf(':');
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (separator > 0 && key === 'title' && value !== '') {
      title = value;
    } else if (separator > 0 && key === 'order' && /^-?\d+$/u.test(value)) {
      order = Number(value);
    } else {
      throw new Error(`${file}: front matter takes only "title: <text>" and "order: <whole number>", not "${line}".`);
    }
  }
  return { slug, title, order, body: match === null ? text : text.slice(match[0].length) };
}

/** Reads a theme's influence sections in order. A theme with no blurbs yet has none. */
export async function readInfluence(themeId: string, root = influenceRoot): Promise<readonly InfluenceSection[]> {
  const directory = path.join(root, themeId);
  let names: string[];
  try {
    names = await readdir(directory);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
  const sections = await Promise.all(
    names
      .filter((name) => name.endsWith('.md'))
      .map(async (name) => {
        const file = path.join(directory, name);
        return parseSection(name.slice(0, -'.md'.length), await readFile(file, 'utf8'), file);
      }),
  );
  return sections.toSorted((a, b) => (a.order === b.order ? a.slug.localeCompare(b.slug) : a.order - b.order));
}

interface InfluenceSectionsProps {
  readonly sections: readonly InfluenceSection[];
  /** Replaces the element rendered for a Markdown node, such as `h3` or `ul`, when a theme needs more than CSS. */
  readonly components?: Components;
}

/**
 * Renders a theme's influence sections as GitHub-flavored Markdown: plain
 * semantic elements (`h2`, `p`, `ul`, `em`) inside `.influence-section`, which
 * the active theme styles. Raw HTML in a blurb is not rendered.
 */
export function InfluenceSections({ sections, components }: InfluenceSectionsProps) {
  return sections.map((section) => (
    <section key={section.slug} className="influence-section" aria-label={section.title}>
      {section.title === undefined ? null : <h2>{section.title}</h2>}
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {section.body}
      </Markdown>
    </section>
  ));
}
