/**
 * Unit tests for the flick-style swipe detector.
 *
 * Coverage matrix:
 *  - Clean left and right flicks → produce 'left' / 'right'
 *  - Slow drag (below velocity threshold) → null
 *  - Short tap (below distance threshold) → null
 *  - Vertical-dominant swipes → null
 *  - Diagonal-but-still-horizontal swipes → pass through
 *  - Zero-duration event (timeStamp unchanged) → null
 *  - Cancel-on-up: gesture distance reached but velocity not → null
 *  - Extreme velocity + distance → accepted
 */
import { describe, expect, it } from 'vitest';
import {
  SWIPE_MAX_ANGLE_DEG,
  SWIPE_MIN_DIST_PX,
  SWIPE_MIN_VELOCITY_PX_MS,
  detectSwipe,
} from '../swipeDetector';
import type { SwipePoint } from '../swipeDetector';

function pt(clientX: number, clientY: number, timeStamp: number, pointerId = 1): SwipePoint {
  return { pointerId, clientX, clientY, timeStamp };
}

/** Produce a start/end pair that travels dx px in dt ms at dy vertical offset. */
function gesture(dx: number, dy: number, dt: number) {
  const start = pt(200, 300, 1000);
  const end = pt(200 + dx, 300 + dy, 1000 + dt);
  return { start, end };
}

describe('detectSwipe', () => {
  // ─── Clean flicks ──────────────────────────────────────────────────────────

  it('returns "left" for a fast leftward flick', () => {
    const { start, end } = gesture(-60, 5, 80);
    expect(detectSwipe(start, end)).toBe('left');
  });

  it('returns "right" for a fast rightward flick', () => {
    const { start, end } = gesture(60, -3, 80);
    expect(detectSwipe(start, end)).toBe('right');
  });

  it('accepts a minimal-qualifying flick (just over both thresholds)', () => {
    // dx = SWIPE_MIN_DIST_PX + 2, velocity = 1.1× SWIPE_MIN_VELOCITY_PX_MS.
    // Using "threshold + margin" avoids floating-point boundary fragility.
    const dx = SWIPE_MIN_DIST_PX + 2;
    const dt = dx / (SWIPE_MIN_VELOCITY_PX_MS * 1.1);
    const { start, end } = gesture(dx, 0, dt);
    expect(detectSwipe(start, end)).toBe('right');
  });

  // ─── Distance gate ─────────────────────────────────────────────────────────

  it('returns null for a tap (dx < SWIPE_MIN_DIST_PX)', () => {
    const shortDx = SWIPE_MIN_DIST_PX - 1;
    const dt = shortDx / (SWIPE_MIN_VELOCITY_PX_MS * 2); // fast, just short
    const { start, end } = gesture(shortDx, 0, dt);
    expect(detectSwipe(start, end)).toBeNull();
  });

  it('returns null for a near-zero horizontal movement', () => {
    const { start, end } = gesture(3, 1, 50);
    expect(detectSwipe(start, end)).toBeNull();
  });

  // ─── Velocity gate ─────────────────────────────────────────────────────────

  it('returns null for a slow drag that covers enough distance but too slowly', () => {
    // dx well above distance threshold, but stretched over 800 ms → velocity too low
    const { start, end } = gesture(80, 0, 800);
    expect(detectSwipe(start, end)).toBeNull();
  });

  it('returns null for an extremely slow crawl (hold-and-drag)', () => {
    const { start, end } = gesture(120, 0, 2000);
    expect(detectSwipe(start, end)).toBeNull();
  });

  // ─── Vertical-dominant gate ────────────────────────────────────────────────

  it('returns null when the gesture is pure vertical', () => {
    // dy >> dx — should be rejected
    const { start, end } = gesture(10, 200, 80);
    expect(detectSwipe(start, end)).toBeNull();
  });

  it('returns null when the angle is just above SWIPE_MAX_ANGLE_DEG', () => {
    const angleRad = (SWIPE_MAX_ANGLE_DEG + 5) * (Math.PI / 180);
    const dx = 50;
    const dy = Math.tan(angleRad) * dx; // angle measured from X-axis
    const dt = dx / (SWIPE_MIN_VELOCITY_PX_MS * 2);
    const { start, end } = gesture(dx, dy, dt);
    expect(detectSwipe(start, end)).toBeNull();
  });

  it('accepts a diagonal that is within SWIPE_MAX_ANGLE_DEG', () => {
    // 30° from horizontal is inside the 40° gate
    const angleRad = 30 * (Math.PI / 180);
    const dx = 60;
    const dy = Math.tan(angleRad) * dx;
    const dt = dx / (SWIPE_MIN_VELOCITY_PX_MS * 2);
    const { start, end } = gesture(dx, dy, dt);
    expect(detectSwipe(start, end)).toBe('right');
  });

  // ─── Time-edge cases ───────────────────────────────────────────────────────

  it('returns null when timeStamp is identical (dt === 0)', () => {
    const start = pt(100, 200, 500);
    const end = pt(200, 200, 500); // same timeStamp
    expect(detectSwipe(start, end)).toBeNull();
  });

  it('returns null when dt is negative (event ordering glitch)', () => {
    // timeStamp decreases — dt negative, velocity guard fires
    const start = pt(100, 200, 600);
    const end = pt(200, 200, 500); // end is earlier than start
    expect(detectSwipe(start, end)).toBeNull();
  });

  // ─── Cancel-on-up-before-threshold scenario ───────────────────────────────

  it('returns null when pointer is lifted before threshold distance is reached', () => {
    // Simulates finger moving 20 px then lifting — below SWIPE_MIN_DIST_PX
    const { start, end } = gesture(20, 0, 40);
    expect(detectSwipe(start, end)).toBeNull();
  });

  // ─── Extreme values ────────────────────────────────────────────────────────

  it('handles extremely fast flick (near-instant gesture)', () => {
    // 100 px in 10 ms — clearly a flick
    const { start, end } = gesture(-100, 0, 10);
    expect(detectSwipe(start, end)).toBe('left');
  });

  it('accepts a large-distance swipe just above velocity threshold', () => {
    // 200 px at 1.1× SWIPE_MIN_VELOCITY_PX_MS so floating-point can't push
    // us below the gate boundary (the "exactly threshold" case is fragile).
    const dx = 200;
    const dt = dx / (SWIPE_MIN_VELOCITY_PX_MS * 1.1);
    const { start, end } = gesture(dx, 0, dt);
    expect(detectSwipe(start, end)).toBe('right');
  });
});
