/**
 * Keyboard input → world traits.
 *
 * Mounts global keydown/keyup listeners and writes Steer/Throttle/RunSession
 * state onto the Player entity each time inputs change. Pure side-effect
 * hook; returns nothing. Horn is edge-triggered via an onHorn callback so
 * the audio layer can fire tones without polling.
 *
 * Key bindings (WASD + arrows, space = horn):
 *   ArrowLeft / A        Steer left
 *   ArrowRight / D       Steer right
 *   ArrowUp / W          Throttle up
 *   ArrowDown / S        Brake
 *   Space                Honk (onHorn edge-trigger)
 */

import type { World } from 'koota';
import { useEffect } from 'react';
import { Player, Steer, Throttle } from '@/ecs/traits';

interface UseKeyboardOptions {
  world: World;
  onHorn?: () => void;
  /** Disable the hook (e.g., while the title screen is up). */
  enabled?: boolean;
}

export function useKeyboard({ world, onHorn, enabled = true }: UseKeyboardOptions): void {
  useEffect(() => {
    if (!enabled) return;
    const pressed = new Set<string>();

    const applyToPlayer = () => {
      let steer = 0;
      if (pressed.has('left')) steer -= 1;
      if (pressed.has('right')) steer += 1;
      let throttle = 0;
      if (pressed.has('up')) throttle = 1;
      if (pressed.has('down')) throttle = -1;

      world.query(Player, Steer, Throttle).updateEach(([s, t]) => {
        s.value = steer;
        t.value = throttle;
      });
    };

    const handleDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const codes: Record<string, string> = {
        arrowleft: 'left',
        a: 'left',
        arrowright: 'right',
        d: 'right',
        arrowup: 'up',
        w: 'up',
        arrowdown: 'down',
        s: 'down',
      };
      const mapped = codes[k];
      if (mapped) {
        if (!pressed.has(mapped)) {
          pressed.add(mapped);
          applyToPlayer();
        }
        e.preventDefault();
        return;
      }
      if (k === ' ' && !e.repeat) {
        onHorn?.();
        e.preventDefault();
      }
    };
    const handleUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const codes: Record<string, string> = {
        arrowleft: 'left',
        a: 'left',
        arrowright: 'right',
        d: 'right',
        arrowup: 'up',
        w: 'up',
        arrowdown: 'down',
        s: 'down',
      };
      const mapped = codes[k];
      if (mapped && pressed.has(mapped)) {
        pressed.delete(mapped);
        applyToPlayer();
      }
    };
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => {
      window.removeEventListener('keydown', handleDown);
      window.removeEventListener('keyup', handleUp);
    };
  }, [world, onHorn, enabled]);
}
