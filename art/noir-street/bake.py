"""Bakes the street's lighting into textures; export.py turns the result into the web scene.

python bake.py <in.blend> <out-dir> <size> <samples> [groups...]

For each bake group the objects are joined, given a fresh "Bake" UV atlas, and
baked with Cycles (COMBINED, seen from the hero camera so the wet street keeps
its reflections), plus albedo and normal passes that tonemap.py uses to guide
the denoiser. The joined groups are saved to <out-dir>/baked.blend.
"""

import json
import math
import os
import sys
import time

import bpy

GROUPS = ["GroundNear", "Props", "Pillar", "GroundFar", "Left", "Right", "Far"]
# Relative atlas size per group, as a share of the requested size.
SCALE = {"GroundNear": 1.0, "Props": 1.0, "Pillar": 0.5, "GroundFar": 0.5, "Left": 0.5, "Right": 0.5, "Far": 0.5}


def select_only(objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.hide_set(False)
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]


def join_group(name):
    objs = [o for o in bpy.data.objects if o.type == "MESH" and o.get("bake") == name]
    if not objs:
        return None
    select_only(objs)
    if len(objs) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = f"Baked_{name}"
    obj["bake"] = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


def unwrap(obj):
    me = obj.data
    while me.uv_layers:
        me.uv_layers.remove(me.uv_layers[0])
    me.uv_layers.new(name="Bake")
    select_only([obj])
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.002, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.pack_islands(udim_source="CLOSEST_UDIM", rotate=True, margin_method="FRACTION", margin=0.003, shape_method="AABB")
    bpy.ops.object.mode_set(mode="OBJECT")


def _bake_pass(obj, name, kind, size, samples, out_dir, **settings):
    float_buffer = kind != "DIFFUSE"
    img = bpy.data.images.new(f"bake_{name}_{kind}", size, size, float_buffer=float_buffer, alpha=False)
    if kind == "NORMAL":
        img.colorspace_settings.name = "Non-Color"
    for slot in obj.material_slots:
        nt = slot.material.node_tree
        for n in nt.nodes:
            n.select = False
        node = nt.nodes.new("ShaderNodeTexImage")
        node.image = img
        node.name = "BakeTarget"
        node.select = True
        nt.nodes.active = node
    scene = bpy.context.scene
    scene.cycles.samples = samples
    bake = scene.render.bake
    bake.margin = 6
    bake.margin_type = "EXTEND"
    bake.view_from = "ACTIVE_CAMERA"
    bake.use_clear = True
    select_only([obj])
    started = time.time()
    bpy.ops.object.bake(type=kind, **settings)
    print(f"baked {name} {kind} {size}px {samples}spp in {time.time() - started:.0f}s", flush=True)
    suffix = {"COMBINED": "", "DIFFUSE": "_albedo", "NORMAL": "_normal"}[kind]
    path = os.path.join(out_dir, f"{name}{suffix}.exr")
    img.filepath_raw = path
    img.file_format = "OPEN_EXR"
    img.save()
    for slot in obj.material_slots:
        nt = slot.material.node_tree
        nt.nodes.remove(nt.nodes["BakeTarget"])
    return path


def bake_group(obj, size, samples, out_dir):
    """Bakes the lit color plus albedo and normal guides for the denoiser."""
    name = obj["bake"]
    _bake_pass(obj, name, "DIFFUSE", size, 4, out_dir, pass_filter={"COLOR"})
    _bake_pass(obj, name, "NORMAL", size, 4, out_dir, normal_space="OBJECT")
    return _bake_pass(obj, name, "COMBINED", size, samples, out_dir)


def main():
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    blend, out_dir, size, samples = args[0], args[1], int(args[2]), int(args[3])
    only = args[4:] or GROUPS
    os.makedirs(out_dir, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=blend)
    scene = bpy.context.scene
    scene.cycles.device = "CPU"
    scene.cycles.use_denoising = False
    report = {}
    for name in only:
        obj = join_group(name)
        if obj is None:
            continue
        unwrap(obj)
        px = int(size * SCALE.get(name, 1.0))
        report[name] = bake_group(obj, px, samples, out_dir)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, "baked.blend"))
    print(json.dumps(report))


main()
