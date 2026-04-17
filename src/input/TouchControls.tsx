/**
 * On-screen touch controls for mobile form factors.
 *
 * Bottom-left: virtual joystick for steer [-1, +1] (x-axis only; y is
 * ignored because throttle auto-cruises on mobile).
 * Bottom-right: honk button, spring-back press animation.
 *
 * The controls mount only when form factor says we're on a phone. They
 * write to koota traits directly, same as the keyboard hook — so the
 * motion system is agnostic about input source.
 */
import { useEffect, useRef, useState } from 'react';
import type { World } from 'koota';
import { Player, Steer, Throttle } from '@/ecs/traits';
import {
  useFormFactor,
  type FormTier,
} from '@/render/cockpit/useFormFactor';

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
      <Joystick world={world} />
      <HornButton onHorn={onHorn} />
    </>
  );
}

function Joystick({ world }: { world: World }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0 });
  const dragId = useRef<number | null>(null);

  const setSteer = (v: number) => {
    world.query(Player, Steer).updateEach(([s]) => {
      s.value = Math.max(-1, Math.min(1, v));
    });
  };

  const handleMove = (e: React.PointerEvent) => {
    if (dragId.current !== e.pointerId) return;
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const dx = e.clientX - cx;
    const max = rect.width / 2;
    const x = Math.max(-max, Math.min(max, dx));
    setKnob({ x });
    setSteer(x / max);
  };
  const handleDown = (e: React.PointerEvent) => {
    dragId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    handleMove(e);
  };
  const handleUp = (e: React.PointerEvent) => {
    dragId.current = null;
    setKnob({ x: 0 });
    setSteer(0);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div
      ref={baseRef}
      data-testid="touch-joystick"
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      style={{
        position: 'fixed',
        left: '20px',
        bottom: '20px',
        width: '120px',
        height: '120px',
        borderRadius: '50%',
        background: 'rgba(156, 39, 176, 0.35)',
        border: '3px solid rgba(255, 241, 219, 0.5)',
        touchAction: 'none',
        zIndex: 20,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: `calc(50% + ${knob.x}px - 24px)`,
          top: 'calc(50% - 24px)',
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: '#ffd600',
          boxShadow: '0 4px 10px rgba(0, 0, 0, 0.35)',
          pointerEvents: 'none',
        }}
      />
    </div>
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
