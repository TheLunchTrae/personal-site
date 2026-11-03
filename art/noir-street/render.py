"""Renders the panoramas the web scene draws around the baked plaza.

python render.py <junction.blend> <out-dir> <samples> [width]

All three are equirectangular, centered on Blender +X (three.js +X), as three.js
expects for an equirectangular texture.

- backdrop.png: the sky, skyline, far bank, and the worm, seen from the hero
  camera with the plaza hidden, then fogged the way noir-street.ts fogs the
  plaza, so the two meet without a seam: toward the same soft sky, mixed in
  the same display colors (after AgX, sRGB encoded, which keeps dark
  silhouettes like the worm dark through the haze). Width defaults to 4096.
- sky.png: the sky alone, small; the web scene fogs the plaza toward it.
- environment.png: the whole scene from the machine, with the machine hidden,
  for the live machine's reflections.
"""

import math
import os
import sys

import bpy
import numpy as np

# Must match FOG_DENSITY and FOG_MAX in src/themes/call-of-duty/noir-street.ts.
FOG_DENSITY = 0.018
FOG_MAX = 0.35

blend, out_dir, samples = sys.argv[1], sys.argv[2], int(sys.argv[3])
width = int(sys.argv[4]) if len(sys.argv) > 4 else 4096
os.makedirs(out_dir, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=blend)
scene = bpy.context.scene
scene.cycles.device = "CPU"
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
cam = scene.camera
hero = cam.location.copy()
cam.data.type = "PANO"
cam.data.panorama_type = "EQUIRECTANGULAR"
cam.rotation_euler = (math.pi / 2, 0, -math.pi / 2)


def show(predicate):
    for obj in bpy.data.objects:
        if obj.type == "MESH":
            obj.hide_render = not predicate(obj)


def render_exr(name, size, spp, denoise):
    scene.render.resolution_x, scene.render.resolution_y = size, size // 2
    scene.cycles.samples = spp
    scene.cycles.use_denoising = denoise
    scene.render.image_settings.file_format = "OPEN_EXR"
    scene.render.image_settings.color_depth = "32"
    scene.render.filepath = os.path.join(out_dir, f"{name}.exr")
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(scene.render.filepath)
    pixels = np.empty(size * (size // 2) * 4, dtype=np.float32)
    img.pixels.foreach_get(pixels)
    return pixels.reshape(size // 2, size, 4)


def save_png(name, rgba, depth="8"):
    h, w = rgba.shape[:2]
    img = bpy.data.images.new(name, w, h, float_buffer=True, alpha=False)
    img.pixels.foreach_set(rgba.astype(np.float32).ravel())
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_depth = depth
    scene.render.image_settings.color_mode = "RGB"
    path = os.path.join(out_dir, f"{name}.png")
    img.save_render(path, scene=scene)
    print("wrote", name, w, h, flush=True)
    return path


def encode(rgb):
    """Linear to sRGB, as three.js's sRGBTransferOETF."""
    rgb = np.maximum(rgb, 0.0)
    return np.where(rgb <= 0.0031308, rgb * 12.92, 1.055 * rgb ** (1 / 2.4) - 0.055)


def decode(rgb):
    """sRGB to linear, as three.js's sRGBTransferEOTF."""
    return np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)


def displayed(name, rgba):
    """rgba as the web sees it: through AgX, then decoded from sRGB to linear."""
    h, w = rgba.shape[:2]
    img = bpy.data.images.load(save_png(name, rgba, depth="16"))
    img.colorspace_settings.name = "Non-Color"
    raw = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(raw)
    raw = raw.reshape(h, w, 4)
    raw[..., :3] = decode(raw[..., :3])
    return raw


def soft_sky(sky):
    """The sky small and blurred, as sky.webp: what the web fogs toward."""
    small = sky[::8, ::8].copy()
    for _ in range(3):
        small[:, :, :3] = (np.roll(small[:, :, :3], 1, 1) + small[:, :, :3] * 2 + np.roll(small[:, :, :3], -1, 1)) / 4
        small[1:-1, :, :3] = (small[:-2, :, :3] + small[1:-1, :, :3] * 2 + small[2:, :, :3]) / 4
    return small


def upsample(small, w, h):
    """Bilinear, wrapping around in longitude, as the web samples sky.webp."""
    sh, sw = small.shape[:2]
    x = (np.arange(w) + 0.5) * sw / w - 0.5
    y = np.clip((np.arange(h) + 0.5) * sh / h - 0.5, 0, sh - 1)
    x0 = np.floor(x).astype(int)
    y0 = np.floor(y).astype(int)
    fx = (x - x0)[None, :, None]
    fy = (y - y0)[:, None, None]
    x0 %= sw
    x1 = (x0 + 1) % sw
    y1 = np.minimum(y0 + 1, sh - 1)
    top = small[y0][:, x0] * (1 - fx) + small[y0][:, x1] * fx
    bottom = small[y1][:, x0] * (1 - fx) + small[y1][:, x1] * fx
    return top * (1 - fy) + bottom * fy


cam.location = hero

# The sky alone, at full size for the fog and small for the web scene's fog map.
show(lambda obj: False)
sky = render_exr("sky", width, 8, True)

# The backdrop's colors, then its distances through an emission override.
show(lambda obj: obj.get("bake") == "Backdrop")
color = render_exr("backdrop-color", width, samples, True)

depth_mat = bpy.data.materials.new("Depth")
depth_mat.use_nodes = True
nt = depth_mat.node_tree
nt.nodes.clear()
camdata = nt.nodes.new("ShaderNodeCameraData")
emit = nt.nodes.new("ShaderNodeEmission")
out = nt.nodes.new("ShaderNodeOutputMaterial")
nt.links.new(camdata.outputs["View Distance"], emit.inputs["Color"])
nt.links.new(emit.outputs[0], out.inputs["Surface"])
scene.view_layers[0].material_override = depth_mat
world = scene.world
scene.world = None
lights = [o for o in bpy.data.objects if o.type == "LIGHT"]
for light in lights:
    light.hide_render = True
saved_view = scene.view_settings.view_transform
scene.view_settings.view_transform = "Standard"
# A box filter a hair wide, so edge pixels take one surface's distance
# rather than averaging it with the sky's zero, which fogged them too little.
saved_filter = scene.cycles.filter_width
scene.cycles.filter_width = 0.01
depth = render_exr("backdrop-depth", width, 4, False)[..., 0]
scene.cycles.filter_width = saved_filter
scene.view_settings.view_transform = saved_view
scene.view_layers[0].material_override = None
scene.world = world
for light in lights:
    light.hide_render = False

# The fog mixes display colors toward the soft sky, as noir-street.ts does.
# Sky pixels have no surface, so they stay as rendered, clouds and all.
small = soft_sky(sky)
save_png("sky", small)
soft = upsample(displayed("sky-soft", small), width, width // 2)
shown = displayed("backdrop-color", color)
fog = np.where(depth > 0.01, np.minimum(1.0 - np.exp(-((FOG_DENSITY * depth) ** 2)), FOG_MAX), 0.0)[..., None]
backdrop = shown.copy()
mixed = encode(shown[..., :3]) * (1.0 - fog) + encode(soft[..., :3]) * fog
backdrop[..., :3] = decode(mixed)
backdrop[..., 3] = 1.0
# The mix is already display color: write it with only the sRGB encoding.
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
save_png("backdrop", backdrop)
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"

# The machine's reflections: everything but the machine and the poster gumballs.
show(lambda obj: obj.get("bake") != "Machine" and not obj.name.startswith("RenderGum"))
cam.location = (0, -0.1, 1.7)
env = render_exr("environment", 1024, samples, True)
save_png("environment", env)
