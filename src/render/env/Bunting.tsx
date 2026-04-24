/**
 * Bunting — procedural triangle-pennant streamers strung between dome rafters.
 *
 * 8 strands of Catmull-Rom curved bunting run between rafter anchor pairs
 * around the big-top dome. Each strand has a 2m sag curve, with triangle
 * pennants instanced every 1.5m along the arc. Pennant colors cycle through
 * the 4-color brand palette.
 *
 * Drop this OUTSIDE the WorldScroller so the decorations are world-static:
 *   <Suspense fallback={null}>
 *     <BigTopEnvironment />
 *     <Audience />
 *     <Bunting />   ← here, sibling of Audience
 *   </Suspense>
 *
 * Geometry is computed once at mount via useMemo. No per-frame updates —
 * the pennants are purely static decoration.
 */

import { useMemo } from 'react';
import * as THREE from 'three';

// ─── Brand palette ────────────────────────────────────────────────────────────

/** 4-color cycling palette for pennant colors (brand: Red, Yellow, Blue, Purple). */
const BUNTING_PALETTE: readonly string[] = [
  '#E53935', // Red
  '#FFD600', // Yellow
  '#1E88E5', // Blue
  '#8E24AA', // Purple
] as const;

// ─── Constants ────────────────────────────────────────────────────────────────

/** Number of strands strung around the dome. */
export const STRAND_COUNT = 8;

/** Approximate y of dome rafters (world-space metres). */
const RAFTER_Y = 48;

/** Sag amount — the midpoint of each strand drops this many metres below the endpoints. */
const SAG_M = 2;

/** Spacing between pennants along the strand arc (metres). */
const PENNANT_SPACING_M = 1.5;

/** Radius of the rafter ring. Rafters at ~80% of dome inner wall. */
const RAFTER_RING_R = 55;

/** Triangle pennant dimensions (half-width, height). */
const PENNANT_HALF_W = 0.4;
const PENNANT_HEIGHT = 0.7;

/** Number of arc sample points per strand (controls curve smoothness). */
const ARC_SAMPLES = 60;

// ─── Geometry helpers ─────────────────────────────────────────────────────────

/** Catmull-Rom curve: P0, midSag (control), P1 → uniform parameterization. */
function sampleCatmullRomArc(
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  sagM: number,
  samples: number,
): THREE.Vector3[] {
  // Midpoint of the two anchor endpoints, then drop by sagM.
  const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
  mid.y -= sagM;

  // CatmullRomCurve3 uses a phantom control point scheme. We build a 3-point
  // curve: p0, mid, p1. The "catmullrom" type interpolates through all three.
  const curve = new THREE.CatmullRomCurve3([p0.clone(), mid, p1.clone()], false, 'catmullrom');
  return curve.getPoints(samples - 1);
}

/** Compute arc length of a sampled polyline. */
function arcLength(points: THREE.Vector3[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += points[i]!.distanceTo(points[i - 1]!);
  }
  return len;
}

interface PennantTransform {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  color: THREE.Color;
}

/**
 * Given an arc (array of sampled points), distribute pennants at regular
 * intervals along the arc. Returns position + orientation for each pennant.
 */
function computePennantTransforms(
  arc: THREE.Vector3[],
  spacingM: number,
  paletteColors: THREE.Color[],
  paletteOffset: number,
): PennantTransform[] {
  const total = arcLength(arc);
  const count = Math.max(1, Math.floor(total / spacingM));
  const result: PennantTransform[] = [];

  let distAccum = 0;
  let arcIdx = 0;
  let nextTarget = spacingM * 0.5; // Start slightly in so pennant is not right at anchor

  while (nextTarget <= total && result.length < count) {
    // Advance along arc until we reach nextTarget arc distance.
    while (arcIdx + 1 < arc.length) {
      const seg = arc[arcIdx]!.distanceTo(arc[arcIdx + 1]!);
      if (distAccum + seg >= nextTarget) {
        const t = (nextTarget - distAccum) / seg;
        const pos = new THREE.Vector3().lerpVectors(arc[arcIdx]!, arc[arcIdx + 1]!, t);

        // Tangent direction along the arc.
        const tangent = new THREE.Vector3().subVectors(arc[arcIdx + 1]!, arc[arcIdx]!).normalize();

        // Pennant hangs down from the strand — orient so the pennant plane
        // faces the center and the triangle points downward. Build a rotation
        // that aligns the pennant's local +Y with -world.y and the pennant face
        // with the tangent direction.
        const up = new THREE.Vector3(0, -1, 0);
        const right = tangent.clone().cross(up).normalize();
        const corrected = up.clone().cross(right).normalize();
        const mat3 = new THREE.Matrix3().set(
          right.x,
          corrected.x,
          tangent.x,
          right.y,
          corrected.y,
          tangent.y,
          right.z,
          corrected.z,
          tangent.z,
        );
        const q = new THREE.Quaternion().setFromRotationMatrix(
          new THREE.Matrix4().setFromMatrix3(mat3),
        );

        const colorIdx = (result.length + paletteOffset) % paletteColors.length;
        result.push({ position: pos, quaternion: q, color: paletteColors[colorIdx]! });
        nextTarget += spacingM;
        break;
      }
      distAccum += seg;
      arcIdx++;
    }
    // Safety: break if we ran past the end without advancing.
    if (arcIdx + 1 >= arc.length) break;
  }

  return result;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Bunting() {
  // Pre-bake palette colors once at module evaluation time.
  const paletteColors = useMemo(() => BUNTING_PALETTE.map((hex) => new THREE.Color(hex)), []);

  // Triangle pennant geometry — an isoceles triangle pointing downward.
  // ShapeGeometry from a THREE.Shape so it is a flat filled triangle.
  const pennantGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-PENNANT_HALF_W, 0);
    shape.lineTo(PENNANT_HALF_W, 0);
    shape.lineTo(0, -PENNANT_HEIGHT);
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, []);

  // Compute all rafter anchor pairs and the pennant transforms for all strands.
  const { transforms, totalPennants } = useMemo(() => {
    const allTransforms: PennantTransform[] = [];

    for (let s = 0; s < STRAND_COUNT; s++) {
      // Compute the two anchor endpoints — evenly spaced around the rafter ring,
      // each strand spans ~90° of arc (every other pair), giving 8 strands that
      // criss-cross around the dome symmetrically.
      const angleA = (s / STRAND_COUNT) * Math.PI * 2;
      const angleB = ((s + 1) / STRAND_COUNT) * Math.PI * 2;

      const p0 = new THREE.Vector3(
        Math.cos(angleA) * RAFTER_RING_R,
        RAFTER_Y,
        Math.sin(angleA) * RAFTER_RING_R,
      );
      const p1 = new THREE.Vector3(
        Math.cos(angleB) * RAFTER_RING_R,
        RAFTER_Y,
        Math.sin(angleB) * RAFTER_RING_R,
      );

      const arc = sampleCatmullRomArc(p0, p1, SAG_M, ARC_SAMPLES);
      const pennants = computePennantTransforms(arc, PENNANT_SPACING_M, paletteColors, s);
      allTransforms.push(...pennants);
    }

    return { transforms: allTransforms, totalPennants: allTransforms.length };
  }, [paletteColors]);

  // Build a single InstancedMesh for all pennants across all strands.
  const { instancedMesh } = useMemo(() => {
    if (totalPennants === 0) return { instancedMesh: null };

    const material = new THREE.MeshStandardMaterial({
      roughness: 0.8,
      metalness: 0.0,
      side: THREE.DoubleSide,
      vertexColors: true,
    });

    const mesh = new THREE.InstancedMesh(pennantGeometry, material, totalPennants);
    mesh.frustumCulled = false;

    const mat4 = new THREE.Matrix4();
    const scaleVec = new THREE.Vector3(1, 1, 1);

    for (let i = 0; i < totalPennants; i++) {
      const t = transforms[i]!;
      mat4.compose(t.position, t.quaternion, scaleVec);
      mesh.setMatrixAt(i, mat4);
      mesh.setColorAt(i, t.color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    return { instancedMesh: mesh };
  }, [pennantGeometry, transforms, totalPennants]);

  if (!instancedMesh) return null;

  return <primitive object={instancedMesh} />;
}
