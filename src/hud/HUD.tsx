import { useEffect, useRef, useState } from 'react';
import { Banner } from '@/design/components/Banner';
import { BrandButton } from '@/design/components/BrandButton';
import { HUDFrame } from '@/design/components/HUDFrame';
import { Panel } from '@/design/components/Panel';
import { Stat } from '@/design/components/Stat';
import { color, motion, safeArea, space } from '@/design/tokens';
import { display, typeStyle, ui } from '@/design/typography';
import { useFormFactor } from '@/hooks/useFormFactor';
import { markShown, shouldShow } from '@/persistence/tutorial';
import { combo } from '@/game/comboSystem';
import { useGameStore } from '@/game/gameState';
import { honk } from '@/audio';
import { onHonk } from '@/audio/honkBus';
import type { RaidKind } from '@/obstacles/raidDirector';
import type { TrickInput, TrickKind } from '@/game/trickSystem';

export function HUD() {
  const hype = useGameStore((s) => s.hype);
  const distance = useGameStore((s) => s.distance);
  const crashes = useGameStore((s) => s.crashes);
  const sanity = useGameStore((s) => s.sanity);
  const crowd = useGameStore((s) => s.crowdReaction);
  const gameOver = useGameStore((s) => s.gameOver);
  const plunging = useGameStore((s) => s.plunging);
  const photoMode = useGameStore((s) => s.photoMode);
  const startRun = useGameStore((s) => s.startRun);
  const ff = useFormFactor();

  const isPhonePortrait = ff.tier === 'phone-portrait';

  // Phone portrait — stacked two rows
  if (isPhonePortrait) {
    return (
      <HUDFrame testId="hud">
        {/* Top row: HYPE + DISTANCE/CRASHES side-by-side */}
        <div
          style={{
            position: 'absolute',
            top: `calc(${space.md}px + ${safeArea.top})`,
            left: `calc(${space.md}px + ${safeArea.left})`,
            right: `calc(${space.md}px + ${safeArea.right})`,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: space.md,
          }}
        >
          <Panel variant="dark">
            <Stat
              label="HYPE"
              value={hype.toFixed(0)}
              bar={{ value: Math.min(100, hype), tone: 'yellow' }}
              testId="hud-hype"
            />
          </Panel>
          <Panel variant="dark" testId="hud-stats">
            <Stat label="DISTANCE" value={distance.toFixed(0)} unit="m" />
            <div style={{ marginTop: space.xs }}>
              <Stat label="CRASHES" value={crashes} labelColor={color.red} />
            </div>
          </Panel>
        </div>

        {/* Bottom row: SANITY bar + CROWD score + HONK */}
        <div
          style={{
            position: 'absolute',
            bottom: `calc(${space.md}px + ${safeArea.bottom})`,
            left: `calc(${space.md}px + ${safeArea.left})`,
            right: `calc(${space.md}px + ${safeArea.right})`,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: space.md,
            marginBottom: 80,
          }}
        >
          <Panel variant="dark" testId="hud-sanity">
            <Stat
              label="SANITY"
              value={sanity.toFixed(0)}
              bar={{ value: sanity, tone: 'red' }}
              labelColor={color.red}
            />
          </Panel>
          <Panel variant="dark" testId="hud-crowd">
            <Stat label="CROWD" value={crowd.toFixed(0)} valueColor={color.blue} />
          </Panel>
        </div>

        <HonkButton />
        <Banner visible={plunging && !gameOver} tone="alert" testId="plunge-banner">
          MIDWAY MELTDOWN
        </Banner>
        <RaidTelegraphBanner />
        <TrickOverlay />
        {gameOver && !photoMode && (
          <GameOverOverlay distance={distance} crowd={crowd} onRestart={startRun} />
        )}
      </HUDFrame>
    );
  }

  // Desktop / landscape / tablet — classic 4-corner layout
  return (
    <HUDFrame testId="hud">
      <Panel corner="tl" variant="dark">
        <Stat
          label="HYPE"
          value={hype.toFixed(0)}
          bar={{ value: Math.min(100, hype), tone: 'yellow' }}
          testId="hud-hype"
        />
      </Panel>

      <Panel corner="tr" variant="dark" testId="hud-stats">
        <Stat label="DISTANCE" value={distance.toFixed(0)} unit="m" />
        <div style={{ marginTop: space.sm }}>
          <Stat label="CRASHES" value={crashes} labelColor={color.red} />
        </div>
      </Panel>

      <Panel corner="bl" variant="dark" testId="hud-sanity">
        <Stat
          label="SANITY"
          value={sanity.toFixed(0)}
          bar={{ value: sanity, tone: 'red' }}
          labelColor={color.red}
        />
      </Panel>

      <Panel corner="br" variant="dark" testId="hud-crowd">
        <Stat label="CROWD" value={crowd.toFixed(0)} valueColor={color.blue} />
      </Panel>

      <HonkButton />
      <Banner visible={plunging && !gameOver} tone="alert" testId="plunge-banner">
        MIDWAY MELTDOWN
      </Banner>
      <RaidTelegraphBanner />
      <TrickOverlay />
      {gameOver && !photoMode && (
        <GameOverOverlay distance={distance} crowd={crowd} onRestart={startRun} />
      )}
    </HUDFrame>
  );
}

/** Color for each multiplier tier of the combo ring. */
const COMBO_RING_COLORS: Record<number, string> = {
  2: color.yellow,
  4: color.orange,
  8: color.red,
};

function useComboMultiplier() {
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

function HonkButton() {
  const mult = useComboMultiplier();
  const ringVisible = mult >= 2;
  const ringColor = COMBO_RING_COLORS[mult] ?? color.purple;
  const [showHonkHint, setShowHonkHint] = useState(() => shouldShow('first-honk'));

  // Mark first-honk tutorial as shown on first press
  useEffect(() => {
    return onHonk(() => {
      if (shouldShow('first-honk')) {
        setShowHonkHint(false);
        markShown('first-honk').catch(() => { /* non-critical */ });
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
      <BrandButton
        kind="primary"
        size="md"
        onClick={() => honk()}
        testId="honk-button"
      >
        HONK
      </BrandButton>
    </div>
  );
}

function GameOverOverlay({
  distance,
  crowd,
  onRestart,
}: {
  distance: number;
  crowd: number;
  onRestart: () => void;
}) {
  const setPhotoMode = useGameStore((s) => s.setPhotoMode);

  return (
    <div
      data-testid="game-over"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: color.overlayDim,
        pointerEvents: 'auto',
      }}
    >
      <div style={{ textAlign: 'center', padding: space.xl }}>
        <div
          style={{
            ...typeStyle(display.hero),
            color: color.red,
            fontSize: 'clamp(3rem, 10vw, 6rem)',
          }}
        >
          CROWD LOST IT!
        </div>
        <div
          style={{
            ...typeStyle(ui.body),
            marginTop: space.md,
            fontSize: '1.2rem',
            color: color.white,
          }}
        >
          Distance: {distance.toFixed(0)}m
        </div>
        <div
          style={{
            ...typeStyle(ui.body),
            fontSize: '1.2rem',
            color: color.white,
          }}
        >
          Crowd Reaction: {crowd.toFixed(0)}
        </div>
        <div style={{ marginTop: space.xl, display: 'flex', gap: space.md, justifyContent: 'center', flexWrap: 'wrap' }}>
          <BrandButton kind="primary" size="lg" onClick={onRestart} testId="restart-button">
            AGAIN!
          </BrandButton>
          <BrandButton
            kind="secondary"
            size="lg"
            onClick={() => setPhotoMode(true)}
            testId="photo-mode-button"
          >
            📸 PHOTO
          </BrandButton>
        </div>
      </div>
    </div>
  );
}

const RAID_KIND_LABEL: Record<RaidKind, string> = {
  TIGER: '🐯 TIGER ON THE TRACK!',
  KNIVES: '🔪 KNIVES INCOMING!',
  CANNONBALL: '💥 CANNONBALL!',
};

/** Feature B: Shows the 2s telegraph warning when a raid is about to fire. */
function RaidTelegraphBanner() {
  const [visible, setVisible] = useState(false);
  const [label, setLabel] = useState('');
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const poll = () => {
      // biome-ignore lint/suspicious/noExplicitAny: raid director
      const rd = (window as any).__mmRaidDirector;
      if (rd) {
        const s = rd.getState() as { kind: RaidKind; phase: string } | null;
        const show = s !== null && s.phase === 'telegraph';
        setVisible(show);
        if (show) setLabel(RAID_KIND_LABEL[s!.kind] ?? '');
      }
      rafRef.current = requestAnimationFrame(poll);
    };
    rafRef.current = requestAnimationFrame(poll);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <Banner
      visible={visible}
      tone="alert"
      testId="raid-telegraph-banner"
      style={{ top: '25%', fontSize: 'clamp(1.5rem, 5vw, 3rem)' }}
    >
      {label}
    </Banner>
  );
}

const TRICK_KIND_LABEL: Record<TrickKind, string> = {
  BARREL_ROLL: 'BARREL ROLL!',
  WHEELIE: 'WHEELIE!',
  HANDSTAND: 'HANDSTAND!',
  SPIN_180: 'SPIN 180!',
};

/** Feature C: Shows input buffer + trick name when airborne. */
function TrickOverlay() {
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

  const INPUT_SYMBOLS: Record<TrickInput, string> = {
    left: '←',
    right: '→',
    up: '↑',
    down: '↓',
  };

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

// re-export so `Banner` is available when needed (ZoneBanner now uses it)
export { Banner };
