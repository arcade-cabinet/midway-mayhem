/**
 * On-screen touch controls for mobile form factors.
 *
 * SWIPE MODEL (replaces continuous drag steering):
 * The car is always moving forward; the player's only spatial decision is
 * which lane to occupy. A fast horizontal flick fires a discrete lane change
 * (+1 or -1). A slow hold-and-drag, a vertical swipe, or a two-finger gesture
 * all produce nothing — no accidental lane changes from bracing the phone.
 *
 * The whole canvas is the swipe surface (minus the honk button corner) so
 * the player can gesture anywhere, not just a fixed zone.
 *
 * Bottom-right: honk button (opaque; intercepts pointer events).
 *
 * The controls mount only when the form factor is phone-tier. They write to
 * the Lane trait directly, same as the keyboard hook — the motion system is
 * agnostic about which input source fires the lane change.
 */

import type { World } from 'koota';
import { useEffect, useRef, useState } from 'react';
import { Lane, LaneCount, Player, Throttle } from '@/ecs/traits';
import { type FormTier, useFormFactor } from '@/render/cockpit/useFormFactor';
import type { SwipePoint } from './swipeDetector';
import { detectSwipe } from './swipeDetector';

interface TouchControlsProps {
  world: World;
  onHorn?: () => void;
  enabled?: boolean;
}

const MOBILE_TIERS: FormTier[] = ['phone-portrait', 'phone-landscape'];

export function TouchControls({ world, onHorn, enabled = true }: TouchControlsProps) {
  const ff = useFormFactor();
  const isMobile = MOBILE_TIERS.includes(ff.tier);

  // Auto-throttle on mobile: forward motion is always on.
  useEffect(() => {
    if (!enabled || !isMobile) return;
    world.query(Player, Throttle).updateEach(([t]) => {
      t.value = 1;
    });
  }, [world, enabled, isMobile]);

  if (!enabled || !isMobile) return null;

  return (
    <>
      <SwipeSurface world={world} />
      <HornButton onHorn={onHorn} />
    </>
  );
}

/**
 * Transparent full-screen swipe overlay.
 *
 * Captures the first pointer down. On pointer up, runs the swipe detector
 * against the start/end snapshots and fires a lane change if the gesture
 * qualifies. Second finger is deliberately ignored (two-finger gestures
 * might be OS-level zoom; we must not fight that).
 */
function SwipeSurface({ world }: { world: World }) {
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
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleUp = (e: React.PointerEvent) => {
    if (activePointer.current !== e.pointerId) return;
    activePointer.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);

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
      data-testid="touch-swipe-surface"
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      style={{
        position: 'fixed',
        inset: 0,
        // Leave the bottom-right 140×140 px free so the honk button
        // underneath still gets its own pointer events.
        clipPath:
          'polygon(0 0, 100% 0, 100% calc(100% - 140px), calc(100% - 140px) calc(100% - 140px), calc(100% - 140px) 100%, 0 100%)',
        touchAction: 'none',
        zIndex: 10,
        background: 'transparent',
      }}
    />
  );
}

function HornButton({ onHorn }: { onHorn?: (() => void) | undefined }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      type="button"
      data-testid="touch-horn"
      onPointerDown={() => {
        setPressed(true);
        onHorn?.();
      }}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      style={{
        position: 'fixed',
        right: '20px',
        bottom: '20px',
        width: '88px',
        height: '88px',
        borderRadius: '50%',
        background: '#ff3e3e',
        border: '4px solid #f4c430',
        color: '#fff1db',
        fontSize: '14px',
        fontWeight: 900,
        letterSpacing: '0.15em',
        cursor: 'pointer',
        transform: pressed ? 'translateY(3px) scale(0.96)' : 'translateY(0) scale(1)',
        transition: 'transform 80ms ease',
        zIndex: 20,
        touchAction: 'none',
      }}
    >
      HONK
    </button>
  );
}
