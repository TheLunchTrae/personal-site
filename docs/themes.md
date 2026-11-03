# Themes

The site has one default look and a set of game themes. A game theme is named
after the game that inspired it, restyles every page, and offers gameplay
navigation that the visitor can turn off. With gameplay off, the site stays in
the theme.

On the site the game themes are framed as the chapters of Trae's story: the
home page introduces Trae, and each game theme is a phase of Trae's life and
how that game inspired them as a developer. Visitor-facing copy calls a game
theme a chapter and its influence page the chapter's story; the code keeps the
theme names. Each game theme has an influence page about how the game inspired
Trae and a credits page for everything the theme draws on.

## State

Three attributes on `<html>` hold the visitor's choices. The head script in
`src/themes/registry.ts` sets them from `localStorage` before first paint, and
`src/themes/theme-store.ts` keeps them current after hydration.

| Attribute         | Values                       | Storage key  |
| ----------------- | ---------------------------- | ------------ |
| `data-theme`      | `default` or a game theme id | `theme`      |
| `data-color-mode` | `system`, `light`, `dark`    | `color-mode` |
| `data-play`       | `on`, `off`                  | `play`       |

- The color mode applies only to the default theme. Its control shows only
  there. A game theme sets its own palette and ignores the color mode.
- Gameplay is one shared preference. It is on for a game theme unless the
  visitor turned it off, or never chose and prefers reduced motion. It is
  always `off` for the default theme.
- A theme whose gameplay cannot run (no WebGL, a failed chunk, a render
  error) has gameplay off for the rest of the visit without changing the
  stored choice. Turning gameplay back on retries it.
- Choices apply for the visit even when the browser refuses storage. A
  gameplay failure is kept in memory for the visit only.
- `src/themes/registry.test.ts` checks that the head script resolves state like
  the registry helpers, and `src/themes/theme-store.test.ts` checks that
  choices apply when storage refuses them.

## Shell

Every theme restyles the same shell, so a game theme never needs its own
pages. Style these hooks under `:root[data-theme='<id>']`:

- Tokens: `--background`, `--foreground`, `--muted`, `--border`, `--accent`,
  `--surface`, and `color-scheme`.
- `.site-header`, which holds `.theme-controls` with its `select` elements and
  `.theme-controls__play` (`aria-pressed`).
- `.page`, `.prose-page` with `h1`, `h2`, `p`;
  `.prose-page[data-section='home']` is the home page.
- `.content-section[data-content='<file name>']`, one per Markdown file from
  `content/`; see [Content](#content).
- `.button`, `.theme-tour__card`, `.theme-tour__chapter` (the chapter label),
  `.theme-tour__name`, `.theme-tour__wordmark`
  (a theme's title image, when it has one), `.theme-tour__actions`,
  `.theme-tour__story`.
- `.game-notice`, the shared notice shown when a theme's gameplay cannot
  start.
- `.play-layer`, the slot that holds gameplay between the header and the page.
  Before hydration it is empty, so `.play-layer:empty` can reserve the
  gameplay's height.
- `.site-footer` and `.theme-credit[data-credit-for='<id>']`, a small line
  with the theme's `notice` and a link to its credits page. It is hidden by
  default, and each theme reveals its own line while it is active. Keep it
  visible in every state, gameplay on or off.
- `.prose-page[data-credit-for='<id>']`, the theme's influence and credits
  pages. They reveal the theme's footer line in any theme, so the notice
  shows wherever the theme's work is shown.

## Order

`gameThemes` in `src/themes/registry.ts` is the one place that sets the order
of the game themes, which is the story order: a theme's place in the list is
its chapter number (`chapterLabel`). The home page chapters, the picker and
the footer credits all follow it, so reordering its entries reorders the site
and renumbers the chapters. The order of the home page's sections is set by
the `order` front matter of the files in `content/home/`; see
`content/README.md`.

## Add a game theme

1. Add the theme's id (kebab case) to the `GameThemeId` union in
   `src/themes/registry.ts`, and add its entry to `gameThemes` at the place it
   should appear: `id`, `name` (the game's name), `notice` (the not-affiliated
   note, in the owner's required wording when it has one), `pitch` (one line
   for the theme's chapter card), and `storyTitle`.
2. Create `src/themes/<id>/` with:
   - `<id>.css`: every rule for the shell scoped under
     `:root[data-theme='<id>']`, including
     `.theme-credit[data-credit-for='<id>'] { display: block; }`, plus the
     same rule under `:root:has(.prose-page[data-credit-for='<id>'])` so the
     theme's own pages show it. Rules for the gameplay component's own
     classes, which exist only while it is mounted, use a prefix of the
     theme's own (Minecraft uses `.blocks-`) instead. Import it in
     `src/app/layout.tsx`.
   - A gameplay component that takes `PlayProps` from
     `src/themes/play-layer.tsx`.
3. Register the component in `players` in `src/themes/play-layer.tsx` with
   `next/dynamic` and `ssr: false`. The map is typed by the registry, so the
   build fails until this step is done.
4. Add the influence page at `src/app/influences/<id>/page.tsx`: a server
   component that renders an
   `<article className="prose-page" data-credit-for="<id>">` holding a
   `ContentBlock` from `src/site/content.tsx` for each section that
   `readSections('influences/<id>')` returns, after a `.page-kicker` line with
   the theme's `chapterLabel` and name and an `h1` with its `storyTitle`. Create
   `content/influences/<id>/` with the theme's blurb files, left empty for
   Trae to write, and list them in `content/README.md`. End the page with a
   link to the theme's credits page (`creditsHref`). The tour, the theme
   picker, the footer credit, and the gameplay's last destination pick the
   theme up from the registry.
5. Write the theme's credits in `content/credits/<id>/`: the owner's notice,
   then every font, library and other work the theme uses, with its author
   and license, linking any license text that has to ship with the code
   under `public/licenses/`. `src/app/credits/[theme]/page.tsx` builds a
   credits page for each registered theme, and the build fails when a theme
   has no credits written.
6. Load any display font with `next/font` and `preload: false`, and expose it
   as a CSS variable on `<html>` in `src/app/layout.tsx`. Use only fonts whose
   license allows web embedding. A self-hosted font lives in
   `src/themes/<id>/fonts/` with its license file beside it, loaded through
   `next/font/local`. Ship the license under `public/licenses/` and credit the
   font with a link to that license in the theme's credits; never link the
   font file itself. Declare only the weights the font ships, and use only
   those in CSS.

## Content

The site's prose, including each theme's influence blurbs, is written in
Markdown files under `content/`. `content/README.md` maps each file to where it
appears and describes the format. Markdown is only how the text is written;
the theme decides how it looks.

`ContentBlock` renders a file as plain semantic elements (`h1`, `h2`, `p`,
`ul`, `em`, `blockquote`, `table`) inside one `section.content-section`, with
`data-content` set to the file name and no prose styles of its own.
`globals.css` adds only base spacing, list markers, link underlines and
borders, drawn from the theme tokens and wrapped in `:where()` so any theme or
component rule overrides them. A section's first element drops its top
margin. It also styles the home intro's text as the lede and spaces the home
sections apart. A theme styles the content with its fonts, colors and panels
under `:root[data-theme='<id>'] .content-section`. When CSS
is not enough, such as a heading that needs extra markup, the page passes
`components` to `ContentBlock` to replace the element for that Markdown node.

`readSections(folder, { schema })` reads a folder's files. Each file's YAML
front matter is parsed with `gray-matter` and checked with a `zod` schema that
extends `sectionFields`, so a bad field fails the build, and only the Markdown
body reaches `ContentBlock`. A page that lists data, such as the Geometry Dash
favorite levels in `content/levels/`, keeps one file per item with the item's
fields in front matter and renders them from `section.fields`.

## Gameplay contract

`PlayProps` gives the component:

- `sections`: the pages gameplay can reach, in order: the site's pages (Home),
  then the theme's own influence page with id `story`. Each has an `href`, a
  `label`, and a short uppercase `tag` for in-game signage. Navigate with
  `useRouter().push(section.href)`; read the current page with
  `usePathname()`.
- `reducedMotion`: whether the visitor prefers reduced motion.
- `onExit()`: turns gameplay off from inside the game.
- `onFail()`: reports that the game cannot run here, such as when WebGL is
  missing. Gameplay turns off and a notice explains it. A thrown render error
  does the same.

The component can sit in the flow of `.play-layer`, such as a runner strip
above the page, or cover the viewport with fixed positioning behind the page,
such as a world to walk through. Either way:

- Plain navigation stays visible and works. Gameplay never replaces a link.
- Every gameplay action has a keyboard path, and keys act only while the game
  or the page it opened has focus, so Space and the arrow keys still scroll
  the page and the header controls keep their keys.
- If gameplay can hide the control the visitor used to turn it on, move focus
  to a visible control.
- Motion respects `reducedMotion`. A theme with sound keeps it off until the
  visitor turns it on, and pauses it when the tab is hidden.
- Heavy engines, such as three.js, load only inside the component, so they
  stay out of every other theme's bundle. Large art, such as a baked 3D
  scene, is served from `public/scenes/<name>/` and fetched only when the
  gameplay that draws it starts; the scripts and sources that build it live
  in `art/<name>/`.
- Art and sound are original. Fonts are original, or third-party under a
  license that allows web embedding and credited in the theme's credits.
  Never take files from the game itself. Reference the game by name only.
  The one exception is a title image for the theme tour, added through
  `src/themes/wordmarks.ts` only with the site owner's approval. Credit it on
  the theme's credits page and list it in `NOTICE.md`, since the repo's MIT
  license does not cover it.
