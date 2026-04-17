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

        {/* Seed phrase row */}
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
              ref={phraseInputRef}
              data-testid="seed-phrase-input"
              type="text"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
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
              onClick={handleShuffle}
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

        {/* Permadeath toggle (always visible so the rule is discoverable, but
            disabled outside nightmare tiers). */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${space.sm}px ${space.md}px`,
            borderRadius: radius.md,
            border: `2px solid ${profile.supportsPermadeath ? color.red : color.borderSubtle}`,
            background: profile.supportsPermadeath ? 'rgba(229,57,53,0.12)' : 'transparent',
          }}
        >
          <div>
            <div
              style={{
                ...typeStyle(ui.body),
                color: profile.supportsPermadeath ? color.white : color.dim,
                fontWeight: 700,
              }}
            >
              💀 PERMADEATH
            </div>
            <div style={{ ...typeStyle(ui.small), color: color.dim }}>
              {profile.forcesPermadeath
                ? 'Forced ON — any collision ends the run.'
                : profile.supportsPermadeath
                  ? 'Any collision ends the run. Higher rewards.'
                  : 'Unlocks at NIGHTMARE tier.'}
            </div>
          </div>
          <label
            style={{
              position: 'relative',
              display: 'inline-block',
              width: 52,
              height: 28,
              cursor:
                profile.supportsPermadeath && !profile.forcesPermadeath ? 'pointer' : 'not-allowed',
            }}
          >
            <input
              type="checkbox"
              data-testid="permadeath-toggle"
              checked={effectivePerma}
              disabled={!profile.supportsPermadeath || profile.forcesPermadeath}
              onChange={(e) => setPermadeathToggle(e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                background: effectivePerma ? color.red : 'rgba(255,255,255,0.15)',
                borderRadius: 999,
                transition: 'background 120ms',
                opacity: profile.supportsPermadeath ? 1 : 0.4,
              }}
            />
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 3,
                left: effectivePerma ? 27 : 3,
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: color.white,
                transition: 'left 120ms',
              }}
            />
          </label>
        </div>

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

function DifficultyTile({
  id,
  selected,
  onSelect,
}: {
  id: Difficulty;
  selected: boolean;
  onSelect: () => void;
}) {
  const profile = DIFFICULTY_PROFILES[id];
  const accent = (() => {
    switch (profile.accentHue) {
      case 'red':
        return color.red;
      case 'yellow':
        return color.yellow;
      case 'blue':
        return color.blue;
      case 'purple':
        return color.purple;
      case 'orange':
        return color.orange;
      case 'green':
        return '#43a047';
    }
  })();
  return (
    // biome-ignore lint/a11y/useSemanticElements: radio behavior on a styled button; radiogroup parent validates
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      data-testid={`difficulty-tile-${id}`}
      style={{
        textAlign: 'left',
        padding: space.md,
        background: selected ? `${accent}25` : 'rgba(0,0,0,0.35)',
        border: `2px solid ${selected ? accent : color.borderSubtle}`,
        borderRadius: radius.md,
        color: color.white,
        cursor: 'pointer',
        display: 'grid',
        gap: space.xs,
        transition: 'border 120ms, background 120ms',
      }}
    >
      <div
        style={{
          ...typeStyle(display.button),
          fontSize: '1.05rem',
          color: accent,
        }}
      >
        {profile.label}
        {profile.forcesPermadeath && ' 💀'}
      </div>
      <div style={{ ...typeStyle(ui.small), color: color.dim }}>{profile.tagline}</div>
      <div
        style={{
          ...typeStyle(ui.meta),
          color: color.dim,
          display: 'flex',
          gap: space.md,
          marginTop: space.xs,
        }}
      >
        <span>⚡ {profile.targetSpeedMps} m/s</span>
        <span>🎟 ×{profile.rewardMultiplier}</span>
      </div>
    </button>
  );
}
