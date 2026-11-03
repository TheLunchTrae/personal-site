"""Converts baked EXR atlases to display-ready PNGs with the scene's AgX look,
optionally denoising them with OpenImageDenoise through the compositor.

python tonemap.py <out-dir> <file.exr>... [--denoise]
"""

import os
import sys

import bpy

args = sys.argv[1:]
denoise = "--denoise" in args
args = [a for a in args if a != "--denoise"]
out_dir = args[0]
# The albedo and normal guides sit beside each bake; only the bakes themselves are converted.
files = [f for f in args[1:] if not f.endswith(("_albedo.exr", "_normal.exr"))]
scene = bpy.context.scene
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = 0.0


def run_denoise(img, albedo=None, normal=None):
    """Runs the image through the compositor's Denoise node and returns the result."""
    tree = bpy.data.node_groups.new("Denoise", "CompositorNodeTree")
    scene.compositing_node_group = tree
    src = tree.nodes.new("CompositorNodeImage")
    src.image = img
    dn = tree.nodes.new("CompositorNodeDenoise")
    out = tree.nodes.new("NodeGroupOutput")
    tree.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    tree.links.new(src.outputs["Image"], dn.inputs["Image"])
    # Albedo and normal guides let the denoiser keep texture detail.
    for guide, socket in ((albedo, "Albedo"), (normal, "Normal")):
        if guide is not None:
            gn = tree.nodes.new("CompositorNodeImage")
            gn.image = guide
            tree.links.new(gn.outputs["Image"], dn.inputs[socket])
    tree.links.new(dn.outputs["Image"], out.inputs[0])
    scene.render.resolution_x, scene.render.resolution_y = img.size
    scene.render.resolution_percentage = 100
    scene.render.use_compositing = True
    scene.render.compositor_device = "CPU"
    scene.render.use_sequencer = False
    # Nothing to render but the compositor: keep the render itself trivial.
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 1
    scene.cycles.device = "CPU"
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj)
    bpy.ops.render.render()
    result = bpy.data.images["Render Result"]
    return result


for path in files:
    img = bpy.data.images.load(path)
    name = os.path.splitext(os.path.basename(path))[0]
    target = os.path.join(out_dir, f"{name}.png")
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.color_mode = "RGB"
    if denoise:
        base = os.path.splitext(path)[0]
        albedo = bpy.data.images.load(base + "_albedo.exr") if os.path.exists(base + "_albedo.exr") else None
        normal = bpy.data.images.load(base + "_normal.exr") if os.path.exists(base + "_normal.exr") else None
        if normal is not None:
            normal.colorspace_settings.name = "Non-Color"
        result = run_denoise(img, albedo, normal)
        result.save_render(target, scene=scene)
    else:
        img.save_render(target, scene=scene)
    print("wrote", target, flush=True)
