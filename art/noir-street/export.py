"""Exports the baked street to GLB: python export.py <baked.blend> <png-dir> <out.glb>

Baked groups get one material whose base color is their denoised atlas. The
machine keeps its PBR materials, and the neon tubes and lamp glass keep their
names so the web scene can drive them. Lights, cameras, and the render-only
gumballs are left out, and so is the backdrop, which render.py draws into the sky.
"""

import os
import sys

import bpy

blend, png_dir, out = sys.argv[1], sys.argv[2], sys.argv[3]
bpy.ops.wm.open_mainfile(filepath=blend)

for obj in list(bpy.data.objects):
    if obj.type in {"LIGHT", "CAMERA"} or obj.get("bake") in {"RenderOnly", "Backdrop"}:
        bpy.data.objects.remove(obj)

for obj in [o for o in bpy.data.objects if o.name.startswith("Baked_")]:
    group = obj["bake"]
    mat = bpy.data.materials.new(f"Baked_{group}")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(os.path.join(png_dir, f"{group}.png"))
    tex.interpolation = "Linear"
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 1.0
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.material_index = 0

# The live machine's procedural materials don't survive glTF, which would
# export them white: give each its flat color, recorded by materials.grimy().
for obj in [o for o in bpy.data.objects if o.get("bake") == "Machine"]:
    for mat in obj.data.materials:
        if mat is None or "flat_color" not in mat:
            continue
        bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        base = bsdf.inputs["Base Color"]
        for link in list(base.links):
            mat.node_tree.links.remove(link)
        base.default_value = tuple(mat["flat_color"])

glass = [o for o in bpy.data.objects if o.name.startswith("LampGlass")]
if glass:
    bpy.ops.object.select_all(action="DESELECT")
    for o in glass:
        o.select_set(True)
    bpy.context.view_layer.objects.active = glass[0]
    bpy.ops.object.join()
    bpy.context.view_layer.objects.active.name = "LampGlass"

bpy.ops.export_scene.gltf(
    filepath=out,
    export_format="GLB",
    export_apply=True,
    export_texcoords=True,
    export_normals=True,
    export_materials="EXPORT",
    export_image_format="AUTO",
    export_cameras=False,
    export_lights=False,
    export_yup=True,
)
print("exported", out)
