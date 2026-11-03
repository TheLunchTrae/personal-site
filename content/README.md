# Content

The site's text lives here as Markdown, one file per section, so each piece
can be written on its own. Short interface labels, such as button text and
the Mode control, stay in code.

The site's text in these files is all rights reserved, not under the repo's
MIT license; third-party names and links in it belong to their owners. This
README is under the MIT license. See [NOTICE.md](../NOTICE.md).

## Where each file appears

| File                                        | Where it appears                                                                               |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `home/intro.md`                             | Top of the home page: your name and the line under it. The resume button follows it.           |
| `home/themes.md`                            | Home page invite to try each game theme, followed by the theme tour.                           |
| `influences/<theme id>/<section>.md`        | A theme's influence page, one section per file. Each theme adds its own files, left empty.     |
| `influences/minecraft/influence.md`         | The Minecraft influence page: what Minecraft meant to you.                                     |
| `influences/geometry-dash/influence.md`     | The Geometry Dash influence page: what Geometry Dash meant to you.                             |
| `influences/call-of-duty/black-ops-1.md`    | The Call of Duty influence page, under "The TV wall · Black Ops": what Black Ops meant to you. |
| `influences/call-of-duty/black-ops-2.md`    | The same page, under "The globe · Black Ops II".                                               |
| `influences/call-of-duty/black-ops-3.md`    | The same page, under "The gumball machine · Black Ops III".                                    |
| `credits/<theme id>/<section>.md`           | A theme's credits page: the owner's notice, then fonts, code and anything else the theme uses. |
| `levels/progress.md`, `levels/favorites.md` | The Geometry Dash favorite levels page: the text above each list.                              |
| `levels/progress/<level>.md`                | One line of the "Where I'm at" list. See [Level files](#level-files).                          |
| `levels/favorites/<level>.md`               | One favorite level. See [Level files](#level-files).                                           |

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
- Front matter is YAML. Each folder accepts set fields, and every folder
  accepts `order`, so a missing, misspelled or mistyped field fails the build
  instead of being ignored. A file that starts with `---` must close its
  front matter with another `---` line.
- A new file in `home/` shows on the home page in its order, with no code
  change. A button or other display after a section's text is set in
  `src/app/page.tsx` by file name, so renaming `intro.md` or `themes.md`
  fails the build until that file is updated too.
- The Call of Duty influence page sets each blurb's heading by file name in
  `src/app/influences/call-of-duty/page.tsx`. A heading shows on its own
  until its file has text, and renaming a file fails the build until that
  page is updated too.

## Level files

Each level on the Geometry Dash favorite levels page is one file whose front
matter holds its details. The body below the front matter is left empty for
now.

```md
---
order: 1
title: Anathema
url: https://youtu.be/k9mLtwdIng4
creator: Optional creator name
---
```

- `order` is required and sets the level's place in the list. Favorites go
  hardest first; the page shows no positions, so reorder by changing the
  numbers.
- `url` must be a YouTube video link. A link pasted from YouTube's Share
  button works as is: the site drops its tracking parameters and keeps only a
  start time. Shorts and live links are not supported.
- A level file holds only front matter; text after it fails the build.
- A file in `levels/progress/` also takes `status`, either `hardest` (the
  hardest level beaten) or `next` (the one being played). A `next` level can
  take `progress`, the best run in percent (0 to 99). There is exactly one
  `hardest` level and at most one `next`.

While `bun run dev` runs, refresh the page to see an edit. The live site
picks up changes when it rebuilds after a merge to `main`.
