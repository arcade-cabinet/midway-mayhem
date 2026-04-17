import { Banner } from '../design/components/Banner';
import { BrandButton } from '../design/components/BrandButton';
import { HUDFrame } from '../design/components/HUDFrame';
import { Panel } from '../design/components/Panel';
import { Stat } from '../design/components/Stat';
import { color, safeArea, space } from '../design/tokens';
import { display, typeStyle, ui } from '../design/typography';
import { useFormFactor } from '../hooks/useFormFactor';
import { audioBus } from '../systems/audioBus';
import { useGameStore } from '../systems/gameState';

export function HUD() {
  const hype = useGameStore((s) => s.hype);
  const distance = useGameStore((s) => s.distance);
  const crashes = useGameStore((s) => s.crashes);
  const sanity = useGameStore((s) => s.sanity);
  const crowd = useGameStore((s) => s.crowdReaction);
  const gameOver = useGameStore((s) => s.gameOver);
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
          <Panel variant="dark">
            <Stat
              label="DISTANCE"
              value={distance.toFixed(0)}
              unit="m"
              testId="hud-stats"
            />
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
        {gameOver && <GameOverOverlay distance={distance} crowd={crowd} onRestart={startRun} />}
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

      <Panel corner="tr" variant="dark">
        <Stat label="DISTANCE" value={distance.toFixed(0)} unit="m" testId="hud-stats" />
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
      {gameOver && <GameOverOverlay distance={distance} crowd={crowd} onRestart={startRun} />}
    </HUDFrame>
  );
}

function HonkButton() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: `calc(${space.lg}px + ${safeArea.bottom})`,
        left: '50%',
        transform: 'translateX(-50%)',
      }}
    >
      <BrandButton
        kind="primary"
        size="md"
        onClick={() => audioBus.playHonk()}
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
        <div style={{ marginTop: space.xl }}>
          <BrandButton
            kind="primary"
            size="lg"
            onClick={onRestart}
            testId="restart-button"
          >
            AGAIN!
          </BrandButton>
        </div>
      </div>
    </div>
  );
}

// re-export so `Banner` is available when needed (ZoneBanner now uses it)
export { Banner };
