import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ReactNode } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * The site's prose lives in Markdown files under content/, one file per
 * section, so it can be written and edited on its own. Server components read
 * and render the files at build time, so no Markdown parser ships to the
 * browser. content/README.md maps each file to where it appears, and
 * docs/themes.md describes the format.
 */
export interface ContentSection {
  /** The file name without `.md`. */
  readonly slug: string;
  /** Sort key from the front matter; sections without one sort first, then by slug. */
  readonly order: number;
  /** The Markdown after the front matter. */
  readonly body: string;
}

const contentRoot = path.join(process.cwd(), 'content');
const frontMatter = /^---\n([\s\S]*?)\n---(?:\n|$)/u;

function parseSection(slug: string, source: string, file: string): ContentSection {
  // Files written on Windows use CRLF line endings.
  const text = source.replaceAll('\r\n', '\n');
  const match = frontMatter.exec(text);
  let order = 0;
  for (const line of (match?.[1] ?? '').split('\n')) {
    const value = /^order:\s*(-?\d+)\s*$/u.exec(line)?.[1];
    if (value !== undefined) {
      order = Number(value);
    } else if (line.trim() !== '') {
      throw new Error(`${file}: front matter takes only "order: <whole number>", not "${line}".`);
    }
  }
  return { slug, order, body: match === null ? text : text.slice(match[0].length) };
}

/** Reads the sections in a folder under content/, in order. A folder that does not exist has none. */
export async function readSections(folder: string, root = contentRoot): Promise<readonly ContentSection[]> {
  const directory = path.join(root, folder);
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
      .filter((name) => name.endsWith('.md') && name !== 'README.md')
      .map(async (name) => {
        const file = path.join(directory, name);
        return parseSection(name.slice(0, -'.md'.length), await readFile(file, 'utf8'), file);
      }),
  );
  return sections.toSorted((a, b) => (a.order === b.order ? a.slug.localeCompare(b.slug) : a.order - b.order));
}

interface ContentBlockProps {
  readonly section: ContentSection;
  /** Replaces the element rendered for a Markdown node, such as `h2` or `ul`, when a theme needs more than CSS. */
  readonly components?: Components;
  /** What the page shows after the section's text, such as a button. */
  readonly children?: ReactNode;
}

/**
 * Renders one section as GitHub-flavored Markdown: plain semantic elements
 * (`h1`, `p`, `ul`, `em`) inside `section.content-section`, which the active
 * theme styles. Raw HTML in a file is not rendered.
 */
export function ContentBlock({ section, components, children }: ContentBlockProps) {
  return (
    <section className="content-section" data-content={section.slug}>
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {section.body}
      </Markdown>
      {children}
    </section>
  );
}
