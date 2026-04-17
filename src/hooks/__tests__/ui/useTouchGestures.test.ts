/**
 * Tests for useTouchGestures
 *
 * Synthesizes PointerEvent sequences (pointerdown → pointerup) and asserts
 * that the correct gesture callbacks fire.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GestureCallbacks } from '@/hooks/useTouchGestures';
import { attachSwipeGestures } from '@/hooks/useTouchGestures';

function makePointerEvent(
  type: 'pointerdown' | 'pointerup' | 'pointercancel',
  clientX: number,
  clientY: number,
  pointerId = 1,
): PointerEvent {
  return new PointerEvent(type, { clientX, clientY, pointerId, bubbles: true });
}

function swipe(el: HTMLElement, fromX: number, fromY: number, toX: number, toY: number) {
  el.dispatchEvent(makePointerEvent('pointerdown', fromX, fromY));
  el.dispatchEvent(makePointerEvent('pointerup', toX, toY));
}

describe('attachSwipeGestures', () => {
  let el: HTMLElement;
  let cbs: GestureCallbacks;
  let cleanup: () => void;

  beforeEach(() => {
    el = document.createElement('div');
    cbs = {
      onSwipeLeft: vi.fn() as GestureCallbacks['onSwipeLeft'],
      onSwipeRight: vi.fn() as GestureCallbacks['onSwipeRight'],
      onSwipeUp: vi.fn() as GestureCallbacks['onSwipeUp'],
      onSwipeDown: vi.fn() as GestureCallbacks['onSwipeDown'],
    };
    cleanup = attachSwipeGestures(el, cbs);
  });

  afterEach(() => cleanup());

  it('fires onSwipeLeft for leftward drag > 40px', () => {
    swipe(el, 200, 100, 100, 100); // dx = -100
    expect(cbs.onSwipeLeft).toHaveBeenCalledTimes(1);
    expect(cbs.onSwipeRight).not.toHaveBeenCalled();
  });

  it('fires onSwipeRight for rightward drag > 40px', () => {
    swipe(el, 100, 100, 200, 100); // dx = +100
    expect(cbs.onSwipeRight).toHaveBeenCalledTimes(1);
    expect(cbs.onSwipeLeft).not.toHaveBeenCalled();
  });

  it('fires onSwipeUp for upward drag > 40px', () => {
    swipe(el, 100, 200, 100, 100); // dy = -100
    expect(cbs.onSwipeUp).toHaveBeenCalledTimes(1);
    expect(cbs.onSwipeDown).not.toHaveBeenCalled();
  });

  it('fires onSwipeDown for downward drag > 40px', () => {
    swipe(el, 100, 100, 100, 200); // dy = +100
    expect(cbs.onSwipeDown).toHaveBeenCalledTimes(1);
    expect(cbs.onSwipeUp).not.toHaveBeenCalled();
  });

  it('does NOT fire for sub-threshold drag (< 40px)', () => {
    swipe(el, 100, 100, 120, 100); // dx = +20 — below threshold
    expect(cbs.onSwipeLeft).not.toHaveBeenCalled();
    expect(cbs.onSwipeRight).not.toHaveBeenCalled();
    expect(cbs.onSwipeUp).not.toHaveBeenCalled();
    expect(cbs.onSwipeDown).not.toHaveBeenCalled();
  });

  it('picks horizontal axis when |dx| >= |dy|', () => {
    // dx = +60, dy = +40 → horizontal
    swipe(el, 100, 100, 160, 140);
    expect(cbs.onSwipeRight).toHaveBeenCalledTimes(1);
    expect(cbs.onSwipeDown).not.toHaveBeenCalled();
  });

  it('picks vertical axis when |dy| > |dx|', () => {
    // dx = +40, dy = +60 → vertical
    swipe(el, 100, 100, 140, 160);
    expect(cbs.onSwipeDown).toHaveBeenCalledTimes(1);
    expect(cbs.onSwipeRight).not.toHaveBeenCalled();
  });

  it('cleanup removes listeners so no gesture fires', () => {
    cleanup();
    // re-assign cleanup so afterEach doesn't double-call
    cleanup = () => {};
    swipe(el, 200, 100, 100, 100);
    expect(cbs.onSwipeLeft).not.toHaveBeenCalled();
  });

  it('pointercancel clears the pointer — no gesture fires', () => {
    el.dispatchEvent(makePointerEvent('pointerdown', 200, 100));
    el.dispatchEvent(makePointerEvent('pointercancel', 200, 100));
    el.dispatchEvent(makePointerEvent('pointerup', 100, 100));
    expect(cbs.onSwipeLeft).not.toHaveBeenCalled();
  });
});
