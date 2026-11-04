# Noir street

The source of the gumball street in
`public/scenes/noir-street/`: a plaza after the Junction, the first room of
Shadows of Evil, seen from the first gumball machine by its pillar, out
through the first door toward the canal, the elevated railway, and the giant
worm hanging in a burning sky. Everything is made here from code: geometry,
procedural materials, lighting, and the neon text. No game assets, and no
outside models, textures, or HDRIs. Reference images were used only for
layout and lighting. The neon lettering uses Pacifico and Teko, both under
the SIL Open Font License (`fonts/`).

The street was built for the Call of Duty theme's gumball menu and is kept,
unmounted, for the story's fly-through; see
[docs/scenes.md](../../docs/scenes.md). The scene is drawn by
`src/scenes/call-of-duty/gumball-scene.ts` and `noir-street.ts`. The machine's dimensions match the constants there, so the
plate, chute, tray, and gumballs line up, and the camera framing (`WIDE` and
`TALL` in `build.py`) matches the one in `gumball-scene.ts`.

## Rebuild

Run these from this folder. Blender runs as a Python module
(`pip install bpy==5.2.3`, Python 3.13, plus numpy). The web tools live in
`out/tools`, which git ignores, so they stay out of the site's dependencies.

```sh
mkdir -p out/tools && cp optimize.mjs panoramas.mjs poster.mjs out/tools/
(cd out/tools && npm init -y >/dev/null && npm install @gltf-transform/core@4.5.1 \
  @gltf-transform/extensions@4.5.1 @gltf-transform/functions@4.5.1 meshoptimizer@1.3.0 sharp@0.35.5 \
  playwright-core@1.63.0)
PUBLIC=../../public/scenes/noir-street

python build.py out/junction.blend                  # scene, materials, lights, hero camera
python bake.py out/junction.blend out/bake 4096 32  # GroundNear and Props at 4096, the rest at 2048
python tonemap.py out/bake out/bake/*.exr --denoise
python export.py out/bake/baked.blend out/bake out/junction.glb
node out/tools/optimize.mjs out/junction.glb $PUBLIC/street-high.glb 4096 92
node out/tools/optimize.mjs out/junction.glb $PUBLIC/street-medium.glb 2048 80
node out/tools/optimize.mjs out/junction.glb $PUBLIC/street-low.glb 1024 72
python render.py out/junction.blend out/render 64 4096  # skyline, sky, and reflection panoramas
node out/tools/panoramas.mjs out/render $PUBLIC
```

The posters are frames of the live scene, so the poster and the first drawn
frame match. `poster.mjs` drives the Call of Duty theme's gameplay, so build
and serve the site at the `pre-restructure` tag, then capture them with any
Chromium:

```sh
CHROMIUM=/path/to/chromium node out/tools/poster.mjs http://localhost:3000/ $PUBLIC
```

The first line copies the scripts beside their tools, so repeat it after
editing one. The bake takes about an hour and a half on four CPU cores.
`tonemap.py` skips the `_albedo` and `_normal` guides it is handed.
`preview.py` renders the hero camera for quick looks while editing.

## How it is lit

- `bake.py` joins each bake group (near and far ground, the pillar, each
  side's buildings, the quay and viaduct, props), gives it a fresh UV atlas,
  and bakes Cycles' combined pass as seen from the hero camera, so the wet
  plaza keeps its reflections. It also bakes albedo and normals, which
  `tonemap.py` hands to OpenImageDenoise as guides, then writes the result
  with the AgX look.
- `render.py` renders what lies past the canal (the far bank, the towers, the
  sky, and the worm) as one panorama from the hero camera, fogged with
  distance. The web scene draws it on a sphere that follows the camera and
  fogs the baked plaza toward the sky with the same formula, mixed in sRGB as
  render.py mixes, so the two meet without a seam.
  `FOG_DENSITY` and `FOG_MAX` must match in `render.py` and `noir-street.ts`.
- The web scene draws baked groups unlit. The machine, neon tubes, and lamp
  glass stay live: the machine reflects `environment.webp`, a panorama
  rendered from its spot, and each page's neon brightens when it is chosen.
- Sign colors and names must match `NEON` in `noir-street.ts`, and the home
  and story signs' colors must match `GUM_COLORS` in `gumball-scene.ts`. The
  site's gameplay reaches only Home and the theme's story page, so the About,
  Projects and Resume signs are scenery. Lamp, manhole, and worm positions in
  `noir-street.ts` come from the `META` line `build.py` prints, with Blender's
  (x, y, z) as three.js's (x, z, -y).

## Graphics presets

The gumball menu offers Auto, Low, Medium, and High. Auto, the default,
guesses from what the browser reports (`quality.ts`): Low for software
renderers, small touch screens, and devices with 4 GB of memory or less; High
for GPUs it can name as strong (NVIDIA, Radeon RX and Pro, and Apple's Pro,
Max, and Ultra chips) with 8 GB or more; Medium otherwise. Safari names every
Apple GPU the same and reports no memory, so Macs on Safari get Medium. The presets differ in atlas size (1024, 2048, 4096), skyline
width, rain and ripple counts, pixel ratio, and multisampling.
