"""
City Bay — кухня-гостиная (помещение №4 обмерного плана).
Процедурная сцена Blender 4.2 (Cycles). Размеры — из обмерного плана, мм -> м.

Система координат: начало — внутренний юго-западный угол комнаты,
X — на восток (к кухне), Y — на север (к окну), Z — вверх.
    комната 4573 (X) x 4600 (Y), потолок 2895
    окно в северной стене: 203 от западной стены, ширина 3375, откос 245
    проём в прихожую в южной стене: 2953..3853 (900)
    двери в спальни в западной стене: 50..964 и 1669..2582

Запуск:  python3 build_scene.py <out.blend> [art.png]
"""
import bpy, bmesh, math, random, os, sys
import numpy as np
from mathutils import Vector, Matrix, Euler

# ------------------------------------------------------------------ размеры
RX, RY, H = 4.573, 4.600, 2.895
WIN = (0.203, 3.578)            # окно по X
WIN_TOP = 2.45                  # верх оконного проёма
REV = 0.245                     # глубина откоса
MUL = (WIN[0] + WIN[1]) / 2     # импост
S_OPEN = (2.953, 3.853)         # проём в прихожую
S_OPEN_H = 2.30
W_DOORS = [(0.05, 0.964), (1.669, 2.582)]
DOOR_H = 2.10
KX = 3.973                      # фасады кухни (низ + колонны)
UPX = 4.203                     # фасады верхних шкафов
Y_C, Y_B = 1.2, 2.6             # границы секций кухни: колонны | ниша | модуль с верхними
BASE_TOP = 0.87
CT_TOP = 0.90
UP_Z0, UP_Z1 = 1.45, 2.72

OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/citybay.blend"
ART_PNG = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(OUT), "art.png")

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
rnd = random.Random(7)


# ------------------------------------------------------------------ утилиты
def hex2lin(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


def rgba(h):
    return (*hex2lin(h), 1.0)


def coll(name):
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c


C_ARCH = coll("Architecture")
C_CEIL = coll("Ceiling")
C_KIT = coll("Kitchen")
C_FURN = coll("Furniture")
C_DECOR = coll("Decor")
C_LIGHT = coll("Lights")
C_OUT = coll("Outside")


def link(obj, c):
    c.objects.link(obj)
    return obj


def mesh_obj(name, bm, mats, c, smooth=False, sharp_angle=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in (mats if isinstance(mats, (list, tuple)) else [mats]):
        me.materials.append(m)
    if smooth:
        me.shade_smooth()
        if sharp_angle:
            me.set_sharp_from_angle(angle=math.radians(sharp_angle))
    obj = bpy.data.objects.new(name, me)
    return link(obj, c)


def box(name, x0, x1, y0, y1, z0, z1, mat, c, bevel=0.0, seg=2, M=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector(((x0 + x1) / 2 + v.co.x * (x1 - x0),
                       (y0 + y1) / 2 + v.co.y * (y1 - y0),
                       (z0 + z1) / 2 + v.co.z * (z1 - z0)))
    o = mesh_obj(name, bm, mat, c, smooth=bevel > 0)
    if bevel > 0:
        md = o.modifiers.new("bevel", 'BEVEL')
        md.width = bevel
        md.segments = seg
        md.limit_method = 'ANGLE'
        md.harden_normals = True
    if M is not None:
        o.matrix_world = M
    return o


def cushion(name, x0, x1, y0, y1, z0, z1, mat, c, r=0.04, M=None, levels=2):
    o = box(name, x0, x1, y0, y1, z0, z1, mat, c, M=M)
    o.data.shade_smooth()
    b = o.modifiers.new("bev", 'BEVEL')
    b.width = r
    b.segments = 3
    b.limit_method = 'NONE'
    s = o.modifiers.new("sub", 'SUBSURF')
    s.levels = 1
    s.render_levels = levels
    return o


def ring_molding(name, poly, profile, O, U, V, N, mat, c):
    """Замкнутый профиль (молдинг/карниз) по полигону с автоматическими усами 45°.
    poly — CCW в координатах (u, v) плоскости; profile — [(w внутрь, h по нормали)]."""
    O, U, V, N = map(Vector, (O, U, V, N))
    poly = [Vector(p) for p in poly]
    n = len(poly)
    bm = bmesh.new()
    rings = []
    for (w, h) in profile:
        ring = []
        for i in range(n):
            p, a, b = poly[i], poly[i - 1], poly[(i + 1) % n]
            e1, e2 = (p - a).normalized(), (b - p).normalized()
            n1, n2 = Vector((-e1.y, e1.x)), Vector((-e2.y, e2.x))
            q = p + (n1 + n2) * (w / (1 + n1.dot(n2)))
            ring.append(bm.verts.new(O + U * q.x + V * q.y + N * h))
        rings.append(ring)
    for r in range(len(rings) - 1):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((rings[r][i], rings[r][j], rings[r + 1][j], rings[r + 1][i]))
    return mesh_obj(name, bm, mat, c, smooth=True, sharp_angle=40)


def rect(u0, u1, v0, v1):
    return [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]


def extrude_profile(name, p0, p1, N, prof, mat, c):
    """Прямой погонаж (плинтус): prof — замкнутый контур [(out, z)]."""
    p0, p1, N = Vector(p0), Vector(p1), Vector(N)
    Z = Vector((0, 0, 1))
    bm = bmesh.new()
    A = [bm.verts.new(p0 + N * o + Z * z) for o, z in prof]
    B = [bm.verts.new(p1 + N * o + Z * z) for o, z in prof]
    n = len(prof)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((A[i], A[j], B[j], B[i]))
    bm.faces.new(A)
    bm.faces.new(list(reversed(B)))
    return mesh_obj(name, bm, mat, c, smooth=True, sharp_angle=40)


def lathe(name, prof, mat, c, seg=48, M=None, cap_bottom=True, cap_top=False, sx=1.0, sy=1.0):
    bm = bmesh.new()
    rings = []
    for r, z in prof:
        ring = []
        for k in range(seg):
            a = 2 * math.pi * k / seg
            ring.append(bm.verts.new((r * math.cos(a) * sx, r * math.sin(a) * sy, z)))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for k in range(seg):
            kk = (k + 1) % seg
            bm.faces.new((rings[i][k], rings[i][kk], rings[i + 1][kk], rings[i + 1][k]))
    if cap_bottom and prof[0][0] > 0:
        bm.faces.new(list(reversed(rings[0])))
    if cap_top and prof[-1][0] > 0:
        bm.faces.new(rings[-1])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    o = mesh_obj(name, bm, mat, c, smooth=True, sharp_angle=50)
    if M is not None:
        o.matrix_world = M
    return o


def cyl(name, x, y, z0, z1, r, mat, c, seg=32, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg,
                          radius1=r, radius2=r, depth=z1 - z0,
                          matrix=Matrix.Translation((x, y, (z0 + z1) / 2)))
    o = mesh_obj(name, bm, mat, c, smooth=True, sharp_angle=40)
    if bevel:
        md = o.modifiers.new("bevel", 'BEVEL')
        md.width = bevel
        md.segments = 2
        md.limit_method = 'ANGLE'
        md.harden_normals = True
    return o


def tubes(name, splines, radius, mat, c, M=None, nurbs=True, res=4):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.use_fill_caps = True
    cu.resolution_u = 8
    for pts in splines:
        sp = cu.splines.new('NURBS' if nurbs and len(pts) > 2 else 'POLY')
        sp.points.add(len(pts) - 1)
        for i, p in enumerate(pts):
            sp.points[i].co = (p[0], p[1], p[2], 1.0)
        if nurbs and len(pts) > 2:
            sp.use_endpoint_u = True
            sp.order_u = min(4, len(pts))
    cu.materials.append(mat)
    o = bpy.data.objects.new(name, cu)
    link(o, c)
    if M is not None:
        o.matrix_world = M
    return o


def uv_quad(name, corners, mat, c):
    bm = bmesh.new()
    vs = [bm.verts.new(Vector(p)) for p in corners]
    f = bm.faces.new(vs)
    uv = bm.loops.layers.uv.new("UVMap")
    for loop, t in zip(f.loops, [(0, 0), (1, 0), (1, 1), (0, 1)]):
        loop[uv].uv = t
    return mesh_obj(name, bm, mat, c)


# ------------------------------------------------------------------ материалы
def principled(name, color, rough=0.5, metal=0.0, spec=0.5, sheen=0.0, sheen_rough=0.4,
               sheen_tint=(1, 1, 1, 1), coat=0.0, coat_rough=0.08, trans=0.0, ior=1.45,
               emis=None, emis_str=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = rgba(color) if isinstance(color, str) else color
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Specular IOR Level"].default_value = spec
    b.inputs["Sheen Weight"].default_value = sheen
    b.inputs["Sheen Roughness"].default_value = sheen_rough
    b.inputs["Sheen Tint"].default_value = sheen_tint
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = coat_rough
    b.inputs["Transmission Weight"].default_value = trans
    b.inputs["IOR"].default_value = ior
    if emis:
        b.inputs["Emission Color"].default_value = rgba(emis) if isinstance(emis, str) else emis
        b.inputs["Emission Strength"].default_value = emis_str
    return m


def nodes_of(m):
    nt = m.node_tree
    return nt, nt.nodes, nt.links, nt.nodes["Principled BSDF"]


def add_noise_bump(m, scale=30.0, strength=0.05, dist=0.002, coord='Object', detail=4.0):
    nt, N, L, b = nodes_of(m)
    tc = N.new("ShaderNodeTexCoord")
    nz = N.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = scale
    nz.inputs["Detail"].default_value = detail
    bp = N.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = strength
    bp.inputs["Distance"].default_value = dist
    L.new(tc.outputs[coord], nz.inputs["Vector"])
    L.new(nz.outputs["Fac"], bp.inputs["Height"])
    L.new(bp.outputs["Normal"], b.inputs["Normal"])
    return nz


def mottle(m, base_hex, scale=6.0, lo=0.86, hi=1.1, coord='Object'):
    """Пятнистость бархата / ткани: base * mix(lo, hi, noise)."""
    nt, N, L, b = nodes_of(m)
    tc = N.new("ShaderNodeTexCoord")
    nz = N.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = scale
    nz.inputs["Detail"].default_value = 6.0
    nz.inputs["Distortion"].default_value = 1.2
    mr = N.new("ShaderNodeMapRange")
    mr.inputs["To Min"].default_value = lo
    mr.inputs["To Max"].default_value = hi
    mix = N.new("ShaderNodeMix")
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs["Factor"].default_value = 1.0
    mix.inputs["A"].default_value = rgba(base_hex)
    comb = N.new("ShaderNodeCombineColor")
    L.new(tc.outputs[coord], nz.inputs["Vector"])
    L.new(nz.outputs["Fac"], mr.inputs["Value"])
    for s in ("Red", "Green", "Blue"):
        L.new(mr.outputs["Result"], comb.inputs[s])
    L.new(comb.outputs["Color"], mix.inputs["B"])
    L.new(mix.outputs["Result"], b.inputs["Base Color"])


def wood(name, dark, light, along='X', rough=0.45, grain=40.0, coat=0.0):
    m = principled(name, dark, rough=rough, coat=coat)
    nt, N, L, b = nodes_of(m)
    tc = N.new("ShaderNodeTexCoord")
    mp = N.new("ShaderNodeMapping")
    sc = [grain, grain, grain]
    sc["XYZ".index(along)] = 1.2
    mp.inputs["Scale"].default_value = sc
    nz = N.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 3.0
    nz.inputs["Detail"].default_value = 12.0
    nz.inputs["Roughness"].default_value = 0.62
    nz.inputs["Distortion"].default_value = 1.8
    cr = N.new("ShaderNodeValToRGB")
    cr.color_ramp.elements[0].position = 0.32
    cr.color_ramp.elements[0].color = rgba(dark)
    cr.color_ramp.elements[1].position = 0.72
    cr.color_ramp.elements[1].color = rgba(light)
    bp = N.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.04
    bp.inputs["Distance"].default_value = 0.001
    L.new(tc.outputs["Object"], mp.inputs["Vector"])
    L.new(mp.outputs["Vector"], nz.inputs["Vector"])
    L.new(nz.outputs["Fac"], cr.inputs["Fac"])
    L.new(cr.outputs["Color"], b.inputs["Base Color"])
    L.new(nz.outputs["Fac"], bp.inputs["Height"])
    L.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m


def floor_wood():
    """Ёлочка: UV вдоль доски + случайное значение на доску (атрибут prand)."""
    m = principled("Oak_Herringbone", "#B07A48", rough=0.4, coat=0.12, coat_rough=0.25)
    nt, N, L, b = nodes_of(m)
    uv = N.new("ShaderNodeUVMap")
    at = N.new("ShaderNodeAttribute")
    at.attribute_type = 'GEOMETRY'
    at.attribute_name = "prand"
    sep = N.new("ShaderNodeSeparateXYZ")
    comb = N.new("ShaderNodeCombineXYZ")
    L.new(uv.outputs["UV"], sep.inputs["Vector"])
    mu = N.new("ShaderNodeMath"); mu.operation = 'MULTIPLY'; mu.inputs[1].default_value = 1.4
    mv = N.new("ShaderNodeMath"); mv.operation = 'MULTIPLY'; mv.inputs[1].default_value = 55.0
    mw = N.new("ShaderNodeMath"); mw.operation = 'MULTIPLY'; mw.inputs[1].default_value = 17.0
    L.new(sep.outputs["X"], mu.inputs[0])
    L.new(sep.outputs["Y"], mv.inputs[0])
    L.new(at.outputs["Fac"], mw.inputs[0])
    L.new(mu.outputs[0], comb.inputs["X"])
    L.new(mv.outputs[0], comb.inputs["Y"])
    L.new(mw.outputs[0], comb.inputs["Z"])
    nz = N.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 2.2
    nz.inputs["Detail"].default_value = 12.0
    nz.inputs["Roughness"].default_value = 0.6
    nz.inputs["Distortion"].default_value = 2.0
    L.new(comb.outputs["Vector"], nz.inputs["Vector"])
    cr = N.new("ShaderNodeValToRGB")
    cr.color_ramp.elements[0].position = 0.28
    cr.color_ramp.elements[0].color = rgba("#8E5328")
    cr.color_ramp.elements[1].position = 0.75
    cr.color_ramp.elements[1].color = rgba("#C99260")
    L.new(nz.outputs["Fac"], cr.inputs["Fac"])
    # тон доски
    tone = N.new("ShaderNodeMapRange")
    tone.inputs["To Min"].default_value = 0.78
    tone.inputs["To Max"].default_value = 1.12
    L.new(at.outputs["Fac"], tone.inputs["Value"])
    hsv = N.new("ShaderNodeHueSaturation")
    L.new(cr.outputs["Color"], hsv.inputs["Color"])
    L.new(tone.outputs["Result"], hsv.inputs["Value"])
    L.new(hsv.outputs["Color"], b.inputs["Base Color"])
    rr = N.new("ShaderNodeMapRange")
    rr.inputs["To Min"].default_value = 0.32
    rr.inputs["To Max"].default_value = 0.5
    L.new(nz.outputs["Fac"], rr.inputs["Value"])
    L.new(rr.outputs["Result"], b.inputs["Roughness"])
    bp = N.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.05
    bp.inputs["Distance"].default_value = 0.0008
    L.new(nz.outputs["Fac"], bp.inputs["Height"])
    L.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m


def marble():
    m = principled("Marble", "#F1EEE9", rough=0.12)
    nt, N, L, b = nodes_of(m)
    tc = N.new("ShaderNodeTexCoord")
    mp = N.new("ShaderNodeMapping")
    mp.inputs["Rotation"].default_value = (0.3, 0.5, 0.8)
    nz = N.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 1.6
    nz.inputs["Detail"].default_value = 14.0
    nz.inputs["Distortion"].default_value = 4.5
    cr = N.new("ShaderNodeValToRGB")
    e = cr.color_ramp.elements
    e[0].position, e[0].color = 0.0, rgba("#F2F0EC")
    e[1].position, e[1].color = 1.0, rgba("#F2F0EC")
    for pos, col in ((0.475, "#EDEAE5"), (0.5, "#9C9A98"), (0.525, "#EAE7E2")):
        el = e.new(pos)
        el.color = rgba(col)
    L.new(tc.outputs["Object"], mp.inputs["Vector"])
    L.new(mp.outputs["Vector"], nz.inputs["Vector"])
    L.new(nz.outputs["Fac"], cr.inputs["Fac"])
    L.new(cr.outputs["Color"], b.inputs["Base Color"])
    return m


def emission(name, color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL':
            nt.nodes.remove(n)
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = rgba(color) if isinstance(color, str) else color
    em.inputs["Strength"].default_value = strength
    nt.links.new(em.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
    return m


def window_glass():
    m = bpy.data.materials.new("Window_Glass")
    m.use_nodes = True
    nt = m.node_tree
    N, L = nt.nodes, nt.links
    N.remove(N["Principled BSDF"])
    tr = N.new("ShaderNodeBsdfTransparent")
    gl = N.new("ShaderNodeBsdfGlossy")
    gl.inputs["Roughness"].default_value = 0.02
    mix1 = N.new("ShaderNodeMixShader")
    mix1.inputs[0].default_value = 0.07
    lp = N.new("ShaderNodeLightPath")
    mix2 = N.new("ShaderNodeMixShader")
    L.new(tr.outputs[0], mix1.inputs[1])
    L.new(gl.outputs[0], mix1.inputs[2])
    L.new(lp.outputs["Is Shadow Ray"], mix2.inputs[0])
    L.new(mix1.outputs[0], mix2.inputs[1])
    L.new(tr.outputs[0], mix2.inputs[2])
    L.new(mix2.outputs[0], N["Material Output"].inputs["Surface"])
    return m


def foliage():
    m = bpy.data.materials.new("Outside_Foliage")
    m.use_nodes = True
    nt = m.node_tree
    N, L = nt.nodes, nt.links
    N.remove(N["Principled BSDF"])
    tc = N.new("ShaderNodeTexCoord")
    nz = N.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 0.9
    nz.inputs["Detail"].default_value = 12.0
    nz.inputs["Roughness"].default_value = 0.7
    cr = N.new("ShaderNodeValToRGB")
    e = cr.color_ramp.elements
    e[0].position, e[0].color = 0.3, rgba("#1E2A12")
    e[1].position, e[1].color = 0.75, rgba("#C9B25A")
    el = e.new(0.52)
    el.color = rgba("#5E7430")
    em = N.new("ShaderNodeEmission")
    em.inputs["Strength"].default_value = 1.6
    L.new(tc.outputs["Object"], nz.inputs["Vector"])
    L.new(nz.outputs["Fac"], cr.inputs["Fac"])
    L.new(cr.outputs["Color"], em.inputs["Color"])
    L.new(em.outputs[0], N["Material Output"].inputs["Surface"])
    return m


def image_mat(name, path):
    m = principled(name, "#FFFFFF", rough=0.6, spec=0.3)
    nt, N, L, b = nodes_of(m)
    img = bpy.data.images.load(path)
    img.pack()
    tx = N.new("ShaderNodeTexImage")
    tx.image = img
    L.new(tx.outputs["Color"], b.inputs["Base Color"])
    return m


M = {}
M["paint"] = principled("Wall_Paint_BlueGrey", "#8D9CA1", rough=0.82, spec=0.35)
M["paint_door"] = principled("Door_Paint", "#93A2A6", rough=0.55, spec=0.4)
M["ceiling"] = principled("Ceiling_White", "#EEE9E1", rough=0.9, spec=0.2)
M["cream"] = principled("Front_Cream", "#E3D9CA", rough=0.42)
M["taupe"] = principled("Front_Taupe", "#B2A292", rough=0.42)
M["taupe_dark"] = principled("Plinth_Taupe", "#8E8073", rough=0.6)
M["marble"] = marble()
M["oak"] = floor_wood()
M["subfloor"] = principled("Subfloor", "#1A120C", rough=0.9)
M["sofa"] = principled("Velvet_Greige", "#B6AAA0", rough=0.88, spec=0.25, sheen=1.0, sheen_rough=0.35)
mottle(M["sofa"], "#B6AAA0", scale=5.0, lo=0.84, hi=1.08)
add_noise_bump(M["sofa"], scale=40, strength=0.04)
M["pillow"] = principled("Velvet_Burgundy", "#6A151A", rough=0.8, spec=0.3, sheen=1.0, sheen_rough=0.3,
                         sheen_tint=(1.0, 0.62, 0.62, 1))
mottle(M["pillow"], "#6A151A", scale=9.0, lo=0.8, hi=1.12)
M["curtain"] = principled("Velvet_Terracotta", "#963824", rough=0.85, spec=0.3, sheen=1.0, sheen_rough=0.35,
                          sheen_tint=(1.0, 0.72, 0.62, 1))
mottle(M["curtain"], "#963824", scale=4.0, lo=0.85, hi=1.1)
M["darkwood"] = wood("Wood_Dark_Oak", "#2F2723", "#4E423A", along='X', rough=0.5)
M["darkwood_y"] = wood("Wood_Dark_Oak_Y", "#2F2723", "#4E423A", along='Y', rough=0.5)
M["walnut"] = wood("Wood_Walnut", "#3A2519", "#6A4A34", along='X', rough=0.45)
M["rug"] = principled("Rug_Wool", "#C9BDAE", rough=1.0, spec=0.2, sheen=0.4)
M["boucle"] = principled("Boucle_Cream", "#E4DBCE", rough=1.0, spec=0.2, sheen=0.5)
add_noise_bump(M["boucle"], scale=380, strength=0.35, dist=0.002, detail=2.0)
M["metal_dark"] = principled("Metal_DarkBronze", "#2E2925", rough=0.35, metal=1.0)
M["black"] = principled("Black_Matte", "#161616", rough=0.45)
M["brass"] = principled("Brass", "#C29A5E", rough=0.25, metal=1.0)
M["red_vase"] = principled("Ceramic_Red_Glossy", "#B2101A", rough=0.08, coat=1.0, coat_rough=0.03)
M["ceramic_white"] = principled("Ceramic_White", "#F0ECE6", rough=0.25, coat=0.5)
M["amber"] = principled("Glass_Amber", "#7A3A12", rough=0.03, trans=1.0, ior=1.5)
M["blind"] = principled("Blinds_Wood", "#B5753D", rough=0.5)
M["tape"] = principled("Blinds_Tape", "#C9B69A", rough=0.9)
M["frame"] = principled("Window_Frame", "#3B3530", rough=0.45)
M["glass"] = window_glass()
M["tv"] = principled("TV_Screen", "#050505", rough=0.06, spec=0.6)
M["oven_glass"] = principled("Oven_Glass", "#070707", rough=0.05, spec=0.8)
M["oven_glow"] = principled("Oven_Glow", "#120804", rough=0.1, emis="#FF8A3A", emis_str=0.45)
M["art_frame"] = principled("Art_Frame_Red", "#8A2319", rough=0.3, coat=0.6)
M["book_w"] = principled("Book_White", "#EEE9E0", rough=0.6)
M["book_b"] = principled("Book_Beige", "#D2C6B4", rough=0.6)
M["book_k"] = principled("Book_Charcoal", "#2E2D2C", rough=0.6)
M["pages"] = principled("Book_Pages", "#F3EEE3", rough=0.8)
M["lemon"] = principled("Lemon", "#E7BE2C", rough=0.35, coat=0.4)
M["leaf_red"] = principled("Leaf_Burgundy", "#5E1719", rough=0.6, sheen=0.3)
M["leaf_rust"] = principled("Leaf_Rust", "#8A3520", rough=0.6)
M["leaf_olive"] = principled("Leaf_Olive", "#6A6B45", rough=0.6)
M["leaf_beige"] = principled("Leaf_Beige", "#C4AE8B", rough=0.7)
M["olive"] = principled("Leaf_OliveBranch", "#5B6340", rough=0.55)
M["stem"] = principled("Stem_Dry", "#5A4630", rough=0.7)
M["cotton"] = principled("Cotton", "#F4F1EA", rough=1.0, sheen=1.0, sheen_rough=0.5)
add_noise_bump(M["cotton"], scale=120, strength=0.6, dist=0.003)
M["socket"] = principled("Socket_Black", "#1B1B1B", rough=0.4)
M["spot_lens"] = emission("Spot_Lens", "#FFD9A8", 25.0)
M["foliage"] = foliage()
M["candle"] = principled("Candle_Wax", "#F2EDE4", rough=0.5)

# ковёр: полосы вязки
nt, Nn, Ll, bb = nodes_of(M["rug"])
tc = Nn.new("ShaderNodeTexCoord")
wv = Nn.new("ShaderNodeTexWave")
wv.inputs["Scale"].default_value = 110.0
wv.inputs["Distortion"].default_value = 1.5
wv.inputs["Detail"].default_value = 3.0
wv.bands_direction = 'X'
nz = Nn.new("ShaderNodeTexNoise")
nz.inputs["Scale"].default_value = 260.0
mixh = Nn.new("ShaderNodeMath"); mixh.operation = 'ADD'
L2 = Nn.new("ShaderNodeMath"); L2.operation = 'MULTIPLY'; L2.inputs[1].default_value = 0.5
Ll.new(tc.outputs["Object"], wv.inputs["Vector"])
Ll.new(tc.outputs["Object"], nz.inputs["Vector"])
Ll.new(wv.outputs["Fac"], mixh.inputs[0])
Ll.new(nz.outputs["Fac"], L2.inputs[0])
Ll.new(L2.outputs[0], mixh.inputs[1])
bp = Nn.new("ShaderNodeBump")
bp.inputs["Strength"].default_value = 1.0
bp.inputs["Distance"].default_value = 0.006
Ll.new(mixh.outputs[0], bp.inputs["Height"])
Ll.new(bp.outputs["Normal"], bb.inputs["Normal"])
mr = Nn.new("ShaderNodeMapRange")
mr.inputs["From Max"].default_value = 1.5
mr.inputs["To Min"].default_value = 0.72
mr.inputs["To Max"].default_value = 1.05
Ll.new(mixh.outputs[0], mr.inputs["Value"])
hs = Nn.new("ShaderNodeHueSaturation")
hs.inputs["Color"].default_value = rgba("#C9BDAE")
Ll.new(mr.outputs["Result"], hs.inputs["Value"])
Ll.new(hs.outputs["Color"], bb.inputs["Base Color"])


# ------------------------------------------------------------------ картина (генерация)
def make_art(path):
    Wp, Hp = 700, 980
    yy, xx = np.mgrid[0:Hp, 0:Wp].astype(np.float32)
    X, Y = xx / Wp, yy / Hp

    def col(h):
        h = h.lstrip('#')
        return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], dtype=np.float32)

    img = np.empty((Hp, Wp, 3), np.float32)
    img[:] = col("#EADFCF")
    field = (X > 0.08) & (X < 0.92) & (Y > 0.06) & (Y < 0.94)

    def disc(cx, cy, r):
        return (xx - cx * Wp) ** 2 + (yy - cy * Hp) ** 2 < (r * Wp) ** 2

    img[field] = col("#B8452C")
    img[field & (X < 0.5) & (Y < 0.5)] = col("#8C1D18")
    img[field & (X >= 0.5) & (Y >= 0.5)] = col("#D98E73")
    img[field & disc(0.5, 0.31, 0.27) & (X >= 0.5)] = col("#EADFCF")
    img[field & disc(0.5, 0.71, 0.25) & (X < 0.5)] = col("#EADFCF")
    img[field & disc(0.92, 0.94, 0.30) & ~disc(0.92, 0.94, 0.16)] = col("#7A1714")
    img[field & disc(0.29, 0.29, 0.10)] = col("#C8603E")
    img[field & (np.abs(X - 0.5) < 0.006)] = col("#EADFCF")
    img[field & disc(0.73, 0.73, 0.07)] = col("#8C1D18")
    img += np.random.default_rng(3).normal(0, 0.012, img.shape).astype(np.float32)
    img = np.clip(img, 0, 1)
    rgba_ = np.concatenate([np.flipud(img), np.ones((Hp, Wp, 1), np.float32)], axis=2)
    im = bpy.data.images.new("ArtGenerated", Wp, Hp)
    im.pixels.foreach_set(rgba_.ravel())
    im.filepath_raw = path
    im.file_format = 'PNG'
    im.save()
    bpy.data.images.remove(im)


make_art(ART_PNG)
M["art"] = image_mat("Art_Canvas", ART_PNG)


# ------------------------------------------------------------------ архитектура
PAINT = M["paint"]
# северная (наружная) стена с окном
box("Wall_N_W", -0.3, WIN[0], RY, RY + 0.3, 0, H, PAINT, C_ARCH)
box("Wall_N_E", WIN[1], RX + 0.3, RY, RY + 0.3, 0, H, PAINT, C_ARCH)
box("Wall_N_Lintel", WIN[0], WIN[1], RY, RY + 0.3, WIN_TOP, H, PAINT, C_ARCH)
# восточная (наружная)
box("Wall_E", RX, RX + 0.3, -2.4, RY + 0.3, 0, H, PAINT, C_ARCH)
# южная перегородка с проёмом в прихожую
box("Wall_S_W", -0.3, S_OPEN[0], -0.14, 0, 0, H, PAINT, C_ARCH)
box("Wall_S_E", S_OPEN[1], RX + 0.3, -0.14, 0, 0, H, PAINT, C_ARCH)
box("Wall_S_Lintel", S_OPEN[0], S_OPEN[1], -0.14, 0, S_OPEN_H, H, PAINT, C_ARCH)
# западная перегородка с дверями в спальни
box("Wall_W_1", -0.13, 0, -0.3, W_DOORS[0][0], 0, H, PAINT, C_ARCH)
box("Wall_W_2", -0.13, 0, W_DOORS[0][1], W_DOORS[1][0], 0, H, PAINT, C_ARCH)
box("Wall_W_3", -0.13, 0, W_DOORS[1][1], RY + 0.3, 0, H, PAINT, C_ARCH)
for i, (a, b) in enumerate(W_DOORS):
    box(f"Wall_W_Lintel_{i}", -0.13, 0, a, b, DOOR_H, H, PAINT, C_ARCH)
# прихожая (минимально)
box("Hall_Wall_W", 2.78, 2.89, -2.3, -0.14, 0, H, PAINT, C_ARCH)
box("Hall_Wall_S", 2.78, RX + 0.3, -2.3, -2.09, 0, H, PAINT, C_ARCH)
box("Hall_EntranceDoor", 3.05, 3.95, -2.09, -2.05, 0, 2.1, M["frame"], C_ARCH, bevel=0.003)
box("Hall_Wardrobe", 3.97, RX, -2.09, -0.72, 0, 2.62, M["cream"], C_ARCH, bevel=0.002)
for k in range(1, 3):
    yk = -2.09 + k * (2.09 - 0.72) / 3
    box(f"Hall_Wardrobe_gap{k}", 3.966, 3.972, yk - 0.002, yk + 0.002, 0.02, 2.6, M["black"], C_ARCH)
# потолок
box("Ceiling_Slab", -0.3, RX + 0.3, -2.4, RY + 0.3, H, H + 0.2, M["ceiling"], C_CEIL)


# пол — ёлочка
def herringbone(L=0.6, W=0.1, gap=0.0012, bounds=(-0.3, RX + 0.3, -2.3, RY + 0.3)):
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    pr = bm.faces.layers.float.new("prand")
    ang = -math.pi / 4
    ca, sa = math.cos(ang), math.sin(ang)
    cx, cy = RX / 2, 2.3

    def rot(x, y):
        return (x * ca - y * sa + cx, x * sa + y * ca + cy)

    x0b, x1b, y0b, y1b = bounds
    Kmax, Mmax = 70, 12
    count = 0
    for m in range(-Mmax, Mmax + 1):
        for k in range(-Kmax, Kmax + 1):
            ox, oy = m * L + k * W, -m * L + k * W
            for (ax0, ay0, ax1, ay1, horiz) in ((ox, oy, ox + L, oy + W, True),
                                               (ox + L, oy + W - L, ox + L + W, oy + W, False)):
                ccx, ccy = rot((ax0 + ax1) / 2, (ay0 + ay1) / 2)
                if not (x0b - 0.4 < ccx < x1b + 0.4 and y0b - 0.4 < ccy < y1b + 0.4):
                    continue
                g, ch = gap / 2, 0.0012
                r = rnd.random()
                du, dv = rnd.uniform(0, 5), rnd.uniform(0, 5)

                def ring(inset, z):
                    pts = [(ax0 + inset, ay0 + inset), (ax1 - inset, ay0 + inset),
                           (ax1 - inset, ay1 - inset), (ax0 + inset, ay1 - inset)]
                    return [bm.verts.new((*rot(px, py), z)) for px, py in pts], pts

                top, tp = ring(g + ch, 0.0)
                mid, _ = ring(g, -ch)
                bot, _ = ring(g, -0.012)
                faces = [bm.faces.new(top)]
                for a_, b_ in ((top, mid), (mid, bot)):
                    for i in range(4):
                        j = (i + 1) % 4
                        faces.append(bm.faces.new((a_[i], a_[j], b_[j], b_[i])))
                for f in faces:
                    f[pr] = r
                    for lp in f.loops:
                        # локальные координаты доски -> UV (u вдоль доски)
                        wx, wy = lp.vert.co.x - cx, lp.vert.co.y - cy
                        lx, ly = wx * ca + wy * sa, -wx * sa + wy * ca
                        if horiz:
                            u, v = lx - ax0, ly - ay0
                        else:
                            u, v = ly - ay0, lx - ax0
                        lp[uvl].uv = (u + du, v + dv)
                count += 1
    for f in bm.faces:
        f.smooth = False
    o = mesh_obj("Floor_Herringbone", bm, M["oak"], C_ARCH)
    return o, count


floor, nplanks = herringbone()
box("Subfloor", -0.3, RX + 0.3, -2.3, RY + 0.3, -0.02, -0.004, M["subfloor"], C_ARCH)

# внутрипольный конвектор в оконной нише
box("Convector_Grille", 0.68, 3.08, RY + 0.02, RY + 0.21, -0.004, 0.001, M["black"], C_ARCH)
for i in range(60):
    xg = 0.70 + i * 0.0395
    box(f"Convector_Bar_{i}", xg, xg + 0.006, RY + 0.025, RY + 0.205, 0.0, 0.0015, M["metal_dark"], C_ARCH)

# окно: рама, импост, створки, стекло
FY0, FY1 = RY + REV, RY + REV + 0.07
fw = 0.06
box("Win_Frame_L", WIN[0], WIN[0] + fw, FY0, FY1, 0, WIN_TOP, M["frame"], C_ARCH, bevel=0.004)
box("Win_Frame_R", WIN[1] - fw, WIN[1], FY0, FY1, 0, WIN_TOP, M["frame"], C_ARCH, bevel=0.004)
box("Win_Frame_T", WIN[0], WIN[1], FY0, FY1, WIN_TOP - fw, WIN_TOP, M["frame"], C_ARCH, bevel=0.004)
box("Win_Frame_B", WIN[0], WIN[1], FY0 - 0.01, FY1, 0, 0.05, M["frame"], C_ARCH, bevel=0.004)
box("Win_Mullion", MUL - 0.045, MUL + 0.045, FY0 - 0.01, FY1, 0, WIN_TOP, M["frame"], C_ARCH, bevel=0.004)
for i, (a, b) in enumerate(((WIN[0] + fw, MUL - 0.045), (MUL + 0.045, WIN[1] - fw))):
    sw = 0.045
    ring_molding(f"Win_Sash_{i}", rect(a, b, 0.05, WIN_TOP - fw),
                 [(0, 0), (0, 0.03), (sw, 0.03), (sw, 0.0)],
                 (0, FY0 + 0.02, 0), (1, 0, 0), (0, 0, 1), (0, -1, 0), M["frame"], C_ARCH)
    uv_quad(f"Win_Glass_{i}", [(a, FY0 + 0.035, 0.05), (b, FY0 + 0.035, 0.05),
                               (b, FY0 + 0.035, WIN_TOP - fw), (a, FY0 + 0.035, WIN_TOP - fw)],
            M["glass"], C_ARCH)

# деревянные жалюзи (две секции)
def blinds(idx, xa, xb):
    yc = RY + REV - 0.045
    box(f"Blind_Headrail_{idx}", xa, xb, yc - 0.03, yc + 0.03, WIN_TOP - 0.06, WIN_TOP - 0.005,
        M["blind"], C_ARCH, bevel=0.003)
    pitch, top, bottom = 0.042, WIN_TOP - 0.09, 0.07
    n = int((top - bottom) / pitch)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * (xb - xa - 0.012), v.co.y * 0.05, v.co.z * 0.003))
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(-30), 3, 'X'))
    bmesh.ops.translate(bm, verts=bm.verts, vec=((xa + xb) / 2, yc, top))
    o = mesh_obj(f"Blind_Slats_{idx}", bm, M["blind"], C_ARCH, smooth=True)
    bv = o.modifiers.new("bevel", 'BEVEL')
    bv.width, bv.segments, bv.limit_method, bv.harden_normals = 0.0012, 2, 'ANGLE', True
    ar = o.modifiers.new("array", 'ARRAY')
    ar.use_relative_offset = False
    ar.use_constant_offset = True
    ar.constant_offset_displace = (0, 0, -pitch)
    ar.count = n
    box(f"Blind_BottomRail_{idx}", xa + 0.006, xb - 0.006, yc - 0.028, yc + 0.028, bottom - 0.03, bottom - 0.012,
        M["blind"], C_ARCH, bevel=0.003)
    for t in (xa + 0.16, xb - 0.16):
        for s in (-1, 1):
            box(f"Blind_Tape_{idx}_{t:.2f}_{s}", t - 0.0125, t + 0.0125, yc + s * 0.021 - 0.0004,
                yc + s * 0.021 + 0.0004, bottom - 0.03, WIN_TOP - 0.06, M["tape"], C_ARCH)


blinds(0, WIN[0] + 0.01, MUL - 0.05)
blinds(1, MUL + 0.05, WIN[1] - 0.01)

# двери в спальни (закрытые, крашеные, с молдингами) + наличники
FRAME_PROF = [(0.0, 0.0), (0.0, 0.004), (0.004, 0.008), (0.010, 0.012), (0.016, 0.016), (0.022, 0.017),
              (0.028, 0.015), (0.032, 0.012), (0.036, 0.010), (0.040, 0.006), (0.044, 0.002), (0.045, 0.0)]
SMALL_PROF = [(0.0, 0.0), (0.0, 0.003), (0.004, 0.006), (0.008, 0.007), (0.012, 0.004), (0.014, 0.0)]
for i, (a, b) in enumerate(W_DOORS):
    box(f"Door_{i}_Leaf", -0.075, -0.035, a + 0.004, b - 0.004, 0.008, DOOR_H - 0.004, M["paint_door"], C_ARCH,
        bevel=0.002)
    for (v0, v1) in ((0.16, 0.86), (1.0, 1.94)):
        ring_molding(f"Door_{i}_Mold_{v0}", rect(a + 0.13, b - 0.13, v0, v1), SMALL_PROF,
                     (-0.035, 0, 0), (0, 1, 0), (0, 0, 1), (1, 0, 0), M["paint_door"], C_ARCH)
    cw = 0.075
    box(f"Door_{i}_Casing_L", 0, 0.018, a - cw, a, 0, DOOR_H + cw, M["paint_door"], C_ARCH, bevel=0.004)
    box(f"Door_{i}_Casing_R", 0, 0.018, b, b + cw, 0, DOOR_H + cw, M["paint_door"], C_ARCH, bevel=0.004)
    box(f"Door_{i}_Casing_T", 0, 0.018, a - cw, b + cw, DOOR_H, DOOR_H + cw, M["paint_door"], C_ARCH, bevel=0.004)
    # ручка-нажимная (латунь)
    hy = b - 0.07 if i == 0 else a + 0.07
    cyl(f"Door_{i}_Rosette", 0, 0, 0, 0.012, 0.026, M["brass"], C_ARCH).matrix_world = \
        Matrix.Translation((-0.035, hy, 1.0)) @ Matrix.Rotation(math.pi / 2, 4, 'Y')
    lever_dir = -1 if i == 0 else 1
    tubes(f"Door_{i}_Lever", [[(-0.02, hy, 1.0), (0.02, hy, 1.0), (0.03, hy + lever_dir * 0.03, 1.0),
                               (0.03, hy + lever_dir * 0.12, 1.0)]], 0.008, M["brass"], C_ARCH)

# наличник проёма в прихожую
cw = 0.075
box("Opening_Casing_L", S_OPEN[0] - cw, S_OPEN[0], 0, 0.018, 0, S_OPEN_H + cw, M["paint"], C_ARCH, bevel=0.004)
box("Opening_Casing_R", S_OPEN[1], S_OPEN[1] + cw, 0, 0.018, 0, S_OPEN_H + cw, M["paint"], C_ARCH, bevel=0.004)
box("Opening_Casing_T", S_OPEN[0] - cw, S_OPEN[1] + cw, 0, 0.018, S_OPEN_H, S_OPEN_H + cw, M["paint"], C_ARCH,
    bevel=0.004)

# плинтус
BASE_PROF = [(0, 0), (0.016, 0), (0.016, 0.075), (0.013, 0.088), (0.008, 0.096), (0.006, 0.105), (0, 0.108)]
for nm, p0, p1, n in (
        ("S1", (0, 0, 0), (S_OPEN[0] - cw, 0, 0), (0, 1, 0)),
        ("W1", (0, W_DOORS[0][1] + cw, 0), (0, W_DOORS[1][0] - cw, 0), (1, 0, 0)),
        ("W2", (0, W_DOORS[1][1] + cw, 0), (0, RY, 0), (1, 0, 0)),
        ("N1", (0, RY, 0), (WIN[0], RY, 0), (0, -1, 0)),
        ("N2", (WIN[1], RY, 0), (KX, RY, 0), (0, -1, 0))):
    extrude_profile(f"Baseboard_{nm}", p0, p1, n, BASE_PROF, M["paint"], C_ARCH)

# потолочный карниз (идёт по фасадам кухни уступами)
CROWN = [(0.0, 0.145), (0.006, 0.145), (0.006, 0.136), (0.013, 0.131), (0.018, 0.121), (0.024, 0.110),
         (0.034, 0.099), (0.047, 0.087), (0.061, 0.072), (0.074, 0.055), (0.084, 0.041), (0.092, 0.033),
         (0.101, 0.030), (0.101, 0.021), (0.111, 0.018), (0.119, 0.011), (0.124, 0.005), (0.128, 0.0)]
crown_poly = [(0, 0), (KX, 0), (KX, Y_C), (RX, Y_C), (RX, Y_B), (UPX, Y_B), (UPX, RY), (0, RY)]
ring_molding("Crown_Cornice", crown_poly, CROWN, (0, 0, H), (1, 0, 0), (0, 1, 0), (0, 0, -1), M["paint"], C_CEIL)
# короба над шкафами до потолка
box("Soffit_Upper", UPX, RX, Y_B, RY, UP_Z1, H, M["paint"], C_CEIL)
box("Soffit_Tall", KX, RX, 0, Y_C, UP_Z1, H, M["paint"], C_CEIL)

# стеновые панели (буазери)
TIERS = ((0.22, 0.80), (0.94, 2.56))


def wall_frames(tag, cols, O, U, N, tiers=TIERS):
    for ci, (u0, u1) in enumerate(cols):
        for ti, (v0, v1) in enumerate(tiers):
            ring_molding(f"Boiserie_{tag}_{ci}_{ti}", rect(u0, u1, v0, v1), FRAME_PROF, O, U, (0, 0, 1), N,
                         M["paint"], C_ARCH)


wall_frames("S", [(0.12, 0.56), (0.68, 2.56), (2.68, 2.82)], (0, 0, 0), (1, 0, 0), (0, 1, 0))
wall_frames("W", [(1.09, 1.54), (2.76, 3.60), (3.72, 4.50)], (0, 0, 0), (0, 1, 0), (1, 0, 0))
wall_frames("N", [(3.63, 3.93)], (0, RY, 0), (1, 0, 0), (0, -1, 0), tiers=((0.22, 0.80), (0.94, 2.30)))
# рамка вокруг картины в нише
ring_molding("Boiserie_Niche", rect(-2.49, -1.31, 1.08, 2.62), FRAME_PROF, (RX, 0, 0), (0, -1, 0), (0, 0, 1),
             (-1, 0, 0), M["paint"], C_KIT)


# ------------------------------------------------------------------ кухня
def front(name, xf, y0, y1, z0, z1, mat, knob=None, mold=True):
    g = 0.0015
    y0, y1, z0, z1 = min(y0, y1) + g, max(y0, y1) - g, z0 + g, z1 - g
    box(name, xf, xf + 0.019, y0, y1, z0, z1, mat, C_KIT, bevel=0.0015)
    if mold and (y1 - y0) > 0.2 and (z1 - z0) > 0.2:
        m_ = 0.065 if (z1 - z0) > 0.35 else 0.05
        ring_molding(name + "_mold", rect(-(y1 - m_), -(y0 + m_), z0 + m_, z1 - m_), SMALL_PROF,
                     (xf, 0, 0), (0, -1, 0), (0, 0, 1), (-1, 0, 0), mat, C_KIT)
    if knob:
        ky, kz = knob
        cyl(name + "_knob", 0, 0, 0, 0.022, 0.011, M["brass"], C_KIT).matrix_world = \
            Matrix.Translation((xf - 0.022, ky, kz)) @ Matrix.Rotation(math.pi / 2, 4, 'Y')


# корпуса
box("Kit_Base_Carcass", KX + 0.02, RX, Y_C, RY, 0.1, BASE_TOP, M["taupe"], C_KIT)
box("Kit_Plinth", KX + 0.06, RX, Y_C, RY, 0.0, 0.1, M["taupe_dark"], C_KIT)
box("Kit_Countertop", KX - 0.02, RX, Y_C, RY, BASE_TOP, CT_TOP, M["marble"], C_KIT, bevel=0.002)
box("Kit_Backsplash_A", RX - 0.015, RX, Y_B, RY, CT_TOP, UP_Z0, M["marble"], C_KIT)
box("Kit_Backsplash_B", RX - 0.015, RX, Y_C, Y_B, CT_TOP, 1.04, M["marble"], C_KIT, bevel=0.002)
box("Kit_Upper_Carcass", UPX + 0.02, RX - 0.015, Y_B, RY, UP_Z0, UP_Z1, M["cream"], C_KIT)
box("Kit_Tall_Carcass", KX + 0.02, RX, 0, Y_C, 0.0, UP_Z1, M["taupe"], C_KIT)
# фасады низа
na = 3
wa = (RY - Y_B) / na
for i in range(na):
    ya, yb = Y_B + i * wa, Y_B + (i + 1) * wa
    front(f"Kit_BaseA_{i}", KX, ya, yb, 0.1, BASE_TOP, M["taupe"], knob=((ya + yb) / 2, BASE_TOP - 0.07))
    front(f"Kit_UpperA_lo_{i}", UPX, ya, yb, UP_Z0, 2.255, M["cream"], knob=((ya + yb) / 2, UP_Z0 + 0.07))
    front(f"Kit_UpperA_hi_{i}", UPX, ya, yb, 2.255, UP_Z1, M["cream"])
for i in range(2):
    ya, yb = Y_C + i * 0.7, Y_C + (i + 1) * 0.7
    front(f"Kit_BaseB_{i}", KX, ya, yb, 0.1, BASE_TOP, M["taupe"], knob=((ya + yb) / 2, BASE_TOP - 0.07))
# колонны
C1, C2 = (0.6, Y_C), (0.0, 0.6)
front("Kit_C1_bottom", KX, *C1, 0.1, 0.72, M["taupe"], knob=(0.9, 0.66))
front("Kit_C1_mid", KX, *C1, 1.77, 2.26, M["taupe"], knob=(0.9, 1.83))
front("Kit_C1_top", KX, *C1, 2.26, UP_Z1, M["taupe"])
front("Kit_C2_bottom", KX, *C2, 0.1, 1.2, M["taupe"], knob=(0.08, 1.12))
front("Kit_C2_mid", KX, *C2, 1.2, 2.26, M["taupe"], knob=(0.08, 1.28))
front("Kit_C2_top", KX, *C2, 2.26, UP_Z1, M["taupe"])
box("Kit_Plinth_C", KX + 0.06, RX, 0, Y_C, 0.0, 0.1, M["taupe_dark"], C_KIT)


def oven(name, z0, z1):
    y0, y1 = C1[0] + 0.004, C1[1] - 0.004
    box(name + "_Body", KX - 0.004, KX + 0.02, y0, y1, z0 + 0.003, z1 - 0.003, M["oven_glass"], C_KIT, bevel=0.002)
    wz0, wz1 = z0 + 0.07, z1 - 0.11
    box(name + "_Window", KX - 0.0055, KX - 0.004, y0 + 0.07, y1 - 0.07, wz0, wz1, M["oven_glow"], C_KIT)
    tubes(name + "_Handle", [[(KX - 0.004, y0 + 0.06, z1 - 0.06), (KX - 0.03, y0 + 0.06, z1 - 0.06),
                              (KX - 0.03, y1 - 0.06, z1 - 0.06), (KX - 0.004, y1 - 0.06, z1 - 0.06)]],
          0.007, M["brass"], C_KIT, nurbs=False)
    box(name + "_Panel", KX - 0.0055, KX - 0.004, y0 + 0.2, y1 - 0.2, z1 - 0.035, z1 - 0.015, M["black"], C_KIT)


oven("Kit_Oven", 0.72, 1.32)
oven("Kit_OvenCompact", 1.32, 1.77)

# мойка, смеситель, варочная панель
box("Kit_Sink", KX + 0.07, RX - 0.12, 3.25, 3.85, CT_TOP - 0.0005, CT_TOP + 0.0008, M["black"], C_KIT, bevel=0.004)
box("Kit_Sink_Drain", KX + 0.2, KX + 0.26, 3.52, 3.58, CT_TOP + 0.0008, CT_TOP + 0.0012, M["metal_dark"], C_KIT)
cyl("Kit_Faucet_Base", RX - 0.075, 3.55, CT_TOP, CT_TOP + 0.05, 0.024, M["black"], C_KIT)
tubes("Kit_Faucet_Spout", [[(RX - 0.075, 3.55, CT_TOP + 0.04), (RX - 0.075, 3.55, CT_TOP + 0.33),
                            (RX - 0.09, 3.55, CT_TOP + 0.40), (RX - 0.2, 3.55, CT_TOP + 0.40),
                            (RX - 0.25, 3.55, CT_TOP + 0.33), (RX - 0.25, 3.55, CT_TOP + 0.27)]],
      0.012, M["black"], C_KIT)
tubes("Kit_Faucet_Lever", [[(RX - 0.075, 3.575, CT_TOP + 0.2), (RX - 0.075, 3.64, CT_TOP + 0.22)]],
      0.006, M["black"], C_KIT, nurbs=False)
box("Kit_Cooktop", KX + 0.04, RX - 0.05, 1.33, 1.66, CT_TOP, CT_TOP + 0.005, M["oven_glass"], C_KIT, bevel=0.002)
for k in range(2):
    box(f"Kit_Socket_{k}", RX - 0.022, RX - 0.015, 2.75 + k * 0.085, 2.83 + k * 0.085, 1.07, 1.15,
        M["socket"], C_KIT, bevel=0.004)

# картина в нише
ART_Y, ART_Z = (1.475, 2.325), (1.22, 2.42)
fr = 0.035
art_x = RX - 0.012
box("Art_Frame_L", art_x - 0.04, art_x, ART_Y[0] - fr, ART_Y[0], ART_Z[0] - fr, ART_Z[1] + fr, M["art_frame"], C_KIT, bevel=0.004)
box("Art_Frame_R", art_x - 0.04, art_x, ART_Y[1], ART_Y[1] + fr, ART_Z[0] - fr, ART_Z[1] + fr, M["art_frame"], C_KIT, bevel=0.004)
box("Art_Frame_B", art_x - 0.04, art_x, ART_Y[0], ART_Y[1], ART_Z[0] - fr, ART_Z[0], M["art_frame"], C_KIT, bevel=0.004)
box("Art_Frame_T", art_x - 0.04, art_x, ART_Y[0], ART_Y[1], ART_Z[1], ART_Z[1] + fr, M["art_frame"], C_KIT, bevel=0.004)
uv_quad("Art_Canvas", [(art_x - 0.02, ART_Y[1], ART_Z[0]), (art_x - 0.02, ART_Y[0], ART_Z[0]),
                       (art_x - 0.02, ART_Y[0], ART_Z[1]), (art_x - 0.02, ART_Y[1], ART_Z[1])], M["art"], C_KIT)


# ------------------------------------------------------------------ мебель
# диван: угловой с шезлонгом у западной стены
SB = 4.35                    # спинка дивана (отступ под шторы и конвектор)
SF = 3.35                    # фронт посадки
SX0, SX1 = 0.10, 2.85
CH_Y = 2.80                  # край шезлонга
SOFA = M["sofa"]
cushion("Sofa_Base_Main", SX0, SX1, SF, SB, 0.06, 0.29, SOFA, C_FURN, r=0.03, levels=1)
cushion("Sofa_Base_Chaise", SX0, 1.0, CH_Y, SF + 0.05, 0.06, 0.29, SOFA, C_FURN, r=0.03, levels=1)
cushion("Sofa_BackFrame", SX0, SX1, SB - 0.15, SB, 0.25, 0.64, SOFA, C_FURN, r=0.035)
cushion("Sofa_Arm_E", 2.62, SX1, SF, SB, 0.2, 0.62, SOFA, C_FURN, r=0.06)
cushion("Sofa_Seat_Chaise", SX0 + 0.01, 0.99, CH_Y + 0.01, SB - 0.25, 0.27, 0.44, SOFA, C_FURN, r=0.05)
for i, (a, b) in enumerate(((1.0, 1.81), (1.81, 2.62))):
    cushion(f"Sofa_Seat_{i}", a + 0.005, b - 0.005, SF + 0.01, SB - 0.25, 0.27, 0.44, SOFA, C_FURN, r=0.05)
for i, (a, b) in enumerate(((SX0 + 0.01, 0.99), (1.0, 1.81), (1.81, 2.62))):
    o = cushion(f"Sofa_Back_{i}", a + 0.005, b - 0.005, -0.14, 0.14, 0.0, 0.45, SOFA, C_FURN, r=0.06)
    o.matrix_world = Matrix.Translation((0, SB - 0.16, 0.42)) @ Matrix.Rotation(math.radians(-9), 4, 'X')
for (fx, fy) in ((0.16, SB - 0.06), (2.79, SB - 0.06), (2.79, SF + 0.06), (0.16, CH_Y + 0.06), (0.94, CH_Y + 0.06)):
    box("Sofa_Foot", fx - 0.025, fx + 0.025, fy - 0.025, fy + 0.025, 0.0, 0.06, M["black"], C_FURN)


def pillow(name, w, h, t, mat, M_):
    n = 18
    bm = bmesh.new()
    front_, back_ = [], []
    for i in range(n + 1):
        rowf, rowb = [], []
        for j in range(n + 1):
            u, v = -1 + 2 * i / n, -1 + 2 * j / n
            th = t / 2 * max(0.0, (1 - u ** 4) * (1 - v ** 4)) ** 0.55
            pinch = 1 - 0.07 * (1 - v * v) * (u * u)
            x, z = u * w / 2 * (1 - 0.05 * (1 - v * v)), v * h / 2 * (1 - 0.05 * (1 - u * u))
            rowf.append(bm.verts.new((x * pinch, th, z)))
            rowb.append(bm.verts.new((x * pinch, -th, z)))
        front_.append(rowf)
        back_.append(rowb)
    for i in range(n):
        for j in range(n):
            bm.faces.new((front_[i][j], front_[i + 1][j], front_[i + 1][j + 1], front_[i][j + 1]))
            bm.faces.new((back_[i][j], back_[i][j + 1], back_[i + 1][j + 1], back_[i + 1][j]))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    o = mesh_obj(name, bm, mat, C_FURN, smooth=True)
    s = o.modifiers.new("sub", 'SUBSURF')
    s.levels, s.render_levels = 1, 1
    o.matrix_world = M_
    return o


for i, (px, rz, tl) in enumerate(((0.38, 8, 16), (0.76, -6, 20), (1.36, 5, 17), (1.72, -9, 22), (2.32, 4, 16))):
    pillow(f"Pillow_{i}", 0.48, 0.48, 0.17, M["pillow"],
           Matrix.Translation((px, SB - 0.36, 0.66)) @ Matrix.Rotation(math.radians(rz), 4, 'Z')
           @ Matrix.Rotation(math.radians(-tl), 4, 'X'))

# ковёр
box("Rug", 0.35, 2.25, 0.85, 3.65, 0.0, 0.014, M["rug"], C_FURN, bevel=0.006, seg=3)

# журнальный стол: овальная столешница + конусная опора
CTX, CTY = 1.72, 2.72


def superellipse_slab(name, a, b, z0, z1, mat, cx, cy, nexp=2.6, seg=96):
    bm = bmesh.new()
    top, bot = [], []
    for k in range(seg):
        t = 2 * math.pi * k / seg
        c, s = math.cos(t), math.sin(t)
        x = a * math.copysign(abs(c) ** (2 / nexp), c)
        y = b * math.copysign(abs(s) ** (2 / nexp), s)
        top.append(bm.verts.new((cx + x, cy + y, z1)))
        bot.append(bm.verts.new((cx + x, cy + y, z0)))
    bm.faces.new(top)
    bm.faces.new(list(reversed(bot)))
    for k in range(seg):
        kk = (k + 1) % seg
        bm.faces.new((bot[k], bot[kk], top[kk], top[k]))
    o = mesh_obj(name, bm, mat, C_FURN, smooth=True, sharp_angle=40)
    md = o.modifiers.new("bevel", 'BEVEL')
    md.width, md.segments, md.limit_method, md.harden_normals = 0.008, 3, 'ANGLE', True
    return o


superellipse_slab("CoffeeTable_Top", 0.50, 0.28, 0.395, 0.43, M["darkwood"], CTX, CTY)
lathe("CoffeeTable_Base", [(0.20, 0.0), (0.20, 0.012), (0.19, 0.02), (0.13, 0.26), (0.10, 0.37), (0.12, 0.395),
                           (0.0, 0.395)], M["darkwood"], C_FURN, seg=64, sx=1.35,
      M=Matrix.Translation((CTX, CTY, 0.0)))

# обеденный стол (парсонс) + 4 стула
DTX, DTY = 3.0, 1.9
DT_W, DT_L = 0.76, 1.2
box("DiningTable_Top", DTX - DT_W / 2, DTX + DT_W / 2, DTY - DT_L / 2, DTY + DT_L / 2, 0.715, 0.755,
    M["darkwood_y"], C_FURN, bevel=0.004)
for sx in (-1, 1):
    for sy in (-1, 1):
        lx, ly = DTX + sx * (DT_W / 2 - 0.035), DTY + sy * (DT_L / 2 - 0.035)
        box("DiningTable_Leg", lx - 0.03, lx + 0.03, ly - 0.03, ly + 0.03, 0.0, 0.716, M["darkwood_y"], C_FURN,
            bevel=0.003)


def arc_band(name, r_in, r_out, z0, z1, a0, a1, mat, c, M_, steps=40):
    bm = bmesh.new()
    rings = []
    for k in range(steps + 1):
        a = a0 + (a1 - a0) * k / steps
        ca, sa = math.cos(a), math.sin(a)
        rings.append([bm.verts.new((r * ca, r * sa, z)) for r, z in ((r_in, z0), (r_out, z0), (r_out, z1), (r_in, z1))])
    for k in range(steps):
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    o = mesh_obj(name, bm, mat, c, smooth=True)
    b = o.modifiers.new("bev", 'BEVEL')
    b.width, b.segments, b.limit_method = 0.02, 3, 'ANGLE'
    s = o.modifiers.new("sub", 'SUBSURF')
    s.levels, s.render_levels = 1, 2
    o.matrix_world = M_
    return o


def chair(name, x, y, facing):
    """Стул с круглой спинкой (букле + тёмный металл). facing — угол взгляда (рад)."""
    Mc = Matrix.Translation((x, y, 0)) @ Matrix.Rotation(facing, 4, 'Z')
    cushion(name + "_Seat", -0.22, 0.22, -0.235, 0.235, 0.425, 0.49, M["boucle"], C_FURN, r=0.03, M=Mc)
    a0, a1 = math.radians(180 - 100), math.radians(180 + 100)
    arc_band(name + "_Back", 0.215, 0.27, 0.62, 0.80, a0, a1, M["boucle"], C_FURN,
             Mc @ Matrix.Translation((0.03, 0, 0)))
    legs = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            legs.append([(sx * 0.17, sy * 0.18, 0.425), (sx * 0.2, sy * 0.21, 0.0)])
    arc = [(0.03 + 0.245 * math.cos(a0 + (a1 - a0) * k / 12), 0.245 * math.sin(a0 + (a1 - a0) * k / 12), 0.605)
           for k in range(13)]
    posts = [[(0.03 + 0.245 * math.cos(a), 0.245 * math.sin(a), 0.605),
              (0.03 + 0.245 * math.cos(a), 0.245 * math.sin(a) * 0.85, 0.425)] for a in (a0, a1)]
    seat_ring = [(-0.17, -0.18, 0.42), (0.17, -0.18, 0.42), (0.17, 0.18, 0.42), (-0.17, 0.18, 0.42),
                 (-0.17, -0.18, 0.42)]
    tubes(name + "_Frame", legs + posts + [seat_ring], 0.0085, M["metal_dark"], C_FURN, M=Mc, nurbs=False)
    tubes(name + "_BackArc", [arc], 0.0085, M["metal_dark"], C_FURN, M=Mc)


for i, yy in enumerate((DTY - 0.3, DTY + 0.3)):
    chair(f"Chair_W{i}", DTX - DT_W / 2 - 0.13, yy + rnd.uniform(-0.02, 0.02), math.radians(rnd.uniform(-4, 4)))
    chair(f"Chair_E{i}", DTX + DT_W / 2 + 0.13, yy + rnd.uniform(-0.02, 0.02),
          math.pi + math.radians(rnd.uniform(-4, 4)))

# ТВ-зона на южной стене
TVX = 1.62
box("TV_Console_Carcass", TVX - 0.9, TVX + 0.9, 0.0, 0.38, 0.33, 0.66, M["walnut"], C_FURN, bevel=0.002)
for i in range(4):
    xa = TVX - 0.9 + i * 0.45
    box(f"TV_Console_Front_{i}", xa + 0.002, xa + 0.448, 0.38, 0.40, 0.333, 0.657, M["walnut"], C_FURN, bevel=0.002)
box("TV_Frame", TVX - 0.726, TVX + 0.726, 0.025, 0.055, 1.07, 1.89, M["black"], C_FURN, bevel=0.003)
box("TV_Screen", TVX - 0.72, TVX + 0.72, 0.055, 0.057, 1.076, 1.884, M["tv"], C_FURN)

# шторы (бархат, волны), трек под карнизом
def curtain(name, x0, x1, amp=0.045, waves=None, z0=0.012, z1=2.70, yc=RY - 0.12):
    width = x1 - x0
    waves = waves or max(2, int(width / 0.11))
    nx, nz = waves * 8, 30
    bm = bmesh.new()
    grid = []
    for j in range(nz + 1):
        z = z0 + (z1 - z0) * j / nz
        row = []
        for i in range(nx + 1):
            t = i / nx
            ph = 2 * math.pi * waves * t
            a = amp * (1.0 + 0.25 * (1 - j / nz))
            row.append(bm.verts.new((x0 + width * t, yc + a * math.sin(ph), z)))
        grid.append(row)
    for j in range(nz):
        for i in range(nx):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    o = mesh_obj(name, bm, M["curtain"], C_FURN, smooth=True)
    so = o.modifiers.new("solid", 'SOLIDIFY')
    so.thickness = 0.004
    return o


curtain("Curtain_W", 0.02, 0.52)
curtain("Curtain_E", 3.40, 3.93)
box("Curtain_Track", 0.0, KX, RY - 0.145, RY - 0.1, 2.70, 2.73, M["black"], C_FURN)


# ------------------------------------------------------------------ декор
def leaf_into(bm, Mx, L, Wd, bend=0.3, mat_index=0, n=8):
    left, right = [], []
    for i in range(n + 1):
        t = i / n
        x = L * t
        w = Wd * (math.sin(math.pi * t) ** 0.8) / 2
        z = bend * L * t * t
        left.append(bm.verts.new(Mx @ Vector((x, w, z))))
        right.append(bm.verts.new(Mx @ Vector((x, -w, z))))
    for i in range(n):
        f = bm.faces.new((left[i], left[i + 1], right[i + 1], right[i]))
        f.material_index = mat_index
        f.smooth = True


def bouquet(name, base, height, n_stems, spread, seed, leaf_mats, balls=0, leaf_size=(0.035, 0.018),
            leaves_per_stem=(3, 7), stem_mat=None):
    rr = random.Random(seed)
    base = Vector(base)
    bm = bmesh.new()
    splines = []
    for s in range(n_stems):
        ang = rr.uniform(0, 2 * math.pi)
        tilt = rr.uniform(0.05, 1.0) * spread
        h = height * rr.uniform(0.55, 1.0)
        d = Vector((math.sin(tilt) * math.cos(ang), math.sin(tilt) * math.sin(ang), math.cos(tilt)))
        p0 = base + Vector((rr.uniform(-0.01, 0.01), rr.uniform(-0.01, 0.01), -0.08))
        pts = [p0 + d * h * t - Vector((0, 0, 0.12 * h * t * t * tilt)) for t in (0, 0.35, 0.7, 1.0)]
        splines.append([tuple(p) for p in pts])
        for k in range(rr.randint(*leaves_per_stem)):
            t = rr.uniform(0.35, 1.0)
            pos = p0 + d * h * t - Vector((0, 0, 0.12 * h * t * t * tilt))
            la = rr.uniform(0, 2 * math.pi)
            ldir = Vector((math.cos(la), math.sin(la), rr.uniform(0.2, 1.2))).normalized()
            Mx = Matrix.Translation(pos) @ ldir.to_track_quat('X', 'Z').to_matrix().to_4x4() @ \
                Matrix.Rotation(rr.uniform(0, math.pi), 4, 'X')
            sz = rr.uniform(0.7, 1.3)
            leaf_into(bm, Mx, leaf_size[0] * sz, leaf_size[1] * sz, bend=rr.uniform(-0.4, 0.4),
                      mat_index=rr.randrange(len(leaf_mats)))
        if s < balls:
            end = pts[-1]
            r = rr.uniform(0.018, 0.027)
            bb = bmesh.new()
            bmesh.ops.create_icosphere(bb, subdivisions=2, radius=r, matrix=Matrix.Translation(end))
            for f in bb.faces:
                f.material_index = len(leaf_mats)
                f.smooth = True
            tmp = bpy.data.meshes.new("tmp")
            bb.to_mesh(tmp)
            bb.free()
            bm.from_mesh(tmp)
            bpy.data.meshes.remove(tmp)
    mats = list(leaf_mats) + ([M["cotton"]] if balls else [])
    mesh_obj(name + "_Leaves", bm, mats, C_DECOR)
    tubes(name + "_Stems", splines, 0.0018, stem_mat or M["stem"], C_DECOR, res=1)


def vase_red(name, x, y, z, scale=1.0):
    prof = [(0.0, 0.0), (0.045, 0.0), (0.06, 0.01), (0.085, 0.05), (0.092, 0.09), (0.085, 0.14), (0.06, 0.18),
            (0.045, 0.2), (0.042, 0.215), (0.047, 0.225), (0.04, 0.225), (0.036, 0.21), (0.036, 0.17)]
    prof = [(r * scale, zz * scale) for r, zz in prof]
    lathe(name, prof, M["red_vase"], C_DECOR, seg=48, M=Matrix.Translation((x, y, z)))
    return z + 0.225 * scale


def book(name, x, y, z, w, d, t, mat, rotz=0.0):
    Mb = Matrix.Translation((x, y, z)) @ Matrix.Rotation(rotz, 4, 'Z')
    box(name + "_Cover", -w / 2, w / 2, -d / 2, d / 2, 0, t, mat, C_DECOR, bevel=0.0015, M=Mb)
    box(name + "_Pages", -w / 2 + 0.004, w / 2 + 0.0005, -d / 2 - 0.0005, d / 2 - 0.004, 0.003, t - 0.003,
        M["pages"], C_DECOR, M=Mb)
    return z + t


# журнальный столик: стопки книг, красная ваза с букетом, свеча
zt = 0.43
zz = book("Book_CT1", CTX + 0.18, CTY - 0.02, zt, 0.30, 0.23, 0.035, M["book_w"], 0.08)
zz = book("Book_CT2", CTX + 0.18, CTY - 0.02, zz, 0.27, 0.21, 0.03, M["book_b"], -0.05)
zz = book("Book_CT3", CTX + 0.18, CTY - 0.02, zz, 0.24, 0.18, 0.025, M["book_k"], 0.12)
zb = book("Book_CT4", CTX - 0.22, CTY + 0.05, zt, 0.28, 0.21, 0.03, M["book_w"], -0.1)
zb = book("Book_CT5", CTX - 0.22, CTY + 0.05, zb, 0.25, 0.19, 0.03, M["book_b"], 0.05)
top = vase_red("Vase_CT", CTX - 0.22, CTY + 0.05, zb, 0.95)
bouquet("Bouquet_CT", (CTX - 0.22, CTY + 0.05, top), 0.34, 16, 0.55, 11,
        [M["leaf_red"], M["leaf_olive"], M["leaf_rust"]], balls=6)
lathe("Candle_Jar", [(0.0, 0.0), (0.035, 0.0), (0.036, 0.06), (0.032, 0.062), (0.031, 0.05), (0.0, 0.05)],
      M["ceramic_white"], C_DECOR, M=Matrix.Translation((CTX + 0.16, CTY - 0.05, zz)))

# обеденный стол: ваза с букетом, латунная чаша
top = vase_red("Vase_DT", DTX, DTY + 0.18, 0.755, 1.0)
bouquet("Bouquet_DT", (DTX, DTY + 0.18, top), 0.36, 18, 0.55, 23,
        [M["leaf_red"], M["leaf_olive"], M["leaf_beige"]], balls=7)
lathe("Bowl_Brass", [(0.0, 0.0), (0.03, 0.0), (0.07, 0.025), (0.1, 0.055), (0.095, 0.057), (0.066, 0.03),
                     (0.028, 0.006), (0.0, 0.006)], M["brass"], C_DECOR,
      M=Matrix.Translation((DTX + 0.05, DTY - 0.25, 0.755)))

# консоль ТВ: янтарная ваза с оливой, керамическая чаша на книгах
lathe("Vase_Amber", [(0.0, 0.0), (0.05, 0.0), (0.075, 0.05), (0.08, 0.11), (0.06, 0.18), (0.028, 0.22),
                     (0.024, 0.26), (0.03, 0.27), (0.024, 0.27), (0.02, 0.25), (0.02, 0.22)],
      M["amber"], C_DECOR, M=Matrix.Translation((TVX + 0.68, 0.2, 0.66)))
bouquet("Olive_Branch", (TVX + 0.68, 0.2, 0.93), 0.42, 7, 0.45, 5, [M["olive"]], balls=0,
        leaf_size=(0.055, 0.012), leaves_per_stem=(9, 14))
zb = book("Book_TV1", TVX - 0.62, 0.2, 0.66, 0.26, 0.2, 0.03, M["book_w"], 0.05)
zb = book("Book_TV2", TVX - 0.62, 0.2, zb, 0.24, 0.18, 0.025, M["book_b"], -0.04)
lathe("Bowl_Ceramic", [(0.0, 0.0), (0.035, 0.0), (0.075, 0.03), (0.09, 0.06), (0.086, 0.061), (0.07, 0.035),
                       (0.03, 0.007), (0.0, 0.007)], M["ceramic_white"], C_DECOR,
      M=Matrix.Translation((TVX - 0.62, 0.2, zb)))

# кухня: белые вазы с сухоцветами, фрукты, чайник, бутылка масла
for i, (vy, hh) in enumerate(((3.05, 0.2), (3.17, 0.16))):
    prof = [(0.0, 0.0), (0.035, 0.0), (0.05, 0.04), (0.052, 0.08), (0.03, hh * 0.8), (0.015, hh), (0.018, hh + 0.01),
            (0.012, hh + 0.01), (0.012, hh * 0.8)]
    lathe(f"Kit_VaseWhite_{i}", prof, M["ceramic_white"], C_DECOR, M=Matrix.Translation((RX - 0.1, vy, CT_TOP)))
    bouquet(f"Kit_Dried_{i}", (RX - 0.1, vy, CT_TOP + hh + 0.01), 0.3, 5, 0.35, 40 + i, [M["leaf_beige"]],
            leaf_size=(0.03, 0.008), leaves_per_stem=(4, 8))
lathe("Kit_FruitBowl", [(0.0, 0.0), (0.04, 0.0), (0.09, 0.03), (0.12, 0.06), (0.115, 0.062), (0.085, 0.036),
                        (0.035, 0.006), (0.0, 0.006)], M["ceramic_white"], C_DECOR,
      M=Matrix.Translation((RX - 0.22, 4.33, CT_TOP)))
for k in range(5):
    a = k * 2 * math.pi / 5
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=16, radius=0.032,
                              matrix=Matrix.Translation((RX - 0.22 + 0.045 * math.cos(a), 4.33 + 0.045 * math.sin(a),
                                                         CT_TOP + 0.05 + 0.01 * (k % 2)))
                              @ Matrix.Diagonal((1.25, 1.0, 1.0, 1.0)))
    mesh_obj(f"Lemon_{k}", bm, M["lemon"], C_DECOR, smooth=True)
lathe("Kit_Kettle", [(0.0, 0.0), (0.075, 0.0), (0.085, 0.02), (0.085, 0.15), (0.07, 0.2), (0.04, 0.22), (0.0, 0.22)],
      M["black"], C_DECOR, M=Matrix.Translation((RX - 0.16, 3.95, CT_TOP)))
tubes("Kit_Kettle_Handle", [[(RX - 0.16, 3.87, CT_TOP + 0.08), (RX - 0.16, 3.83, CT_TOP + 0.16),
                             (RX - 0.16, 3.9, CT_TOP + 0.26), (RX - 0.16, 4.0, CT_TOP + 0.26),
                             (RX - 0.16, 4.05, CT_TOP + 0.19)]], 0.008, M["black"], C_DECOR)
lathe("Kit_OilBottle", [(0.0, 0.0), (0.028, 0.0), (0.03, 0.02), (0.03, 0.2), (0.012, 0.25), (0.011, 0.29),
                        (0.0, 0.29)], M["amber"], C_DECOR, M=Matrix.Translation((RX - 0.1, 2.45, CT_TOP)))


# ------------------------------------------------------------------ свет
def spot(name, loc, target, energy, size_deg=40, blend=0.35, color=(1.0, 0.78, 0.55), radius=0.02, c=C_LIGHT):
    ld = bpy.data.lights.new(name, 'SPOT')
    ld.energy = energy
    ld.spot_size = math.radians(size_deg)
    ld.spot_blend = blend
    ld.shadow_soft_size = radius
    ld.color = color
    o = bpy.data.objects.new(name, ld)
    link(o, c)
    o.location = loc
    d = Vector(target) - Vector(loc)
    o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return o


def area(name, loc, rot, sx, sy, energy, color=(1.0, 0.82, 0.62), portal=False, c=C_LIGHT):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.shape = 'RECTANGLE'
    ld.size, ld.size_y = sx, sy
    ld.energy = energy
    ld.color = color
    if portal:
        ld.cycles.is_portal = True
    o = bpy.data.objects.new(name, ld)
    link(o, c)
    o.location = loc
    o.rotation_euler = rot
    return o


def track(name, x, y0, y1, heads):
    box(name, x - 0.018, x + 0.018, y0, y1, H - 0.032, H, M["black"], C_CEIL, bevel=0.003)
    for i, (hy, tgt, en) in enumerate(heads):
        base = Vector((x, hy, H - 0.035))
        d = (Vector(tgt) - base).normalized()
        head_c = base + d * 0.09
        Mh = Matrix.Translation(head_c) @ d.to_track_quat('-Z', 'Y').to_matrix().to_4x4()
        tubes(f"{name}_arm{i}", [[tuple(base + Vector((0, 0, 0.03))), tuple(base - Vector((0, 0, 0.02))),
                                  tuple(head_c)]], 0.006, M["black"], C_CEIL, nurbs=False)
        cyl(f"{name}_head{i}", 0, 0, -0.065, 0.065, 0.028, M["black"], C_CEIL).matrix_world = Mh
        cyl(f"{name}_lens{i}", 0, 0, -0.067, -0.064, 0.02, M["spot_lens"], C_CEIL).matrix_world = Mh
        spot(f"{name}_L{i}", tuple(head_c + d * 0.07), tgt, en)


track("Track_Living", 1.7, 0.45, 4.0, [
    (0.8, (1.0, 0.0, 0.9), 22), (1.35, (2.3, 0.0, 1.1), 22), (2.4, (CTX, CTY, 0.4), 18),
    (3.1, (0.3, 4.0, 1.2), 20), (3.7, (2.2, 4.5, 1.0), 20)])
track("Track_Kitchen", 3.58, 0.35, 4.3, [
    (0.6, (RX, 0.6, 1.4), 22), (1.9, (RX, 1.9, 1.8), 30), (3.0, (RX, 3.0, 1.2), 22), (3.95, (RX, 4.0, 1.2), 22)])

# линейные подвесы над обеденным столом
for bi, (ya, yb) in enumerate(((DTY - 0.75, DTY - 0.05), (DTY + 0.05, DTY + 0.75))):
    zb_ = 1.74
    box(f"Pendant_{bi}_Bar", DTX - 0.011, DTX + 0.011, ya, yb, zb_, zb_ + 0.022, M["black"], C_CEIL, bevel=0.002)
    for yy in (ya + 0.04, yb - 0.04):
        tubes(f"Pendant_{bi}_Wire", [[(DTX, yy, zb_ + 0.02), (DTX, yy, H)]], 0.0012, M["black"], C_CEIL,
              nurbs=False)
    for k in range(4):
        yy = ya + (yb - ya) * (k + 0.5) / 4
        cyl(f"Pendant_{bi}_Cup{k}", DTX, yy, zb_ - 0.04, zb_, 0.016, M["brass"], C_CEIL)
        cyl(f"Pendant_{bi}_Lens{k}", DTX, yy, zb_ - 0.0415, zb_ - 0.039, 0.012, M["spot_lens"], C_CEIL)
        spot(f"Pendant_{bi}_L{k}", (DTX, yy, zb_ - 0.045), (DTX, yy, 0.0), 5, size_deg=70, blend=0.6)

# подсветка под верхними шкафами, прихожая
area("Kit_UnderCabinet", (RX - 0.25, (Y_B + RY) / 2, UP_Z0 - 0.01), (0, 0, 0), 0.05, RY - Y_B - 0.1, 25)
area("Hall_Light", (3.7, -1.1, H - 0.02), (0, 0, 0), 0.8, 0.8, 30)

# окно: портал + солнце + небо
area("Window_Portal", (MUL, RY + REV + 0.08, WIN_TOP / 2), (-math.pi / 2, 0, 0), WIN[1] - WIN[0], WIN_TOP, 1.0,
     portal=True)
sun_d = Vector((-0.42, -1.0, -0.42)).normalized()
ld = bpy.data.lights.new("Sun", 'SUN')
ld.energy = 5.0
ld.angle = math.radians(1.2)
ld.color = (1.0, 0.86, 0.7)
sun = link(bpy.data.objects.new("Sun", ld), C_LIGHT)
sun.rotation_euler = sun_d.to_track_quat('-Z', 'Y').to_euler()

world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
wn = world.node_tree
sky = wn.nodes.new("ShaderNodeTexSky")
sky.sky_type = 'NISHITA'
sky.sun_disc = False
sky.sun_elevation = math.radians(24)
sky.sun_rotation = math.atan2(-sun_d.x, -sun_d.y)
sky.altitude = 60
bg = wn.nodes["Background"]
bg.inputs["Strength"].default_value = 0.9
wn.links.new(sky.outputs["Color"], bg.inputs["Color"])

# за окном — деревья (фон, виден только камере/в отражениях)
bd = uv_quad("Outside_Backdrop", [(-8, 10, -4), (12, 10, -4), (12, 10, 12), (-8, 10, 12)], M["foliage"], C_OUT)
bd.visible_diffuse = False
bd.visible_shadow = False
bd.visible_volume_scatter = False

# ------------------------------------------------------------------ камеры
def camera(name, loc, target, lens, clip=0.1, shift=(0.0, 0.0), ortho=None):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.sensor_width = 36
    cd.clip_start = clip
    cd.clip_end = 60
    cd.shift_x, cd.shift_y = shift
    if ortho:
        cd.type = 'ORTHO'
        cd.ortho_scale = ortho
    o = bpy.data.objects.new(name, cd)
    link(o, scene.collection)
    o.location = loc
    d = Vector(target) - Vector(loc)
    o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return o


camera("CAM_01_Main", (-0.32, 2.15, 1.35), (4.6, 2.15, 1.35), 15.5, clip=0.36, shift=(0.0, -0.06))
camera("CAM_02_High", (0.1, 0.6, 2.55), (3.5, 3.25, 0.45), 16.0, clip=0.05)
camera("CAM_03_Window", (0.14, 0.22, 1.25), (4.0, 3.6, 0.95), 15.0, clip=0.05)
camera("CAM_04_Reverse", (4.5, 1.05, 1.42), (0.0, 3.0, 1.1), 16.0, clip=0.62)
camera("CAM_05_Plan", (RX / 2 + 0.01, RY / 2 - 0.12, 8.0), (RX / 2 + 0.01, RY / 2 - 0.12, 0.0), 50, clip=4.9, ortho=5.22)

# ------------------------------------------------------------------ рендер-настройки
scene.render.engine = 'CYCLES'
cy = scene.cycles
cy.device = 'CPU'
cy.samples = 256
cy.use_adaptive_sampling = True
cy.adaptive_threshold = 0.015
cy.use_denoising = True
cy.denoiser = 'OPENIMAGEDENOISE'
cy.max_bounces = 10
cy.diffuse_bounces = 5
cy.glossy_bounces = 4
cy.transmission_bounces = 8
cy.transparent_max_bounces = 16
cy.sample_clamp_indirect = 6.0
cy.caustics_reflective = False
cy.caustics_refractive = False
cy.blur_glossy = 1.0
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Base Contrast'
scene.view_settings.exposure = 1.1
scene.render.film_transparent = False
scene.camera = bpy.data.objects["CAM_01_Main"]

print(f"planks={nplanks} objects={len(bpy.data.objects)}")
bpy.ops.wm.save_as_mainfile(filepath=OUT, compress=True)
print("SAVED", OUT)
