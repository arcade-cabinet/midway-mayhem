/**
 * @component NewRunModal
 *
 * Pre-run configuration modal:
 *   - Seed phrase input (adjective-adjective-noun) + 🎲 shuffle
 *   - 3×2 difficulty grid (DOOM-style, circus-themed)
 *   - Permadeath toggle (locked-off below nightmare, locked-on at ultra)
 *   - PLAY button commits { seed, phrase, difficulty, permadeath }
 *
 * The modal owns no persistent state — a single config object is passed up
 * via onPlay once the player commits. Closing (Esc / backdrop / ✕) aborts.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { BrandButton } from '@/design/components/BrandButton';
import { Dialog } from '@/design/components/Dialog';
import { color, radius, space } from '@/design/tokens';
import { display, typeStyle, ui } from '@/design/typography';
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTY_GRID,
  DIFFICULTY_PROFILES,
  type Difficulty,
  effectivePermadeath,
} from '@/game/difficulty';
import { phraseToSeed, shufflePhrase } from '@/utils/seedPhrase';
import { DifficultyTile } from './DifficultyTile';
import { PermadeathToggle } from './PermadeathToggle';
import { SeedPhraseField } from './SeedPhraseField';

export interface NewRunConfig {
  seed: number;
  seedPhrase: string;
  difficulty: Difficulty;
  permadeath: boolean;
}

interface Props {
  onPlay: (config: NewRunConfig) => void;
  onClose: () => void;
  initialDifficulty?: Difficulty;
}

export function NewRunModal({ onPlay, onClose, initialDifficulty = DEFAULT_DIFFICULTY }: Props) {
  const [phrase, setPhrase] = useState<string>(() => shufflePhrase().phrase);
  const [difficulty, setDifficulty] = useState<Difficulty>(initialDifficulty);
  const [permadeathToggle, setPermadeathToggle] = useState(false);
  const phraseInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    phraseInputRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const seed = useMemo(() => phraseToSeed(phrase), [phrase]);
  const effectivePerma = effectivePermadeath(difficulty, permadeathToggle);
  const profile = DIFFICULTY_PROFILES[difficulty];

  function handleShuffle() {
    setPhrase(shufflePhrase().phrase);
  }

  function handlePlay() {
    onPlay({
      seed,
      seedPhrase: phrase.trim() || shufflePhrase().phrase,
      difficulty,
      permadeath: effectivePerma,
    });
  }

  return (
    <Dialog role="dialog" ariaLabel="New Run" testId="new-run-modal" tone="info">
      <div
        style={{
          maxWidth: 640,
          padding: space.xl,
          display: 'grid',
          gap: space.lg,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: space.md,
          }}
        >
          <div style={{ ...typeStyle(display.banner), color: color.yellow }}>NEW RUN</div>
          <button
            type="button"
            onClick={onClose}
            data-testid="new-run-close"
            aria-label="Close"
            style={{
              background: 'transparent',
              border: `1px solid ${color.borderSubtle}`,
              color: color.white,
              borderRadius: radius.sm,
              padding: `${space.xs}px ${space.sm}px`,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        <SeedPhraseField
          phrase={phrase}
          seed={seed}
          inputRef={phraseInputRef}
          onChange={setPhrase}
          onShuffle={handleShuffle}
        />

        {/* Difficulty grid */}
        <div>
          <div
            style={{
              ...typeStyle(ui.label),
              color: color.blue,
              marginBottom: space.sm,
            }}
          >
            DIFFICULTY
          </div>
          <div
            role="radiogroup"
            aria-label="Difficulty"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: space.sm,
            }}
            data-testid="difficulty-grid"
          >
            {DIFFICULTY_GRID.flat().map((d) => (
              <DifficultyTile
                key={d}
                id={d}
                selected={difficulty === d}
                onSelect={() => {
                  setDifficulty(d);
                  // Re-evaluate permadeath toggle against the new tier.
                  const prof = DIFFICULTY_PROFILES[d];
                  if (prof.forcesPermadeath) setPermadeathToggle(true);
                  else if (!prof.supportsPermadeath) setPermadeathToggle(false);
                }}
              />
            ))}
          </div>
        </div>

        <PermadeathToggle
          profile={profile}
          effectivePerma={effectivePerma}
          onChange={setPermadeathToggle}
        />

        {/* Footer — PLAY */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: space.sm,
            marginTop: space.sm,
          }}
        >
          <BrandButton
            kind="balloon"
            hue="red"
            size="lg"
            onClick={handlePlay}
            testId="new-run-play"
          >
            ▶ PLAY
          </BrandButton>
        </div>
      </div>
    </Dialog>
  );
}
