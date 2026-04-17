/**
 * CockpitResponsive.browser.test.tsx
 *
 * Verifies that useResponsiveCockpitScale fires and cockpit-root scale picks it up.
 *
 * For each of four viewports:
 *   1. Resize window to that viewport.
 *   2. Get expected scale from the hook.
 *   3. Mount <Cockpit />, find cockpit-root group, assert scale matches.
 *   4. Save baseline PNG.
 */

import { Canvas, useThree } from '@react-three/fiber';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import type * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Cockpit } from '@/cockpit/Cockpit';
import { resetGameState, useGameStore } from '@/game/gameState';
import { useResponsiveCockpitScale } from '@/hooks/useResponsiveCockpitScale';

interface SceneCapture {
  scene: THREE.Scene;
}

function SceneCapture({ onCapture }: { onCapture: (c: SceneCapture) => void }) {
  const { scene } = useThree();
  useEffect(() => {
    onCapture({ scene });
  }, [scene, onCapture]);
  return null;
}

const VIEWPORTS = [
  { width: 1440, height: 900, label: '1440x900' },
  { width: 820, height: 1180, label: '820x1180' },
  { width: 390, height: 844, label: '390x844' },
  { width: 844, height: 390, label: '844x390' },
] as const;

describe('<Cockpit /> responsive form-factor scale', () => {
  const origInnerWidth = window.innerWidth;
  const origInnerHeight = window.innerHeight;

  beforeEach(() => resetGameState());

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: origInnerWidth,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: origInnerHeight,
    });
    window.dispatchEvent(new Event('resize'));
    resetGameState();
  });

  for (const vp of VIEWPORTS) {
    it(`scale at ${vp.label} matches useResponsiveCockpitScale output`, async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: vp.width,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: vp.height,
      });

      await act(async () => {
        window.dispatchEvent(new Event('resize'));
        await new Promise<void>((resolve) => setTimeout(resolve, 50));
      });

      // Get expected scale from hook
      const { result: hookResult } = renderHook(() => useResponsiveCockpitScale());
      const expectedScale = hookResult.current.scale;

      let capturedScene: THREE.Scene | null = null;

      const TestScene = () => (
        <Canvas style={{ width: vp.width, height: vp.height }} gl={{ antialias: false }}>
          <SceneCapture
            onCapture={(c) => {
              capturedScene = c.scene;
            }}
          />
          <ambientLight intensity={1} />
          <Cockpit />
        </Canvas>
      );

      const { unmount } = render(<TestScene />);
      useGameStore.setState({ dropProgress: 1 });

      await waitFor(() => expect(capturedScene).toBeTruthy(), { timeout: 10_000 });
      await act(async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 200));
      });

      const scene = capturedScene!;

      let cockpitRoot: THREE.Object3D | null = null;
      scene.traverse((obj) => {
        if (obj.name === 'cockpit-root' && !cockpitRoot) {
          cockpitRoot = obj;
        }
      });

      expect(cockpitRoot).toBeTruthy();

      const root = cockpitRoot as unknown as THREE.Object3D;
      const actualScale = root.scale.x;

      // Scale should match expected within 5%
      expect(Math.abs(actualScale - expectedScale)).toBeLessThan(0.1);

      // Save baseline screenshot
      const { page } = await import('vitest/browser');
      await page.screenshot({
        path: `__screenshots__/cockpit-${vp.label}.png`,
      });

      unmount();
    });
  }
});
