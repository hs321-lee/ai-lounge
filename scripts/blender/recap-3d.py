"""AI-S 복습 장면 3D 모델 (어텐션 · 양자화 · RAG).

Blender 4.5 LTS에서 실행합니다. 화면 라벨은 그림에 굽지 않고, 카메라 투영 좌표를
JSON으로 내보내 HTML 글자(Pretendard)로 얹습니다.

  blender -b -P scripts/blender/recap-3d.py -- --scene attention --mode still --out DIR
  blender -b -P scripts/blender/recap-3d.py -- --scene rag --mode anim --out DIR

mode
  preview : 마지막 프레임 저해상도 확인용
  still   : 마지막 프레임 1440×1080 투명 PNG + 라벨 좌표 JSON
  anim    : 1–FRAMES 프레임 800×600 투명 PNG 시퀀스 (빠른 설정)
"""
import bpy, bmesh, json, math, os, sys
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
opts = dict(zip(argv[::2], argv[1::2]))
SCENE = opts.get("--scene", "attention")
MODE = opts.get("--mode", "preview")
OUT = opts.get("--out", "/tmp/recap3d")
FRAMES = 120  # 30fps · 4초: 만들어지는 과정 → 정지
os.makedirs(OUT, exist_ok=True)

# tokens.css · lounge.css의 OKLCH 값을 sRGB로 옮긴 색입니다.
HEX = {
    "orange": "#ec6100",       # --l-orange
    "orange_text": "#b03f00",  # --l-orange-text / --story-accent
    "amber": "#f2a635",        # --l-amber
    "soft": "#ffead7",         # --l-orange-soft
    "paper": "#fdfaf6",        # --l-bg
    "cream": "#f6f1e7",        # --story-paper
    "line": "#e8e0d8",         # --l-line
    "beige": "#d6c4ae",        # 기존 도식의 비활성 막대(#c9b9a7)를 조금 밝힌 값
    "ink": "#281c15",          # --l-ink
    "muted": "#645850",        # --l-muted
}

def lin(hex_):
    hex_ = hex_.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(hex_[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, 1.0)

# ---------------------------------------------------------------- scene setup
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.frame_start, scene.frame_end = 1, FRAMES
scene.render.fps = 30
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 24 if MODE == "preview" else (128 if MODE == "still" else 14)
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.02 if MODE == "still" else 0.06
scene.cycles.use_denoising = True
scene.cycles.denoiser = "OPENIMAGEDENOISE"
scene.cycles.max_bounces = 6 if MODE == "still" else 3
scene.cycles.diffuse_bounces = 3 if MODE == "still" else 2
scene.cycles.glossy_bounces = 2
scene.cycles.transmission_bounces = 0
scene.cycles.caustics_reflective = scene.cycles.caustics_refractive = False
scene.render.use_persistent_data = True
FAST = MODE == "anim"  # 애니메이션은 피부 산란(SSS) 없이 빠르게, 정지 그림은 전체 품질
scene.render.film_transparent = True
scene.view_settings.view_transform = "Standard"  # 브랜드 색을 그대로 유지
scene.view_settings.look = "None"
scene.view_settings.exposure = 0.0
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
res = {"preview": (640, 480), "still": (1440, 1080), "anim": (800, 600)}[MODE]
scene.render.resolution_x, scene.render.resolution_y = res
scene.render.resolution_percentage = 100

world = bpy.data.worlds.new("warm")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = lin("#fff4e8")
world.node_tree.nodes["Background"].inputs[1].default_value = 0.55

MATS = {}
def mat(name, color, rough=0.55, coat=0.0, sss=0.0, emission=None):
    key = (name, color, rough, coat)
    if key in MATS:
        return MATS[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = lin(color)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = 0.25
    if sss and not FAST:
        b.inputs["Subsurface Weight"].default_value = sss
        b.inputs["Subsurface Radius"].default_value = (0.4, 0.2, 0.1)
        b.inputs["Subsurface Scale"].default_value = 0.08
    if emission:
        b.inputs["Emission Color"].default_value = lin(emission[0])
        b.inputs["Emission Strength"].default_value = emission[1]
    MATS[key] = m
    return m

M = {
    "orange": mat("orange", HEX["orange"], 0.32, coat=0.6, sss=0.15),
    "orange_deep": mat("orange_deep", HEX["orange_text"], 0.38, coat=0.4),
    "amber": mat("amber", HEX["amber"], 0.4, coat=0.4, sss=0.1),
    "soft": mat("soft", HEX["soft"], 0.6, sss=0.08),
    "paper": mat("paper", HEX["paper"], 0.65, sss=0.05),
    "cream": mat("cream", HEX["cream"], 0.7),
    "beige": mat("beige", HEX["beige"], 0.62),
    "ink": mat("ink", HEX["ink"], 0.5),
    "muted": mat("muted", HEX["muted"], 0.55),
    "line": mat("line", "#e2d3c2", 0.6),
}

def link(obj):
    scene.collection.objects.link(obj)
    return obj

def rounded_box(name, size, loc, material, radius=0.08, origin_bottom=True):
    """둥근 모서리 상자. origin_bottom이면 바닥 중심이 원점이라 높이 애니메이션이 쉽습니다."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]
        v.co.y *= size[1]
        v.co.z = v.co.z * size[2] + (size[2] / 2 if origin_bottom else 0)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    obj = link(bpy.data.objects.new(name, me))
    obj.location = loc
    bev = obj.modifiers.new("bevel", "BEVEL")
    bev.width = min(radius, min(size) * 0.45)
    bev.segments = 6
    bev.limit_method = "NONE"
    bev.harden_normals = True
    obj.data.materials.append(material)
    return obj

def sphere(name, radius, loc, material):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=loc, segments=64, ring_count=32)
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(material)
    return obj

def cylinder(name, radius, depth, loc, material, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, location=loc, rotation=rot, vertices=64)
    obj = bpy.context.active_object
    obj.name = name
    bev = obj.modifiers.new("bevel", "BEVEL")
    bev.width = min(0.03, depth * 0.3)
    bev.segments = 4
    bev.harden_normals = True
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(material)
    return obj

def cone(name, r, depth, loc, material, direction):
    bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=0, depth=depth, location=loc, vertices=48)
    obj = bpy.context.active_object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(Vector(direction).normalized())
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(material)
    return obj

def tube(name, points, radius, material, handles=None):
    """베지어 곡선 관. points는 (x, y, z) 목록, 각 점에 자동 핸들을 씁니다."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = 8
    cu.use_fill_caps = True
    cu.resolution_u = 32
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(points) - 1)
    for bp, co in zip(sp.bezier_points, points):
        bp.co = co
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    obj = link(bpy.data.objects.new(name, cu))
    obj.data.materials.append(material)
    return obj

def text3d(name, body, loc, size, material, extrude=0.04, rot=(math.radians(90), 0, 0)):
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = body
    cu.size = size
    cu.extrude = extrude
    cu.bevel_depth = 0.01
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    obj = link(bpy.data.objects.new(name, cu))
    obj.location = loc
    obj.rotation_euler = rot
    obj.data.materials.append(material)
    return obj

# ------------------------------------------------------------ keyframe helpers
def key(target, path, frame, value, interp="BEZIER", easing="AUTO", index=-1):
    setattr(target, path, value)
    target.keyframe_insert(path, frame=frame, index=index)
    ad = target.animation_data
    if ad and ad.action:
        for fc in ad.action.fcurves:
            if fc.data_path == path:
                for kp in fc.keyframe_points:
                    if abs(kp.co.x - frame) < 0.01:
                        kp.interpolation = interp
                        kp.easing = easing

def pop(obj, start, length=14, final=None):
    """0에서 살짝 넘쳤다가 제자리로: 블렌더의 BACK 보간."""
    final = tuple(final or obj.scale)
    key(obj, "scale", start, (0.0001,) * 3, "BACK", "EASE_OUT")
    key(obj, "scale", start + length, final, "BEZIER")

def grow_z(obj, start, length, final_z):
    key(obj, "scale", start, (1, 1, 0.0001), "BACK", "EASE_OUT")
    key(obj, "scale", start + length, (1, 1, final_z), "BEZIER")

def draw(curve_obj, start, length):
    cu = curve_obj.data
    key(cu, "bevel_factor_end", start, 0.0, "SINE", "EASE_IN_OUT")
    key(cu, "bevel_factor_end", start + length, 1.0, "SINE")

def move(obj, frames_values, interp="BEZIER"):
    for f, v in frames_values:
        key(obj, "location", f, v, interp)

# ---------------------------------------------------------------- floor/light
def floor_and_lights(target, cam_loc, lens=50, key_loc=(-6, -6, 9), ortho=None):
    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0))
    fl = bpy.context.active_object
    fl.name = "floor"
    fl.is_shadow_catcher = True

    def area(name, loc, energy, size, color):
        ld = bpy.data.lights.new(name, "AREA")
        ld.energy = energy
        ld.size = size
        ld.color = lin(color)[:3]
        ob = link(bpy.data.objects.new(name, ld))
        ob.location = loc
        ob.rotation_mode = "QUATERNION"
        ob.rotation_quaternion = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y")
        return ob

    area("key", key_loc, 1400, 6, "#fff1e2")
    area("fill", (8, -4, 4), 380, 8, "#ffe6d0")
    area("rim", (2, 8, 6), 650, 5, "#ffd2ad")

    cd = bpy.data.cameras.new("cam")
    cd.lens = lens
    if ortho:
        cd.type = "ORTHO"
        cd.ortho_scale = ortho
    cam = link(bpy.data.objects.new("cam", cd))
    cam.location = cam_loc
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = (Vector(target) - Vector(cam_loc)).to_track_quat("-Z", "Y")
    scene.camera = cam
    cd.dof.use_dof = False
    return cam

LABELS = {}
def label(name, co):
    LABELS[name] = co

# ============================================================== 1. 어텐션
def build_attention():
    # 문장 "고양이가 창가에서 잠들었다"에서 '잠들었다'(질의)가 앞 단어들을 얼마나 참고하는지.
    weights = [0.62, 0.14, 0.24]  # 설명용 예시 값 · 합계 1
    xs = [-2.5, 0.0, 2.5]
    query = Vector((0.0, 2.6, 4.3))
    sentence = rounded_box("sentence", (7.6, 1.9, 0.14), (0, 0, 0), M["cream"], 0.08)
    pop(sentence, 1, 14)
    for i, (x, w) in enumerate(zip(xs, weights)):
        tile = rounded_box(f"tile{i}", (2.1, 1.45, 0.2), (x, 0, 0.14), M["paper"], 0.1)
        pop(tile, 4 + i * 4, 14)
        h = 3.4 * w
        mat_ = M["orange"] if i == 0 else (M["amber"] if i == 2 else M["beige"])
        pillar = rounded_box(f"pillar{i}", (0.9, 0.9, 1.0), (x, 0.0, 0.34), mat_, 0.14)
        grow_z(pillar, 46 + i * 6, 26, h)
        top = Vector((x, 0.0, 0.34 + h + 0.05))
        # 질의 구에서 각 막대 꼭대기로 내려오는 관심 곡선. 굵기가 곧 비중입니다.
        mid = Vector((x * 0.55, 1.2, max(query.z, top.z) + 0.55))
        arc = tube(f"arc{i}", [query + Vector((x * 0.08, -0.3, -0.25)), mid, top], 0.02 + 0.12 * w,
                   M["orange"] if i == 0 else (M["amber"] if i == 2 else M["beige"]))
        draw(arc, 28 + i * 5, 24)
        label(f"word{i}", (x, -0.95, 0.2))
        label(f"weight{i}", (x, 0.0, 0.34 + h + 0.75))
    q = sphere("query", 0.62, query, M["orange_deep"])
    move(q, [(10, query + Vector((0, 0, 2.4))), (30, query)])
    pop(q, 10, 16)
    ring = tube("ring", [query + Vector((0.85 * math.cos(t), 0.85 * math.sin(t), -0.05)) for t in [k * math.pi / 4 for k in range(8)]], 0.035, M["amber"])
    ring.data.splines[0].use_cyclic_u = True
    pop(ring, 22, 12)
    label("query", (query.x, query.y, query.z + 1.15))
    return floor_and_lights(target=(-0.25, 0.7, 1.95), cam_loc=(2.3, -12.2, 7.0), lens=45)

# ============================================================== 2. 양자화
def build_quantization():
    L, H = 4.8, 2.4            # 실수 0.0→1.0 이 x 길이 L, 높이 H에 대응
    x0 = -L / 2
    ramp_y, step_y = 1.35, -0.95
    me = bpy.data.meshes.new("ramp")
    w = 1.1
    verts = [(x0, ramp_y - w / 2, 0), (x0 + L, ramp_y - w / 2, 0), (x0 + L, ramp_y + w / 2, 0), (x0, ramp_y + w / 2, 0),
             (x0 + L, ramp_y - w / 2, H), (x0 + L, ramp_y + w / 2, H)]
    faces = [(0, 1, 2, 3), (0, 4, 1), (3, 2, 5), (1, 4, 5, 2), (0, 3, 5, 4)]
    me.from_pydata(verts, [], faces)
    me.update()
    ramp = link(bpy.data.objects.new("ramp", me))
    bev = ramp.modifiers.new("bevel", "BEVEL")
    bev.width, bev.segments, bev.harden_normals = 0.05, 5, True
    for p in me.polygons:
        p.use_smooth = True
    ramp.data.materials.append(M["beige"])
    grow_z(ramp, 1, 20, 1.0)
    steps = [(0.0, 0.25, 0), (0.25, 0.75, 1), (0.75, 1.0, 2)]
    for i, (a, b, qv) in enumerate(steps):
        width = L * (b - a) - 0.1
        h = max(0.12, H * qv / 2)
        st = rounded_box(f"step{i}", (width, 1.15, 1.0), (x0 + L * (a + b) / 2, step_y, 0), M["orange"], 0.08)
        grow_z(st, 30 + i * 6, 22, h)
        label(f"step{i}", (x0 + L * (a + b) / 2, step_y - 0.6, h * 0.5))
    values = [0.0, 0.3, 0.5, 0.8, 1.0]
    r = 0.21
    for i, v in enumerate(values):
        qv = round(v / 0.5 + 1e-9)
        start = Vector((x0 + L * v + (0.25 if v == 0 else (-0.25 if v == 1 else 0)), ramp_y, H * max(v, 0.05) + r))
        if v == 0:
            start.z = r + 0.02
        end_h = max(0.12, H * qv / 2)
        end = Vector((start.x, step_y, end_h + r))
        rounded = v in (0.3, 0.8)
        ball = sphere(f"ball{i}", r, start, M["ink"] if not rounded else M["orange_deep"])
        pop(ball, 18 + i * 3, 12)
        t0 = 58 + i * 7
        apex = (start + end) / 2 + Vector((0, 0, 1.0))
        move(ball, [(t0, start), (t0 + 9, apex), (t0 + 18, end)], "SINE")
        # 원래 실수 자리를 작은 점으로 남겨 "어디에서 어디로" 옮겼는지 보이게 합니다.
        ghost = sphere(f"ghost{i}", 0.1, start - Vector((0, 0, r - 0.04)), M["muted"])
        pop(ghost, t0 + 2, 8)
        label(f"ball{i}", tuple(end + Vector((0, 0, 0.5))))
        label(f"real{i}", tuple(start + Vector((0, 0, 0.5))))
    label("ramp", (x0 + L * 0.5, ramp_y + 0.6, H * 0.5 + 0.9))
    return floor_and_lights(target=(0.1, 0.25, 0.95), cam_loc=(-3.6, -10.4, 8.4), lens=45)

# ============================================================== 3. RAG
def arrow(name, points, material, start, length=20, radius=0.06):
    """곡선 화살표: 관이 다 그려진 뒤 끝 방향 그대로 원뿔 머리가 튀어나옵니다."""
    pts = [Vector(p) for p in points]
    direction = (pts[-1] - pts[-2]).normalized()
    body = tube(name, [tuple(p) for p in pts[:-1]] + [tuple(pts[-1] - direction * 0.2)], radius, material)
    draw(body, start, length)
    head = cone(name + "_head", radius * 2.8, 0.38, pts[-1], material, direction)
    pop(head, start + length - 3, 8)
    return body

def build_rag():
    qloc = Vector((-3.75, 0.0, 1.35))
    bubble = sphere("question", 0.9, qloc, M["orange"])
    tail = cone("tail", 0.3, 0.55, qloc + Vector((0.45, -0.1, -0.85)), M["orange"], (0.45, 0, -1))
    mark = text3d("qmark", "?", qloc + Vector((0.12, -0.86, 0.0)), 1.05, M["paper"], 0.05,
                  rot=(math.radians(90), 0, math.radians(10)))
    for o in (bubble, tail, mark):
        pop(o, 1, 16)
    picks = {1, 4}
    xs = [-1.3 + i * 0.52 for i in range(6)]
    tray = rounded_box("tray", (3.5, 1.7, 0.2), (0.0, 0.0, 0.0), M["beige"], 0.08)
    pop(tray, 12, 14)
    for i, x in enumerate(xs):
        chosen = i in picks
        card = rounded_box(f"doc{i}", (0.13, 1.3, 1.6), (x, 0.0, 0.2), M["amber"] if chosen else M["paper"], 0.05)
        pop(card, 16 + i * 3, 12)
        for j in range(3):
            ln = rounded_box(f"doc{i}_l{j}", (0.03, 0.85 - j * 0.2, 0.08), (0, 0, 0),
                             M["orange_deep"] if chosen else M["line"], 0.015)
            ln.parent = card
            ln.location = (-0.075, -0.1 + j * 0.1, 1.2 - j * 0.3)
        if chosen:
            move(card, [(44 + i * 2, (x, 0, 0.2)), (62 + i * 2, (x, -0.45, 1.25))], "BACK")
            label(f"doc{i}", (x, -0.45, 1.25 + 1.95))
    aloc = Vector((3.6, 0.2, 0.0))
    ans = rounded_box("answer", (1.9, 0.18, 2.35), aloc, M["paper"], 0.1)
    ans.rotation_euler = (0, 0, math.radians(-14))
    pop(ans, 82, 16)
    for j, ln in enumerate((1.25, 1.05, 1.3, 0.75)):
        bar = rounded_box(f"ans_l{j}", (ln, 0.06, 0.11), (0, 0, 0), M["line"], 0.03)
        bar.parent = ans
        bar.location = (-0.2 - (1.3 - ln) / 2, -0.1, 1.45 - j * 0.28)
    for k in range(2):
        cite = rounded_box(f"cite{k}", (0.4, 0.07, 0.2), (0, 0, 0), M["amber"], 0.05)
        cite.parent = ans
        cite.location = (-0.55 + k * 0.5, -0.1, 0.3)
    badge = cylinder("badge", 0.34, 0.12, (0, 0, 0), M["orange_deep"], rot=(math.radians(90), 0, 0))
    badge.parent = ans
    badge.location = (0.62, -0.14, 1.98)
    chk = bpy.data.curves.new("check", "CURVE")
    chk.dimensions = "3D"
    chk.bevel_depth = 0.045
    chk.bevel_resolution = 6
    chk.use_fill_caps = True
    sp = chk.splines.new("POLY")
    sp.points.add(2)
    for pt, co in zip(sp.points, [(-0.15, 0, 0.0), (-0.04, 0, -0.12), (0.17, 0, 0.13)]):
        pt.co = (*co, 1)
    check = link(bpy.data.objects.new("check", chk))
    check.data.materials.append(M["paper"])
    check.parent = ans
    check.location = (0.62, -0.23, 1.98)
    pop(badge, 98, 12)
    pop(check, 102, 10)
    arrow("arrow1", [(-2.7, -0.3, 1.75), (-2.15, -0.55, 2.55), (-1.55, -0.35, 2.15)], M["orange_deep"], 18)
    arrow("arrow2", [(1.35, -0.45, 2.45), (2.0, -0.7, 3.05), (2.55, -0.45, 2.45)], M["orange_deep"], 66)
    label("question", (qloc.x, qloc.y, qloc.z + 1.45))
    label("shelf", (0.0, -1.0, -0.05))
    label("answer", (aloc.x, aloc.y, aloc.z + 2.95))
    return floor_and_lights(target=(0, 0, 1.3), cam_loc=(1.4, -12.6, 6.0), lens=47)

cam = {"attention": build_attention, "quantization": build_quantization, "rag": build_rag}[SCENE]()
scene.render.threads_mode = "AUTO"

# ------------------------------------------------------------- render/export
if MODE in ("preview", "still"):
    scene.frame_set(FRAMES)
    bpy.context.view_layer.update()
    projected = {}
    for name, co in LABELS.items():
        p = world_to_camera_view(scene, cam, Vector(co))
        projected[name] = {"x": round(p.x * 100, 2), "y": round((1 - p.y) * 100, 2)}
    with open(os.path.join(OUT, f"{SCENE}-labels.json"), "w") as fh:
        json.dump(projected, fh, ensure_ascii=False, indent=1)
    scene.render.filepath = os.path.join(OUT, f"{SCENE}-{MODE}.png")
    bpy.ops.render.render(write_still=True)
else:
    scene.frame_start = int(opts.get("--start", 1))
    scene.frame_end = int(opts.get("--end", FRAMES))
    scene.frame_step = int(opts.get("--step", 2))  # 점토 애니메이션처럼 2프레임마다 한 장(on twos)
    scene.render.filepath = os.path.join(OUT, f"{SCENE}-")
    bpy.ops.render.render(animation=True)
