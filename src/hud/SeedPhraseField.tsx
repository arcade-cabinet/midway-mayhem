import type { RefObject } from 'react';
import { color, radius, space } from '@/design/tokens';
import { typeStyle, ui } from '@/design/typography';

interface SeedPhraseFieldProps {
  phrase: string;
  seed: number;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onShuffle: () => void;
}

export function SeedPhraseField({ phrase, seed, inputRef, onChange, onShuffle }: SeedPhraseFieldProps) {
  return (
    <div>
      <div
        style={{
          ...typeStyle(ui.label),
          color: color.blue,
          marginBottom: space.xs,
        }}
      >
        SEED PHRASE
      </div>
      <div style={{ display: 'flex', gap: space.sm, alignItems: 'stretch' }}>
        <input
          ref={inputRef}
          data-testid="seed-phrase-input"
          type="text"
          value={phrase}
          onChange={(e) => onChange(e.target.value)}
          placeholder="neon-polkadot-jalopy"
          aria-label="Seed phrase"
          style={{
            flex: 1,
            padding: `${space.sm}px ${space.md}px`,
            background: 'rgba(0,0,0,0.45)',
            border: `2px solid ${color.borderAccent}`,
            borderRadius: radius.md,
            color: color.white,
            ...typeStyle(ui.body),
            fontSize: '1rem',
            letterSpacing: '0.04em',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={onShuffle}
          data-testid="seed-phrase-shuffle"
          aria-label="Shuffle seed phrase"
          style={{
            padding: `${space.sm}px ${space.md}px`,
            background: color.yellow,
            color: color.night,
            border: `2px solid ${color.yellow}`,
            borderRadius: radius.md,
            fontSize: '1.25rem',
            cursor: 'pointer',
            minWidth: 56,
          }}
        >
          🎲
        </button>
      </div>
      <div
        style={{
          ...typeStyle(ui.small),
          color: color.dim,
          marginTop: space.xs,
        }}
        data-testid="seed-value"
      >
        → seed #{seed.toString(16).padStart(8, '0')}
      </div>
    </div>
  );
}
