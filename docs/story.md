# Site structure and the story

The site has three parts, linked from the header on every page:

| Page            | Route                          | What it holds                                                    |
| --------------- | ------------------------------ | ---------------------------------------------------------------- |
| Home            | `/`                            | Trae's intro, the resume, and the invite to the story.           |
| About           | `/about/`                      | The professional About me.                                       |
| My story        | `/story/`                      | The personal story's start, then one chapter per game, in order. |
| A chapter       | `/story/<chapter id>/`         | How that game inspired Trae.                                     |
| Favorite levels | `/story/geometry-dash/levels/` | Trae's Geometry Dash levels, under that chapter.                 |
| Credits         | `/credits/`                    | Notices for the games the story names, and fonts and code.       |

The site has one look. The only visitor choice is the color mode.

## Color mode

`data-color-mode` on `<html>` is `system`, `light` or `dark`, stored in
`localStorage` under `color-mode`. The head script in
`src/site/color-mode.ts` sets it before first paint, and the color mode button
in `src/site/color-mode-button.tsx` changes it: each press moves from System
to Light to Dark and back to System. The button draws all three icons, and
`globals.css` shows the one for the current mode, so the icon is right from
first paint. `globals.css` defines the palette tokens for light and redefines
them for dark; [DESIGN.md](../DESIGN.md#color) gives each token's role and
values. A choice applies for the visit even when the browser refuses storage,
and a choice made in another tab applies too.

## Header and menu

`src/site/site-header.tsx` holds the site's name, the page links
(`site-nav.tsx`) and the color mode button. Below a 40rem viewport the bar
shows the menu button instead of the links, and the color mode button stays
beside it. The menu button opens the links in a modal panel that slides in
from the right (`site-menu.tsx`). Opening it focuses the panel rather than a
control, so a tap shows no focus ring; Tab moves through the panel, Escape
closes it, and focus returns to the menu button. A link press in the panel
closes it.

## The story

`chapters` in `src/site/story.ts` is the one place that sets the chapters and
their order: a chapter's place in the list is its number. The home page's
route, the story start, the chapter numbers, and each chapter's back and next
links follow it. Each chapter has an `id` (its route and text folder), the
game's `name`, the page `title`, and a `notice`, the short not-affiliated line
under the chapter in the wording the game's owner asks for when it has one.

Each chapter page in `src/app/story/<id>/page.tsx` renders `ChapterPage` from
`src/site/chapter-page.tsx`: the chapter's place in the story, its title, the
scene slot, Trae's text from `content/influences/<id>/`, the back and next
links, and the notice. A page can pass `headings` to put a heading before a
file's text, as the Call of Duty chapter does for each Black Ops game, and
children to add a line after the text, as the Geometry Dash chapter does for
the favorite levels page.

To add a chapter, add it to `ChapterId` and `chapters`, add its page under
`src/app/story/<id>/`, write its notice into `content/credits/credits.md`,
and leave its text folder for Trae: `content/influences/` is
[Trae's own writing](../AGENTS.md#traes-own-writing).

### Scene slot

`SceneSlot` in `src/site/scene-slot.tsx` marks where each story page's 3D
scene goes: a still horizon with the label "Background scene coming soon".
The plan is a scroll-driven camera that flies the visitor through one world
from chapter to chapter, with the text readable on its own and the scene as
an enhancement on top: a light preset for phones and a still frame for
reduced motion. [scenes.md](scenes.md) describes the 3D scenes kept for
it.

### Text that is not written yet

A page whose text files are all empty shows "This part is still being
written." in place of the text (`ComingSoon` in `src/site/coming-soon.tsx`).
On a chapter with headings, each empty file shows it under its heading once
any file has text.

## Content

The site's prose is written in Markdown files under `content/`.
[content/README.md](../content/README.md) maps each file to where it appears
and describes the format.

`ContentBlock` in `src/site/content.tsx` renders a file as plain semantic
elements (`h1`, `h2`, `p`, `ul`, `em`, `blockquote`, `table`) inside one
`section.content-section`, with `data-content` set to the file name.
`globals.css` adds base spacing, list markers, link underlines and borders,
wrapped in `:where()` so component rules override them.

`readSections(folder, { schema })` reads a folder's files. Each file's YAML
front matter is parsed with `gray-matter` and checked with a `zod` schema that
extends `sectionFields`, so a bad field fails the build, and only the Markdown
body reaches `ContentBlock`. A page that lists data, such as the favorite
levels in `content/levels/`, keeps one file per item with the item's fields in
front matter (`src/site/levels.ts`) and renders them from `section.fields`.

## Credits and notices

Every page links the credits page from the footer. Each chapter, and the
favorite levels page, ends with its game's notice. `content/credits/` holds
the full statements, then the fonts and code the site serves; the build fails
when it has no credits written. Mojang's guidelines require the Minecraft
notice's exact wording, and `src/site/story.test.ts` checks that the chapter
and the credits carry it.

Fonts are original, or third-party under a license that allows web
embedding: load one with `next/font`, ship its license under
`public/licenses/`, and credit it with a link to that license. Never take
files from the games. Reference a game by name only.
