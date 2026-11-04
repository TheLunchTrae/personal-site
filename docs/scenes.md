# Kept 3D scenes

The 3D work built for the site's former game themes is kept, unmounted, for
the story's fly-through (see [story.md](story.md#scene-slot)). Trae decided to
keep it while the story's text is written. The full themes, with their
gameplay, are at the `pre-restructure` tag.

| Path                         | What it is                                                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `src/scenes/call-of-duty/`   | The Call of Duty menu scenes: the noir street with the gumball machine, the globe, the TV wall, and their graphics presets. |
| `src/scenes/minecraft/`      | The Minecraft voxel island: world generation, meshing, painted textures, and the walking engine.                            |
| `src/scenes/stops.ts`        | The places a scene can stop at, from the themes' navigation (home and story).                                               |
| `art/noir-street/`           | The Blender scripts that build the noir street's baked assets.                                                              |
| `public/scenes/noir-street/` | The baked street: models in three sizes, panoramas, and loading posters.                                                    |

No page imports `src/scenes/`, so none of it, three.js included, reaches a
page's bundle, and the browser never fetches `public/scenes/`. The modules
still pass the type, lint and test checks. `knip.jsonc` treats each file as
an entry and ignores their unused exports, since the page that mounts them
does not exist yet.

The modules keep the shape the themes gave them, so expect to adapt them
when a page mounts them:

- `scene-kit.ts` reads the themes' title and typewriter fonts from
  `--font-call-of-duty-title` and `--font-call-of-duty-type`, which the
  layout does not set, so its labels fall back to the system face.
- `art/noir-street/poster.mjs` captures the loading posters by driving the
  Call of Duty theme's gameplay in a browser, so it works only against a
  build of the `pre-restructure` tag.
