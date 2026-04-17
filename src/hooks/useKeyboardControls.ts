/**
 * @hook useKeyboardControls
 *
 * Global keyboard controls wired to the game store.
 *
 * Bindings:
 *   Space / H        → honk()
 *   ArrowLeft / A    → steer -1 (decays to 0 on keyup)
 *   ArrowRight / D   → steer +1 (decays to 0 on keyup)
 *   P / Escape       → pause / resume
 *   R                → restart on game-over screen
 *
 * Auto-registers on window. Returns a cleanup function.
 * Call once from Game.tsx alongside useSteering.
 */

import { useEffect } from 'react';
import { honk } from '@/audio';
import { useGameStore } from '@/game/gameState';
import { STEER } from '@/utils/constants';
import { damp } from '@/utils/math';

/** Keyboard steer target: -1, 0, or +1. */
let _kbSteerTarget = 0;

export function useKeyboardControls(): void {
  useEffect(() => {
    const held = new Set<string>();

    function resolveSteer(): number {
      const left = held.has('ArrowLeft') || held.has('a') || held.has('A');
      const right = held.has('ArrowRight') || held.has('d') || held.has('D');
      if (left && !right) return -1;
      if (right && !left) return 1;
      return 0;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      // Skip if focus is in an input/textarea — let the browser handle it
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Prevent arrow/space default scroll behaviours during gameplay
      if (
        ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code) &&
        useGameStore.getState().running
      ) {
        e.preventDefault();
      }

      held.add(e.key);

      const { running, paused, gameOver } = useGameStore.getState();

      // HONK — Space or H
      if ((e.code === 'Space' || e.key === 'h' || e.key === 'H') && running && !paused) {
        honk();
        return;
      }

      // PAUSE / RESUME — P or Escape
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (running && !gameOver) {
          if (paused) {
            useGameStore.getState().resume();
          } else {
            useGameStore.getState().pause();
          }
        }
        return;
      }

      // RESTART — R (only when game-over)
      if ((e.key === 'r' || e.key === 'R') && gameOver) {
        useGameStore.getState().startRun();
        return;
      }

      // STEER — update target
      _kbSteerTarget = resolveSteer();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      held.delete(e.key);
      _kbSteerTarget = resolveSteer();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Damped steer loop — blends keyboard target into the store
    let lastFrame = performance.now();
    let raf = 0;

    const loop = (t: number) => {
      const dt = Math.min(0.1, (t - lastFrame) / 1000);
      lastFrame = t;

      if (_kbSteerTarget !== 0) {
        const current = useGameStore.getState().steer;
        // Keyboard steer ramps up quickly (low tau)
        const next = damp(current, _kbSteerTarget * STEER.SENSITIVITY, 0.05, dt);
        useGameStore.getState().setSteer(Math.max(-1, Math.min(1, next)));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      cancelAnimationFrame(raf);
      _kbSteerTarget = 0;
    };
  }, []);
}

/**
 * Wire keyboard navigation to TitleScreen.
 * Exported separately so it can be used in TitleScreen.tsx.
 *
 * Enter / Space → START
 * T → VISIT THE MIDWAY (tour)
 * S → SHOP
 * Esc → close open panel (returns focus to START button)
 */
export function useTitleKeyboard(opts: {
  onStart: () => void;
  onTour?: () => void;
  onShop: () => void;
  onEsc: () => void;
}): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        opts.onStart();
      } else if (e.key === 't' || e.key === 'T') {
        opts.onTour?.();
      } else if (e.key === 's' || e.key === 'S') {
        opts.onShop();
      } else if (e.key === 'Escape') {
        opts.onEsc();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [opts]);
}
