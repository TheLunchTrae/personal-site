# Design

The site is a personal site for a software engineer: a home page, a
professional About page, and a personal story told one game at a time. It
should read as calm and precise, with the green brand color used sparingly so
it marks the things a visitor can act on.

Every page follows this file. `src/app/globals.css` is the source of truth for
values: colors are CSS custom properties, and components use the token names,
never raw colors, except the menu backdrop. This file gives each value's role.
`src/app/globals.test.ts` checks that the color table here matches the CSS and
that each text and control pair meets WCAG AA.

## Color

The colors come from the green set in Trae's branding repository
(`TheLunchTrae/personal-branding`, `green-color-palette.md`). That set names
eight roles; the rows marked _derived_ fill roles it does not name, in the
same green-tinted family.

The visitor picks light, dark, or the system's setting
([docs/story.md](docs/story.md#color-mode)).

| Token              | Light     | Dark      | Role                                                                  |
| ------------------ | --------- | --------- | --------------------------------------------------------------------- |
| `--background`     | `#f7fff8` | `#111a14` | Page background.                                                      |
| `--surface`        | `#ffffff` | `#1a261e` | Raised areas: selects, the menu buttons, and the scene floor.         |
| `--foreground`     | `#14281a` | `#f3fff5` | Body text and headings.                                               |
| `--muted`          | `#4a6352` | `#a3baa9` | _Derived._ Secondary text: lede, labels, captions, footer.            |
| `--link`           | `#256438` | `#8af793` | Links inside prose.                                                   |
| `--primary`        | `#8af793` | `#8af793` | Fill of the primary action, route dots, text selection.               |
| `--primary-hover`  | `#74ea80` | `#a6fbad` | _Derived._ Fill of the primary action on hover.                       |
| `--on-primary`     | `#14281a` | `#14281a` | Text on `--primary`.                                                  |
| `--control-border` | `#256438` | `#8af793` | Outlines of buttons and controls, the current page marker, dot rings. |
| `--border`         | `#d3e4d7` | `#2b3b30` | _Derived._ Decorative hairlines and dividers that carry no meaning.   |
| `--tint`           | `#e7f6ea` | `#223329` | _Derived._ Hover wash behind secondary buttons.                       |
| `--focus`          | `#14281a` | `#f3fff5` | Keyboard focus outline.                                               |
| `--sky-top`        | `#e2f1e5` | `#0b120d` | _Derived._ Top of the scene slot's sky.                               |
| `--sky-horizon`    | `#f2fbf3` | `#1d2b22` | _Derived._ The scene slot's sky at the horizon.                       |

Rules:

- Green is for action and place: the primary button, the current page
  marker, control outlines, the story route's dots, and links. Text,
  headings, and decorative lines stay neutral.
- Use one primary button per view. Everything else is a secondary button or
  a link.
- `--border` is decorative and is below 3:1. Anything a visitor needs to see
  to find or use a control uses `--control-border` instead.

### Contrast

Every pair below meets WCAG 2.2 AA in both modes: 4.5:1 for text (1.4.3) and
3:1 for control boundaries and focus outlines (1.4.11). The test computes each
ratio from the CSS.

- Text: `--foreground` on `--background`, `--surface`, and `--tint`;
  `--muted` on `--background` and `--surface`; `--link` on `--background`;
  `--on-primary` on `--primary` and `--primary-hover`.
- Boundaries: `--control-border` on `--background` and `--surface`; `--focus`
  on `--background`.

The brand's light page and primary fill are 1.3:1 apart, so the fill alone
does not mark the primary button in light mode. The primary button keeps the
brand's control border in both modes, which carries the 3:1 boundary.

## Typography

One family: Geist, loaded with `next/font/google` in `src/app/layout.tsx`,
with the system sans-serif stack as fallback. Headings get their character
from weight and tight tracking, not from a second face. `globals.css` sets
each size; the styles, from largest to smallest:

| Style       | Where in `globals.css`                                        | Weight           | Use                                              |
| ----------- | ------------------------------------------------------------- | ---------------- | ------------------------------------------------ |
| Display     | `.prose-page h1`, `.story-page h1`                            | 700              | Page title. Fluid size, tight tracking.          |
| Heading     | `.prose-page h2`, `.story-page h2`                            | 650              | Section heading.                                 |
| Lede        | `[data-content='intro'] p` on home                            | 400              | Home intro under the name, in `--muted`.         |
| Menu link   | `.site-menu__panel .site-nav ul`                              | 400              | Page links in the phone menu panel.              |
| Route title | `.story-route a`                                              | 650              | Chapter names on the story route.                |
| Body        | `.prose-page`, `.story-page`                                  | 400              | Prose, at 1rem.                                  |
| UI          | `.site-nav ul`, `.button`, `.page-kicker`, `.page-aside`      | 400, buttons 550 | Nav links in the bar, buttons, kicker, aside.    |
| Caption     | `.color-mode` in the bar, `.story-route__number`, scene label | 400              | Labels, chapter numbers, back and next captions. |
| Footer      | `.site-footer`                                                | 400              | Footer.                                          |
| Notice      | `.chapter-notice`                                             | 400              | A chapter's not-affiliated line.                 |

Weights in use: 400 for text, 550 for buttons, 600 for the back and next
titles and the menu title, 650 for headings, the route titles, and the site
name, and 700 for page titles. Body prose is 1rem and keeps a 40rem measure,
about 70 characters. Text is left-aligned, except the next link at the end of
a chapter, which aligns to the end.

## Spacing and layout

- Spacing is in rem. Prefer the common steps (0.5, 0.75, 1, 1.5, 2.5, and
  4.5rem); control padding uses smaller steps to size touch targets.
- `--gutter` is the page's side padding, shared by the header, pages, and
  footer so their edges line up.
- Pages share one centered column. Text inside it keeps the 40rem measure;
  the scene slot and the story route use the full column.
- Sections on a page sit 2.5rem apart. Home spaces its two parts with a wider
  gap.
- [docs/story.md](docs/story.md#header-and-menu) describes the header and the
  phone menu, and [AGENTS.md](AGENTS.md#css-layout) sets how layout is built:
  flex and grid, `gap`, and intrinsic sizing.

## Shape and depth

| Radius   | Use                                                                                       |
| -------- | ----------------------------------------------------------------------------------------- |
| 0.375rem | Small controls and labels: the color select, the menu and close buttons, the scene label. |
| 0.5rem   | Buttons and the "still being written" panel.                                              |
| 0.75rem  | The scene slot.                                                                           |
| 50%      | Story route dots.                                                                         |

There are no shadows. Depth comes from `--surface` against `--background`
and from borders. The menu panel's backdrop is `rgb(0 0 0 / 0.5)`.

## Components

- **Primary button** (`.button.button--primary`): `--primary` fill,
  `--on-primary` text, 1px `--control-border` outline, 0.5rem radius. Hover
  fills `--primary-hover`. Use it for the one main action on a page.
- **Secondary button** (`.button`): `--background` fill, `--foreground`
  text, 1px `--control-border` outline. Hover fills `--tint`.
- **Focus**: every focusable element shows a 2px `--focus` outline at a
  2px offset on `:focus-visible`.
- **Links in prose**: `--link`, underlined at a 0.2em offset. Links that are
  their own block (the story route, back and next) are `--foreground` and
  underline on hover.
- **Site nav**: `--muted` links; hover turns them `--foreground`. The
  current page is `--foreground` with a 2px `--control-border` underline.
- **Color select and menu buttons**: `--surface` fill, 1px
  `--control-border` outline, 0.375rem radius. The menu button is a 2.75rem
  square touch target.
- **Menu panel**: `--background`, with a `--border` edge, over a dimmed
  backdrop. [docs/story.md](docs/story.md#header-and-menu) describes how it
  opens.
- **Story route**: chapters as stops on one line. The line is `--border`;
  each stop is a 12px `--primary` dot with a 2px `--control-border` ring.
- **Back and next**: a `--border` rule above, a `--muted` caption over a
  `--foreground` title.
- **Scene slot**: a sky gradient from `--sky-top` to `--sky-horizon` over a
  `--surface` floor with a `--border` grid, a `--border` outline, and a
  `--muted` label on `--background`.
- **Still being written**: a dashed `--border` panel with `--muted` text.
- **Footer**: small `--muted` text with underlined links.

## Imagery and icons

- Icons are inline SVG, 1.5 stroke, `currentColor`, hidden from assistive
  technology when a label names the control. There is no icon set and no
  emoji.
- The story's only imagery is the 3D scenes ([docs/scenes.md](docs/scenes.md)),
  shown in the scene slot. The site uses no stock photos or illustrations, and
  no game's own assets.
- Avoid gradients except the scene slot's sky, and avoid gradient text,
  glass effects, and decorative motion.
