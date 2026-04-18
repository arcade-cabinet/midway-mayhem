import { useEffect, useRef, useState } from 'react';
import { combo } from '@/game/comboSystem';

/** Polls the combo system's current multiplier via rAF. */
export function useComboMultiplier(): number {
  const [mult, setMult] = useState(1);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      setMult(combo.getMultiplier());
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return mult;
}
