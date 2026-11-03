# Noir street: assets and licenses

Everything in the scene was made in this project. No game assets, and no
outside models, textures, or HDRIs.

| What                                                                                                       | Source                                                          | License                               |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------- |
| Geometry (plaza, pillar, buildings, quay, viaduct and train, skyline, worm, lamps, props, gumball machine) | Built in code by `build.py`                                     | Ours                                  |
| Materials (cobbles, puddles, ring, concrete, brick, windows, metal, glass, worm, sky)                      | Procedural Blender node trees in `materials.py`                 | Ours                                  |
| Lighting, baked textures, skyline and reflection panoramas                                                 | Rendered and baked from our scene with Cycles                   | Ours                                  |
| Posters                                                                                                    | Frames of the live web scene, captured by `poster.mjs`          | Ours                                  |
| Neon lettering "About", "Projects"                                                                         | Pacifico (Vernon Adams), converted to tube outlines             | SIL OFL 1.1, `fonts/Pacifico-OFL.txt` |
| Neon lettering "HOME", "RESUME", "OPEN"                                                                    | Teko SemiBold (Indian Type Foundry), converted to tube outlines | SIL OFL 1.1, `fonts/Teko-OFL.txt`     |
| Rain, ripples, haze, mist, steam                                                                           | three.js shaders written for this site                          | Ours                                  |

The fonts came from the `@fontsource/pacifico` and `@fontsource/teko` npm
packages and were converted from WOFF to TTF with fontTools. The OFL allows
this; the font files themselves are only used at build time and are not
served by the site.

No CC0 scans or models are used yet; every texture is procedural. Swapping in
CC0 assets later means replacing node trees in `materials.py` and rebaking.
Record any such asset here with its URL and license.

The plaza is a tribute to the Junction in Call of Duty: Black Ops III's
Shadows of Evil: the machine by its pillar, the view out through the first
door, the canal, the elevated railway, and the giant worm in a red sky.
Screenshots and guide images of that map were looked at for layout and
lighting only. Nothing was taken, traced, or extracted from the game, and no
Activision or Treyarch asset is in the scene: every model, texture, and sign
here is modeled from scratch, and the sign wording is our own.
