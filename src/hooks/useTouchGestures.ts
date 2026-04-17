/**
 * @hook useTouchGestures
 *
 * Swipe-gesture detector using Pointer Events (unified desktop + mobile).
 *
 * Gestures (min 40px delta):
 *   Swipe-left  → steer -1
 *   Swipe-right → steer +1
 *   Swipe-up    → throttle ON (auto-accelerate to cruise)
 *   Swipe-down  → throttle OFF (coast to a stop — pause-analog)
 *
 * Honk is triggered by tapping the horn mesh directly, not via swipe.
 *
 * Returns a cleanup function via useEffect so callers can integrate it with
 * their own canvas or the document body.
 */

import { useEffect } from 'react';
import { useGameStore } from '@/game/gameState';

const MIN_SWIPE_PX = 40;

/** Normalized gesture callbacks — exported for testing. */
export interface GestureCallbacks {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeUp: () => void;
  onSwipeDown: () => void;
}

/**
 * Pure function: attach gesture detection to an element.
 * Returns a cleanup function.
 */
export function attachSwipeGestures(el: HTMLElement | Window, cb: GestureCallbacks): () => void {
  const starts = new Map<number, { x: number; y: number }>();

  const onPointerDown = (e: PointerEvent) => {
    starts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const onPointerUp = (e: PointerEvent) => {
    const start = starts.get(e.pointerId);
    if (!start) return;
    starts.delete(e.pointerId);

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    if (adx < MIN_SWIPE_PX && ady < MIN_SWIPE_PX) return;

    if (adx >= ady) {
      // Horizontal
      if (dx < 0) cb.onSwipeLeft();
      else cb.onSwipeRight();
    } else {
      // Vertical
      if (dy < 0) cb.onSwipeUp();
      else cb.onSwipeDown();
    }
  };

  const onPointerCancel = (e: PointerEvent) => {
    starts.delete(e.pointerId);
  };

  el.addEventListener('pointerdown', onPointerDown as EventListener);
  el.addEventListener('pointerup', onPointerUp as EventListener);
  el.addEventListener('pointercancel', onPointerCancel as EventListener);

  return () => {
    el.removeEventListener('pointerdown', onPointerDown as EventListener);
    el.removeEventListener('pointerup', onPointerUp as EventListener);
    el.removeEventListener('pointercancel', onPointerCancel as EventListener);
  };
}

/**
 * Hook variant — attaches to the given element (defaults to document body).
 * Integrates directly into the game store.
 */
export function useTouchGestures(target: HTMLElement | null): void {
  useEffect(() => {
    const el = target ?? document.body;

    const cleanup = attachSwipeGestures(el, {
      onSwipeLeft: () => {
        const { running } = useGameStore.getState();
        if (running) useGameStore.getState().setSteer(-1);
      },
      onSwipeRight: () => {
        const { running } = useGameStore.getState();
        if (running) useGameStore.getState().setSteer(1);
      },
      onSwipeUp: () => {
        const { running } = useGameStore.getState();
        if (running) useGameStore.getState().setThrottle(1);
      },
      onSwipeDown: () => {
        const { running } = useGameStore.getState();
        if (running) useGameStore.getState().setThrottle(0);
      },
    });

    return cleanup;
  }, [target]);
}
