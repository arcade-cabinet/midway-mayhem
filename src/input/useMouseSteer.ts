/**
 * Desktop-only pointer steering — reads the mouse X position across the
 * window and maps it to Steer in [-1, +1]. Always-on while enabled (no
 * click required); the steering wheel follows the cursor.
 *
 * Keyboard steering still works in parallel. When both are active the
 * keyboard value wins because it's a discrete 1/−1/0 rather than an
 * analog proportional read — giving the player a clear "pull to lane"
 * response on tap.
 *
 * Not mounted on touch devices (pointerType === 'touch') — those use
 * TouchControls.tsx.
 */
import type { World } from 'koota';
import { useEffect } from 'react';
import { Player, Steer, Throttle } from '@/ecs/traits';

interface UseMouseSteerOptions {
  world: World;
  enabled?: boolean;
}

export function useMouseSteer({ world, enabled = true }: UseMouseSteerOptions): void {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const onPointerMove = (e: PointerEvent) => {
      // Ignore touch — TouchControls owns that path
      if (e.pointerType === 'touch') return;

      const w = window.innerWidth || 1;
      // Map x across the viewport into [-1, +1]; deadzone 5% around center
      const normalized = (e.clientX / w) * 2 - 1;
      const deadzone = 0.05;
      let steerValue = 0;
      if (normalized > deadzone) {
        steerValue = Math.min(1, (normalized - deadzone) / (1 - deadzone));
      } else if (normalized < -deadzone) {
        steerValue = Math.max(-1, (normalized + deadzone) / (1 - deadzone));
      }

      world.query(Player, Steer, Throttle).updateEach(([s]) => {
        // Only write when keyboard isn't already steering (keyboard sets ±1).
        if (s.value === 1 || s.value === -1) return;
        s.value = steerValue;
      });
    };

    window.addEventListener('pointermove', onPointerMove);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, [world, enabled]);
}
