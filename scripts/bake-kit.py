"""
Bake Kenney Racing Kit → Midway Mayhem branded GLBs.

Runs in Blender (via Blender MCP or `blender --background --python bake-kit.py`).
For each source GLB in the Kenney Racing Kit, remap the built-in Kenney materials
(road, grey, grass, red, sand, wall, white, _defaultMat, *.NNN) to the Midway
Mayhem palette and export to public/models/.

Input dir:  /Volumes/home/assets/3DLowPoly/Vehicles/Cars/Racing Kit/
Output dir: <repo>/public/models/

Run from Claude Code:
  mcp__blender__execute_blender_code with the contents of this file.

Or from CLI:
  blender --background --python scripts/bake-kit.py
"""

import os
import sys
import re
import glob
from pathlib import Path

try:
    import bpy
except ImportError:
    print("This script must run inside Blender.", file=sys.stderr)
    sys.exit(1)

# ── Config ──────────────────────────────────────────────────────────────
KIT_DIR = "/Volumes/home/assets/3DLowPoly/Vehicles/Cars/Racing Kit"
REPO_ROOT = Path("/Users/jbogaty/src/arcade-cabinet/midway-mayhem")
OUT_DIR = REPO_ROOT / "public" / "models"

# Brand palette — mirrors src/utils/constants.ts exactly
PALETTE = {
    "track_orange":    (0.95, 0.43, 0.13, 1.0),
    "marking_white":   (0.98, 0.98, 0.96, 1.0),
    "shoulder_purple": (0.29, 0.10, 0.41, 1.0),
    "rail_red":        (0.90, 0.22, 0.21, 1.0),
    "rail_blue":       (0.12, 0.53, 0.90, 1.0),
    "rail_yellow":     (1.00, 0.84, 0.00, 1.0),
    "wall_dark":       (0.07, 0.03, 0.09, 1.0),
}

# Map Kenney material name prefix → palette key + (roughness, metalness)
#                                                    rough  metal
REMAP = [
    # `road` is the main paved road surface (65% area) → Hot Wheels orange
    (re.compile(r"^road", re.I),   "track_orange",    0.38, 0.10),
    # `grey` is the raised curb edges along road — use rail yellow for pop
    (re.compile(r"^grey", re.I),   "rail_yellow",     0.40, 0.10),
    # `grass`/`sand` are off-road shoulders → deep purple (Funhouse Frenzy)
    (re.compile(r"^grass", re.I),  "shoulder_purple", 0.55, 0.00),
    (re.compile(r"^sand", re.I),   "shoulder_purple", 0.60, 0.00),
    # white dashes stay white
    (re.compile(r"^white", re.I),  "marking_white",   0.45, 0.00),
    # red/blue/yellow variant hits
    (re.compile(r"^red", re.I),    "rail_red",        0.30, 0.15),
    (re.compile(r"yellow", re.I),  "rail_yellow",     0.38, 0.10),
    (re.compile(r"blue", re.I),    "rail_blue",       0.38, 0.10),
    (re.compile(r"green", re.I),   "shoulder_purple", 0.55, 0.00),
    # walls, chrome, checkers
    (re.compile(r"^wall", re.I),   "wall_dark",       0.70, 0.00),
    (re.compile(r"checker", re.I), "marking_white",   0.40, 0.00),
    (re.compile(r"chrome", re.I),  "marking_white",   0.10, 1.00),
    # _defaultMat fallback → track orange (corners' main surface)
    (re.compile(r"^_default", re.I), "track_orange",  0.38, 0.10),
]

# Pieces to bake → which files end up in public/models/
SOURCE_FILES = [
    # Track pieces (load-bearing — composer uses these)
    "roadStart.glb",
    "roadStraight.glb",
    "roadStraightLong.glb",
    "roadStraightArrow.glb",
    "roadEnd.glb",
    "roadCornerLarge.glb",
    "roadCornerLarger.glb",
    "roadCornerSmall.glb",
    "roadRamp.glb",
    "roadRampLong.glb",
    "roadRampLongCurved.glb",
    "roadCurved.glb",
    # Roadside props
    "barrierRed.glb",
    "barrierWhite.glb",
    "barrierWall.glb",
    "tent.glb",
    "tentClosed.glb",
    "bannerTowerRed.glb",
    "bannerTowerGreen.glb",
    "flagCheckers.glb",
    "flagRed.glb",
    "flagGreen.glb",
    "lightPostLarge.glb",
    "lightRed.glb",
    "grandStand.glb",
    "grandStandCovered.glb",
    "billboard.glb",
    "billboardLower.glb",
    "pylon.glb",
    "overheadRoundColored.glb",
    "overheadLights.glb",
]


# ── Helpers ──────────────────────────────────────────────────────────────

def wipe_scene() -> None:
    """Clear all scene data — repeatable per piece."""
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)
    for img in list(bpy.data.images):
        bpy.data.images.remove(img)


def build_mm_material(palette_key: str, roughness: float, metalness: float) -> "bpy.types.Material":
    """Create a fresh MeshStandardMaterial equivalent. Cached by palette key."""
    name = f"mm_{palette_key}"
    existing = bpy.data.materials.get(name)
    if existing is not None:
        return existing

    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)

    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf.inputs["Base Color"].default_value = PALETTE[palette_key]
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metalness
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def pick_palette(source_name: str) -> tuple[str, float, float]:
    for pattern, key, rough, metal in REMAP:
        if pattern.search(source_name):
            return key, rough, metal
    # default — track orange
    return "track_orange", 0.38, 0.1


def retexture_all_slots() -> int:
    """Reassign every material slot on every mesh to an mm_* material. Returns count."""
    count = 0
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        for slot in obj.material_slots:
            orig_name = slot.material.name if slot.material else ""
            key, rough, metal = pick_palette(orig_name)
            slot.material = build_mm_material(key, rough, metal)
            count += 1
    return count


def bake_piece(source_file: str) -> Path:
    src = Path(KIT_DIR) / source_file
    if not src.exists():
        raise FileNotFoundError(f"Kit source missing: {src}")

    wipe_scene()
    bpy.ops.import_scene.gltf(filepath=str(src))
    slot_count = retexture_all_slots()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / source_file
    bpy.ops.export_scene.gltf(
        filepath=str(out),
        export_format="GLB",
        export_apply=False,
        export_yup=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        use_selection=False,
    )
    print(f"[bake] {source_file}  slots={slot_count}  →  {out}")
    return out


# ── Entry point ──────────────────────────────────────────────────────────

def main() -> None:
    print(f"[bake-kit] input  = {KIT_DIR}")
    print(f"[bake-kit] output = {OUT_DIR}")
    print(f"[bake-kit] {len(SOURCE_FILES)} pieces to bake")

    baked = []
    missing = []
    for name in SOURCE_FILES:
        try:
            baked.append(bake_piece(name))
        except FileNotFoundError as e:
            missing.append(name)
            print(f"[bake-kit] MISSING: {e}", file=sys.stderr)

    print(f"[bake-kit] done — {len(baked)} baked, {len(missing)} missing")
    if missing:
        sys.exit(1)


if __name__ == "__main__":
    main()
