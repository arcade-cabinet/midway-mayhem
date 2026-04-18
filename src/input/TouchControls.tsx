/**
 * On-screen touch controls for mobile form factors.
 *
 * Whole-canvas drag surface (transparent overlay): any finger-down
 * anywhere in the viewport captures the touch and tracks x-delta to
 * drive Steer in [-1, +1]. Matches the vision doc — no virtual
 * joystick stuck in one corner; the player steers by pulling any
 * part of the screen left/right.
 *
 * Bottom-right: honk button (opaque; intercepts pointer events).
 *
 * The controls mount only when form factor says we're on a phone. They
 * write to koota traits directly, same as the keyboard hook — so the
 * motion system is agnostic about input source.
 */

import type { World } from 'koota';
import { useEffect, useRef, useState } from 'react';
import { Player, Steer, Throttle } from '@/ecs/traits';
import { type FormTier, useFormFactor } from '@/render/cockpit/useFormFactor';

interface TouchControlsProps {
  world: World;
  onHorn?: () => void;
  enabled?: boolean;
}

const MOBILE_TIERS: FormTier[] = ['phone-portrait', 'phone-landscape'];

export function TouchControls({ world, onHorn, enabled = true }: TouchControlsProps) {
  const ff = useFormFactor();
  const isMobile = MOBILE_TIERS.includes(ff.tier);

  // Auto-throttle on mobile so the player only needs to steer; full throttle
  // is always applied while the controls are mounted.
  useEffect(() => {
    if (!enabled || !isMobile) return;
    world.query(Player, Throttle).updateEach(([t]) => {
      t.value = 1;
    });
  }, [world, enabled, isMobile]);

  if (!enabled || !isMobile) return null;

  return (
    <>
      <DragSurface world={world} />
      <HornButton onHorn={onHorn} />
    </>
  );
}

/** How far the finger has to drag (in px) to reach Steer = ±1. */
const DRAG_RANGE_PX = 160;

/**
 * Transparent full-screen drag overlay. Captures the first touch,
 * tracks dx from the touch-down point, scales to [-1, +1] via
 * DRAG_RANGE_PX, releases on touch-up / cancel (steer → 0).
 *
 * Second finger is ignored so a two-finger zoom doesn't confuse
 * the driver.
 */
function DragSurface({ world }: { world: World }) {
  const dragId = useRef<number | null>(null);
  const startX = useRef(0);

  const setSteer = (v: number) => {
    world.query(Player, Steer).updateEach(([s]) => {
      s.value = Math.max(-1, Math.min(1, v));
    });
  };

  const handleDown = (e: React.PointerEvent) => {
    if (dragId.current !== null) return;
    dragId.current = e.pointerId;
    startX.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handleMove = (e: React.PointerEvent) => {
    if (dragId.current !== e.pointerId) return;
    const dx = e.clientX - startX.current;
    setSteer(dx / DRAG_RANGE_PX);
  };
  const handleUp = (e: React.PointerEvent) => {
    if (dragId.current !== e.pointerId) return;
    dragId.current = null;
    setSteer(0);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div
      data-testid="touch-drag-surface"
      onPointerDown={handleDown}
      onPointerMove={handleMove}
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
