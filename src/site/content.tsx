import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import type { ReactNode } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as z from 'zod';

/**
 * The site's prose lives in Markdown files under content/, one file per
 * section, so it can be written and edited on its own. Server components read
 * and render the files at build time, so no Markdown parser ships to the
 * browser. content/README.md maps each file to where it appears, and
 * docs/themes.md describes the format.
 *
 * A file can open with YAML front matter. A schema checks it, so a missing,
 * misspelled or mistyped field fails the build instead of shipping, and only
 * the Markdown after it reaches the page.
 */
export interface ContentSection<Fields extends SectionFields = SectionFields> {
  /** The file name without `.md`. */
  readonly slug: string;
  /** Sort key from the front matter; sections without one sort first, then by slug. */
  readonly order: number;
  /** The front matter, as the folder's schema parsed it. */
  readonly fields: Fields;
  /** The Markdown after the front matter. */
  readonly body: string;
}

/** The front matter every section can take: `order`, a whole number. A folder's schema extends it. */
export const sectionFields = z.strictObject({ order: z.int().optional() });
export type SectionFields = z.output<typeof sectionFields>;

const contentRoot = path.join(process.cwd(), 'content');
const openingLine = /^---[ \t]*\n/u;
const closingLine = /^---[ \t]*$/mu;

function parseSection<Fields extends SectionFields>(
  slug: string,
  source: string,
  file: string,
  schema: z.ZodType<Fields>,
): ContentSection<Fields> {
  // Editors on Windows can save CRLF line endings and a byte order mark.
  const text = source.replace(/^\uFEFF/u, '').replaceAll('\r\n', '\n');
  const opening = openingLine.exec(text);
  if (opening !== null && !closingLine.test(text.slice(opening[0].length))) {
    throw new Error(`${file}: front matter opens with --- but never closes with a --- line.`);
  }
  let parsed: { data: unknown; content: string };
  try {
    // Passing options turns off gray-matter's cache, which would share one object across files.
    parsed = matter(text, {});
  } catch (error) {
    throw new Error(`${file}: front matter is not valid YAML.`, { cause: error });
  }
  const result = schema.safeParse(parsed.data);
  if (!result.success) {
    throw new Error(`${file}: front matter does not fit its schema.\n${z.prettifyError(result.error)}`);
  }
  return { slug, order: result.data.order ?? 0, fields: result.data, body: parsed.content.replace(/^[ \t]*\n/u, '') };
}

/** Reads the sections in a folder under content/, in order. A folder that does not exist has none. */
export function readSections(folder: string, options?: { readonly root?: string }): Promise<readonly ContentSection[]>;
/** Reads a folder whose front matter fits `schema`, an extension of `sectionFields`. */
export function readSections<Fields extends SectionFields>(
  folder: string,
  options: { readonly schema: z.ZodType<Fields>; readonly root?: string },
): Promise<readonly ContentSection<Fields>[]>;
export async function readSections(
  folder: string,
  {
    schema = sectionFields,
    root = contentRoot,
  }: { readonly schema?: z.ZodType<SectionFields>; readonly root?: string } = {},
): Promise<readonly ContentSection[]> {
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
        return parseSection(name.slice(0, -'.md'.length), await readFile(file, 'utf8'), file, schema);
      }),
  );
  return sections.toSorted((a, b) => (a.order === b.order ? a.slug.localeCompare(b.slug) : a.order - b.order));
}

interface ContentBlockProps {
  readonly section: Pick<ContentSection, 'slug' | 'body'>;
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
