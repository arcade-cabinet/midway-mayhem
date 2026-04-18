import { useEffect, useRef, useState } from 'react';
import { color, space } from '@/design/tokens';
import { useGameStore } from '@/game/gameState';
import type { TrickInput, TrickKind } from '@/game/trickSystem';

const TRICK_KIND_LABEL: Record<TrickKind, string> = {
  BARREL_ROLL: 'BARREL ROLL!',
  WHEELIE: 'WHEELIE!',
  HANDSTAND: 'HANDSTAND!',
  SPIN_180: 'SPIN 180!',
};

const INPUT_SYMBOLS: Record<TrickInput, string> = {
  left: '←',
  right: '→',
  up: '↑',
  down: '↓',
};

/** Feature C: Shows input buffer + trick name when airborne. */
export function TrickOverlay() {
  const airborne = useGameStore((s) => s.airborne);
  const trickActive = useGameStore((s) => s.trickActive);
  const [inputBuffer, setInputBuffer] = useState<TrickInput[]>([]);
  const [currentTrickKind, setCurrentTrickKind] = useState<TrickKind | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const poll = () => {
      // biome-ignore lint/suspicious/noExplicitAny: trick system
      const ts = (window as any).__mmTrickSystem;
      if (ts) {
        const state = ts.getState() as {
          inputBuffer: TrickInput[];
          currentTrick: { kind: TrickKind } | null;
        };
        setInputBuffer([...state.inputBuffer]);
        setCurrentTrickKind(state.currentTrick?.kind ?? null);
      }
      rafRef.current = requestAnimationFrame(poll);
    };
    rafRef.current = requestAnimationFrame(poll);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (!airborne && !trickActive) return null;

  return (
    <div
      data-testid="trick-overlay"
      style={{
        position: 'absolute',
        top: '35%',
        left: '50%',
        transform: 'translateX(-50%)',
        textAlign: 'center',
        pointerEvents: 'none',
        zIndex: 25,
      }}
    >
      {/* Trick name */}
      {currentTrickKind && (
        <div
          style={{
            color: color.yellow,
            fontSize: 'clamp(1.8rem, 4vw, 2.5rem)',
            fontWeight: 900,
            textShadow: `4px 4px 0 rgba(0,0,0,0.8), 0 0 20px ${color.yellow}`,
            marginBottom: space.sm,
            letterSpacing: '0.05em',
          }}
        >
          {TRICK_KIND_LABEL[currentTrickKind]}
        </div>
      )}
      {/* Input buffer dots */}
      {inputBuffer.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: space.xs,
            justifyContent: 'center',
            fontSize: '1.4rem',
            color: color.white,
            textShadow: '2px 2px 0 rgba(0,0,0,0.7)',
          }}
        >
          {inputBuffer.map((inp, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable input buffer
            <span key={i}>{INPUT_SYMBOLS[inp]}</span>
          ))}
        </div>
      )}
      {/* AIRBORNE indicator */}
      {airborne && !currentTrickKind && (
        <div
          style={{
            color: color.orange,
            fontSize: '0.9rem',
            fontWeight: 700,
            opacity: 0.8,
            letterSpacing: '0.1em',
          }}
        >
          AIRBORNE
        </div>
      )}
    </div>
  );
}
