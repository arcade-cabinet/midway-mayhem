/**
 * @module render/obstacles/__tests__/themedAssets.test
 *
 * Unit tests for the themedAssets obstacle→GLB mapping.
 *
 * Runs in the node project (no DOM, no GPU).
 * Tests:
 *   1. Every ObstacleKind has a valid entry in OBSTACLE_ASSETS.
 *   2. All file paths end in .glb and resolve under public/models/obstacles/.
 *   3. The corresponding files exist under public/models/obstacles/.
 *   4. scale is a positive finite number.
 *   5. yOffset is a finite number.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ObstacleKind } from '@/ecs/traits';
import { ALL_OBSTACLE_PATHS, OBSTACLE_ASSETS } from '../themedAssets';

const EXPECTED_KINDS: ObstacleKind[] = ['barrier', 'cone', 'gate', 'oil', 'hammer', 'critter'];

// Resolve public/ directory relative to this test file.
// Path: __tests__/ → obstacles/ → render/ → src/ → <project-root>/public/
const PUBLIC_DIR = path.resolve(__dirname, '../../../../public');
const OBSTACLES_DIR = path.join(PUBLIC_DIR, 'models', 'obstacles');

describe('OBSTACLE_ASSETS', () => {
  it('has an entry for every ObstacleKind', () => {
    for (const kind of EXPECTED_KINDS) {
      expect(OBSTACLE_ASSETS).toHaveProperty(kind);
    }
  });

  it('has no extra or unexpected keys', () => {
    const keys = Object.keys(OBSTACLE_ASSETS).sort();
    expect(keys).toEqual([...EXPECTED_KINDS].sort());
  });

  for (const kind of EXPECTED_KINDS) {
    it(`${kind}: path ends in .glb`, () => {
      expect(OBSTACLE_ASSETS[kind].path).toMatch(/\.glb$/);
    });

    it(`${kind}: path includes models/obstacles/`, () => {
      expect(OBSTACLE_ASSETS[kind].path).toContain('models/obstacles/');
    });

    it(`${kind}: scale is a positive finite number`, () => {
      const { scale } = OBSTACLE_ASSETS[kind];
      expect(typeof scale).toBe('number');
      expect(Number.isFinite(scale)).toBe(true);
      expect(scale).toBeGreaterThan(0);
    });

    it(`${kind}: yOffset is a finite number`, () => {
      const { yOffset } = OBSTACLE_ASSETS[kind];
      expect(typeof yOffset).toBe('number');
      expect(Number.isFinite(yOffset)).toBe(true);
    });

    it(`${kind}: GLB file exists under public/models/obstacles/`, () => {
      const filename = path.basename(OBSTACLE_ASSETS[kind].path);
      const fullPath = path.join(OBSTACLES_DIR, filename);
      expect(
        fs.existsSync(fullPath),
        `Expected ${fullPath} to exist. Run pnpm install and ensure NAS is mounted.`,
      ).toBe(true);
    });
  }

  it('ALL_OBSTACLE_PATHS has 6 entries, one per kind', () => {
    expect(ALL_OBSTACLE_PATHS).toHaveLength(EXPECTED_KINDS.length);
  });

  it('ALL_OBSTACLE_PATHS entries all end in .glb', () => {
    for (const p of ALL_OBSTACLE_PATHS) {
      expect(p).toMatch(/\.glb$/);
    }
  });
});
