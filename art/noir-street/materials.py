"""Procedural Cycles materials for the Junction scene. Everything is generated
here; no image textures are used, so every pixel of the baked maps is original."""

import bpy

from nodes import Tree, rgba

GROUND_FLOOR = 4.0
FLOOR = 3.2
BAY = 2.2
WALK_TOP = 0.15
# The painted ring on the plaza: center (x, y) and outer radius, in meters.
RING = (3.2, 13.5, 3.4)
# The direction of the glow behind the skyline.
SKY_GLOW = (0.02, 0.95, 0.31)


def _new(name):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    return mat, Tree(mat)


def _puddles(t, pos, scale=0.22, level=0.5):
    """A 0..1 puddle mask from low-frequency noise; 1 means standing water."""
    n = t.noise(pos, scale, detail=3.0, roughness=0.55)
    return t.ramp(n.outputs["Fac"], [(level, (0, 0, 0, 1)), (level + 0.06, (1, 1, 1, 1))])


def plaza():
    """Wet cobblestones with puddles, grime, and a faded painted ring."""
    mat, t = _new("Plaza")
    geo = t.node("ShaderNodeNewGeometry")
    pos = geo.outputs["Position"]
    p = t.separate(pos)
    # Cobbles laid in rows: stretch the cells along x so they read as setts.
    sett = t.combine(t.mul(p[0], 0.75), p[1], 0.0)
    vor = t.node("ShaderNodeTexVoronoi", feature="DISTANCE_TO_EDGE", inputs={"Scale": 7.5, "Randomness": 0.7})
    t.set(vor, "Vector", sett)
    vcol = t.node("ShaderNodeTexVoronoi", feature="F1", inputs={"Scale": 7.5, "Randomness": 0.7})
    t.set(vcol, "Vector", sett)
    gap = t.ramp(vor.outputs["Distance"], [(0.03, (0, 0, 0, 1)), (0.12, (1, 1, 1, 1))])
    stone_var = t.ramp(
        vcol.outputs["Color"],
        [(0.0, rgba("#211d1c")), (0.45, rgba("#2c2724")), (0.8, rgba("#3a322c")), (1.0, rgba("#26211f"))],
    )
    grime = t.noise(pos, 1.3, detail=7.0)
    stone = t.mix_color(t.mul(grime.outputs["Fac"], 0.45), stone_var, rgba("#120f0e"))
    base = t.mix_color(gap, rgba("#0a0807"), stone)

    # The painted ring: two circles and short ticks, worn by traffic.
    dx = t.sub(p[0], RING[0])
    dy = t.sub(p[1], RING[1])
    dist = t.math("SQRT", t.add(t.mul(dx, dx), t.mul(dy, dy)))
    angle = t.math("ARCTAN2", dy, dx)
    outer = t.band(dist, RING[2] - 0.22, RING[2])
    inner = t.band(dist, RING[2] - 0.95, RING[2] - 0.85)
    ticks = t.mul(t.band(dist, RING[2] - 0.8, RING[2] - 0.3), t.lt(t.fract(t.mul(angle, 12 / 6.28318)), 0.06))
    wear = t.noise(pos, 3.5, detail=5.0)
    paint = t.mul(t.math("MINIMUM", t.add(t.add(outer, inner), ticks), 1.0), t.gt(wear.outputs["Fac"], 0.42))
    paint = t.mul(paint, t.math("POWER", gap, 2.0))
    base = t.mix_color(t.mul(paint, 0.85), base, rgba("#4a0f0b"))

    puddle = _puddles(t, pos, 0.2, 0.52)
    color = t.mix_color(t.mul(puddle, 0.85), base, rgba("#060505"))
    rough = t.mix_float(puddle, t.mix_float(gap, 0.6, 0.24), 0.012)
    bump = t.node("ShaderNodeBump", inputs={"Strength": 0.3, "Distance": 0.02})
    t.set(bump, "Height", gap)
    flat = t.node("ShaderNodeNewGeometry")
    normal = t.node("ShaderNodeMix", data_type="VECTOR")
    t.set(normal, 0, puddle)
    t.set(normal, 4, bump.outputs["Normal"])
    t.set(normal, 5, flat.outputs["Normal"])
    bsdf = t.principled(**{"Base Color": color, "Roughness": rough, "Specular IOR Level": 0.65})
    t.set(bsdf, "Normal", normal.outputs[1])
    t.output(bsdf.outputs[0])
    return mat


def sidewalk():
    """Square concrete slabs, wet, with a few puddles."""
    mat, t = _new("Sidewalk")
    geo = t.node("ShaderNodeNewGeometry")
    pos = geo.outputs["Position"]
    brick = t.node(
        "ShaderNodeTexBrick",
        offset=0.0,
        inputs={
            "Scale": 1.0,
            "Mortar Size": 0.012,
            "Brick Width": 1.1,
            "Row Height": 1.1,
            "Color1": rgba("#2e2b2a"),
            "Color2": rgba("#3a3634"),
            "Mortar": rgba("#0d0c0c"),
        },
    )
    t.set(brick, "Vector", pos)
    stain = t.noise(pos, 2.4, detail=6.0)
    color = t.mix_color(t.mul(stain.outputs["Fac"], 0.5), brick.outputs["Color"], rgba("#161413"))
    puddle = _puddles(t, pos, 0.4)
    color = t.mix_color(t.mul(puddle, 0.8), color, rgba("#0a0909"))
    rough = t.mix_float(puddle, 0.34, 0.02)
    bump = t.node("ShaderNodeBump", inputs={"Strength": 0.3, "Distance": 0.01})
    t.set(bump, "Height", brick.outputs["Fac"])
    bsdf = t.principled(**{"Base Color": color, "Roughness": rough, "Specular IOR Level": 0.6})
    t.set(bsdf, "Normal", bump.outputs["Normal"])
    t.output(bsdf.outputs[0])
    return mat


def concrete(name="Concrete"):
    """Weathered cast concrete: pour lines, rain streaks, chips, and grime near the ground."""
    mat, t = _new(name)
    geo = t.node("ShaderNodeNewGeometry")
    pos = geo.outputs["Position"]
    p = t.separate(pos)
    big = t.noise(pos, 0.9, detail=6.0, roughness=0.6)
    fine = t.noise(pos, 14.0, detail=8.0, roughness=0.7)
    tone = t.ramp(big.outputs["Fac"], [(0.3, rgba("#3c3833")), (0.55, rgba("#55504a")), (0.75, rgba("#625b52"))])
    lines = t.band(t.fract(t.math("DIVIDE", p[2], 0.6)), 0.0, 0.02)
    tone = t.mix_color(t.mul(lines, 0.6), tone, rgba("#24211e"))
    streak = t.noise(t.combine(t.mul(p[0], 5.0), t.mul(p[1], 5.0), t.mul(p[2], 0.15)), 2.5, detail=4.0)
    wet = t.ramp(streak.outputs["Fac"], [(0.45, (0, 0, 0, 1)), (0.72, (1, 1, 1, 1))])
    tone = t.mix_color(t.mul(wet, 0.55), tone, rgba("#16130f"))
    splash = t.mul(t.math("POWER", t.math("DIVIDE", t.sub(1.4, p[2]), 1.4, clamp=True), 1.5), 0.8)
    tone = t.mix_color(t.mul(splash, fine.outputs["Fac"]), tone, rgba("#0f0c0a"))
    chips = t.ramp(fine.outputs["Fac"], [(0.68, (0, 0, 0, 1)), (0.72, (1, 1, 1, 1))])
    tone = t.mix_color(t.mul(chips, 0.5), tone, rgba("#7a7166"))
    rough = t.mix_float(wet, 0.82, 0.38)
    bump = t.node("ShaderNodeBump", inputs={"Strength": 0.25, "Distance": 0.01})
    t.set(bump, "Height", t.add(fine.outputs["Fac"], t.mul(lines, -0.5)))
    bsdf = t.principled(**{"Base Color": tone, "Roughness": rough})
    t.set(bsdf, "Normal", bump.outputs["Normal"])
    t.output(bsdf.outputs[0])
    return mat


def simple(name, color, roughness=0.5, metallic=0.0, emission=None, strength=0.0):
    mat, t = _new(name)
    inputs = {"Base Color": rgba(color), "Roughness": roughness, "Metallic": metallic}
    if emission is not None:
        inputs["Emission Color"] = rgba(emission)
        inputs["Emission Strength"] = strength
    bsdf = t.principled(**inputs)
    t.output(bsdf.outputs[0])
    return mat


def grimy(name, color, roughness=0.6, metallic=0.0, scale=3.0, dirt="#0c0a09"):
    """A flat color broken up by grime, for painted wood, metal, and canvas."""
    mat, t = _new(name)
    geo = t.node("ShaderNodeNewGeometry")
    pos = geo.outputs["Position"]
    n = t.noise(pos, scale, detail=6.0, roughness=0.6)
    worn = t.ramp(n.outputs["Fac"], [(0.35, (0, 0, 0, 1)), (0.75, (1, 1, 1, 1))])
    color_out = t.mix_color(t.mul(worn, 0.65), rgba(color), rgba(dirt))
    rough = t.mix_float(worn, roughness, min(1.0, roughness + 0.25))
    bump = t.node("ShaderNodeBump", inputs={"Strength": 0.12, "Distance": 0.01})
    t.set(bump, "Height", n.outputs["Fac"])
    bsdf = t.principled(**{"Base Color": color_out, "Roughness": rough, "Metallic": metallic})
    t.set(bsdf, "Normal", bump.outputs["Normal"])
    t.output(bsdf.outputs[0])
    # glTF can't carry the grime's node tree, so export.py uses this color instead.
    mat["flat_color"] = rgba(color)
    return mat


def wood(name, color, plank=0.18):
    """Weathered planks with dark gaps."""
    mat, t = _new(name)
    geo = t.node("ShaderNodeNewGeometry")
    pos = geo.outputs["Position"]
    p = t.separate(pos)
    across = t.add(t.add(p[0], p[1]), p[2])
    gaps = t.band(t.fract(t.math("DIVIDE", across, plank)), 0.0, 0.06)
    grain = t.noise(t.combine(t.mul(p[0], 0.3), t.mul(p[1], 0.3), t.mul(p[2], 8.0)), 6.0, detail=5.0)
    tone = t.mix_color(t.mul(grain.outputs["Fac"], 0.5), rgba(color), rgba("#140d08"))
    tone = t.mix_color(gaps, tone, rgba("#070504"))
    bsdf = t.principled(**{"Base Color": tone, "Roughness": 0.75})
    t.output(bsdf.outputs[0])
    return mat


def neon(name, color, strength):
    """A glowing glass tube. In the export it becomes an unlit, brightness-driven material."""
    mat, t = _new(name)
    emit = t.node("ShaderNodeEmission", inputs={"Color": rgba(color), "Strength": strength})
    t.output(emit.outputs[0])
    mat.diffuse_color = rgba(color)
    return mat


def awning(name, a, b, along_x=False):
    mat, t = _new(name)
    geo = t.node("ShaderNodeNewGeometry")
    sep = t.separate(geo.outputs["Position"])
    stripes = t.gt(t.fract(t.mul(sep[0] if along_x else sep[1], 2.4)), 0.5)
    color = t.mix_color(stripes, rgba(a), rgba(b))
    sheen = t.noise(geo.outputs["Position"], 9.0, detail=4.0)
    color = t.mix_color(t.mul(sheen.outputs["Fac"], 0.35), color, rgba("#050505"))
    bsdf = t.principled(**{"Base Color": color, "Roughness": 0.6, "Sheen Weight": 0.3})
    t.output(bsdf.outputs[0])
    return mat


def facade(name="Facade", window_rate=(0.1, 0.28), stucco_from=0.78):
    """Brick or stucco facades with shopfronts and a grid of upper windows, some lit.
    Windows go on every vertical face; per-building variety comes from the `bseed`
    face attribute."""
    mat, t = _new(name)
    geo = t.node("ShaderNodeNewGeometry")
    pos = geo.outputs["Position"]
    nrm = t.separate(geo.outputs["Normal"])
    p = t.separate(pos)
    seed = t.node("ShaderNodeAttribute", attribute_name="bseed", attribute_type="GEOMETRY").outputs["Fac"]
    wall = t.lt(t.abs(nrm[2]), 0.5)
    roof = t.gt(nrm[2], 0.5)
    faces_x = t.gt(t.abs(nrm[0]), t.abs(nrm[1]))
    u = t.mix_float(faces_x, p[0], p[1])
    v = t.sub(p[2], WALK_TOP)

    tint = t.ramp(
        seed,
        [
            (0.0, rgba("#4a2318")),
            (0.2, rgba("#5a3021")),
            (0.4, rgba("#3a2a26")),
            (0.6, rgba("#4d2a1f")),
            (stucco_from - 0.01, rgba("#3b2e28")),
            (stucco_from, rgba("#5f564c")),
            (1.0, rgba("#4a4640")),
        ],
    )
    stucco = t.gt(seed, stucco_from)
    brick = t.node(
        "ShaderNodeTexBrick",
        offset=0.5,
        inputs={
            "Scale": 1.0,
            "Mortar Size": 0.008,
            "Mortar Smooth": 0.2,
            "Brick Width": 0.24,
            "Row Height": 0.075,
            "Bias": 0.1,
            "Color1": (0.9, 0.9, 0.9, 1),
            "Color2": (0.62, 0.6, 0.58, 1),
            "Mortar": (0.35, 0.34, 0.33, 1),
        },
    )
    t.set(brick, "Vector", t.combine(u, v, 0.0))
    pattern = t.mix_color(stucco, brick.outputs["Color"], (0.85, 0.85, 0.85, 1))
    mul = t.node("ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY", inputs={0: 1.0})
    t.set(mul, 6, tint)
    t.set(mul, 7, pattern)
    wall_col = mul.outputs[2]
    streaks = t.noise(t.combine(t.mul(u, 6.0), t.mul(v, 0.25), seed), 3.0, detail=4.0)
    wet = t.ramp(streaks.outputs["Fac"], [(0.4, (0, 0, 0, 1)), (0.7, (1, 1, 1, 1))])
    wall_col = t.mix_color(t.mul(wet, 0.5), wall_col, rgba("#0b0809"))
    grime = t.noise(pos, 1.1, detail=5.0)
    wall_col = t.mix_color(t.mul(grime.outputs["Fac"], 0.35), wall_col, rgba("#120c0a"))

    upper = t.mul(t.gt(v, GROUND_FLOOR), wall)
    fv = t.math("DIVIDE", t.sub(v, GROUND_FLOOR), FLOOR)
    lv = t.mul(t.fract(fv), FLOOR)
    fu = t.math("DIVIDE", u, BAY)
    lu = t.mul(t.fract(fu), BAY)
    window = t.mul(t.mul(t.band(lv, 0.75, 2.45), t.band(lu, 0.55, 1.65)), upper)
    frame = t.sub(t.mul(t.mul(t.band(lv, 0.66, 2.54), t.band(lu, 0.46, 1.74)), upper), window)
    sill = t.mul(t.mul(t.band(lv, 0.56, 0.66), t.band(lu, 0.38, 1.82)), upper)
    lintel = t.mul(t.mul(t.band(lv, 2.54, 2.7), t.band(lu, 0.4, 1.8)), upper)
    course = t.mul(t.band(lv, 0.0, 0.12), upper)

    cell = t.combine(t.floor(fu), t.floor(fv), t.add(t.mul(t.add(p[0], p[1]), 0.1), t.mul(seed, 17.0)))
    rnd = t.white(cell).outputs["Value"]
    rnd2 = t.white(t.combine(t.floor(fu), t.floor(fv), t.add(seed, 3.3))).outputs["Value"]
    lit = t.lt(rnd, t.mix_float(seed, window_rate[0], window_rate[1]))
    room = t.ramp(
        rnd2,
        [(0.0, rgba("#ff9a4a")), (0.5, rgba("#ffc583")), (0.8, rgba("#f28f45")), (1.0, rgba("#ffd9a8"))],
    )
    blind = t.mul(t.gt(rnd2, 0.55), t.gt(t.fract(t.mul(lv, 6.0)), 0.5))
    room_strength = t.mul(t.mix_float(blind, 3.0, 1.0), lit)
    glass = rgba("#060608")

    ground = t.mul(t.lt(v, GROUND_FLOOR), wall)
    su = t.mul(t.fract(t.math("DIVIDE", u, 3.6)), 3.6)
    pane = t.mul(t.mul(t.band(su, 0.35, 3.25), t.band(v, 0.55, 2.9)), ground)
    mullion = t.add(t.band(t.fract(t.math("DIVIDE", t.sub(su, 0.35), 0.9667)), 0.0, 0.035), t.band(v, 2.3, 2.36))
    shop = t.mul(pane, t.sub(1.0, t.math("MINIMUM", mullion, 1.0)))
    shop_frame = t.sub(t.mul(t.mul(t.band(su, 0.25, 3.35), t.band(v, 0.45, 3.0)), ground), shop)
    shop_glow = t.mul(t.math("POWER", t.math("DIVIDE", t.sub(v, 0.55), 2.35, clamp=True), 1.6), 0.9)
    shop_lit = t.lt(t.white(t.combine(t.floor(t.math("DIVIDE", u, 3.6)), seed, t.add(p[0], p[1]))).outputs["Value"], 0.35)
    shop_col = t.ramp(seed, [(0.0, rgba("#e8934c")), (0.5, rgba("#f0a860")), (0.7, rgba("#d9784a")), (1.0, rgba("#e8a35c"))])
    sign_band = t.mul(t.band(v, 3.1, 3.85), ground)

    trim = t.mix_color(stucco, rgba("#4b4440"), rgba("#6b6258"))
    color = wall_col
    color = t.mix_color(t.add(t.add(frame, sill), t.add(lintel, course)), color, trim)
    color = t.mix_color(shop_frame, color, rgba("#17110d"))
    color = t.mix_color(sign_band, color, rgba("#120d0b"))
    color = t.mix_color(t.add(window, shop), color, glass)
    color = t.mix_color(roof, color, rgba("#121113"))
    emission = t.mix_color(shop, t.mix_color(window, (0, 0, 0, 1), room), shop_col)
    strength = t.add(t.mul(window, room_strength), t.mul(shop, t.mul(shop_lit, t.add(0.1, shop_glow))))
    rough = t.mix_float(t.add(window, shop), t.mix_float(wet, 0.78, 0.32), 0.05)
    bump = t.node("ShaderNodeBump", inputs={"Strength": 0.35, "Distance": 0.01})
    t.set(bump, "Height", t.mul(t.mul(brick.outputs["Fac"], t.sub(1.0, stucco)), t.sub(1.0, t.add(window, shop))))
    bsdf = t.principled(
        **{
            "Base Color": color,
            "Roughness": rough,
            "Emission Color": emission,
            "Emission Strength": strength,
            "Specular IOR Level": 0.5,
        }
    )
    t.set(bsdf, "Normal", bump.outputs["Normal"])
    t.output(bsdf.outputs[0])
    return mat


def tower():
    """Distant skyscrapers: dark masonry and a tight grid of windows, many lit."""
    mat, t = _new("Tower")
    geo = t.node("ShaderNodeNewGeometry")
    pos = geo.outputs["Position"]
    nrm = t.separate(geo.outputs["Normal"])
    p = t.separate(pos)
    seed = t.node("ShaderNodeAttribute", attribute_name="bseed", attribute_type="GEOMETRY").outputs["Fac"]
    wall = t.lt(t.abs(nrm[2]), 0.5)
    faces_x = t.gt(t.abs(nrm[0]), t.abs(nrm[1]))
    u = t.mix_float(faces_x, p[0], p[1])
    lu = t.fract(t.math("DIVIDE", u, 1.6))
    lv = t.fract(t.math("DIVIDE", p[2], 3.0))
    window = t.mul(t.mul(t.band(lu, 0.2, 0.8), t.band(lv, 0.3, 0.85)), wall)
    cell = t.combine(t.floor(t.math("DIVIDE", u, 1.6)), t.floor(t.math("DIVIDE", p[2], 3.0)), seed)
    lit = t.lt(t.white(cell).outputs["Value"], 0.3)
    hue = t.ramp(t.white(t.add(t.floor(t.math("DIVIDE", u, 1.6)), 7.0)).outputs["Value"], [(0.0, rgba("#ff9c52")), (0.7, rgba("#ffcf8a")), (1.0, rgba("#e8b070"))])
    tone = t.ramp(seed, [(0.0, rgba("#1e1916")), (0.5, rgba("#2a221d")), (1.0, rgba("#191719"))])
    color = t.mix_color(window, tone, rgba("#050506"))
    bsdf = t.principled(
        **{"Base Color": color, "Roughness": 0.7, "Emission Color": hue, "Emission Strength": t.mul(t.mul(window, lit), 4.0)}
    )
    t.output(bsdf.outputs[0])
    return mat


def worm():
    """The beast's hide: dark ridged chitin with faint gold glands."""
    mat, t = _new("Worm")
    geo = t.node("ShaderNodeNewGeometry")
    pos = geo.outputs["Position"]
    vor = t.node("ShaderNodeTexVoronoi", feature="F1", inputs={"Scale": 0.35, "Randomness": 1.0})
    t.set(vor, "Vector", pos)
    spots = t.ramp(vor.outputs["Distance"], [(0.0, (1, 1, 1, 1)), (0.06, (0, 0, 0, 1))])
    skin = t.noise(pos, 0.6, detail=8.0, roughness=0.65)
    tone = t.ramp(skin.outputs["Fac"], [(0.3, rgba("#141812")), (0.6, rgba("#26281c")), (0.8, rgba("#3a3424"))])
    bsdf = t.principled(
        **{
            "Base Color": tone,
            "Roughness": 0.35,
            "Coat Weight": 0.5,
            "Coat Roughness": 0.2,
            "Emission Color": rgba("#d8d050"),
            "Emission Strength": t.mul(spots, 2.5),
        }
    )
    bump = t.node("ShaderNodeBump", inputs={"Strength": 0.6, "Distance": 0.3})
    t.set(bump, "Height", skin.outputs["Fac"])
    t.set(bsdf, "Normal", bump.outputs["Normal"])
    t.output(bsdf.outputs[0])
    return mat


def world(strength=1.0):
    """A burning sky: a hot orange band on the horizon, deep red above, smoke, and a
    glow behind the skyline. Below the horizon a warm haze, so fog reads the same."""
    w = bpy.data.worlds.get("Junction") or bpy.data.worlds.new("Junction")
    w.use_nodes = True
    t = Tree.__new__(Tree)
    t.nt = w.node_tree
    t.nt.nodes.clear()
    t.x = 0
    coord = t.node("ShaderNodeTexCoord")
    d = coord.outputs["Generated"]
    s = t.separate(d)
    elev = s[2]
    up = t.math("MAXIMUM", elev, 0.0)
    band = t.ramp(
        up,
        [
            (0.0, rgba("#c8501f")),
            (0.04, rgba("#d2642a")),
            (0.1, rgba("#8a2a18")),
            (0.25, rgba("#4a1812")),
            (0.5, rgba("#24100e")),
            (1.0, rgba("#0e0a10")),
        ],
    )
    gx = t.node("ShaderNodeVectorMath", operation="DOT_PRODUCT")
    t.set(gx, 0, d)
    t.set(gx, 1, SKY_GLOW)
    dot = t.math("MAXIMUM", gx.outputs["Value"], 0.0)
    color = t.mix_color(t.mul(t.math("POWER", dot, 4.0), 0.45), band, rgba("#e0602a"))
    color = t.mix_color(t.mul(t.math("POWER", dot, 18.0), 0.9), color, rgba("#ffb070"))
    # Smoke: layered clouds, flattened toward the horizon, that darken the middle sky.
    lift = t.add(t.math("MAXIMUM", elev, 0.0), 0.25)
    clouds = t.noise(t.combine(t.math("DIVIDE", s[0], lift), t.math("DIVIDE", s[1], lift), 0.0), 1.4, detail=8.0, roughness=0.62)
    smoke = t.ramp(clouds.outputs["Fac"], [(0.38, (0, 0, 0, 1)), (0.68, (1, 1, 1, 1))])
    above = t.ramp(elev, [(0.02, (0, 0, 0, 1)), (0.12, (1, 1, 1, 1))])
    color = t.mix_color(t.mul(t.mul(smoke, above), 0.7), color, rgba("#120808"))
    below = t.ramp(elev, [(-0.2, (1, 1, 1, 1)), (0.0, (0, 0, 0, 1))])
    color = t.mix_color(below, color, rgba("#5a2a18"))
    bg = t.node("ShaderNodeBackground", inputs={"Strength": strength})
    t.set(bg, "Color", color)
    out = t.node("ShaderNodeOutputWorld")
    t.link(bg.outputs[0], out.inputs[0])
    bpy.context.scene.world = w
    return w
