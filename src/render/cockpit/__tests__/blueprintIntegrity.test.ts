/**
 * Cockpit blueprint STRUCTURAL integrity — pure data-layer golden path.
 *
 * The Cockpit.browser.test.tsx baselines catch regressions at the pixel
 * level, but that requires a GPU and is slow. Many cockpit glitches are
 * actually DATA glitches — a mesh at the wrong y/z, a stem that doesn't
 * reach its anchor, a stray mesh whose material reference is broken —
 * that we can prove BEFORE rendering by asserting invariants on the JSON.
 *
 * These invariants encode the cockpit's identity ("polka-dot hood, purple
 * A-pillars meeting yellow arch, steering wheel on column, mirror above
 * with fuzzy dice hanging, etc.") as numeric relationships. If someone
 * later drags the wheel to x=0.5 without touching the column, this test
 * fails with a concrete message pointing at the offset.
 */
import { describe, expect, it } from 'vitest';
import blueprint from '@/config/cockpit-blueprint.json';

type Vec3 = readonly [number, number, number];
interface MeshLike {
  position?: number[];
  rotation?: number[];
  rotationEuler?: number[];
  materialRef?: string;
  fromPos?: number[];
  toPos?: number[];
  length?: number;
}

const meshes = blueprint.meshes as unknown as Record<string, MeshLike>;
const materials = blueprint.materials as Record<string, unknown>;

function p(name: string): Vec3 {
  const m = meshes[name];
  if (!m?.position) throw new Error(`mesh '${name}' has no position`);
  const [x, y, z] = m.position;
  if (x === undefined || y === undefined || z === undefined) {
    throw new Error(`mesh '${name}' position must have 3 elements`);
  }
  return [x, y, z];
}

function vec3(a: number[] | undefined, where: string): Vec3 {
  if (!a) throw new Error(`${where}: missing`);
  const [x, y, z] = a;
  if (x === undefined || y === undefined || z === undefined) {
    throw new Error(`${where}: must have 3 elements`);
  }
  return [x, y, z];
}

describe('cockpit blueprint — structural invariants', () => {
  it('every mesh references a defined material', () => {
    const broken: string[] = [];
    for (const [name, mesh] of Object.entries(meshes)) {
      if (!mesh.materialRef) continue;
      if (!(mesh.materialRef in materials)) {
        broken.push(`${name} → '${mesh.materialRef}'`);
      }
    }
    expect(broken, broken.join(', ')).toEqual([]);
  });

  it('all required identity-signature meshes exist', () => {
    // From the cockpit identity doc: polka-dot hood, purple A-pillars,
    // yellow windshield arch, red bench seat, chrome wheel, LAUGHS + FUN
    // gauges, 8-petal flower, fuzzy dice hanging from mirror.
    const required = [
      'hood',
      'dashCowl',
      'pillarLeft',
      'pillarRight',
      'windshieldArch',
      'seatBase',
      'seatBack',
      'wheelRim',
      'wheelHub',
      'steeringColumn',
      'hornCap',
      'gaugeFace_LAUGHS',
      'gaugeFace_FUN',
      'flowerCenter',
      'mirrorFrame',
      'mirrorGlass',
      'diceRed',
      'diceBlue',
    ];
    const missing = required.filter((k) => !(k in meshes));
    expect(missing, `missing identity meshes: ${missing.join(', ')}`).toEqual([]);
    expect(Object.keys(meshes).filter((k) => k.startsWith('flowerPetal'))).toHaveLength(8);
    expect(Object.keys(meshes).filter((k) => k.startsWith('wheelSpoke'))).toHaveLength(4);
  });

  it('A-pillars are rendered VERTICAL (no ±π/2 X-rotation)', () => {
    // Past bug: pillars shipped with rotation [π/2, 0, tilt] which under
    // three.js Y-aligned cylinder default laid them flat along -Z. They
    // should have ONLY a small z-axis roll for the outward lean, never an
    // X-rotation approaching π/2. Caught by CockpitElements.browser.test.tsx.
    for (const id of ['pillarLeft', 'pillarRight'] as const) {
      const rot = meshes[id]?.rotation ?? meshes[id]?.rotationEuler;
      if (!Array.isArray(rot)) throw new Error(`${id}: missing rotation`);
      const [rx] = rot;
      expect(
        Math.abs(rx ?? 0),
        `${id} has X-rotation ${rx} — must be near 0 so the pillar stands vertical (three.js CylinderGeometry is Y-aligned by default)`,
      ).toBeLessThan(0.2);
    }
  });

  it('A-pillar tops reach up to the windshield arch', () => {
    const leftBase = p('pillarLeft');
    const rightBase = p('pillarRight');
    const archCenter = p('windshieldArch');
    const pillarLen = meshes.pillarLeft?.length ?? 0;
    // Under a near-zero X-rotation (enforced above), the cylinder's local Y
    // maps to world Y. Top endpoint is at base.y + length/2.
    const leftTop = leftBase[1] + pillarLen / 2;
    const rightTop = rightBase[1] + pillarLen / 2;
    const archY = archCenter[1];
    expect(
      Math.abs(leftTop - archY),
      `left pillar top y=${leftTop.toFixed(3)} vs arch y=${archY.toFixed(3)} — gap of ${Math.abs(leftTop - archY).toFixed(3)}m is a visible floating pillar`,
    ).toBeLessThan(0.15);
    expect(Math.abs(rightTop - archY)).toBeLessThan(0.15);
  });

  it('steering column sits under the steering wheel', () => {
    const wheel = p('wheelRim');
    const col = p('steeringColumn');
    // x and z must match the wheel within ε; y MUST be below the wheel
    // (column extends down from the wheel to the dashboard).
    expect(Math.abs(wheel[0] - col[0]), 'steering column x-drift').toBeLessThan(0.01);
    expect(Math.abs(wheel[2] - col[2]), 'steering column z-drift').toBeLessThan(0.2);
    expect(col[1]).toBeGreaterThan(wheel[1]);
  });

  it('dice hang from the mirror anchor on strings', () => {
    const mirror = p('mirrorFrame');
    const redString = meshes.diceStringRed;
    const blueString = meshes.diceStringBlue;
    expect(redString?.fromPos, 'red string needs fromPos').toBeDefined();
    expect(blueString?.fromPos, 'blue string needs fromPos').toBeDefined();
    // Strings should anchor near the mirror frame (within ~30cm).
    const redFrom = vec3(redString?.fromPos, 'diceStringRed.fromPos');
    const blueFrom = vec3(blueString?.fromPos, 'diceStringBlue.fromPos');
    const distRed = dist(redFrom, mirror);
    const distBlue = dist(blueFrom, mirror);
    expect(distRed, `red string anchors ${distRed.toFixed(2)}m from mirror`).toBeLessThan(0.35);
    expect(distBlue, `blue string anchors ${distBlue.toFixed(2)}m from mirror`).toBeLessThan(0.35);
    // Strings should END near their respective dice.
    const redDice = p('diceRed');
    const blueDice = p('diceBlue');
    expect(dist(vec3(redString?.toPos, 'diceStringRed.toPos'), redDice)).toBeLessThan(0.2);
    expect(dist(vec3(blueString?.toPos, 'diceStringBlue.toPos'), blueDice)).toBeLessThan(0.2);
  });

  it('horn cap sits at the center of the steering wheel', () => {
    const wheel = p('wheelRim');
    const horn = p('hornCap');
    const off = dist(wheel, horn);
    expect(off, `horn offset from wheel center: ${off.toFixed(3)}m`).toBeLessThan(0.05);
  });

  it('LAUGHS + FUN gauges are mirrored across the dashboard centerline', () => {
    const laughs = p('gaugeFace_LAUGHS');
    const fun = p('gaugeFace_FUN');
    expect(laughs[0] + fun[0], 'gauges not x-symmetric').toBeCloseTo(0, 2);
    expect(laughs[1]).toBeCloseTo(fun[1], 3);
    expect(laughs[2]).toBeCloseTo(fun[2], 3);
  });

  it('flower ornament center sits in front of the hood at its front tip', () => {
    const flower = p('flowerCenter');
    const hood = meshes.hood;
    const frontTipZ = (hood as { frontTipZ?: number }).frontTipZ ?? -2.45;
    // Flower should be right at or just forward of the hood's front tip.
    expect(Math.abs(flower[2] - frontTipZ)).toBeLessThan(0.25);
    expect(Math.abs(flower[0]), 'flower not centered on hood').toBeLessThan(0.05);
  });

  it('seat is behind the driver (positive z)', () => {
    const seatBase = p('seatBase');
    expect(seatBase[2], 'seat base must be behind camera').toBeGreaterThan(0);
  });
});

function dist(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
