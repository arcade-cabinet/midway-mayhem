"""
Midway Mayhem cockpit prototype builder (iter 3).

Fixes from iter2: camera to_track_quat uses ("-Z", "Z") to correctly map
image-up to world +Y in a Y-up scene (Blender defaults to Z-up).
"""

import bpy, bmesh, math, json, os, sys
from mathutils import Vector, Matrix, Quaternion

argv = sys.argv
argv = argv[argv.index("--") + 1 :] if "--" in argv else []
REPO_ROOT = argv[0] if argv else "/Users/jbogaty/src/arcade-cabinet/midway-mayhem"
OUT_DIR = os.path.join(REPO_ROOT, "scripts")
os.makedirs(OUT_DIR, exist_ok=True)


def hex_to_rgb(h):
    h = h.lstrip("#")
    r, g, b = int(h[0:2],16)/255, int(h[2:4],16)/255, int(h[4:6],16)/255
    def s(c): return c/12.92 if c <= 0.04045 else ((c+0.055)/1.055)**2.4
    return (s(r), s(g), s(b), 1.0)


def ensure_main_collection():
    return bpy.context.scene.collection


def wipe_scene():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    master = bpy.context.scene.collection
    def uc(c):
        for ch in list(c.children): uc(ch); c.children.unlink(ch)
    uc(master)
    for c in list(bpy.data.collections):
        try: bpy.data.collections.remove(c)
        except: pass
    for m in list(bpy.data.meshes): bpy.data.meshes.remove(m)
    for m in list(bpy.data.materials): bpy.data.materials.remove(m)
    for l in list(bpy.data.lights): bpy.data.lights.remove(l)
    for c in list(bpy.data.cameras): bpy.data.cameras.remove(c)
    for img in list(bpy.data.images):
        if img.users == 0: bpy.data.images.remove(img)


def mat_solid(name, hex_color, rough=0.5, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = hex_to_rgb(hex_color)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    return m


def mat_polka(name, base_hex, dot_hex, scale=8.0, dot_size=0.22,
              rough=0.55, metal=0.1):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nodes = nt.nodes; links = nt.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    tc = nodes.new("ShaderNodeTexCoord")
    mp = nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (scale, scale, scale)
    vo = nodes.new("ShaderNodeTexVoronoi")
    vo.feature = "F1"; vo.distance = "EUCLIDEAN"
    cr = nodes.new("ShaderNodeValToRGB")
    cr.color_ramp.elements[0].position = max(0.0, dot_size - 0.02)
    cr.color_ramp.elements[0].color = hex_to_rgb(dot_hex)
    cr.color_ramp.elements[1].position = dot_size
    cr.color_ramp.elements[1].color = hex_to_rgb(base_hex)
    links.new(tc.outputs["Generated"], mp.inputs["Vector"])
    links.new(mp.outputs["Vector"], vo.inputs["Vector"])
    links.new(vo.outputs["Distance"], cr.inputs["Fac"])
    links.new(cr.outputs["Color"], bsdf.inputs["Base Color"])
    return m


def _obj_from_bmesh(name, bm, loc=(0,0,0), rot=(0,0,0), scale=(1,1,1), mat=None):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    obj = bpy.data.objects.new(name, me)
    ensure_main_collection().objects.link(obj)
    obj.location = loc; obj.rotation_euler = rot; obj.scale = scale
    if mat: obj.data.materials.append(mat)
    for p in obj.data.polygons: p.use_smooth = True
    return obj


def build_capped_hemisphere(name, wx, dy, hz, seg=56, rings=24,
                            mat=None, loc=(0,0,0), rot=(0,0,0)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0,0,0),
                           plane_no=(0,1,0), clear_outer=True)
    open_edges = [e for e in bm.edges if e.is_boundary]
    if open_edges: bmesh.ops.edgeloop_fill(bm, edges=open_edges)
    for v in bm.verts:
        v.co.x *= wx; v.co.y *= dy; v.co.z *= hz
    return _obj_from_bmesh(name, bm, loc=loc, rot=rot, mat=mat)


def build_cylinder(name, r=0.05, d=1.0, seg=24, mat=None,
                   loc=(0,0,0), rot=(0,0,0)):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False,
                           segments=seg, radius1=r, radius2=r, depth=d)
    return _obj_from_bmesh(name, bm, loc=loc, rot=rot, mat=mat)


def _torus_bm(maj, mn, mjs, mns, a0=0.0, a1=None):
    if a1 is None: a1 = 2*math.pi
    full = abs(a1-a0) >= 2*math.pi - 1e-6
    bm = bmesh.new()
    rc = mjs if full else mjs + 1
    rings = []
    for i in range(rc):
        theta = (a0 + 2*math.pi*i/mjs) if full else (a0 + (a1-a0)*(i/(rc-1)))
        cx = math.cos(theta)*maj; cy = math.sin(theta)*maj
        ring = []
        for j in range(mns):
            phi = 2*math.pi*j/mns
            nx = math.cos(phi)*mn*math.cos(theta)
            ny = math.cos(phi)*mn*math.sin(theta)
            nz = math.sin(phi)*mn
            ring.append(bm.verts.new((cx+nx, cy+ny, nz)))
        rings.append(ring)
    bm.verts.ensure_lookup_table()
    for i in range(len(rings)):
        nx_i = (i+1) % len(rings)
        if not full and nx_i == 0: continue
        r0, r1 = rings[i], rings[nx_i]
        for k in range(mns):
            kn = (k+1) % mns
            bm.faces.new((r0[k], r1[k], r1[kn], r0[kn]))
    return bm


def build_torus(name, maj=1.0, mn=0.05, mjs=64, mns=16, mat=None,
                loc=(0,0,0), rot=(0,0,0), scale=(1,1,1)):
    return _obj_from_bmesh(name, _torus_bm(maj, mn, mjs, mns),
                            loc=loc, rot=rot, scale=scale, mat=mat)


def build_half_torus(name, maj=1.0, mn=0.05, mjs=64, mns=16, mat=None,
                     loc=(0,0,0), rot=(0,0,0)):
    bm = _torus_bm(maj, mn, mjs, mns, a0=0.0, a1=math.pi)
    boundary = [e for e in bm.edges if e.is_boundary]
    if boundary:
        bmesh.ops.holes_fill(bm, edges=boundary, sides=mns)
    return _obj_from_bmesh(name, bm, loc=loc, rot=rot, mat=mat)


def build_box(name, size=(1,1,1), mat=None, loc=(0,0,0), rot=(0,0,0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]; v.co.y *= size[1]; v.co.z *= size[2]
    return _obj_from_bmesh(name, bm, loc=loc, rot=rot, mat=mat)


def build_sphere(name, r=1.0, mat=None, loc=(0,0,0), scale=(1,1,1), rot=(0,0,0)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=r)
    return _obj_from_bmesh(name, bm, loc=loc, rot=rot, scale=scale, mat=mat)


def build_plane(name, size=(1,1), mat=None, loc=(0,0,0), rot=(0,0,0)):
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    for v in bm.verts: v.co.x *= size[0]; v.co.y *= size[1]
    return _obj_from_bmesh(name, bm, loc=loc, rot=rot, mat=mat)


def build_cylinder_sweep(name, r=1.0, height=0.6, arc_deg=140, seg=48,
                         mat=None, loc=(0,0,0), rot=(0,0,0)):
    bm = bmesh.new()
    arc = math.radians(arc_deg); half = arc*0.5
    rb = []; rt = []
    for i in range(seg+1):
        theta = -half + arc*i/seg
        x, y = math.cos(theta)*r, math.sin(theta)*r
        rb.append(bm.verts.new((x, y, -height*0.5)))
        rt.append(bm.verts.new((x, y, height*0.5)))
    bm.verts.ensure_lookup_table()
    for i in range(seg):
        bm.faces.new((rb[i], rb[i+1], rt[i+1], rt[i]))
    cb = bm.verts.new((0,0,-height*0.5))
    ct = bm.verts.new((0,0, height*0.5))
    for i in range(seg):
        bm.faces.new((cb, rb[i+1], rb[i]))
        bm.faces.new((ct, rt[i], rt[i+1]))
    return _obj_from_bmesh(name, bm, loc=loc, rot=rot, mat=mat)


# ======================================================================
# COCKPIT ASSEMBLY
# ======================================================================
wipe_scene(); ensure_main_collection()

M = {
    "hoodPolka":    mat_polka("hoodPolka", "#ffe4f2", "#ff2d87", 6.0, 0.24, 0.55, 0.05),
    "dashPolka":    mat_polka("dashPolka", "#fff1db", "#ff4fa3", 8.0, 0.22, 0.5, 0.05),
    "pillarPurple": mat_solid("pillarPurple", "#9c27b0", 0.4),
    "archYellow":   mat_solid("archYellow", "#ffd600", 0.35),
    "seatRed":      mat_solid("seatRed", "#c21a1a", 0.6),
    "seatPiping":   mat_solid("seatPiping", "#ffd600", 0.4),
    "chrome":       mat_solid("chrome", "#d8d8d8", 0.08, 0.98),
    "hornRed":      mat_solid("hornRed", "#e53935", 0.35),
    "gaugeFace":    mat_solid("gaugeFace", "#fff1db", 0.45),
    "gaugeNeedle":  mat_solid("gaugeNeedle", "#e53935", 0.4),
    "flowerCenter": mat_solid("flowerCenter", "#f4c430", 0.4),
    "flowerPetal":  mat_solid("flowerPetal", "#ff2d87", 0.45),
    "diceRed":      mat_solid("diceRed", "#e53935", 0.6),
    "diceBlue":     mat_solid("diceBlue", "#1e88e5", 0.6),
    "mirrorGlass":  mat_solid("mirrorGlass", "#aacbe3", 0.08, 0.9),
}

blueprint = {
    "cameraPosition": [0, 1.72, 1.55],
    "cameraTargetForward": [0, 1.72, 0],
    "cameraFov": {"horizontalDeg": 88, "near": 0.1, "far": 2000},
    "meshes": {},
    "materials": {
        "hoodPolka": {"baseColor":"#ffe4f2","dotColor":"#ff2d87","dotsPerSide":3,"roughness":0.55,"metalness":0.05},
        "dashPolka": {"baseColor":"#fff1db","dotColor":"#ff4fa3","dotsPerSide":4,"roughness":0.5,"metalness":0.05},
        "pillarPurple": {"baseColor":"#9c27b0","roughness":0.4,"metalness":0.0},
        "archYellow": {"baseColor":"#ffd600","roughness":0.35,"metalness":0.0},
        "seatRed": {"baseColor":"#c21a1a","roughness":0.6,"metalness":0.0},
        "seatPiping": {"baseColor":"#ffd600","roughness":0.4,"metalness":0.0},
        "chrome": {"baseColor":"#d8d8d8","roughness":0.08,"metalness":0.98},
        "hornRed": {"baseColor":"#e53935","roughness":0.35,"metalness":0.0},
        "gaugeFace": {"baseColor":"#fff1db","roughness":0.45,"metalness":0.0},
        "gaugeNeedle": {"baseColor":"#e53935","roughness":0.4,"metalness":0.0},
        "flowerCenter": {"baseColor":"#f4c430","roughness":0.4,"metalness":0.0},
        "flowerPetal": {"baseColor":"#ff2d87","roughness":0.45,"metalness":0.0},
        "diceRed": {"baseColor":"#e53935","roughness":0.6,"metalness":0.0},
        "diceBlue": {"baseColor":"#1e88e5","roughness":0.6,"metalness":0.0},
        "mirrorGlass": {"baseColor":"#aacbe3","roughness":0.08,"metalness":0.9},
    },
}
def record(name, entry): blueprint["meshes"][name] = entry


# ===== 1) HOOD (flat-backed hemisphere, extends along world -Z) =====
HOOD_BACK_Z = -0.3
HOOD_FRONT_Z = -2.8
HOOD_LEN = abs(HOOD_FRONT_Z - HOOD_BACK_Z)  # 2.4m
hood_width = 1.7
hood_height = 0.8
hood_center_y = 0.75  # center height of hood; top at y = 0.6 + 0.3 = 0.9
HOOD_ROT = (math.pi/2, 0, 0)
build_capped_hemisphere(
    "Hood",
    wx=hood_width*0.5, dy=HOOD_LEN, hz=hood_height*0.5,
    seg=64, rings=28, mat=M["hoodPolka"],
    loc=(0, hood_center_y, HOOD_BACK_Z), rot=HOOD_ROT,
)
record("hood", {
    "type": "cappedHemisphere",
    "position": [0, hood_center_y, HOOD_BACK_Z],
    "rotation": list(HOOD_ROT),
    "widthScale": hood_width*0.5,
    "depthScale": HOOD_LEN,
    "heightScale": hood_height*0.5,
    "frontTipZ": HOOD_FRONT_Z,
    "backCapZ": HOOD_BACK_Z,
    "materialRef": "hoodPolka",
    "note": "Flat-backed hemisphere; dome extends -Z after Rx(+pi/2).",
})


# ===== 2) DASHBOARD COWL =====
# Smaller, lower, tucked under the windshield opening. A cylinder sweep arcing
# around the steering column, with axis along world X.
dash_radius = 0.32
dash_width = 1.3
dash_center_y = 1.05
dash_center_z = -0.12
# Cylinder default axis = Z. We want axis = world X. Ry(π/2) maps local +Z to
# world -X. Let's use Ry(-π/2) which maps local +Z to world +X. Also need
# the arc opening to face UP-FORWARD so driver looks AT the cowl's convex surface
# from above. After Ry(-π/2), local +X (arc peak direction) -> world +Z (behind).
# That's backward. Try Ry(+π/2): local +Z -> world -X (axis X ok); local +X -> world -Z (forward peak).
# Arc opens toward the driver (peak points forward). Concave face = top of dash.
DASH_ROT = (0, math.pi/2, 0)
build_cylinder_sweep(
    "DashCowl",
    r=dash_radius, height=dash_width, arc_deg=160, seg=48,
    mat=M["dashPolka"],
    rot=DASH_ROT, loc=(0, dash_center_y, dash_center_z),
)
record("dashCowl", {
    "type": "cylinderSweep",
    "position": [0, dash_center_y, dash_center_z],
    "rotation": list(DASH_ROT),
    "radius": dash_radius,
    "widthAlongX": dash_width,
    "arcDeg": 160,
    "materialRef": "dashPolka",
})

# ===== 3) A-PILLARS =====
pillar_length = 1.1
pillar_radius = 0.05
pillar_tilt = math.radians(10)
pillar_x = 0.9
pillar_center_y = 1.35
pillar_z = -0.25
for side, sign in (("Left", -1), ("Right", 1)):
    rot = (math.pi/2, 0, sign*pillar_tilt)
    build_cylinder(f"Pillar{side}", r=pillar_radius, d=pillar_length, seg=20,
                   mat=M["pillarPurple"], rot=rot,
                   loc=(sign*pillar_x, pillar_center_y, pillar_z))
    record(f"pillar{side}", {
        "type":"cylinder",
        "position":[sign*pillar_x, pillar_center_y, pillar_z],
        "rotation":list(rot),"radius":pillar_radius,
        "length":pillar_length,"materialRef":"pillarPurple",
    })

# ===== 4) WINDSHIELD ARCH =====
# Half-torus in XY plane, arc 0..π, peak at (0, +major, 0). After no rotation,
# peak is at world +Y (up). Spans X from -major to +major.
arch_major = 0.88
arch_minor = 0.055
ARCH_POS = (0, 1.9, -0.35)
build_half_torus("WindshieldArch", maj=arch_major, mn=arch_minor,
                  mjs=64, mns=16, mat=M["archYellow"],
                  rot=(0,0,0), loc=ARCH_POS)
record("windshieldArch", {
    "type":"halfTorus","position":list(ARCH_POS),"rotation":[0,0,0],
    "majorRadius":arch_major,"minorRadius":arch_minor,
    "materialRef":"archYellow",
})

# ===== 5) BENCH SEAT =====
build_box("SeatBase", size=(1.4, 0.22, 0.6), mat=M["seatRed"],
          loc=(0, 0.55, 1.5))
record("seatBase", {"type":"box","size":[1.4,0.22,0.6],
                    "position":[0,0.55,1.5],"rotation":[0,0,0],
                    "materialRef":"seatRed"})
back_rot = (math.radians(-8), 0, 0)
build_box("SeatBack", size=(1.4, 0.85, 0.16), mat=M["seatRed"],
          loc=(0, 1.0, 1.72), rot=back_rot)
record("seatBack", {"type":"box","size":[1.4,0.85,0.16],
                    "position":[0,1.0,1.72],"rotation":list(back_rot),
                    "materialRef":"seatRed"})
build_cylinder("SeatPiping", r=0.025, d=1.4, seg=16, mat=M["seatPiping"],
               rot=(0, math.pi/2, 0), loc=(0, 1.4, 1.66))
record("seatPiping", {"type":"cylinder","radius":0.025,"length":1.4,
                      "position":[0,1.4,1.66],"rotation":[0,math.pi/2,0],
                      "materialRef":"seatPiping"})

# ===== 6) STEERING WHEEL =====
sw_pos = (0, 1.0, -0.1)
sw_rot_x = math.radians(36)  # top tilts toward driver
rx = sw_rot_x
wheel_major = 0.26
wheel_minor = 0.025
build_torus("WheelRim", maj=wheel_major, mn=wheel_minor, mjs=48, mns=16,
            mat=M["pillarPurple"], rot=(rx,0,0), loc=sw_pos)
record("wheelRim", {"type":"torus","majorRadius":wheel_major,
                    "minorRadius":wheel_minor,"position":list(sw_pos),
                    "rotation":[rx,0,0],"materialRef":"pillarPurple"})
build_cylinder("WheelHub", r=0.055, d=0.04, mat=M["chrome"],
               rot=(rx,0,0), loc=sw_pos)
record("wheelHub", {"type":"cylinder","radius":0.055,"length":0.04,
                    "position":list(sw_pos),"rotation":[rx,0,0],
                    "materialRef":"chrome"})
for i, tdeg in enumerate([0, 90, 180, 270]):
    theta = math.radians(tdeg)
    ml = Vector((math.cos(theta)*wheel_major*0.5,
                  math.sin(theta)*wheel_major*0.5, 0.0))
    my = ml.y*math.cos(rx) - ml.z*math.sin(rx)
    mz = ml.y*math.sin(rx) + ml.z*math.cos(rx)
    wp = (sw_pos[0]+ml.x, sw_pos[1]+my, sw_pos[2]+mz)
    sp = build_cylinder(f"WheelSpoke{i}", r=0.012, d=wheel_major, seg=12,
                         mat=M["chrome"], loc=wp)
    R = (Matrix.Rotation(rx,4,"X") @ Matrix.Rotation(theta,4,"Z") @
         Matrix.Rotation(math.pi/2,4,"Y"))
    sp.rotation_euler = R.to_euler()
    record(f"wheelSpoke{i}", {"type":"cylinder","radius":0.012,
                              "length":wheel_major,"position":list(wp),
                              "rotationEuler":list(R.to_euler()),
                              "materialRef":"chrome",
                              "note":f"Spoke at {tdeg}° in wheel-local plane"})
# Horn cap: slightly along wheel normal (toward driver)
norm = (0.0, -math.sin(rx), math.cos(rx))
ho = 0.022
hp = (sw_pos[0]+norm[0]*ho, sw_pos[1]+norm[1]*ho, sw_pos[2]+norm[2]*ho)
build_cylinder("HornCap", r=0.07, d=0.02, mat=M["hornRed"],
               rot=(rx,0,0), loc=hp)
record("hornCap", {"type":"cylinder","radius":0.07,"length":0.02,
                   "position":list(hp),"rotation":[rx,0,0],
                   "materialRef":"hornRed"})
rp = (sw_pos[0]+norm[0]*(ho+0.009),
      sw_pos[1]+norm[1]*(ho+0.009),
      sw_pos[2]+norm[2]*(ho+0.009))
build_torus("HornRing", maj=0.075, mn=0.008, mjs=32, mns=12,
            mat=M["chrome"], rot=(rx,0,0), loc=rp)
record("hornRing", {"type":"torus","majorRadius":0.075,"minorRadius":0.008,
                    "position":list(rp),"rotation":[rx,0,0],
                    "materialRef":"chrome"})
cl = 0.3
cp = (sw_pos[0]-norm[0]*cl*0.5, sw_pos[1]-norm[1]*cl*0.5, sw_pos[2]-norm[2]*cl*0.5)
build_cylinder("SteeringColumn", r=0.035, d=cl, mat=M["chrome"],
               rot=(rx,0,0), loc=cp)
record("steeringColumn", {"type":"cylinder","radius":0.035,"length":cl,
                          "position":list(cp),"rotation":[rx,0,0],
                          "materialRef":"chrome"})

# ===== 7) GAUGES =====
gauge_radius = 0.09
gauge_depth = 0.028
gauge_bezel_minor = 0.012
gauge_y = 1.12
gauge_z = -0.32
gfr = math.radians(-25)
for label, dx in (("LAUGHS", -0.3), ("FUN", 0.3)):
    build_cylinder(f"GaugeFace_{label}", r=gauge_radius, d=gauge_depth,
                   mat=M["gaugeFace"], rot=(gfr,0,0),
                   loc=(dx, gauge_y, gauge_z))
    record(f"gaugeFace_{label}", {"type":"cylinder","radius":gauge_radius,
                                   "length":gauge_depth,
                                   "position":[dx,gauge_y,gauge_z],
                                   "rotation":[gfr,0,0],
                                   "materialRef":"gaugeFace","label":label})
    fn = (0.0, -math.sin(gfr), math.cos(gfr))
    bp = (dx+fn[0]*(gauge_depth*0.5+0.002),
          gauge_y+fn[1]*(gauge_depth*0.5+0.002),
          gauge_z+fn[2]*(gauge_depth*0.5+0.002))
    build_torus(f"GaugeBezel_{label}", maj=gauge_radius, mn=gauge_bezel_minor,
                mjs=36, mns=12, mat=M["chrome"],
                rot=(gfr,0,0), loc=bp)
    record(f"gaugeBezel_{label}", {"type":"torus","majorRadius":gauge_radius,
                                    "minorRadius":gauge_bezel_minor,
                                    "position":list(bp),"rotation":[gfr,0,0],
                                    "materialRef":"chrome","label":label})
    nl = gauge_radius * 0.85
    fu = (0.0, math.cos(gfr), math.sin(gfr))
    nc = (dx+fu[0]*nl*0.4,
          gauge_y+fu[1]*nl*0.4,
          gauge_z+fu[2]*nl*0.4+fn[2]*0.015)
    build_box(f"GaugeNeedle_{label}",
              size=(0.01, nl, 0.004), mat=M["gaugeNeedle"],
              rot=(gfr,0,0), loc=nc)
    record(f"gaugeNeedle_{label}", {"type":"box","size":[0.01,nl,0.004],
                                     "position":list(nc),"rotation":[gfr,0,0],
                                     "materialRef":"gaugeNeedle",
                                     "label":label,"pointsUp":True})

# ===== 8) 8-PETAL FLOWER =====
# At hood front tip. Sit just above the surface at z=-2.6 (0.1m behind tip).
flower_z = -2.6
flower_y = 0.95  # just above hood top (hood center 0.6 + near-tip height ~0.1)
build_sphere("FlowerCenter", r=0.065, mat=M["flowerCenter"],
             loc=(0, flower_y, flower_z))
record("flowerCenter", {"type":"sphere","radius":0.065,
                        "position":[0, flower_y, flower_z],
                        "materialRef":"flowerCenter"})
ft = math.radians(-15)
for i in range(8):
    ang = 2*math.pi*i/8
    ldx = math.cos(ang)*0.13
    ldz = math.sin(ang)*0.13
    py = -ldz*math.sin(ft)
    pz = ldz*math.cos(ft)
    pp = (ldx, flower_y+py, flower_z+pz)
    pR = Matrix.Rotation(ft,4,"X") @ Matrix.Rotation(-ang,4,"Y")
    petal = build_sphere(f"FlowerPetal{i}", r=1.0, mat=M["flowerPetal"],
                         loc=pp, scale=(0.09, 0.035, 0.045))
    petal.rotation_euler = pR.to_euler()
    record(f"flowerPetal{i}", {"type":"sphere","position":list(pp),
                                "scale":[0.09,0.035,0.045],
                                "rotationEuler":list(pR.to_euler()),
                                "materialRef":"flowerPetal"})
build_cylinder("FlowerStem", r=0.018, d=0.2, mat=M["chrome"],
               rot=(math.pi/2,0,0),
               loc=(0, flower_y-0.1, flower_z))
record("flowerStem", {"type":"cylinder","radius":0.018,"length":0.2,
                      "position":[0, flower_y-0.1, flower_z],
                      "rotation":[math.pi/2,0,0],"materialRef":"chrome"})

# ===== 9) FUZZY DICE + STRINGS =====
mirror_pos = (0, 2.15, -0.25)
dice_top = (0.3, 2.1, -0.25)
dice_bot = (0.3, 1.65, -0.25)

def line_cyl(name, p0, p1, r, mat):
    p0v, p1v = Vector(p0), Vector(p1)
    mid = (p0v + p1v) * 0.5
    d = p1v - p0v; L = d.length; dn = d.normalized()
    z = Vector((0,0,1)); axis = z.cross(dn)
    q = Quaternion() if axis.length < 1e-6 else Quaternion(axis.normalized(), z.angle(dn))
    o = build_cylinder(name, r=r, d=L, seg=8, mat=mat, loc=tuple(mid))
    o.rotation_euler = q.to_euler()
    return o, L

sre = (dice_bot[0]-0.04, dice_bot[1]+0.1, dice_bot[2]-0.02)
sbe = (dice_bot[0]+0.04, dice_bot[1]+0.08, dice_bot[2]+0.02)
line_cyl("DiceStringRed", dice_top, sre, 0.006, M["chrome"])
line_cyl("DiceStringBlue", dice_top, sbe, 0.006, M["chrome"])
record("diceStringRed", {"type":"cylinder","radius":0.006,
                          "fromPos":list(dice_top),"toPos":list(sre),
                          "materialRef":"chrome"})
record("diceStringBlue", {"type":"cylinder","radius":0.006,
                           "fromPos":list(dice_top),"toPos":list(sbe),
                           "materialRef":"chrome"})

dsz = 0.16
for side, cm, off, tilt in (
    ("Red", "diceRed", (-0.05, 0, -0.04),
     (math.radians(15), math.radians(20), math.radians(8))),
    ("Blue", "diceBlue", (0.05, -0.05, 0.04),
     (math.radians(-10), math.radians(-18), math.radians(-5))),
):
    pos = (dice_bot[0]+off[0], dice_bot[1]+off[1], dice_bot[2]+off[2])
    build_box(f"Dice{side}", size=(dsz,dsz,dsz), mat=M[cm],
              loc=pos, rot=tilt)
    record(f"dice{side}", {"type":"box","size":[dsz,dsz,dsz],
                            "position":list(pos),"rotation":list(tilt),
                            "materialRef":cm})

# ===== 10) REAR-VIEW MIRROR =====
build_box("MirrorFrame", size=(0.42, 0.14, 0.02), mat=M["chrome"],
          loc=mirror_pos, rot=(math.radians(-12),0,0))
record("mirrorFrame", {"type":"box","size":[0.42,0.14,0.02],
                        "position":list(mirror_pos),
                        "rotation":[math.radians(-12),0,0],
                        "materialRef":"chrome"})
# Mirror glass plane — face oriented down-forward toward driver
build_plane("MirrorGlass", size=(0.38, 0.1), mat=M["mirrorGlass"],
            loc=(mirror_pos[0], mirror_pos[1]-0.008, mirror_pos[2]+0.012),
            rot=(math.radians(78), 0, 0))
record("mirrorGlass", {"type":"plane","size":[0.38,0.1],
                        "position":[mirror_pos[0],mirror_pos[1]-0.008,mirror_pos[2]+0.012],
                        "rotation":[math.radians(78),0,0],
                        "materialRef":"mirrorGlass"})
build_cylinder("MirrorStem", r=0.012, d=0.18, mat=M["chrome"],
               loc=(0, 2.05, -0.37),
               rot=(math.radians(35),0,0))
record("mirrorStem", {"type":"cylinder","radius":0.012,"length":0.18,
                       "position":[0,2.05,-0.37],
                       "rotation":[math.radians(35),0,0],
                       "materialRef":"chrome"})

# ---------- LIGHTING ----------
def add_area(n, loc, rot, en, sz, c=(1,1,1)):
    ld = bpy.data.lights.new(n, "AREA")
    ld.energy = en; ld.size = sz; ld.color = c
    o = bpy.data.objects.new(n, ld)
    ensure_main_collection().objects.link(o)
    o.location = loc; o.rotation_euler = rot
    return o

add_area("Key",   (2.5, 3.2, 0.5), (math.radians(-75), math.radians(20), 0), 500, 3.0, (1.0, 0.96, 0.88))
add_area("Fill",  (-2.5, 2.2, 1.2), (math.radians(-60), math.radians(-18), 0), 180, 3.0, (0.75, 0.8, 1.0))
add_area("Rim",   (0, 3.2, 2.5), (math.radians(-135), 0, 0), 300, 2.5, (1.0, 0.85, 0.75))
add_area("Front", (0, 1.8, -2.5), (math.radians(75), 0, 0), 200, 2.0, (1.0, 0.92, 0.85))

world = bpy.data.worlds["World"] if "World" in bpy.data.worlds else bpy.data.worlds.new("World")
bpy.context.scene.world = world; world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg:
    bg.inputs["Color"].default_value = (0.55, 0.52, 0.62, 1.0)
    bg.inputs["Strength"].default_value = 0.7


# ---------- CAMERAS ----------
def make_cam(name, loc, look_at, hfov_deg):
    d = bpy.data.cameras.new(name)
    d.sensor_width = 36
    d.lens = (36/2) / math.tan(math.radians(hfov_deg)/2)
    d.clip_start = 0.02; d.clip_end = 2000.0
    o = bpy.data.objects.new(name, d)
    ensure_main_collection().objects.link(o)
    o.location = loc
    dn = Vector(look_at) - Vector(loc)
    # Use ("-Z", "Z") so image-up maps to world +Y in Y-up scene (Blender default Z-up).
    o.rotation_euler = dn.to_track_quat("-Z", "Z").to_euler()
    return o


driver_cam = make_cam("DriverCam", (0, 1.72, 1.55), (0, 0.9, -2.5), hfov_deg=80)
external_cam = make_cam("ExternalCam", (3.5, 2.1, 2.8), (0, 1.1, -1.0), hfov_deg=55)


# ---------- RENDER ----------
scene = bpy.context.scene
engines = {e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items}
scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else \
                       ("BLENDER_EEVEE" if "BLENDER_EEVEE" in engines else "CYCLES")
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
views = {v.name for v in scene.view_settings.bl_rna.properties["view_transform"].enum_items}
scene.view_settings.view_transform = "AgX" if "AgX" in views else "Filmic"

scene.camera = driver_cam
scene.render.filepath = os.path.join(OUT_DIR, "cockpit-prototype-driver.png")
bpy.ops.render.render(write_still=True)

scene.camera = external_cam
scene.render.filepath = os.path.join(OUT_DIR, "cockpit-prototype-external.png")
bpy.ops.render.render(write_still=True)

with open(os.path.join(OUT_DIR, "cockpit-blueprint.json"), "w") as f:
    json.dump(blueprint, f, indent=2)

print("[cockpit-proto] DONE iter3")
