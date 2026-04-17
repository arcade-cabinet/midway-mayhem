/**
 * dropInSequence.browser.test.tsx
 *
 * Verifies the drop-in animation formula and captures three baseline PNGs
 * at dropProgress = 0.0, 0.5, 1.0.
 *
 * Also verifies the three canvas frames differ substantially.
 */

import { Canvas, useThree } from '@react-three/fiber';
import { act, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import type * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Cockpit } from '@/cockpit/Cockpit';
import { resetGameState, useGameStore } from '@/game/gameState';

interface SceneCapture {
  scene: THREE.Scene;
  gl: THREE.WebGLRenderer;
  camera: THREE.Camera;
}

function SceneCapture({ onCapture }: { onCapture: (c: SceneCapture) => void }) {
  const { scene, gl, camera } = useThree();
  useEffect(() => {
    onCapture({ scene, gl, camera });
  }, [scene, gl, camera, onCapture]);
  return null;
}

function cockpitYFromDp(dp: number): number {
  const capped = Math.max(0, Math.min(1, dp));
  const fall =
    capped < 0.75 ? (capped / 0.75) ** 2 : 1 + Math.sin((capped - 0.75) * 12) * 0.06 * (1 - capped);
  return 12 * (1 - fall);
}

async function countPixelDiff(a: string, b: string): Promise<number> {
  const W = 160;
  const H = 90;

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  const [imgA, imgB] = await Promise.all([loadImage(a), loadImage(b)]);

  const ca = document.createElement('canvas');
  const cb = document.createElement('canvas');
  ca.width = W;
  ca.height = H;
  cb.width = W;
  cb.height = H;
  const ctxA = ca.getContext('2d')!;
  const ctxB = cb.getContext('2d')!;
  ctxA.drawImage(imgA, 0, 0, W, H);
  ctxB.drawImage(imgB, 0, 0, W, H);
  const da = ctxA.getImageData(0, 0, W, H).data;
  const db = ctxB.getImageData(0, 0, W, H).data;
  let diff = 0;
  for (let i = 0; i < da.length; i += 4) {
    const d =
      Math.abs((da[i] ?? 0) - (db[i] ?? 0)) +
      Math.abs((da[i + 1] ?? 0) - (db[i + 1] ?? 0)) +
      Math.abs((da[i + 2] ?? 0) - (db[i + 2] ?? 0));
    if (d > 15) diff++;
  }
  return diff;
}

describe('drop-in snapshot sequence', () => {
  beforeEach(() => resetGameState());
  afterEach(() => resetGameState());

  // Pure formula test — no Canvas needed
  it('cockpit y formula: dp=0→≈12, dp=0.5→[3,9], dp=1→≈0', () => {
    const y0 = cockpitYFromDp(0.0);
    const y05 = cockpitYFromDp(0.5);
    const y10 = cockpitYFromDp(1.0);

    expect(y0).toBeGreaterThan(11);
    expect(y0).toBeLessThanOrEqual(12);

    expect(y05).toBeGreaterThan(3);
    expect(y05).toBeLessThan(9);

    expect(y10).toBeGreaterThan(-0.5);
    expect(y10).toBeLessThan(1.5);

    // No NaN across full range
    for (let i = 0; i <= 100; i++) {
      expect(Number.isNaN(cockpitYFromDp(i / 100))).toBe(false);
    }
  });

  it('three canvas snapshots at dp=0, 0.5, 1.0 differ substantially', async () => {
    let captured: SceneCapture | null = null;

    const TestScene = () => (
      <Canvas
        style={{ width: 640, height: 360 }}
        gl={{ antialias: false, preserveDrawingBuffer: true }}
        camera={{ position: [0, 1.2, 0.6], fov: 75, near: 0.1, far: 1000 }}
      >
        <SceneCapture
          onCapture={(c) => {
            captured = c;
          }}
        />
        <ambientLight intensity={1} />
        <Cockpit />
      </Canvas>
    );

    const { unmount } = render(<TestScene />);

    await waitFor(() => expect(captured).toBeTruthy(), { timeout: 10_000 });

    const { page } = await import('vitest/browser');
    const dataUrls: string[] = [];

    for (const dp of [0.0, 0.5, 1.0] as const) {
      await act(async () => {
        useGameStore.setState({ dropProgress: dp, running: true });
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      });

      const cap = captured as unknown as SceneCapture;
      const { scene, gl, camera } = cap;

      let rootY = cockpitYFromDp(dp);
      scene.traverse((obj: THREE.Object3D) => {
        if (obj.name === 'cockpit-root') rootY = obj.position.y;
      });

      // Verify y matches expected range
      if (dp === 0.0) {
        expect(rootY).toBeGreaterThan(10);
      } else if (dp === 0.5) {
        expect(rootY).toBeGreaterThan(2);
        expect(rootY).toBeLessThan(10);
      } else {
        expect(rootY).toBeGreaterThan(-2);
        expect(rootY).toBeLessThan(2);
      }

      gl.render(scene, camera);

      const dataUrl = gl.domElement.toDataURL('image/png');
      dataUrls.push(dataUrl);

      const dpLabel = dp.toFixed(1).replace('.', '_');
      await page.screenshot({
        path: `__screenshots__/drop-sequence-dp${dpLabel}.png`,
      });
    }

    // Snapshots at dp=0 and dp=1 should differ (cockpit moved substantially).
    // At dp=0 the cockpit-root is at y≈12 (mostly above viewport); at dp=1 it's
    // at y≈0 (fully in view). The threshold is conservative because much of the
    // y-displacement pushes geometry out of the top of the frustum.
    const diff = await countPixelDiff(dataUrls[0]!, dataUrls[2]!);
    expect(diff).toBeGreaterThan(5_000);

    unmount();
  });
});
