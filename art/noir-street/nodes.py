"""Small helpers for building Cycles node trees from Python."""

import bpy


class Tree:
    """Wraps a material node tree so nodes can be made and linked in one line each."""

    def __init__(self, material):
        material.use_nodes = True
        self.nt = material.node_tree
        self.nt.nodes.clear()
        self.x = 0

    def node(self, kind, **props):
        n = self.nt.nodes.new(kind)
        n.location = (self.x, 0)
        self.x += 200
        inputs = props.pop("inputs", {})
        for key, value in props.items():
            setattr(n, key, value)
        for key, value in inputs.items():
            self.set(n, key, value)
        return n

    def set(self, n, key, value):
        sock = n.inputs[key]
        if isinstance(value, bpy.types.NodeSocket):
            self.nt.links.new(value, sock)
        else:
            sock.default_value = value

    def link(self, a, b):
        self.nt.links.new(a, b)

    # Math shortcuts -------------------------------------------------------
    def math(self, op, a, b=0.0, clamp=False):
        n = self.node("ShaderNodeMath", operation=op, use_clamp=clamp)
        self.set(n, 0, a)
        self.set(n, 1, b)
        return n.outputs[0]

    def math3(self, op, a, b, c):
        n = self.node("ShaderNodeMath", operation=op)
        self.set(n, 0, a)
        self.set(n, 1, b)
        self.set(n, 2, c)
        return n.outputs[0]

    def add(self, a, b):
        return self.math("ADD", a, b)

    def sub(self, a, b):
        return self.math("SUBTRACT", a, b)

    def mul(self, a, b):
        return self.math("MULTIPLY", a, b)

    def lt(self, a, b):
        return self.math("LESS_THAN", a, b)

    def gt(self, a, b):
        return self.math("GREATER_THAN", a, b)

    def band(self, value, low, high):
        """1 where low <= value < high, else 0."""
        return self.mul(self.gt(value, low), self.lt(value, high))

    def fract(self, a):
        return self.math("FRACT", a)

    def floor(self, a):
        return self.math("FLOOR", a)

    def abs(self, a):
        return self.math("ABSOLUTE", a)

    def combine(self, x, y, z=0.0):
        n = self.node("ShaderNodeCombineXYZ")
        self.set(n, 0, x)
        self.set(n, 1, y)
        self.set(n, 2, z)
        return n.outputs[0]

    def separate(self, v):
        n = self.node("ShaderNodeSeparateXYZ")
        self.set(n, 0, v)
        return n.outputs

    def mix_color(self, fac, a, b):
        n = self.node("ShaderNodeMix", data_type="RGBA", blend_type="MIX")
        self.set(n, 0, fac)
        self.set(n, 6, a)
        self.set(n, 7, b)
        return n.outputs[2]

    def mix_float(self, fac, a, b):
        n = self.node("ShaderNodeMix", data_type="FLOAT")
        self.set(n, 0, fac)
        self.set(n, 2, a)
        self.set(n, 3, b)
        return n.outputs[0]

    def noise(self, vector, scale, detail=2.0, roughness=0.5):
        n = self.node("ShaderNodeTexNoise", inputs={"Scale": scale, "Detail": detail, "Roughness": roughness})
        self.set(n, "Vector", vector)
        return n

    def white(self, vector, dims="3D"):
        n = self.node("ShaderNodeTexWhiteNoise", noise_dimensions=dims)
        self.set(n, "Vector", vector)
        return n

    def ramp(self, fac, stops):
        """stops: list of (position, (r, g, b, a))."""
        n = self.node("ShaderNodeValToRGB")
        elements = n.color_ramp.elements
        while len(elements) > 1:
            elements.remove(elements[-1])
        elements[0].position = stops[0][0]
        elements[0].color = stops[0][1]
        for position, color in stops[1:]:
            e = elements.new(position)
            e.color = color
        self.set(n, 0, fac)
        return n.outputs[0]

    def principled(self, **inputs):
        return self.node("ShaderNodeBsdfPrincipled", inputs=inputs)

    def output(self, shader):
        out = self.node("ShaderNodeOutputMaterial")
        self.link(shader, out.inputs["Surface"])
        return out


def rgba(hex_or_tuple, alpha=1.0):
    if isinstance(hex_or_tuple, str):
        h = hex_or_tuple.lstrip("#")
        srgb = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
        lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
        return (*lin, alpha)
    return (*hex_or_tuple[:3], alpha)
