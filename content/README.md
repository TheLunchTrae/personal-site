# Content

The site's text lives here as Markdown, one file per section, so each piece
can be written on its own. Short interface labels, such as button text and
the Mode control, stay in code.

## Where each file appears

| File                                 | Where it appears                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `home/intro.md`                      | Top of the home page: your name and the line under it. The resume button follows it.              |
| `home/themes.md`                     | Home page invite to try each game theme, followed by the theme tour. Hidden until a theme exists. |
| `influences/<theme id>/<section>.md` | A theme's influence page, one section per file. Each theme adds its own files, left empty.        |

## Format

Write GitHub-flavored Markdown: headings, paragraphs, lists, links, tables.
Raw HTML shows as literal text. The active theme styles the text, so write
only the words and structure.

A file can start with front matter that sets its place among the other files
in its folder:

```md
---
order: 2
---

## A heading

Some text.
```

- Files sort by `order`, a whole number, then by file name. A file without
  one has order 0.
- Front matter takes one `order` line, so a typo fails the build instead of
  being ignored. A file that starts with `---` must close its front matter
  with another `---` line.
- A new file in `home/` shows on the home page in its order, with no code
  change. A button or other display after a section's text is set in
  `src/app/page.tsx` by file name, so renaming `intro.md` or `themes.md`
  fails the build until that file is updated too.

While `bun run dev` runs, refresh the page to see an edit. The live site
picks up changes when it rebuilds after a merge to `main`.
