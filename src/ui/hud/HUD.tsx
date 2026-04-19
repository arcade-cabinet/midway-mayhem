import { Banner } from '@/design/components/Banner';
import { HUDFrame } from '@/design/components/HUDFrame';
import { Panel } from '@/design/components/Panel';
import { Stat } from '@/design/components/Stat';
import { color, safeArea, space } from '@/design/tokens';
import { useGameStore } from '@/game/gameState';
import { useFormFactor } from '@/hooks/useFormFactor';
import { RacingLineMeter } from './RacingLineMeter';
import { RaidTelegraphBanner } from './RaidTelegraphBanner';
import { TrickOverlay } from './TrickOverlay';

export function HUD() {
  const hype = useGameStore((s) => s.hype);
  const distance = useGameStore((s) => s.distance);
  const crashes = useGameStore((s) => s.crashes);
  const sanity = useGameStore((s) => s.sanity);
  const crowd = useGameStore((s) => s.crowdReaction);
  const gameOver = useGameStore((s) => s.gameOver);
  const plunging = useGameStore((s) => s.plunging);
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

        {/* Bottom row: SANITY bar + CROWD score + racing-line meter */}
        <div
          style={{
            position: 'absolute',
            bottom: `calc(${space.md}px + ${safeArea.bottom})`,
            left: `calc(${space.md}px + ${safeArea.left})`,
            right: `calc(${space.md}px + ${safeArea.right})`,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
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
          <Panel variant="dark">
            <RacingLineMeter />
          </Panel>
        </div>

        <Banner visible={plunging && !gameOver} tone="alert" testId="plunge-banner">
          MIDWAY MELTDOWN
        </Banner>
        <RaidTelegraphBanner />
        <TrickOverlay />
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
        <div style={{ marginTop: space.sm }}>
          <RacingLineMeter />
        </div>
      </Panel>

      <Panel corner="br" variant="dark" testId="hud-crowd">
        <Stat label="CROWD" value={crowd.toFixed(0)} valueColor={color.blue} />
      </Panel>

      <Banner visible={plunging && !gameOver} tone="alert" testId="plunge-banner">
        MIDWAY MELTDOWN
      </Banner>
      <RaidTelegraphBanner />
      <TrickOverlay />
    </HUDFrame>
  );
}

// re-export so `Banner` is available when needed (ZoneBanner now uses it)
export { Banner };
