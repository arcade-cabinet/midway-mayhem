/**
 * @hook useKeyboardControls
 *
 * Keyboard bindings for the web/debug build. The shipped Capacitor build
 * is touch-only; keyboard is a developer-facing tool that never surfaces
 * to mobile users.
 *
 * Bindings (web/debug):
 *   H                → honk
 *   ArrowLeft  / A   → steer -1 (decays to 0 on keyup)
 *   ArrowRight / D   → steer +1 (decays to 0 on keyup)
 *   ArrowUp    / W   → throttle = 1 (car auto-accelerates)
 *   ArrowDown  / S   → throttle = 0 (car coasts / stops)
 *   Space            → PAUSE + CAPTURE (writes .capture/<ts>/ via /__capture)
 *   R                → restart on game-over screen
 *
 * Deliberately NO player-facing pause binding — this is a runner-style
 * arcade racer, not a pausable game. Space's pause is a debug feature
 * that co-occurs with a frame capture for bug reporting.
 */

import { useEffect } from 'react';
import { honk } from '@/audio';
import { useGameStore } from '@/game/gameState';
import { STEER } from '@/utils/constants';
import { damp } from '@/utils/math';

/** Keyboard steer target: -1, 0, or +1. */
let _kbSteerTarget = 0;

function triggerCapture(): void {
  // biome-ignore lint/suspicious/noExplicitAny: registered by DebugCaptureBridge
  const fn = (window as any).__mmCapture as
    | ((label?: string) => Promise<unknown>)
    | undefined;
  if (fn) {
    void fn('space-pause');
  }
}

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
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (
        ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code) &&
        useGameStore.getState().running
      ) {
        e.preventDefault();
      }

      held.add(e.key);

      const { running, gameOver } = useGameStore.getState();

      // HONK — H only. Space is reserved for debug capture.
      if ((e.key === 'h' || e.key === 'H') && running) {
        honk();
        return;
      }

      // THROTTLE — ↑/W sets throttle=1, ↓/S sets throttle=0
      if ((e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') && running) {
        useGameStore.getState().setThrottle(1);
        return;
      }
      if ((e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') && running) {
        useGameStore.getState().setThrottle(0);
        return;
      }

      // DEBUG CAPTURE — Space pauses + snapshots the current frame.
      if (e.code === 'Space' && running && !gameOver) {
        triggerCapture();
        return;
      }

      // RESTART — R (only when game-over)
      if ((e.key === 'r' || e.key === 'R') && gameOver) {
        useGameStore.getState().startRun();
        return;
      }

      _kbSteerTarget = resolveSteer();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      held.delete(e.key);
      _kbSteerTarget = resolveSteer();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let lastFrame = performance.now();
    let raf = 0;

    const loop = (t: number) => {
      const dt = Math.min(0.1, (t - lastFrame) / 1000);
      lastFrame = t;

      if (_kbSteerTarget !== 0) {
        const current = useGameStore.getState().steer;
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
 *
 * Enter / Space → START
 * T → VISIT THE MIDWAY (debug walk-around)
 * S → SHOP
 * Esc → close open panel
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
