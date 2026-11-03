"""Builds the Junction scene for the Call of Duty theme's gumball menu.

Run headless: python build.py <out.blend>

The view stands in a doorway looking across a wet cobbled plaza at a gumball
machine beside a tall concrete pillar. Past it: a fruit cart, a parked truck,
shopfronts, an elevated railway with a stopped train, a skyline under a
burning sky, and a giant worm hanging out of the clouds. All of it is modeled
here from code.

Blender is Z-up; the glTF export turns it Y-up, so Blender +Y (away from the
camera) becomes three.js -Z. The machine stands at the origin and matches the
dimensions gumball-scene.ts expects.

Every mesh carries a "bake" group:
- GroundNear, GroundFar, Pillar, Left, Right, Far, Props: baked, exported.
- Machine, Emissive: exported with live materials.
- Backdrop: the skyline, worm, and far streets, rendered into the sky panorama.
- RenderOnly: seen in reflections and renders, never exported.
"""

import json
import math
import os
import random
import sys

import bpy  # noqa: I001  (bpy must load before bmesh and mathutils)
import bmesh
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(__file__))
import materials as M  # noqa: E402
from nodes import rgba  # noqa: E402

FONTS = os.path.join(os.path.dirname(__file__), "fonts")
TOP = M.WALK_TOP
LEFT_X = -11.0
RIGHT_X = 11.0
FAR_Y = 38.0
BANK_Y = 62.0
BACK_Y = -9.0
WALK = 1.8
NEAR_SPLIT = 10.0
VIADUCT_Y = 30.0
# Lane openings in each wall, as (start, end) along the wall.
LEFT_LANE = (12.0, 16.0)
RIGHT_LANE = (15.0, 19.0)
PILLAR = (-1.18, 0.78, 1.3)  # center x, center y, width

# Page signs: id, text, font, neon color, side, y, z, size, vertical. The home and story
# signs' colors match GUM_COLORS in gumball-scene.ts; the others are scenery.
SIGNS = [
    ("about", "About", "Pacifico", "#3fd8c8", 1, 10.5, 4.6, 0.9, False),
    ("projects", "Projects", "Pacifico", "#ff4f9a", 1, 21.0, 6.4, 1.1, False),
    ("home", "HOME", "Teko", "#efe2c8", -1, 8.2, 6.0, 0.95, True),
    ("resume", "RESUME", "Teko", "#f0a35c", -1, 20.0, 5.6, 1.2, False),
    ("story", "OPEN", "Teko", "#e04a3f", 1, 6.4, 2.6, 0.55, False),
]

R = random.Random(1942)

# Three.js stage framing, as in gumball-scene.ts layout(): the hero camera is
# where that code puts the camera for a wide stage, then tilted up by pitch degrees.
WIDE = {"aspect": 2.5, "fov": 46, "center": (0, 1.75, 0), "size": (4.6, 3.9), "region": (0.9, 0.7, 0, 0.25), "pitch": 5}
TALL = {"aspect": 0.72, "fov": 56, "center": (0, 1.75, 0), "size": (2.3, 3.6), "region": (0.94, 0.66, 0, 0.2), "pitch": 4}


def home_camera(view):
    """The camera position frameBox() in scene-kit.ts picks, in Blender coordinates."""
    tan = math.tan(math.radians(view["fov"] / 2))
    a = view["aspect"]
    w, h = view["size"]
    rw, rh, rx, ry = view["region"]
    cx, cy, cz = view["center"]
    distance = max(h / 2 / (tan * rh), w / 2 / (tan * a * rw))
    three = (cx - rx * distance * tan * a, cy - ry * distance * tan, cz + distance)
    return (three[0], -three[2], three[1])


# ---------------------------------------------------------------- mesh utils
def link(obj, collection=None):
    (collection or bpy.context.scene.collection).objects.link(obj)
    return obj


def mesh_object(name, bm, material=None, bake=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    if material is not None:
        me.materials.append(material)
    if bake is not None:
        obj["bake"] = bake
    return link(obj)


def box(bm, center, size, drop=()):
    """Adds an axis-aligned box. drop names faces to leave out: -x +x -y +y -z +z."""
    cx, cy, cz = center
    sx, sy, sz = (s / 2 for s in size)
    v = [bm.verts.new((cx + x * sx, cy + y * sy, cz + z * sz)) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]

    def idx(x, y, z):
        return v[(x > 0) * 4 + (y > 0) * 2 + (z > 0)]

    faces = {
        "-x": [idx(-1, -1, -1), idx(-1, -1, 1), idx(-1, 1, 1), idx(-1, 1, -1)],
        "+x": [idx(1, -1, -1), idx(1, 1, -1), idx(1, 1, 1), idx(1, -1, 1)],
        "-y": [idx(-1, -1, -1), idx(1, -1, -1), idx(1, -1, 1), idx(-1, -1, 1)],
        "+y": [idx(-1, 1, -1), idx(-1, 1, 1), idx(1, 1, 1), idx(1, 1, -1)],
        "-z": [idx(-1, -1, -1), idx(-1, 1, -1), idx(1, 1, -1), idx(1, -1, -1)],
        "+z": [idx(-1, -1, 1), idx(1, -1, 1), idx(1, 1, 1), idx(-1, 1, 1)],
    }
    return [bm.faces.new(f) for key, f in faces.items() if key not in drop]


def _merge(bm, other):
    me = bpy.data.meshes.new("tmp")
    other.to_mesh(me)
    other.free()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)


def transformed(bm, build, matrix):
    """Builds into a scratch mesh, transforms it, and merges it into bm."""
    tmp = bmesh.new()
    build(tmp)
    bmesh.ops.transform(tmp, matrix=matrix, verts=tmp.verts)
    _merge(bm, tmp)


def beam(bm, a, b, thickness, depth=None):
    """A square (or flat) bar between two points."""
    a, b = Vector(a), Vector(b)
    length = (b - a).length
    rot = Vector((0, 0, 1)).rotation_difference((b - a).normalized()).to_matrix().to_4x4()
    transformed(bm, lambda t: box(t, (0, 0, length / 2), (thickness, depth or thickness, length)), Matrix.Translation(a) @ rot)


def lathe(bm, profile, segments=48, center=(0, 0, 0), close_top=True, close_bottom=True):
    """Revolves (radius, z) points about the z axis."""
    cx, cy, cz = center
    rings = []
    for r, z in profile:
        rings.append([bm.verts.new((cx + r * math.cos(2 * math.pi * s / segments), cy + r * math.sin(2 * math.pi * s / segments), cz + z)) for s in range(segments)])
    for i in range(len(rings) - 1):
        for s in range(segments):
            n = (s + 1) % segments
            bm.faces.new([rings[i][s], rings[i][n], rings[i + 1][n], rings[i + 1][s]])
    if close_bottom and profile[0][0] > 1e-4:
        bm.faces.new(list(reversed(rings[0])))
    if close_top and profile[-1][0] > 1e-4:
        bm.faces.new(rings[-1])


def cylinder_x(bm, center, radius, width, segments=20):
    """A wheel or drum lying along x."""
    transformed(
        bm,
        lambda t: lathe(t, [(radius, -width / 2), (radius, width / 2)], segments=segments),
        Matrix.Translation(center) @ Matrix.Rotation(math.pi / 2, 4, "Y"),
    )


def sphere(bm, center, radius, segments=10, rings=7):
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=radius, matrix=Matrix.Translation(center))


def curve_object(name, points, radius, material, radii=None, resolution=3):
    """A tube along a poly line, optionally with a radius per point."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = resolution
    sp = cu.splines.new("POLY")
    sp.points.add(len(points) - 1)
    for i, (p, co) in enumerate(zip(sp.points, points)):
        p.co = (*co, 1)
        if radii is not None:
            p.radius = radii[i]
    obj = link(bpy.data.objects.new(name, cu))
    cu.materials.append(material)
    return to_mesh(obj)


def to_mesh(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    return bpy.context.view_layer.objects.active


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = name
    return obj


def shade_smooth(obj, angle=35):
    for poly in obj.data.polygons:
        poly.use_smooth = True
    obj.data.set_sharp_from_angle(angle=math.radians(angle))


def set_seed(obj, value):
    attr = obj.data.attributes.get("bseed") or obj.data.attributes.new("bseed", "FLOAT", "FACE")
    for i in range(len(attr.data)):
        attr.data[i].value = value


def text_mesh(text, font, size, extrude=0.0, bevel=0.0, fill=True, align="CENTER"):
    """Lettering as a mesh lying in the XZ plane, facing -Y, centered on the origin."""
    fnt = bpy.data.fonts.load(os.path.join(FONTS, "Pacifico.ttf" if font == "Pacifico" else "Teko-SemiBold.ttf"), check_existing=True)
    cu = bpy.data.curves.new(f"Text_{text}", "FONT")
    cu.body = text
    cu.font = fnt
    cu.size = size
    cu.align_x = align
    cu.align_y = "CENTER"
    cu.extrude = extrude
    cu.bevel_depth = bevel
    cu.bevel_resolution = 2
    cu.resolution_u = 6
    if not fill:
        cu.fill_mode = "NONE"
    obj = link(bpy.data.objects.new(cu.name, cu))
    obj.rotation_euler = (math.pi / 2, 0, 0)
    return to_mesh(obj)


# --------------------------------------------------------------- the plaza
def ground(mats):
    """The cobbled plaza, its lanes, and the sidewalks along the walls, split
    near and far so the near half gets the most texels."""
    for part, y0, y1 in (("Near", BACK_Y, NEAR_SPLIT), ("Far", NEAR_SPLIT, FAR_Y)):
        bm = bmesh.new()
        # Cobbles in 5 m tiles, so the atlas packs well.
        y = y0
        while y < y1 - 1e-3:
            length = min(5.0, y1 - y)
            x = LEFT_X + WALK
            while x < RIGHT_X - WALK - 1e-3:
                width = min(5.0, RIGHT_X - WALK - x)
                box(bm, (x + width / 2, y + length / 2, -0.05), (width, length, 0.1), drop=("-z", "-x", "+x", "-y", "+y"))
                x += width
            y += length
        mesh_object(f"Plaza{part}", bm, mats["plaza"], f"Ground{part}")
        for side, x_wall in ((-1, LEFT_X), (1, RIGHT_X)):
            bm = bmesh.new()
            cx = x_wall - side * WALK / 2
            y = y0
            while y < y1 - 1e-3:
                length = min(5.0, y1 - y)
                box(bm, (cx, y + length / 2, TOP / 2), (WALK, length, TOP), drop=("-z", "-y", "+y", "+x" if side > 0 else "-x"))
                y += length
            walk = mesh_object(f"Walk{part}{side}", bm, mats["sidewalk"], f"Ground{part}")
            walk.data.materials.append(mats["curb"])
            for poly in walk.data.polygons:
                if abs(poly.normal.x) > 0.5:
                    poly.material_index = 1
    # The lanes beyond the side walls.
    bm = bmesh.new()
    box(bm, (LEFT_X - 5, sum(LEFT_LANE) / 2, -0.05), (10, LEFT_LANE[1] - LEFT_LANE[0], 0.1), drop=("-z",))
    box(bm, (RIGHT_X + 5, sum(RIGHT_LANE) / 2, -0.05), (10, RIGHT_LANE[1] - RIGHT_LANE[0], 0.1), drop=("-z",))
    mesh_object("Lanes", bm, mats["plaza"], "GroundFar")


def quay(mats):
    """The plaza's far edge: a stone quay with an iron railing over the canal, the
    water, and the far bank's buildings, which only the backdrop sees."""
    bm = bmesh.new()
    box(bm, (0, FAR_Y + 0.3, 0.12), (RIGHT_X - LEFT_X + 18, 0.6, 0.24), drop=("-z",))
    box(bm, (0, FAR_Y + 0.55, -1.0), (RIGHT_X - LEFT_X + 18, 0.1, 2.0), drop=())
    mesh_object("Quay", bm, mats["stone"], "Far")
    bm = bmesh.new()
    x = LEFT_X - 9
    while x <= RIGHT_X + 9:
        box(bm, (x, FAR_Y + 0.3, 0.75), (0.07, 0.07, 1.05))
        lathe(bm, [(0.0, 0.0), (0.06, 0.02), (0.0, 0.1)], segments=8, center=(x, FAR_Y + 0.3, 1.27))
        x += 1.8
    box(bm, (0, FAR_Y + 0.3, 1.2), (RIGHT_X - LEFT_X + 18, 0.06, 0.05))
    box(bm, (0, FAR_Y + 0.3, 0.6), (RIGHT_X - LEFT_X + 18, 0.04, 0.04))
    x = LEFT_X - 9
    while x <= RIGHT_X + 9:
        box(bm, (x + 0.9, FAR_Y + 0.3, 0.9), (0.025, 0.025, 0.6))
        x += 0.3
    mesh_object("Railing", bm, mats["iron"], "Far")
    bm = bmesh.new()
    box(bm, (0, (FAR_Y + BANK_Y) / 2 + 0.3, -0.8), (200, BANK_Y - FAR_Y, 0.1), drop=("-z",))
    mesh_object("Canal", bm, mats["water"], "Backdrop")
    bm = bmesh.new()
    box(bm, (0, BANK_Y + 3, -0.05), (200, 6, 0.1), drop=("-z",))
    mesh_object("FarBank", bm, mats["sidewalk"], "Backdrop")


def building(name, x0, x1, y0, y1, height, mats, bake, seed):
    """A block of the given footprint. Faces under the street or against neighbors are left out."""
    bm = bmesh.new()
    box(bm, ((x0 + x1) / 2, (y0 + y1) / 2, TOP + height / 2), (x1 - x0, y1 - y0, height), drop=("-z",))
    obj = mesh_object(name, bm, mats["facade"], bake)
    set_seed(obj, seed)
    return obj


def cornice(bm, a, b, z, out, depth=0.35, height=0.5):
    """A stone ledge along a wall from a to b (2D points) at height z, sticking out by depth."""
    a, b = Vector((*a, 0)), Vector((*b, 0))
    mid = (a + b) / 2
    along = b - a
    size = (abs(along.x) + (depth if abs(along.y) > 0 else 0.1), abs(along.y) + (depth if abs(along.x) > 0 else 0.1), height)
    box(bm, (mid.x + out[0] * depth / 2, mid.y + out[1] * depth / 2, z), size)


def walls(mats):
    """The plaza's walls: rows of buildings on three sides, and the wall behind the camera."""
    stone = []
    # Left and right rows: blocks along y, 9 m deep, with a lane gap.
    for side, x_face, lane in ((-1, LEFT_X, LEFT_LANE), (1, RIGHT_X, RIGHT_LANE)):
        y = BACK_Y - 2
        i = 0
        while y < FAR_Y + 9:
            if lane[0] <= y < lane[1]:
                y = lane[1]
                continue
            width = R.choice((5.0, 6.2, 7.4, 8.6))
            if y < lane[0] < y + width:
                width = lane[0] - y
            height = R.choice((12.0, 15.2, 18.4, 15.2)) if y < 12 else R.choice((10.6, 12.0, 13.6, 12.0))
            setback = R.choice((0.0, 0.0, 0.3))
            xf = x_face + side * setback
            x0, x1 = (xf, xf + 9) if side > 0 else (xf - 9, xf)
            bake = "Left" if side < 0 else "Right"
            building(f"Bldg{bake}{i}", x0, x1, y, y + width, height, mats, bake, R.random())
            bm = bmesh.new()
            cornice(bm, (xf, y), (xf, y + width), TOP + height - 0.25, (-side, 0))
            cornice(bm, (xf, y), (xf, y + width), TOP + M.GROUND_FLOOR - 0.1, (-side, 0), 0.22, 0.22)
            stone.append(mesh_object(f"Cornice{bake}{i}", bm, mats["stone"], bake))
            rows.append((side, y, width, height, xf, bake))
            y += width
            i += 1
        # The lane's end wall, so the lane leads somewhere.
        end_x = x_face + side * 10
        building(f"LaneEnd{side}", min(end_x, end_x + side * 6), max(end_x, end_x + side * 6), lane[0] - 2, lane[1] + 2, 14, mats, "Left" if side < 0 else "Right", 0.5)
    # Behind the camera: the building the door opens from. Only reflections see it.
    bm = bmesh.new()
    box(bm, (0, BACK_Y - 4, TOP + 7), (RIGHT_X - LEFT_X + 18, 8, 14), drop=("-z",))
    behind = mesh_object("Behind", bm, mats["facade"], "RenderOnly")
    set_seed(behind, 0.3)


def backdrop(mats):
    """The city past the plaza: towers on a wide arc, the far street's buildings,
    and a water tower or two. Rendered into the sky panorama, never exported."""
    rnd = random.Random(77)
    # The far bank: a terrace of warehouses and walk-ups across the canal.
    x = -70.0
    while x < 70:
        width = rnd.choice((6.0, 8.0, 10.0, 12.0))
        height = rnd.choice((9.0, 11.0, 12.5, 14.0, 17.0))
        obj = building(f"Bank{int(x)}", x, x + width, BANK_Y + 6, BANK_Y + 18, height, mats, "Backdrop", rnd.random())
        obj.data.materials[0] = mats["facade"]
        x += width
    # Towers: stacked, stepped blocks on an arc from 80 m to 220 m. Their tops stay
    # low in the view (6 to 15 degrees up) so the sky stays open above them.
    for i in range(38):
        angle = math.radians(rnd.uniform(-70, 70))
        dist = rnd.uniform(80, 220)
        cx, cy = math.sin(angle) * dist, math.cos(angle) * dist
        w = rnd.uniform(12, 26)
        d = rnd.uniform(12, 24)
        h = dist * math.tan(math.radians(rnd.uniform(6, 13) if abs(angle) < math.radians(30) else rnd.uniform(8, 16)))
        bm = bmesh.new()
        z = 0.0
        tiers = rnd.choice((1, 2, 3, 3))
        for t in range(tiers):
            th = h * (0.7 if t == 0 else 0.15)
            box(bm, (cx, cy, z + th / 2), (w, d, th), drop=("-z",))
            z += th
            w *= 0.72
            d *= 0.72
        if rnd.random() < 0.35:
            # A spire on the top tier.
            lathe(bm, [(w * 0.18, 0), (w * 0.1, h * 0.1), (0.0, h * 0.22)], segments=8, center=(cx, cy, z))
        obj = mesh_object(f"Tower{i}", bm, mats["tower"], "Backdrop")
        set_seed(obj, rnd.random())


def gateworm(mats):
    """A colossal segmented worm hanging out of the clouds, its glowing maw low over
    the rooftops. Original design; it reads at a distance, so it is built coarse."""
    tip = Vector((10.5, 66.0, 18.5))
    points = []
    radii = []
    # A slow S-curve up and to the right, into the clouds.
    for i in range(140):
        t = i / 139
        p = tip + Vector((t * 30 + math.sin(t * 3.4) * 6, t * 40 + math.sin(t * 2.3) * 8, t * 130))
        points.append(p)
        # Fat ridged segments, thickening as the body climbs.
        base = 4.6 + t * 8.0
        ridge = 1.0 + 0.16 * max(0.0, math.sin(i * 1.15)) ** 2
        radii.append(base * ridge)
    body = curve_object("Gateworm", points, 1.0, mats["worm"], radii, resolution=4)
    body["bake"] = "Backdrop"
    shade_smooth(body, 60)
    # The maw: a flared lip around a glowing core.
    bm = bmesh.new()
    lathe(bm, [(0.0, -2.6), (2.0, -2.3), (3.6, -1.2), (4.2, 0.2), (3.4, 0.9)], segments=24, center=tip, close_top=False)
    lip = mesh_object("GatewormLip", bm, mats["worm"], "Backdrop")
    shade_smooth(lip)
    bm = bmesh.new()
    sphere(bm, (tip.x, tip.y, tip.z - 1.6), 1.6, 16, 10)
    mesh_object("GatewormGlow", bm, mats["worm_glow"], "Backdrop")
    light = bpy.data.lights.new("GatewormLight", "POINT")
    light.energy = 400000
    light.color = rgba("#ffd860")[:3]
    light.shadow_soft_size = 2.0
    lo = link(bpy.data.objects.new("GatewormLight", light))
    lo.location = (tip.x, tip.y, tip.z - 3.0)
    meta["worm_tip"] = [tip.x, tip.y, tip.z - 1.6]


def viaduct(mats):
    """An elevated railway crossing the plaza on riveted girders, with a train stopped on it."""
    bm = bmesh.new()
    deck_z = 8.0
    x0, x1 = LEFT_X - 2, RIGHT_X + 2
    for y in (VIADUCT_Y - 1.5, VIADUCT_Y + 1.5):
        box(bm, ((x0 + x1) / 2, y, deck_z - 0.55), (x1 - x0, 0.3, 1.1))
        box(bm, ((x0 + x1) / 2, y, deck_z - 1.1), (x1 - x0, 0.6, 0.1))
        box(bm, ((x0 + x1) / 2, y, deck_z), (x1 - x0, 0.6, 0.1))
        # Lattice webbing along the girder.
        x = x0
        while x < x1 - 1.2:
            beam(bm, (x, y - 0.18, deck_z - 1.05), (x + 1.2, y - 0.18, deck_z - 0.05), 0.07)
            beam(bm, (x + 1.2, y - 0.18, deck_z - 1.05), (x + 2.4, y - 0.18, deck_z - 0.05), 0.07)
            x += 2.4
    box(bm, ((x0 + x1) / 2, VIADUCT_Y, deck_z + 0.08), (x1 - x0, 3.4, 0.12))
    for rail in (-0.72, 0.72):
        box(bm, ((x0 + x1) / 2, VIADUCT_Y + rail, deck_z + 0.2), (x1 - x0, 0.08, 0.12))
    # Railings and columns.
    for y in (VIADUCT_Y - 1.75, VIADUCT_Y + 1.75):
        box(bm, ((x0 + x1) / 2, y, deck_z + 1.1), (x1 - x0, 0.05, 0.05))
        x = x0
        while x <= x1:
            box(bm, (x, y, deck_z + 0.6), (0.05, 0.05, 1.0))
            x += 1.5
    for x in (-5.6, 5.6):
        for y in (VIADUCT_Y - 1.3, VIADUCT_Y + 1.3):
            box(bm, (x, y, deck_z / 2 - 0.5), (0.45, 0.45, deck_z - 1.0))
        beam(bm, (x, VIADUCT_Y - 1.3, 1.0), (x, VIADUCT_Y + 1.3, deck_z - 1.6), 0.12)
        beam(bm, (x, VIADUCT_Y + 1.3, 1.0), (x, VIADUCT_Y - 1.3, deck_z - 1.6), 0.12)
        box(bm, (x, VIADUCT_Y, deck_z - 1.2), (0.6, 3.4, 0.3))
    mesh_object("Viaduct", bm, mats["iron_rust"], "Far")

    # A two-car train, stopped, its windows lit.
    bm = bmesh.new()
    glass = bmesh.new()
    z0 = deck_z + 0.35
    for cx in (-6.4, 1.2):
        length = 7.2
        box(bm, (cx, VIADUCT_Y, z0 + 0.25), (length, 2.6, 0.5))
        box(bm, (cx, VIADUCT_Y, z0 + 2.35), (length, 2.6, 0.5))
        lathe_roof = bmesh.new()
        box(lathe_roof, (cx, VIADUCT_Y, z0 + 2.75), (length - 0.2, 2.3, 0.3))
        _merge(bm, lathe_roof)
        for i in range(8):
            wx = cx - length / 2 + 0.55 + i * 0.88
            box(bm, (wx - 0.42, VIADUCT_Y - 1.28, z0 + 1.3), (0.12, 0.06, 1.6))
            box(glass, (wx, VIADUCT_Y - 1.27, z0 + 1.35), (0.7, 0.04, 1.2))
        box(bm, (cx + length / 2 - 0.05, VIADUCT_Y, z0 + 1.3), (0.1, 2.6, 1.6))
        box(bm, (cx - length / 2 + 0.05, VIADUCT_Y, z0 + 1.3), (0.1, 2.6, 1.6))
        box(bm, (cx, VIADUCT_Y + 1.25, z0 + 1.3), (length, 0.1, 1.6))
        for wx in (cx - 2.2, cx + 2.2):
            box(bm, (wx, VIADUCT_Y, z0 - 0.15), (1.6, 2.0, 0.3))
    mesh_object("Train", bm, mats["train"], "Far")
    windows = mesh_object("TrainWindows", glass, mats["train_glass"], "Far")
    del windows
    # Light spilling from the train onto the plaza below.
    light = bpy.data.lights.new("TrainLight", "AREA")
    light.shape = "RECTANGLE"
    light.size = 14
    light.size_y = 1.2
    light.energy = 900
    light.color = rgba("#ffc27a")[:3]
    lo = link(bpy.data.objects.new("TrainLight", light))
    lo.location = (-2.6, VIADUCT_Y - 1.6, deck_z + 1.4)
    lo.rotation_euler = (math.radians(-70), 0, 0)


# ------------------------------------------------------------------ the pillar
def pillar(mats):
    """A massive square concrete pillar beside the machine, rising out of view, with
    a lamp on an iron bracket and torn handbills pasted at eye height."""
    px, py, w = PILLAR
    bm = bmesh.new()
    box(bm, (px, py, 0.35), (w + 0.3, w + 0.3, 0.7), drop=("-z",))
    box(bm, (px, py, 0.76), (w + 0.16, w + 0.16, 0.12), drop=("-z",))
    box(bm, (px, py, 0.82 + 15), (w, w, 30.0), drop=("-z",))
    # Chamfer strips on the corners, so the edges catch the light.
    for dx in (-1, 1):
        for dy in (-1, 1):
            box(bm, (px + dx * w / 2, py + dy * w / 2, 15.8), (0.08, 0.08, 30.0))
    obj = mesh_object("Pillar", bm, mats["concrete"], "Pillar")
    # Handbills: thin rectangles on the two faces the camera sees.
    bm = bmesh.new()
    rnd = random.Random(5)
    for _ in range(9):
        face = rnd.choice(("front", "front", "right"))
        bw, bh = rnd.uniform(0.2, 0.32), rnd.uniform(0.28, 0.42)
        z = rnd.uniform(1.0, 2.4)
        if face == "front":
            x = px + rnd.uniform(-w / 2 + 0.25, w / 2 - 0.25)
            box(bm, (x, py - w / 2 - 0.006, z), (bw, 0.004, bh))
        else:
            y = py + rnd.uniform(-w / 2 + 0.25, w / 2 - 0.25)
            box(bm, (px + w / 2 + 0.006, y, z), (0.004, bw, bh))
    mesh_object("Handbills", bm, mats["paper"], "Pillar")
    # The lamp: an iron arm off the pillar's front face, out over the machine.
    wall = Vector((px + 0.32, py - w / 2, 3.55))
    lamp_at = Vector((px + 0.45, py - w / 2 - 0.85, 3.55))
    bm = bmesh.new()
    beam(bm, wall, lamp_at, 0.06)
    beam(bm, (wall.x, wall.y, 3.0), (lamp_at.x, lamp_at.y + 0.35, 3.55), 0.04)
    box(bm, (wall.x, wall.y - 0.03, 3.3), (0.24, 0.06, 0.7))
    lathe(bm, [(0.05, 0.12), (0.28, -0.08), (0.3, -0.12), (0.0, -0.12)], segments=20, center=lamp_at)
    hood = mesh_object("PillarLamp", bm, mats["iron"], "Pillar")
    shade_smooth(hood)
    glass = bmesh.new()
    lathe(glass, [(0.0, -0.12), (0.18, -0.14), (0.12, -0.34), (0.0, -0.36)], segments=20, center=lamp_at)
    g = mesh_object("LampGlassPillar", glass, mats["lampglass"], "Emissive")
    shade_smooth(g)
    add_lamp_light("PillarLight", (lamp_at.x, lamp_at.y, lamp_at.z - 0.25), 300)
    return obj


def add_lamp_light(name, at, energy, color="#ffc98a"):
    light = bpy.data.lights.new(name, "POINT")
    light.energy = energy
    light.color = rgba(color)[:3]
    light.shadow_soft_size = 0.12
    lo = link(bpy.data.objects.new(name, light))
    lo.location = at
    lamps.append(tuple(at))


def street_lamp(x, y, mats):
    """A cast-iron lamp post with a single lantern."""
    bm = bmesh.new()
    lathe(
        bm,
        [(0.17, 0), (0.17, 0.1), (0.12, 0.14), (0.1, 0.55), (0.07, 0.66), (0.055, 0.75), (0.05, 4.0), (0.07, 4.1), (0.09, 4.2), (0.0, 4.25)],
        segments=16,
        center=(x, y, 0),
    )
    lathe(bm, [(0.0, 0.0), (0.22, -0.02), (0.26, -0.06), (0.0, -0.08)], segments=16, center=(x, y, 4.85))
    for a in range(4):
        ang = a * math.pi / 2 + math.pi / 4
        beam(bm, (x + math.cos(ang) * 0.17, y + math.sin(ang) * 0.17, 4.25), (x + math.cos(ang) * 0.2, y + math.sin(ang) * 0.2, 4.8), 0.03)
    obj = mesh_object(f"Lamp{int(x)}_{int(y)}", bm, mats["iron"], "Props")
    shade_smooth(obj)
    glass = bmesh.new()
    lathe(glass, [(0.0, 4.25), (0.15, 4.28), (0.19, 4.55), (0.2, 4.8), (0.0, 4.82)], segments=16, center=(x, y, 0))
    g = mesh_object(f"LampGlass{int(x)}_{int(y)}", glass, mats["lampglass"], "Emissive")
    shade_smooth(g)
    add_lamp_light(f"LampLight{int(x)}_{int(y)}", (x, y, 4.55), 380)


# ---------------------------------------------------------------- props
def fruit_cart(mats, at, turn):
    """A painted push-cart of fruit under a striped canopy."""
    m = Matrix.Translation(at) @ Matrix.Rotation(turn, 4, "Z")
    wood_bm, crate_bm, fruit_bm, canopy_bm, iron_bm = (bmesh.new() for _ in range(5))

    def body(t):
        box(t, (0, 0, 0.82), (2.4, 1.1, 0.1))
        box(t, (0, -0.56, 0.95), (2.4, 0.04, 0.3))
        box(t, (0, 0.56, 0.95), (2.4, 0.04, 0.3))
        box(t, (-1.2, 0, 0.95), (0.04, 1.1, 0.3))
        box(t, (1.2, 0, 0.95), (0.04, 1.1, 0.3))
        box(t, (0, 0, 0.6), (2.2, 0.9, 0.35))
        for dx in (-1.15, 1.15):
            for dy in (-0.5, 0.5):
                box(t, (dx, dy, 1.6), (0.06, 0.06, 1.5))
        beam(t, (1.2, -0.3, 0.8), (1.9, -0.3, 0.75), 0.05)
        beam(t, (1.2, 0.3, 0.8), (1.9, 0.3, 0.75), 0.05)
        # A sign board under the canopy's front edge.
        box(t, (0, -0.6, 2.2), (1.6, 0.04, 0.32))

    transformed(wood_bm, body, m)

    def crates(t):
        for i, dx in enumerate((-0.8, 0.0, 0.8)):
            box(t, (dx, -0.15, 1.02), (0.7, 0.55, 0.3))
            box(t, (dx, 0.25, 1.15), (0.7, 0.4, 0.4))
        box(t, (-1.8, 0.8, 0.25), (0.6, 0.45, 0.5))
        box(t, (-1.7, 0.85, 0.72), (0.55, 0.42, 0.44))

    transformed(crate_bm, crates, m)

    def fruit(t):
        rnd = random.Random(11)
        for dx in (-0.8, 0.0, 0.8):
            for _ in range(14):
                sphere(t, (dx + rnd.uniform(-0.28, 0.28), -0.15 + rnd.uniform(-0.2, 0.2), 1.2 + rnd.uniform(0, 0.06)), 0.055, 8, 6)
            for _ in range(12):
                sphere(t, (dx + rnd.uniform(-0.28, 0.28), 0.25 + rnd.uniform(-0.14, 0.14), 1.38 + rnd.uniform(0, 0.06)), 0.055, 8, 6)

    transformed(fruit_bm, fruit, m)

    def canopy(t):
        v = [t.verts.new(co) for co in ((-1.4, -0.95, 2.05), (1.4, -0.95, 2.05), (1.4, 0.75, 2.5), (-1.4, 0.75, 2.5))]
        t.faces.new(v)
        # A scalloped valance along the front edge.
        for i in range(10):
            x = -1.4 + i * 0.28
            tri = [t.verts.new((x, -0.95, 2.05)), t.verts.new((x + 0.28, -0.95, 2.05)), t.verts.new((x + 0.14, -0.96, 1.9))]
            t.faces.new(tri)

    transformed(canopy_bm, canopy, m)

    def wheels(t):
        for dy in (-0.62, 0.62):
            transformed(t, lambda s: lathe(s, [(0.42, -0.03), (0.42, 0.03)], segments=24), Matrix.Translation((0.3, dy, 0.42)) @ Matrix.Rotation(math.pi / 2, 4, "X"))
            transformed(t, lambda s: lathe(s, [(0.37, -0.025), (0.37, 0.025)], segments=24), Matrix.Translation((0.3, dy, 0.42)) @ Matrix.Rotation(math.pi / 2, 4, "X"))
            for k in range(8):
                ang = k * math.pi / 4
                beam(t, (0.3, dy, 0.42), (0.3 + math.cos(ang) * 0.38, dy, 0.42 + math.sin(ang) * 0.38), 0.025)
        box(t, (-1.0, 0, 0.22), (0.06, 0.06, 0.44))

    transformed(iron_bm, wheels, m)
    mesh_object("CartBody", wood_bm, mats["cart_green"], "Props")
    mesh_object("CartCrates", crate_bm, mats["crate"], "Props")
    f = mesh_object("CartFruit", fruit_bm, mats["orange"], "Props")
    shade_smooth(f, 80)
    mesh_object("CartCanopy", canopy_bm, mats["canopy"], "Props")
    mesh_object("CartWheels", iron_bm, mats["iron"], "Props")
    sign = text_mesh("FRESH FRUIT", "Teko", 0.24, extrude=0.004)
    sign.matrix_world = m @ Matrix.Translation((0, -0.63, 2.18)) @ Matrix.Rotation(math.pi / 2, 4, "X")
    sign.data.materials.clear()
    sign.data.materials.append(mats["sign_paint"])
    sign["bake"] = "Props"


def truck(mats, at, turn):
    """An old flatbed truck, parked at an angle with its headlamps on."""
    m = Matrix.Translation(at) @ Matrix.Rotation(turn, 4, "Z")
    paint, dark, chrome, glow_bm, crate_bm = (bmesh.new() for _ in range(5))

    def body(t):
        # Cab: the truck faces -y in its own frame.
        box(t, (0, 0.2, 1.55), (1.9, 1.5, 1.3))
        box(t, (0, 0.2, 2.25), (1.95, 1.6, 0.1))
        # Hood, tapering toward the grille.
        box(t, (0, -1.25, 1.2), (1.1, 1.4, 0.7))
        # Fenders: long arcs over the front wheels, made of stepped boxes.
        for sx in (-1, 1):
            for k in range(6):
                a = math.pi * (k + 0.5) / 6
                box(t, (sx * 0.78, -1.3 + math.cos(a) * 0.55, 0.62 + math.sin(a) * 0.38), (0.4, 0.22, 0.08))
            box(t, (sx * 0.85, 0.1, 0.62), (0.3, 1.4, 0.06))
        # Flatbed and its rails.
        box(t, (0, 2.6, 0.95), (2.0, 3.2, 0.15))
        for sx in (-1, 1):
            box(t, (sx * 0.98, 2.6, 1.3), (0.06, 3.2, 0.06))
            for k in range(5):
                box(t, (sx * 0.98, 1.1 + k * 0.75, 1.15), (0.06, 0.06, 0.4))

    transformed(paint, body, m)

    def under(t):
        box(t, (0, 0.8, 0.55), (0.9, 5.4, 0.2))
        for wy in (-1.3, 2.9):
            for sx in (-1, 1):
                cylinder_x(t, (sx * 0.85, wy, 0.42), 0.42, 0.24, 20)
        # Windshield and side windows read as dark glass.
        box(t, (0, -0.56, 1.75), (1.6, 0.04, 0.6))
        for sx in (-1, 1):
            box(t, (sx * 0.96, 0.25, 1.75), (0.04, 0.9, 0.55))

    transformed(dark, under, m)

    def shine(t):
        box(t, (0, -1.97, 1.15), (0.8, 0.05, 0.7))
        box(t, (0, -2.05, 0.6), (1.9, 0.12, 0.12))
        for sx in (-1, 1):
            cylinder_x(t, (sx * 0.85, -1.3, 0.42), 0.2, 0.26, 16)
            cylinder_x(t, (sx * 0.85, 2.9, 0.42), 0.2, 0.26, 16)

    transformed(chrome, shine, m)

    def lamps_(t):
        for sx in (-1, 1):
            transformed(t, lambda s: lathe(s, [(0.0, 0.0), (0.13, 0.0), (0.15, 0.06), (0.0, 0.08)], segments=16), Matrix.Translation((sx * 0.62, -1.98, 1.25)) @ Matrix.Rotation(math.pi / 2, 4, "X"))

    transformed(glow_bm, lamps_, m)

    def cargo(t):
        box(t, (-0.3, 2.0, 1.33), (0.8, 0.8, 0.6))
        box(t, (0.45, 2.3, 1.28), (0.6, 0.6, 0.5))
        box(t, (0.0, 3.4, 1.4), (1.2, 0.9, 0.75))
        box(t, (-0.2, 2.1, 1.85), (0.55, 0.55, 0.42))

    transformed(crate_bm, cargo, m)
    mesh_object("TruckBody", paint, mats["truck_paint"], "Props")
    mesh_object("TruckDark", dark, mats["rubber"], "Props")
    mesh_object("TruckChrome", chrome, mats["chrome"], "Props")
    mesh_object("HeadlampGlass", glow_bm, mats["headlamp"], "Props")
    mesh_object("TruckCargo", crate_bm, mats["crate"], "Props")
    for sx in (-1, 1):
        light = bpy.data.lights.new(f"Headlamp{sx}", "SPOT")
        light.energy = 900
        light.spot_size = math.radians(55)
        light.spot_blend = 0.6
        light.color = rgba("#ffd9a0")[:3]
        light.shadow_soft_size = 0.08
        lo = link(bpy.data.objects.new(light.name, light))
        lo.matrix_world = m @ Matrix.Translation((sx * 0.62, -2.05, 1.25)) @ Matrix.Rotation(math.radians(-82), 4, "X")


def phone_booth(mats, at, turn):
    """A wooden telephone booth with glazed doors and a lit roof sign."""
    m = Matrix.Translation(at) @ Matrix.Rotation(turn, 4, "Z")
    frame, glass, sign = bmesh.new(), bmesh.new(), bmesh.new()

    def body(t):
        box(t, (0, 0, 0.06), (1.05, 1.05, 0.12))
        for dx in (-0.48, 0.48):
            for dy in (-0.48, 0.48):
                box(t, (dx, dy, 1.3), (0.1, 0.1, 2.4))
        box(t, (0, 0, 2.55), (1.1, 1.1, 0.15))
        box(t, (0, 0, 2.7), (0.9, 0.9, 0.15))
        for face in range(4):
            r = Matrix.Rotation(face * math.pi / 2, 4, "Z")
            transformed(t, lambda s: [box(s, (0, -0.49, z), (0.86, 0.05, 0.05)) for z in (0.35, 0.9, 1.45, 2.0)], r)
            transformed(t, lambda s: box(s, (0, -0.49, 0.2), (0.86, 0.06, 0.3)), r)

    transformed(frame, body, m)

    def panes(t):
        for face in range(4):
            r = Matrix.Rotation(face * math.pi / 2, 4, "Z")
            transformed(t, lambda s: box(s, (0, -0.48, 1.25), (0.84, 0.01, 1.8)), r)

    transformed(glass, panes, m)
    transformed(sign, lambda t: box(t, (0, -0.56, 2.42), (0.8, 0.02, 0.16)), m)
    mesh_object("BoothFrame", frame, mats["booth_red"], "Props")
    mesh_object("BoothGlass", glass, mats["booth_glass"], "Props")
    mesh_object("BoothSign", sign, mats["booth_sign"], "Props")
    light = bpy.data.lights.new("BoothLight", "POINT")
    light.energy = 60
    light.color = rgba("#ffd9a0")[:3]
    lo = link(bpy.data.objects.new("BoothLight", light))
    lo.location = m @ Vector((0, 0, 2.3))


def arch_gate(mats):
    """An iron arch over the left lane with a lettered name board."""
    x = LEFT_X + 0.1
    y0, y1 = LEFT_LANE
    bm = bmesh.new()
    for y in (y0 + 0.15, y1 - 0.15):
        box(bm, (x, y, 2.6), (0.18, 0.18, 5.2))
        lathe(bm, [(0.0, 0.0), (0.16, 0.0), (0.0, 0.3)], segments=8, center=(x, y, 5.2))
    pts = []
    for i in range(25):
        a = math.pi * i / 24
        pts.append((x, (y0 + y1) / 2 - math.cos(a) * (y1 - y0 - 0.3) / 2, 4.6 + math.sin(a) * 0.9))
    for k in range(len(pts) - 1):
        beam(bm, pts[k], pts[k + 1], 0.08)
    beam(bm, (x, y0 + 0.15, 4.6), (x, y1 - 0.15, 4.6), 0.07)
    for i in range(1, 12):
        yy = y0 + 0.15 + i * (y1 - y0 - 0.3) / 12
        top = 4.6 + math.sin(math.pi * i / 12) * 0.9
        beam(bm, (x, yy, 4.6), (x, yy, top), 0.03)
    box(bm, (x, (y0 + y1) / 2, 5.1), (0.05, 2.6, 0.42))
    mesh_object("ArchGate", bm, mats["iron"], "Left")
    word = text_mesh("THEATRE ROW", "Teko", 0.34, extrude=0.01)
    word.matrix_world = Matrix.Translation((x + 0.04, (y0 + y1) / 2, 5.1)) @ Matrix.Rotation(-math.pi / 2, 4, "Z") @ Matrix.Rotation(math.pi / 2, 4, "X")
    word.data.materials.clear()
    word.data.materials.append(mats["gilt"])
    word["bake"] = "Left"


def stall(mats):
    """Sacks, barrels, and crates under an awning by the left lane."""
    bm = bmesh.new()
    rnd = random.Random(3)
    for x, y in ((-9.6, 17.6), (-9.0, 18.4), (-9.7, 19.2)):
        lathe(bm, [(0.0, 0.0), (0.3, 0.0), (0.36, 0.45), (0.3, 0.9), (0.0, 0.9)], segments=16, center=(x, y, TOP))
    barrels = mesh_object("Barrels", bm, mats["barrel"], "Left")
    shade_smooth(barrels)
    bm = bmesh.new()
    for x, y in ((-9.3, 10.6), (-9.6, 11.3), (-9.4, 10.9)):
        box(bm, (x, y, TOP + 0.3 + rnd.choice((0, 0.6))), (0.6, 0.6, 0.6))
    mesh_object("StallCrates", bm, mats["crate"], "Left")
    bm = bmesh.new()
    for x, y in ((-9.9, 20.4), (-9.5, 20.9), (-9.9, 21.5)):
        transformed(bm, lambda t: lathe(t, [(0.0, 0.0), (0.26, 0.0), (0.3, 0.2), (0.22, 0.5), (0.0, 0.56)], segments=10), Matrix.Translation((x, y, TOP)) @ Matrix.Rotation(rnd.uniform(-0.3, 0.3), 4, "X"))
    sacks = mesh_object("Sacks", bm, mats["burlap"], "Left")
    shade_smooth(sacks, 70)


def debris(mats):
    """Planks, newspapers, and cans scattered on the cobbles."""
    rnd = random.Random(19)
    bm = bmesh.new()
    for _ in range(18):
        x, y = rnd.uniform(-8, 8), rnd.uniform(-2, 24)
        if abs(x - PILLAR[0]) < 1.4 and abs(y - PILLAR[1]) < 1.4 or (abs(x) < 2.2 and y < 3.0):
            continue
        transformed(bm, lambda t: box(t, (0, 0, 0.012), (rnd.uniform(0.6, 1.6), 0.12, 0.025)), Matrix.Translation((x, y, 0)) @ Matrix.Rotation(rnd.uniform(0, math.pi), 4, "Z"))
    mesh_object("Planks", bm, mats["wood_dark"], "GroundNear")
    bm = bmesh.new()
    for _ in range(26):
        x, y = rnd.uniform(-9, 9), rnd.uniform(-3, 26)
        if abs(x) < 2.2 and y < 3.0:
            continue
        transformed(bm, lambda t: box(t, (0, 0, 0.004), (rnd.uniform(0.25, 0.5), rnd.uniform(0.3, 0.45), 0.002)), Matrix.Translation((x, y, 0)) @ Matrix.Rotation(rnd.uniform(0, math.pi), 4, "Z"))
    mesh_object("Papers", bm, mats["paper"], "GroundNear")
    bm = bmesh.new()
    for x, y in ((9.7, 3.0), (9.6, 3.7), (-9.8, 5.0), (9.7, 12.8)):
        lathe(bm, [(0.0, 0.0), (0.27, 0.0), (0.29, 0.05), (0.28, 0.82), (0.31, 0.86), (0.31, 0.92), (0.0, 0.98)], segments=16, center=(x, y, TOP))
    cans = mesh_object("Cans", bm, mats["can"], "Props")
    shade_smooth(cans)
    bm = bmesh.new()
    lathe(bm, [(0.0, 0.004), (0.42, 0.004), (0.44, 0.0)], segments=24, center=(2.4, 6.0, 0.0), close_bottom=False)
    mesh_object("Manhole", bm, mats["iron"], "GroundNear")
    meta["manhole"] = [2.4, 6.0, 0.0]


def sandwich_board(mats, at, turn):
    bm = bmesh.new()

    def board(t):
        for s in (-1, 1):
            transformed(t, lambda u: box(u, (0, 0, 0.55), (0.62, 0.035, 1.05)), Matrix.Translation((0, s * 0.2, 0)) @ Matrix.Rotation(s * 0.2, 4, "X"))

    transformed(bm, board, Matrix.Translation(at) @ Matrix.Rotation(turn, 4, "Z"))
    mesh_object("SandwichBoard", bm, mats["chalkboard"], "Props")


def pennants(mats):
    """Strings of faded pennants across the plaza."""
    colors = [mats["pennant_a"], mats["pennant_b"], mats["pennant_c"]]
    for k, (a, b, sag) in enumerate((((LEFT_X, 6.0, 7.2), (RIGHT_X, 9.0, 7.6), 1.3), ((LEFT_X, 22.0, 8.6), (RIGHT_X, 16.0, 8.0), 1.1))):
        a, b = Vector(a), Vector(b)
        pts = []
        for i in range(31):
            t = i / 30
            p = a.lerp(b, t)
            p.z -= math.sin(t * math.pi) * sag
            pts.append(p)
        wire = curve_object(f"PennantWire{k}", [tuple(p) for p in pts], 0.012, mats["iron"])
        wire["bake"] = "Props"
        flags = [bmesh.new() for _ in colors]
        for i in range(1, 30):
            p, q = pts[i], pts[i + 1]
            mid = (p + q) / 2
            tri = flags[i % 3]
            v = [tri.verts.new(p), tri.verts.new(q), tri.verts.new((mid.x, mid.y, mid.z - 0.38))]
            tri.faces.new(v)
        for i, bm in enumerate(flags):
            mesh_object(f"Pennants{k}{i}", bm, colors[i], "Props")


def fire_escape(side, y0, x_face, floors, mats, bake):
    """Platforms, railings, and switchback stairs on a facade."""
    bm = bmesh.new()
    depth, length, out = 1.0, 3.4, -side
    xm = x_face + out * depth / 2
    for f in range(floors):
        z = TOP + M.GROUND_FLOOR + f * M.FLOOR - 0.05
        box(bm, (xm, y0 + length / 2, z), (depth, length, 0.05))
        rail_z = z + 0.95
        xo = x_face + out * depth
        beam(bm, (xo, y0, rail_z), (xo, y0 + length, rail_z), 0.035)
        beam(bm, (xo, y0, z + 0.45), (xo, y0 + length, z + 0.45), 0.02)
        for e in (0, length):
            beam(bm, (x_face, y0 + e, rail_z), (xo, y0 + e, rail_z), 0.035)
        steps = int(length / 0.22)
        for i in range(steps + 1):
            yy = y0 + i * length / steps
            beam(bm, (xo, yy, z), (xo, yy, rail_z), 0.018)
        if f < floors - 1:
            a = (xm, y0 + 0.4 if f % 2 else y0 + length - 0.4, z + M.FLOOR)
            b = (xm, y0 + length - 0.6 if f % 2 else y0 + 0.6, z)
            for dx in (-0.35, 0.35):
                beam(bm, (a[0] + dx, a[1], a[2]), (b[0] + dx, b[1], b[2]), 0.04)
            for i in range(1, 12):
                p = Vector(a).lerp(Vector(b), i / 12)
                box(bm, (p.x, p.y, p.z), (0.7, 0.08, 0.03))
    z0 = TOP + M.GROUND_FLOOR - 0.05
    for dy in (0.9, 1.4):
        beam(bm, (xm, y0 + dy, z0), (xm, y0 + dy, z0 - 1.8), 0.03)
    for i in range(1, 7):
        beam(bm, (xm, y0 + 0.9, z0 - i * 0.28), (xm, y0 + 1.4, z0 - i * 0.28), 0.02)
    mesh_object(f"FireEscape{side}{int(y0)}", bm, mats["iron"], bake)


def awning(side, y0, width, x_face, mat, bake):
    bm = bmesh.new()
    out = -side
    top = TOP + 3.3
    v = [
        bm.verts.new((x_face, y0, top)),
        bm.verts.new((x_face, y0 + width, top)),
        bm.verts.new((x_face + out * 1.4, y0 + width, top - 0.75)),
        bm.verts.new((x_face + out * 1.4, y0, top - 0.75)),
        bm.verts.new((x_face + out * 1.4, y0 + width, top - 1.0)),
        bm.verts.new((x_face + out * 1.4, y0, top - 1.0)),
    ]
    bm.faces.new([v[0], v[1], v[2], v[3]] if side > 0 else [v[3], v[2], v[1], v[0]])
    bm.faces.new([v[3], v[2], v[4], v[5]] if side > 0 else [v[5], v[4], v[2], v[3]])
    mesh_object(f"Awning{side}{int(y0)}", bm, mat, bake)


def face_at(side, y):
    for r in rows:
        if r[0] == side and r[1] <= y < r[1] + r[2]:
            return r[4]
    return LEFT_X if side < 0 else RIGHT_X


def neon_sign(spec, mats):
    """A page's sign: neon tube lettering on a dark board, hung out from a wall."""
    page, text, font, color, side, y, z, size, vertical = spec
    x_face = abs(face_at(side, y))
    letters = list(text) if vertical else [text]
    tubes = []
    max_w = 0.0
    step = size * 0.92
    for i, chunk in enumerate(letters):
        obj = text_mesh(chunk, font, size, bevel=0.014 if font == "Teko" else 0.012, fill=False)
        max_w = max(max_w, obj.dimensions.x)
        tubes.append(obj)
    height_text = (len(letters) - 1) * step + max(t.dimensions.y for t in tubes)
    width = max_w + 0.35
    height = (height_text if vertical else tubes[0].dimensions.y) + 0.3
    cx = side * (x_face - 0.25 - width / 2)
    stack_top = z + (height_text / 2 - size * 0.5 if vertical else 0)
    for i, obj in enumerate(tubes):
        obj.location = (cx, y - 0.09, stack_top - i * step)
    tube = join(tubes, f"Neon_{page}")
    tube.data.materials.clear()
    tube.data.materials.append(mats[f"neon_{page}"])
    tube["bake"] = "Emissive"
    tube["page"] = page
    bm = bmesh.new()
    box(bm, (cx, y + 0.03, z), (width, 0.08, height))
    for dz in (height / 2 - 0.15, -height / 2 + 0.15):
        beam(bm, (cx + side * width / 2, y + 0.03, z + dz), (side * x_face, y + 0.03, z + dz), 0.05)
    mesh_object(f"SignBoard_{page}", bm, mats["signboard"], "Left" if side < 0 else "Right")
    light = bpy.data.lights.new(f"NeonLight_{page}", "AREA")
    light.shape = "RECTANGLE"
    light.size = width * 0.9
    light.size_y = height * 0.8
    light.energy = 160 * width * height
    light.color = rgba(color)[:3]
    lo = link(bpy.data.objects.new(light.name, light))
    lo.location = (cx, y - 0.2, z)
    lo.rotation_euler = (-math.pi / 2, 0, 0)
    signs.append((page, cx, y, z, width, height, color))


def wires(mats):
    for y0, y1, z0, z1 in ((4.0, 5.5, 9.0, 8.4), (13.0, 11.5, 10.5, 9.4), (26.0, 25.0, 11.0, 10.2)):
        pts = []
        for i in range(17):
            t = i / 16
            pts.append((LEFT_X + t * (RIGHT_X - LEFT_X), y0 + (y1 - y0) * t, z0 + (z1 - z0) * t - math.sin(t * math.pi) * 0.9))
        wire = curve_object(f"Wire{int(y0)}", pts, 0.014, mats["iron"])
        wire["bake"] = "Props"


# ------------------------------------------------------------ gumball machine
def machine(mats):
    """An original art-deco gumball machine, sized for gumball-scene.ts: a stepped
    dark base, a coin box with the crank and chute, a glass globe, and a crest with
    a horned beast's face whose eyes glow. Three.js coordinates in comments are
    (x, y, z) with z toward the camera; here that is (x, -z, y)."""
    parts = {}
    # The base: stepped square tiers narrowing up to the coin box.
    bm = bmesh.new()
    box(bm, (0, 0, 0.04), (1.0, 1.0, 0.08))
    box(bm, (0, 0, 0.13), (0.86, 0.86, 0.1))
    box(bm, (0, 0, 0.26), (0.7, 0.7, 0.16))
    # The column: chamfered, with fluting reliefs on its faces.
    transformed(bm, lambda t: lathe(t, [(0.3, 0.34), (0.27, 0.42), (0.25, 0.78), (0.3, 0.84)], segments=8, close_top=False, close_bottom=False), Matrix.Rotation(math.pi / 8, 4, "Z"))
    for k in range(4):
        r = Matrix.Rotation(k * math.pi / 2, 4, "Z")
        for dx in (-0.08, 0.0, 0.08):
            transformed(bm, lambda t: box(t, (dx, -0.245, 0.6), (0.035, 0.03, 0.32)), r)
    # The coin box: 0.8 wide, its front face at y = -0.4 (three z 0.4), with
    # stepped fins on the sides and a band at the top.
    box(bm, (0, 0, 0.9), (0.8, 0.8, 0.12))
    box(bm, (0, 0, 1.26), (0.76, 0.78, 0.62))
    box(bm, (0, 0, 1.6), (0.82, 0.82, 0.08))
    for sx in (-1, 1):
        for k, (w, h) in enumerate(((0.08, 0.5), (0.06, 0.38), (0.04, 0.26))):
            box(bm, (sx * (0.39 + 0.04 + k * 0.05), 0, 1.24), (w, 0.5 - k * 0.1, h))
    parts["Machine_Body"] = (bm, mats["machine_body"])

    bm = bmesh.new()
    # Brass trim: the foot's lip, rings at each step, the globe collar and cap.
    box(bm, (0, 0, 0.09), (0.9, 0.9, 0.02))
    box(bm, (0, 0, 0.35), (0.62, 0.62, 0.03))
    box(bm, (0, 0, 0.97), (0.81, 0.81, 0.02))
    box(bm, (0, 0, 1.55), (0.79, 0.81, 0.02))
    lathe(bm, [(0.34, 1.64), (0.4, 1.66), (0.41, 1.69), (0.37, 1.72), (0.28, 1.73), (0.0, 1.73)], segments=64, close_bottom=False)
    lathe(bm, [(0.26, 2.6), (0.29, 2.63), (0.26, 2.66)], segments=64, close_top=False, close_bottom=False)
    # The crank's dial plate on the coin box front.
    transformed(bm, lambda t: lathe(t, [(0.0, 0.0), (0.155, 0.0), (0.16, 0.012), (0.15, 0.03), (0.0, 0.035)], segments=40), Matrix.Translation((0, -0.39, 1.24)) @ Matrix.Rotation(math.pi / 2, 4, "X"))
    # The chute's lip and tray.
    box(bm, (0, -0.56, 0.935), (0.34, 0.24, 0.025))
    box(bm, (0, -0.675, 0.965), (0.34, 0.025, 0.06))
    for sx in (-1, 1):
        box(bm, (sx * 0.1575, -0.56, 0.965), (0.025, 0.24, 0.06))
    # Corner beads on the coin box.
    for sx in (-1, 1):
        for sy in (-1, 1):
            box(bm, (sx * 0.385, sy * 0.395, 1.26), (0.03, 0.03, 0.62))
    parts["Machine_Brass"] = (bm, mats["brass"])

    bm = bmesh.new()
    box(bm, (0, -0.43, 1.0), (0.2, 0.12, 0.13))
    parts["Machine_Chute"] = (bm, mats["machine_dark"])

    # The cap over the globe, and the crest standing on it.
    bm = bmesh.new()
    lathe(bm, [(0.0, 2.6), (0.25, 2.6), (0.26, 2.63), (0.24, 2.68), (0.18, 2.72), (0.0, 2.73)], segments=48, close_bottom=False)
    # A fan of stepped rays behind the face.
    for k in range(9):
        a = math.radians(-64 + k * 16)
        length = 0.42 if k % 2 == 0 else 0.34
        transformed(bm, lambda t: box(t, (0, 0, length / 2), (0.07, 0.03, length)), Matrix.Translation((0, 0.02, 2.74)) @ Matrix.Rotation(a, 4, "Y"))
    # The face: a rounded skull plate with a brow, a snout, and two curled horns.
    transformed(bm, lambda t: sphere(t, (0, 0, 0), 1.0, 20, 12), Matrix.Translation((0, -0.02, 2.95)) @ Matrix.Diagonal((0.16, 0.08, 0.15, 1)))
    transformed(bm, lambda t: box(t, (0, 0, 0), (0.28, 0.06, 0.05)), Matrix.Translation((0, -0.085, 3.0)))
    transformed(bm, lambda t: sphere(t, (0, 0, 0), 1.0, 12, 8), Matrix.Translation((0, -0.09, 2.88)) @ Matrix.Diagonal((0.07, 0.06, 0.06, 1)))
    for sx in (-1, 1):
        horn = []
        for i in range(10):
            t = i / 9
            a = t * math.pi * 1.1
            horn.append(Vector((sx * (0.13 + math.sin(a) * 0.12), -0.02, 3.02 + (1 - math.cos(a)) * 0.08 - t * 0.04)))
        for i in range(len(horn) - 1):
            beam(bm, horn[i], horn[i + 1], 0.045 * (1 - i / 12))
    parts["Machine_Crest"] = (bm, mats["brass_dark"])

    bm = bmesh.new()
    for sx in (-1, 1):
        sphere(bm, (sx * 0.06, -0.1, 2.97), 0.022, 10, 6)
    parts["Machine_Eyes"] = (bm, mats["machine_eyes"])

    bm = bmesh.new()
    # A ribbon under the face, for the lettering.
    for k in range(12):
        a0 = math.radians(-50 + k * 100 / 12)
        a1 = math.radians(-50 + (k + 1) * 100 / 12)
        r = 0.38
        p0 = (math.sin(a0) * r, -0.06 - (1 - math.cos(a0)) * 0.1, 2.74 + (1 - math.cos(a0)) * 0.22)
        p1 = (math.sin(a1) * r, -0.06 - (1 - math.cos(a1)) * 0.1, 2.74 + (1 - math.cos(a1)) * 0.22)
        v = [bm.verts.new((p0[0], p0[1], p0[2] - 0.05)), bm.verts.new((p1[0], p1[1], p1[2] - 0.05)), bm.verts.new((p1[0], p1[1], p1[2] + 0.05)), bm.verts.new((p0[0], p0[1], p0[2] + 0.05))]
        bm.faces.new(v)
    parts["Machine_Ribbon"] = (bm, mats["machine_body"])

    objs = {}
    for name, (bm, mat) in parts.items():
        obj = mesh_object(name, bm, mat, "Machine")
        shade_smooth(obj, 40)
        objs[name] = obj
    # Lettering: the price on the base, the word on the ribbon.
    price = text_mesh("5¢", "Teko", 0.2, extrude=0.008)
    price.location = (0, -0.36, 0.56)
    words = text_mesh("GUM", "Teko", 0.1, extrude=0.004)
    words.location = (0, -0.115, 2.74)
    letters = join([price, words], "Machine_Letters")
    letters.data.materials.clear()
    letters.data.materials.append(mats["brass"])
    letters["bake"] = "Machine"
    # The glass globe.
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=0.55, location=(0, 0, 2.15))
    globe = bpy.context.active_object
    globe.name = "Machine_Globe"
    globe.data.materials.append(mats["glass"])
    shade_smooth(globe, 80)
    globe["bake"] = "Machine"
    # The crank turns about its own origin, the dial's center.
    bm = bmesh.new()
    box(bm, (0.11, 0, 0), (0.26, 0.03, 0.05))
    transformed(bm, lambda t: lathe(t, [(0.0, 0.0), (0.032, 0.0), (0.038, 0.03), (0.035, 0.09), (0.04, 0.1), (0.0, 0.105)], segments=16), Matrix.Translation((0.22, -0.01, 0)) @ Matrix.Rotation(math.pi / 2, 4, "X"))
    transformed(bm, lambda t: lathe(t, [(0.0, 0.0), (0.045, 0.0), (0.045, 0.03), (0.0, 0.04)], segments=20), Matrix.Rotation(math.pi / 2, 4, "X"))
    crank = mesh_object("Machine_Crank", bm, mats["brass"], "Machine")
    crank.data.materials.append(mats["machine_dark"])
    for poly in crank.data.polygons:
        if poly.center.x > 0.18:
            poly.material_index = 1
    crank.location = (0, -0.44, 1.24)
    shade_smooth(crank, 40)
    return objs


def gumballs_for_render(mats):
    """Gumballs for the poster and bake only; the web scene makes its own."""
    rnd = random.Random(7)
    placed = []
    radius = 0.075
    tries = 0
    while len(placed) < 46 and tries < 5000:
        tries += 1
        p = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))) * (0.55 - radius * 1.1)
        if p.length > 0.55 - radius * 1.1 or p.z > 0.12:
            continue
        placed.append(p)
    for i, p in enumerate(placed):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=radius, location=(p.x, -p.y, 2.15 + p.z))
        ball = bpy.context.active_object
        ball.name = f"RenderGum{i}"
        ball.data.materials.append(mats[f"gum{i % 5}"])
        shade_smooth(ball, 80)
        ball["bake"] = "RenderOnly"


def make_materials():
    mats = {
        "plaza": M.plaza(),
        "sidewalk": M.sidewalk(),
        "curb": M.simple("Curb", "#3a3634", 0.45),
        "facade": M.facade(),
        "tower": M.tower(),
        "concrete": M.concrete(),
        "stone": M.grimy("Stone", "#5a524a", 0.7, scale=2.0),
        "iron": M.simple("Iron", "#0e0d0f", 0.45, 0.6),
        "iron_rust": M.grimy("IronRust", "#2a1c16", 0.6, 0.5, scale=1.2, dirt="#4a2412"),
        "signboard": M.simple("SignBoard", "#0c0b0e", 0.5, 0.3),
        "lampglass": M.simple("LampGlass", "#ffe6b8", 0.2, 0.0, "#ffd49a", 18.0),
        "can": M.grimy("Can", "#2a2c2e", 0.4, 0.8),
        "crate": M.wood("Crate", "#4a3220", 0.12),
        "wood_dark": M.wood("WoodDark", "#2a1d14", 0.25),
        "barrel": M.wood("Barrel", "#3d2616", 0.1),
        "burlap": M.grimy("Burlap", "#6a5236", 0.9, scale=12.0),
        "paper": M.grimy("Paper", "#7a7262", 0.8, scale=8.0, dirt="#2a241c"),
        "cart_green": M.grimy("CartGreen", "#1f3a24", 0.55, scale=2.5),
        "orange": M.simple("Orange", "#e06a14", 0.45),
        "canopy": M.awning("Canopy", "#6a1a14", "#c9b48e", along_x=True),
        "sign_paint": M.simple("SignPaint", "#e8dcc0", 0.6),
        "truck_paint": M.grimy("TruckPaint", "#1c2a24", 0.35, 0.3, scale=1.5),
        "rubber": M.simple("Rubber", "#0b0b0c", 0.6),
        "chrome": M.simple("Chrome", "#c8c4bc", 0.18, 1.0),
        "headlamp": M.neon("Headlamp", "#ffe2b0", 20.0),
        "booth_red": M.grimy("BoothRed", "#5a1a12", 0.45, scale=2.5),
        "booth_glass": M.simple("BoothGlass", "#2a2620", 0.05, 0.0, "#ffcf8a", 0.6),
        "booth_sign": M.neon("BoothSign", "#ffe6b8", 6.0),
        "gilt": M.simple("Gilt", "#c89a4a", 0.35, 1.0),
        "chalkboard": M.wood("Chalkboard", "#1a1612", 0.4),
        "pennant_a": M.simple("PennantA", "#8a2a1c", 0.7),
        "pennant_b": M.simple("PennantB", "#b88a3a", 0.7),
        "pennant_c": M.simple("PennantC", "#3a4a3a", 0.7),
        "train": M.grimy("Train", "#3a2a1e", 0.5, 0.4, scale=1.0),
        "train_glass": M.neon("TrainGlass", "#ffbf72", 4.0),
        "worm": M.worm(),
        "water": M.simple("Water", "#05070a", 0.04),
        "worm_glow": M.neon("WormGlow", "#ffe070", 60.0),
        "machine_body": M.grimy("MachineBody", "#2a1212", 0.3, 0.2, scale=4.0, dirt="#120808"),
        "brass": M.simple("Brass", "#d9a35a", 0.28, 1.0),
        "brass_dark": M.grimy("BrassDark", "#a8783a", 0.35, 1.0, scale=6.0, dirt="#3a2a14"),
        "machine_dark": M.simple("MachineDark", "#141015", 0.55),
        "machine_eyes": M.neon("MachineEyes", "#c46aff", 30.0),
    }
    mat = mats["glass"] = M.simple("Glass", "#e6f2ff", 0.02)
    mat.node_tree.nodes["Principled BSDF"].inputs["Transmission Weight"].default_value = 1.0
    for i, c in enumerate(["#efe2c8", "#3fd8c8", "#f0a35c", "#ff4f9a", "#e04a3f"]):
        mats[f"gum{i}"] = M.simple(f"Gum{i}", c, 0.3)
    for page, _, _, color, *_ in SIGNS:
        mats[f"neon_{page}"] = M.neon(f"Neon_{page}", color, 14.0)
    mats["awnings"] = [
        M.awning("AwningRed", "#5a1210", "#c9b79a"),
        M.awning("AwningGreen", "#163018", "#b8a888"),
        M.awning("AwningBlue", "#14243a", "#b8a888"),
    ]
    return mats


# ----------------------------------------------------------------- assemble
rows = []
lamps = []
signs = []
meta = {}


def build(out_path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    M.world(0.85)
    mats = make_materials()

    ground(mats)
    quay(mats)
    walls(mats)
    backdrop(mats)
    gateworm(mats)
    viaduct(mats)
    pillar(mats)
    for side, y0, floors in ((-1, 6.0, 3), (1, 12.0, 3), (-1, 25.0, 4), (1, 27.0, 3)):
        x_face = face_at(side, y0 + 1)
        fire_escape(side, y0, x_face, floors, mats, "Left" if side < 0 else "Right")
    for i, (side, y0, width) in enumerate(((1, 3.5, 3.4), (-1, 8.6, 3.2), (1, 9.4, 3.0), (-1, 22.0, 3.4), (1, 24.0, 3.2), (-1, 30.5, 3.0))):
        x_face = face_at(side, y0 + 1)
        awning(side, y0, width, x_face, mats["awnings"][i % 3], "Left" if side < 0 else "Right")
    for x, y in ((-6.2, 4.2), (6.6, 8.6), (-7.0, 18.5), (7.2, 24.0), (-2.6, 35.5)):
        street_lamp(x, y, mats)
    for spec in SIGNS:
        neon_sign(spec, mats)
    fruit_cart(mats, (-4.4, 3.4, 0.0), math.radians(18))
    truck(mats, (4.7, 4.6, 0.0), math.radians(-28))
    phone_booth(mats, (-9.0, 9.4, TOP), math.radians(90))
    sandwich_board(mats, (8.6, 6.6, TOP), math.radians(20))
    arch_gate(mats)
    stall(mats)
    debris(mats)
    pennants(mats)
    wires(mats)
    machine(mats)
    gumballs_for_render(mats)

    # A warm key on the machine and the pillar's face, like a shop window behind the camera.
    key = bpy.data.lights.new("MachineKey", "AREA")
    key.size = 1.6
    key.energy = 140
    key.color = rgba("#ffcf96")[:3]
    ko = link(bpy.data.objects.new("MachineKey", key))
    ko.location = (1.8, -3.0, 3.2)
    ko.rotation_euler = (math.radians(58), 0, math.radians(32))
    # Fill: a dim warm wash from the sky's glow, so the dark sides of things read.
    fill = bpy.data.lights.new("SkyFill", "SUN")
    fill.energy = 0.12
    fill.color = rgba("#ff9a60")[:3]
    fo = link(bpy.data.objects.new("SkyFill", fill))
    fo.rotation_euler = (math.radians(72), 0, math.radians(200))

    cam = bpy.data.cameras.new("Hero")
    cam.lens_unit = "FOV"
    cam.sensor_fit = "VERTICAL"
    cam.angle = math.radians(WIDE["fov"])
    cam.clip_end = 600
    co = link(bpy.data.objects.new("Hero", cam))
    co.location = home_camera(WIDE)
    co.rotation_euler = (math.radians(90 + WIDE["pitch"]), 0, 0)
    scene.camera = co
    scene.render.resolution_x = 1440
    scene.render.resolution_y = 576

    for obj in bpy.data.objects:
        if obj.type == "MESH":
            bm = bmesh.new()
            bm.from_mesh(obj.data)
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            bm.to_mesh(obj.data)
            bm.free()
    meta["lamps"] = [list(p) for p in lamps]
    meta["signs"] = signs
    meta["cameras"] = {name: {"at": list(home_camera(v)), "fov": v["fov"], "pitch": v["pitch"]} for name, v in (("wide", WIDE), ("tall", TALL))}
    scene["meta"] = json.dumps(meta)
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(out_path))
    print("saved", out_path, len(bpy.data.objects), "objects")
    print("META", json.dumps(meta))


if __name__ == "__main__":
    build(sys.argv[-1] if sys.argv[-1].endswith(".blend") else "junction.blend")
