"""Renders the hero camera of a built .blend with Cycles: python preview.py in.blend out.png [width] [samples]"""

import sys

import bpy

blend, out = sys.argv[1], sys.argv[2]
width = int(sys.argv[3]) if len(sys.argv) > 3 else 720
samples = int(sys.argv[4]) if len(sys.argv) > 4 else 48
bpy.ops.wm.open_mainfile(filepath=blend)
scene = bpy.context.scene
scene.cycles.samples = samples
scene.cycles.use_denoising = True
scene.cycles.device = "CPU"
scene.render.resolution_y = int(width * scene.render.resolution_y / scene.render.resolution_x)
scene.render.resolution_x = width
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.render.filepath = out
bpy.ops.render.render(write_still=True)
