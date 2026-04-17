import { useEffect, useState } from 'react';
import { honk } from '@/audio';
import { onHonk } from '@/audio/honkBus';
import { BrandButton } from '@/design/components/BrandButton';
import { color, motion, safeArea, space } from '@/design/tokens';
import { typeStyle, ui } from '@/design/typography';
import { combo } from '@/game/comboSystem';
import { markShown, shouldShow } from '@/persistence/tutorial';
import { useComboMultiplier } from './useComboMultiplier';

/** Color for each multiplier tier of the combo ring. */
const COMBO_RING_COLORS: Record<number, string> = {
  2: color.yellow,
  4: color.orange,
  8: color.red,
};

export { combo };

export function HonkButton() {
  const mult = useComboMultiplier();
  const ringVisible = mult >= 2;
  const ringColor = COMBO_RING_COLORS[mult] ?? color.purple;
  const [showHonkHint, setShowHonkHint] = useState(() => shouldShow('first-honk'));

  // Mark first-honk tutorial as shown on first press
  useEffect(() => {
    return onHonk(() => {
      if (shouldShow('first-honk')) {
        setShowHonkHint(false);
        markShown('first-honk').catch(() => {
          /* non-critical */
        });
      }
    });
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: `calc(${space.lg}px + ${safeArea.bottom})`,
        left: '50%',
        transform: 'translateX(-50%)',
        touchAction: 'manipulation',
      }}
    >
      {/* First-honk tutorial hint */}
      {showHonkHint && (
        <div
          data-testid="honk-tutorial-hint"
          style={{
            position: 'absolute',
            bottom: '110%',
            left: '50%',
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap',
            ...typeStyle(ui.body),
            color: color.yellow,
            fontSize: '0.85rem',
            pointerEvents: 'none',
            textShadow: '0 0 8px rgba(0,0,0,0.8)',
          }}
        >
          TAP TO HONK!
        </div>
      )}
      {/* Combo ring — pulsing halo around the HONK button */}
      {ringVisible && (
        <div
          data-testid="combo-ring"
          role="img"
          aria-label={`Combo ${mult}×`}
          style={{
            position: 'absolute',
            inset: -8,
            borderRadius: '50%',
            border: `3px solid ${ringColor}`,
            boxShadow: `0 0 16px 4px ${ringColor}`,
            pointerEvents: 'none',
            animation: `mm-combo-pulse ${motion.slow}ms ${motion.easing.out} infinite alternate`,
          }}
        />
      )}
      {/* Multiplier label above the ring */}
      {ringVisible && (
        <div
          data-testid="combo-label"
          style={{
            position: 'absolute',
            top: -28,
            left: '50%',
            transform: 'translateX(-50%)',
            color: ringColor,
            fontWeight: 800,
            fontSize: '1rem',
            textShadow: `0 0 8px ${ringColor}`,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {mult}×
        </div>
      )}
      <BrandButton kind="primary" size="md" onClick={() => honk()} testId="honk-button">
        HONK
      </BrandButton>
    </div>
  );
}
