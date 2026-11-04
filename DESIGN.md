# Design

The site is a personal site for a software engineer: a home page, a
professional About page, and a personal story told one game at a time. It
should read as calm and precise, with the green brand color used sparingly so
it marks the things a visitor can act on.

Every page follows this file. `src/app/globals.css` holds the values as CSS
custom properties, and components use the token names, never raw values.
`src/app/globals.test.ts` checks that the tables here match the CSS and that
each text and control pair meets WCAG AA.

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
| `--surface`        | `#ffffff` | `#1a261e` | Raised areas: selects and the menu button.                            |
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

All pairs meet WCAG 2.2 AA in both modes: 4.5:1 for text, 3:1 for control
boundaries and focus outlines (1.4.11).

| Pair                                 | Light | Dark |
| ------------------------------------ | ----- | ---- |
| `--foreground` on `--background`     | 15.3  | 17.3 |
| `--muted` on `--background`          | 6.5   | 8.6  |
| `--muted` on `--surface`             | 6.6   | 7.6  |
| `--link` on `--background`           | 7.0   | 13.4 |
| `--on-primary` on `--primary`        | 11.7  | 11.7 |
| `--on-primary` on `--primary-hover`  | 10.3  | 12.6 |
| `--foreground` on `--tint`           | 13.9  | 13.0 |
| `--control-border` on `--background` | 7.0   | 13.4 |
| `--focus` on `--background`          | 15.3  | 17.3 |

The brand's light page and primary fill are 1.3:1 apart, so the fill alone
does not mark the primary button in light mode. The primary button keeps the
brand's control border in both modes, which carries the 3:1 boundary.

## Typography

One family: Geist, loaded with `next/font/google` in `src/app/layout.tsx`,
with the system sans-serif stack as fallback. Headings get their character
from weight and tight tracking, not from a second face.

| Style       | Size                         | Weight | Line height | Tracking | Use                                      |
| ----------- | ---------------------------- | ------ | ----------- | -------- | ---------------------------------------- |
| Display     | `clamp(2.5rem, 7vw, 4.5rem)` | 700    | 1           | -0.04em  | Page title (`h1`).                       |
| Heading     | 1.375rem                     | 650    | inherited   | -0.015em | Section heading (`h2`).                  |
| Lede        | 1.25rem                      | 400    | 1.6         | 0        | Home intro under the name, in `--muted`. |
| Route title | 1.0625rem                    | 650    | inherited   | 0        | Chapter names on the story route.        |
| Body        | 1rem                         | 400    | 1.65        | 0        | Prose.                                   |
| UI          | 0.9375rem                    | 400    | inherited   | 0        | Nav links, buttons, kicker, page aside.  |
| Caption     | 0.875rem                     | 400    | inherited   | 0        | Labels, chapter numbers, scene label.    |
| Footer      | 0.8125rem                    | 400    | inherited   | 0        | Footer.                                  |
| Notice      | 0.75rem                      | 400    | 1.5         | 0        | A chapter's not-affiliated line.         |

Buttons use weight 550, and the site name 650. Prose keeps a 40rem measure,
about 70 characters of body text. Text is left-aligned everywhere; there is
no centered section.

## Spacing and layout

- Base unit: 0.25rem. Use its multiples; the common steps are 0.5, 0.75, 1,
  1.5, 2.5, and 4.5rem.
- Gutter: `--gutter`, `clamp(1.25rem, 4vw, 3rem)`, shared by the header,
  pages, and footer so their edges line up.
- Column: 60rem wide, centered. Text inside it keeps the 40rem measure;
  the scene slot and the story route use the full column.
- Page padding: `clamp(2.5rem, 8vh, 6rem)` above the title, 5rem below.
- Between sections: 2.5rem. Home spaces its two parts with a 4.5rem gap.
- Breakpoint: 40rem. Below it the header collapses to the menu button, the
  story route runs as a column, and the scene slot is 4:3 instead of 21:9.

[AGENTS.md](AGENTS.md#css-layout) sets how layout is built: flex and grid,
`gap`, and intrinsic sizing.

## Shape and depth

| Radius   | Use                                            |
| -------- | ---------------------------------------------- |
| 0.375rem | Small controls: the color select, menu button. |
| 0.5rem   | Buttons and the "still being written" panel.   |
| 0.75rem  | The scene slot.                                |
| 50%      | Story route dots.                              |

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
- **Color select and menu button**: `--surface` fill, 1px
  `--control-border` outline, 0.375rem radius. The menu button is a 2.75rem
  square touch target.
- **Menu panel**: a modal sheet from the right edge, `--background`, with a
  `--border` edge. It slides in over 200ms and appears without motion when
  the visitor prefers reduced motion.
- **Story route**: chapters as stops on one line. The line is `--border`;
  each stop is a 12px `--primary` dot with a 2px `--control-border` ring.
- **Back and next**: a `--border` rule above, a `--muted` caption over a
  `--foreground` title.
- **Scene slot**: a sky gradient from `--sky-top` to `--sky-horizon` over a
  `--surface` floor with a `--border` grid, a `--border` outline, and a
  `--muted` label on `--background`.
- **Still being written**: a dashed `--border` panel with `--muted` text.
- **Footer**: `--muted` caption-size text with underlined links.

## Imagery and icons

- Icons are inline SVG, 1.5 stroke, `currentColor`, hidden from assistive
  technology when a label names the control. There is no icon set and no
  emoji.
- The story's only imagery is the 3D scenes ([docs/scenes.md](docs/scenes.md)),
  shown in the scene slot. The site uses no stock photos or illustrations, and
  no game's own assets.
- Avoid gradients except the scene slot's sky, and avoid gradient text,
  glass effects, and decorative motion.
