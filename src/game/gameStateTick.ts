/**
 * @module game/gameStateTick
 *
 * Per-frame tick logic. Drives: drop-in progress, plunge timeout,
 * speed/distance/hype, zone derivation, sanity regen, combo tracking,
 * cleanliness EMA, plunge detection, and game-over-on-exhaustion.
 *
 * All state reads/writes use ECS traits on the player entity.
 */
import type { World } from 'koota';
import { trackArchetypes, tunables } from '@/config';
import {
  BoostState,
  DropIntro,
  GameplayStats,
  Player,
  PlungeState,
  Position,
  RunCounters,
  RunSession,
  Score,
  Speed,
  Steer,
} from '@/ecs/traits';
import type { PieceKind } from '@/track/trackComposer';
import type { ZoneId } from '@/utils/constants';
import { TRACK } from '@/utils/constants';
import { combo } from './comboSystem';
import { CLEANLINESS_EMA, DEVIATION_MAX_M, updateDeviationWindow } from './deviationWindow';
import { hapticsBus } from './hapticsBus';
import { getOptimalPath } from './runPlanRefs';

/** Ramp piece kinds that have no side rails — plunge risk zone. */
export const RAMP_KINDS: ReadonlySet<PieceKind> = new Set(['ramp', 'rampLong', 'rampLongCurved']);

/** How far beyond the lateral clamp the player must drift to trigger a plunge. */
const PLUNGE_OVERSHOOT_M = 0.5;

/** Duration of the plunge animation in seconds. */
export const PLUNGE_DURATION_S = 1.5;

/** Duration of the drop-in intro in milliseconds. */
export const DROP_DURATION_MS = 1800;

export function tickGameState(dt: number, now: number, w: World): void {
  const players = w.query(
    Player,
    RunSession,
    GameplayStats,
    BoostState,
    DropIntro,
    PlungeState,
    RunCounters,
  );
  const pe = players[0];
  if (!pe) return;

  const rs = pe.get(RunSession)!;
  if (!rs.running || rs.paused || rs.gameOver) return;

  const di = pe.get(DropIntro)!;
  const gs = pe.get(GameplayStats)!;
  const bs = pe.get(BoostState)!;
  const ps = pe.get(PlungeState)!;
  const rc = pe.get(RunCounters)!;
  const optimalPath = getOptimalPath();

  // During drop-in, only advance dropProgress and freeze gameplay
  if (di.dropProgress < 1) {
    const p = Math.min(1, (now - di.dropStartedAt) / DROP_DURATION_MS);
    pe.set(DropIntro, { ...di, dropProgress: p });
    return;
  }

  // If already plunging, check if animation is done
  if (ps.plunging) {
    const elapsed = (now - ps.plungeStartedAt) / 1000;
    if (elapsed >= PLUNGE_DURATION_S) {
      pe.set(RunSession, { ...rs, running: false, gameOver: true });
      pe.set(PlungeState, { ...ps, plunging: false });
    }
    return;
  }

  // Speed interpolation toward target; target climbs slowly over time.
  const { cruiseMps, boostMps, megaMps, rampStartMps, rampPerMetre, interpResponse } =
    tunables.speed;
  let target = Math.min(cruiseMps, rampStartMps + gs.distance * rampPerMetre);
  if (now < bs.boostUntil) target = boostMps;
  if (now < bs.megaBoostUntil) target = megaMps;
  target *= gs.throttle;
  const speed = gs.speedMps + (target - gs.speedMps) * Math.min(1, dt * interpResponse);
  const distance = gs.distance + speed * dt;
  const hype = (speed / megaMps) * 100;

  // Consume Steer trait (written by keyboard / TouchControls / governor)
  // into lateral. Clamp to the paved surface so the player can't drive
  // off into the void. Write both the GameplayStats lateral (read by
  // plunge detector + racing-line meter) and the Steer-derived motion.
  const steer = pe.get(Steer)?.value ?? 0;
  const halfWidth = (trackArchetypes.laneWidth * trackArchetypes.lanes) / 2;
  const maxLateral = halfWidth - trackArchetypes.laneWidth * 0.4;
  let lateral = gs.lateral + steer * tunables.maxSteerRate * dt;
  if (lateral > maxLateral) lateral = maxLateral;
  if (lateral < -maxLateral) lateral = -maxLateral;

  // Zone derivation (simple cycle every 450 units across 4 zones)
  const zIdx = Math.floor(distance / 450) % 4;
  const currentZone: ZoneId =
    (['midway-strip', 'balloon-alley', 'ring-of-fire', 'funhouse-frenzy'] as const)[zIdx] ??
    'midway-strip';

  // Sanity regen slowly
  const sanity = Math.min(100, gs.sanity + dt * 2);

  const currentChain = combo.getChainLength();
  const maxComboThisRun = Math.max(rc.maxComboThisRun, currentChain);

  // Racing-line cleanliness: update deviation window and smooth with EMA.
  let nextCleanliness = gs.cleanliness;
  if (optimalPath !== null) {
    const msd = updateDeviationWindow(distance, lateral, optimalPath);
    const raw = Math.max(0, 1 - msd / (DEVIATION_MAX_M * DEVIATION_MAX_M));
    nextCleanliness = gs.cleanliness + CLEANLINESS_EMA * (raw - gs.cleanliness);
  }

  pe.set(GameplayStats, {
    ...gs,
    speedMps: speed,
    targetSpeedMps: target,
    distance,
    lateral,
    steer,
    hype,
    sanity,
    currentZone,
    cleanliness: nextCleanliness,
  });

  // Keep the legacy Position/Speed/Score traits in sync so the v2 renderers
  // (Track, TrackContent, Cockpit, DiegeticHUD) and ECS gameOver detector
  // all see the same distance/speed as GameplayStats.
  const pos = pe.get(Position);
  if (pos) {
    pe.set(Position, { distance, lateral });
  }
  const sp = pe.get(Speed);
  if (sp) {
    pe.set(Speed, { value: speed, target });
  }
  const sc = pe.get(Score);
  if (sc) {
    // Score = cumulative distance * cleanliness multiplier. Keeps the HUD
    // diegetic read the same number gameState uses for end-of-run summary.
    pe.set(Score, { ...sc, value: distance * (1 + nextCleanliness) });
  }

  if (maxComboThisRun !== rc.maxComboThisRun) {
    pe.set(RunCounters, { ...rc, maxComboThisRun });
  }

  // Plunge detection
  const plungeThreshold = TRACK.LATERAL_CLAMP + PLUNGE_OVERSHOOT_M;
  if (
    !ps.plunging &&
    Math.abs(lateral) > plungeThreshold &&
    ps.currentPieceKind !== null &&
    RAMP_KINDS.has(ps.currentPieceKind)
  ) {
    pe.set(PlungeState, {
      ...ps,
      plunging: true,
      plungeStartedAt: now,
      plungeDirection: Math.sign(lateral),
    });
    hapticsBus.fire('crash-heavy');
    return;
  }

  // Game over when sanity exhausted
  if (sanity <= 0) {
    pe.set(RunSession, { ...rs, running: false, gameOver: true });
  }
}
