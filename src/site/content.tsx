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
const frontMatter = /^---[ \t]*\n(?:([\s\S]*?)\n)?---[ \t]*(?:\n|$)/u;

function parseSection(slug: string, source: string, file: string): ContentSection {
  // Editors on Windows can save CRLF line endings and a byte order mark.
  const text = source.replace(/^\uFEFF/u, '').replaceAll('\r\n', '\n');
  const match = frontMatter.exec(text);
  if (match === null && text.startsWith('---')) {
    throw new Error(`${file}: front matter opens with --- but never closes with a --- line.`);
  }
  let order: number | undefined;
  for (const line of (match?.[1] ?? '').split('\n')) {
    const value = /^order:\s*(-?\d+)\s*$/u.exec(line)?.[1];
    if (value !== undefined && order === undefined) {
      order = Number(value);
    } else if (line.trim() !== '') {
      throw new Error(`${file}: front matter takes one "order: <whole number>" line, not "${line}".`);
    }
  }
  return { slug, order: order ?? 0, body: match === null ? text : text.slice(match[0].length) };
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
      .filter((name) => name.endsWith('.md') && name.toLowerCase() !== 'readme.md')
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
 * theme styles. Raw HTML in a file shows as literal text.
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
