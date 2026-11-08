# Content

The site's text lives here as Markdown, one file per section, so each piece
can be written on its own. Short interface labels, such as button text,
the page links and the color mode button's name, stay in code.

The site's text in these files is all rights reserved, not under the repo's
MIT license; third-party names and links in it belong to their owners. This
README is under the MIT license. See [NOTICE.md](../NOTICE.md).

## Where each file appears

| File                                        | Where it appears                                                                                         |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `home/intro.md`                             | Top of the home page, the Meet Trae intro: my name and the line under it. The resume button follows it.  |
| `home/themes.md`                            | Home page invite to my story, followed by the chapters and a Start the story button.                     |
| `about/<section>.md`                        | The About me page, my professional About, one section per file.                                          |
| `story/<section>.md`                        | The start of My story, under the scene and above the chapters.                                           |
| `influences/<chapter id>/<section>.md`      | A chapter of my story, one section per file. Agents add a chapter's empty files only with my permission. |
| `influences/minecraft/influence.md`         | The Minecraft chapter: how Minecraft inspired me.                                                        |
| `influences/geometry-dash/influence.md`     | The Geometry Dash chapter: how Geometry Dash inspired me.                                                |
| `influences/call-of-duty/black-ops-1.md`    | The Call of Duty chapter, under "Black Ops": how Black Ops inspired me.                                  |
| `influences/call-of-duty/black-ops-2.md`    | The same chapter, under "Black Ops II".                                                                  |
| `influences/call-of-duty/black-ops-3.md`    | The same chapter, under "Black Ops III".                                                                 |
| `credits/credits.md`                        | The credits page: notices for the games the story names, then the fonts and code the site uses.          |
| `levels/progress.md`, `levels/favorites.md` | The Geometry Dash favorite levels page: the text above each list.                                        |
| `levels/progress/<level>.md`                | One line of the "Where I'm at" list. See [Level files](#level-files).                                    |
| `levels/favorites/<level>.md`               | One favorite level. See [Level files](#level-files).                                                     |

A page whose files are all empty shows "This part is still being written." in
their place, so an empty file is a safe placeholder.

## Format

Write GitHub-flavored Markdown: headings, paragraphs, lists, links, tables.
Raw HTML shows as literal text. The site styles the text, so write only the
words and structure.

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
- The Call of Duty chapter sets each blurb's heading by file name in
  `src/app/story/call-of-duty/page.tsx`. Renaming a file fails the build until
  that page is updated too.

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
