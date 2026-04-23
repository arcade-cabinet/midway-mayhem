/**
 * Browser test for the swipe → Lane trait wiring.
 *
 * We test the core piece in isolation: a minimal React component that hosts
 * only the SwipeSurface pointer logic and a koota world with Lane + LaneCount.
 * We do NOT mount the full App or wait for WebGL — this is an input-layer test.
 *
 * The form-factor gate inside TouchControls (isMobile) is intentionally
 * bypassed here by rendering SwipeSurface's logic through a thin test wrapper
 * rather than mounting the full TouchControls tree. This keeps the test
 * fast and immune to viewport-size side-effects.
 */
import { render } from '@testing-library/react';
import { createWorld } from 'koota';
import { useRef } from 'react';
import { describe, expect, it } from 'vitest';
import { Lane, LaneCount, Player } from '@/ecs/traits';
import type { SwipePoint } from './swipeDetector';
import { detectSwipe } from './swipeDetector';

/**
 * Minimal test harness: a pointer-event surface that applies the same
 * lane-change logic as SwipeSurface in TouchControls — isolated so the
 * test doesn't need the full form-factor / R3F stack.
 */
function TestSwipeSurface({ world }: { world: ReturnType<typeof createWorld> }) {
  const activePointer = useRef<number | null>(null);
  const startPoint = useRef<SwipePoint | null>(null);

  const fireLaneChange = (direction: 'left' | 'right') => {
    const delta = direction === 'left' ? -1 : 1;
    world.query(Player, Lane, LaneCount).updateEach(([lane, laneCount]) => {
      lane.target = Math.max(0, Math.min(laneCount.value - 1, lane.target + delta));
    });
  };

  const handleDown = (e: React.PointerEvent) => {
    if (activePointer.current !== null) return;
    activePointer.current = e.pointerId;
    startPoint.current = {
      pointerId: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
      timeStamp: e.timeStamp,
    };
  };

  const handleUp = (e: React.PointerEvent) => {
    if (activePointer.current !== e.pointerId) return;
    activePointer.current = null;

    if (!startPoint.current) return;
    const end: SwipePoint = {
      pointerId: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
      timeStamp: e.timeStamp,
    };
    const dir = detectSwipe(startPoint.current, end);
    startPoint.current = null;
    if (dir) fireLaneChange(dir);
  };

  return (
    <div
      data-testid="swipe-surface"
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      style={{ width: 400, height: 300 }}
    />
  );
}

/** Spawn a player entity with Lane + LaneCount. Returns the koota world. */
function makeWorld(startLane: number, laneCount = 4) {
  const w = createWorld();
  w.spawn(Player, Lane({ current: startLane, target: startLane }), LaneCount({ value: laneCount }));
  return w;
}

/**
 * Create a synthetic PointerEvent with the given (clientX, clientY, timeStamp).
 * We need to supply these via Object.defineProperty because clientX/Y and
 * timeStamp are read-only on PointerEvent but init-able only via constructor
 * options which browsers partially expose.
 */
function syntheticPointer(
  type: string,
  x: number,
  y: number,
  timeStamp: number,
  pointerId = 1,
): PointerEvent {
  const evt = new PointerEvent(type, {
    bubbles: true,
    pointerId,
    clientX: x,
    clientY: y,
  });
  // timeStamp is read-only on Event; override via defineProperty.
  Object.defineProperty(evt, 'timeStamp', { value: timeStamp, writable: false });
  return evt;
}

/** Fire a qualifying right-swipe (80 px in 80 ms) on the surface. */
function fireRightSwipe(el: Element) {
  el.dispatchEvent(syntheticPointer('pointerdown', 100, 150, 1000));
  el.dispatchEvent(syntheticPointer('pointerup', 180, 152, 1080));
}

/** Fire a qualifying left-swipe (80 px left in 80 ms) on the surface. */
function fireLeftSwipe(el: Element) {
  el.dispatchEvent(syntheticPointer('pointerdown', 200, 150, 2000));
  el.dispatchEvent(syntheticPointer('pointerup', 120, 148, 2080));
}

/** Fire a slow drag that must NOT change lanes. */
function fireSlowDrag(el: Element) {
  el.dispatchEvent(syntheticPointer('pointerdown', 100, 150, 3000));
  el.dispatchEvent(syntheticPointer('pointerup', 200, 150, 3800)); // 100px in 800ms < threshold
}

describe('TouchControls — swipe → Lane trait', () => {
  it('right swipe increments lane.target', () => {
    const world = makeWorld(1);
    const { getByTestId } = render(<TestSwipeSurface world={world} />);
    const surface = getByTestId('swipe-surface');

    fireRightSwipe(surface);

    const e = world.query(Player, Lane)[0];
    expect(e?.get(Lane)?.target).toBe(2);
  });

  it('left swipe decrements lane.target', () => {
    const world = makeWorld(2);
    const { getByTestId } = render(<TestSwipeSurface world={world} />);
    const surface = getByTestId('swipe-surface');

    fireLeftSwipe(surface);

    const e = world.query(Player, Lane)[0];
    expect(e?.get(Lane)?.target).toBe(1);
  });

  it('right swipe at rightmost lane is clamped to laneCount-1', () => {
    const world = makeWorld(3); // already at max (lane index 3 in 4-lane track)
    const { getByTestId } = render(<TestSwipeSurface world={world} />);
    const surface = getByTestId('swipe-surface');

    fireRightSwipe(surface);

    const e = world.query(Player, Lane)[0];
    expect(e?.get(Lane)?.target).toBe(3);
  });

  it('left swipe at lane 0 is clamped to 0', () => {
    const world = makeWorld(0);
    const { getByTestId } = render(<TestSwipeSurface world={world} />);
    const surface = getByTestId('swipe-surface');

    fireLeftSwipe(surface);

    const e = world.query(Player, Lane)[0];
    expect(e?.get(Lane)?.target).toBe(0);
  });

  it('slow drag (below velocity threshold) does not change lane', () => {
    const world = makeWorld(1);
    const { getByTestId } = render(<TestSwipeSurface world={world} />);
    const surface = getByTestId('swipe-surface');

    fireSlowDrag(surface);

    const e = world.query(Player, Lane)[0];
    expect(e?.get(Lane)?.target).toBe(1);
  });

  it('two sequential swipes fire two lane changes', () => {
    const world = makeWorld(1);
    const { getByTestId } = render(<TestSwipeSurface world={world} />);
    const surface = getByTestId('swipe-surface');

    fireRightSwipe(surface);
    fireRightSwipe(surface);

    const e = world.query(Player, Lane)[0];
    expect(e?.get(Lane)?.target).toBe(3);
  });
});
