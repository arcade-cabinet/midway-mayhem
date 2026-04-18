/**
 * @module game/runPlan
 *
 * Pre-baked run plan. Called once at run-start to enumerate every obstacle,
 * pickup, balloon anchor, mirror room, critter idle position, and fire-hoop
 * gate for the entire track — computed from the track RNG channel, which
 * advances ZERO times during play.
 *
 * Why this matters:
 *   - Deterministic runs: same seed phrase → identical world, frame 0 on
 *   - Idle animations for critters long before the player arrives (their GLB
 *     idle clips loop in place so the midway feels alive from a distance)
 *   - Perf: one-shot spawn decisions at startup instead of per-frame probes
 *   - Replay: the plan is the single ground truth a replay file must match
 *
 * In-run event sources (AI raids, barker callouts, visual jitter, mirror
 * warp variance) still use the events channel — those are TIMING decisions,
 * not PLACEMENT, and their randomness cannot perturb the plan.
 */

import type { CritterKind, ObstacleType, PickupType } from '@/utils/constants';
import type { Rng } from '@/utils/rng';

/** Furthest we generate spawns ahead of the player at run start. */
export const RUN_PLAN_DISTANCE_M = 4000;

export interface PlannedObstacle {
  /** Along-track distance in metres. */
  d: number;
  /** Lane index [0..LANE_COUNT-1]. */
  lane: number;
  type: ObstacleType;
  /** Critter (cow/horse/llama/pig) for types that spawn animals. */
  critter?: CritterKind;
  /** Random rotation about Y for variety (rads). */
  yaw: number;
  /** Idle animation offset so critters don't breathe in sync. */
  idlePhase: number;
}

export interface PlannedPickup {
  d: number;
  lane: number;
  type: PickupType;
  yaw: number;
}

export interface PlannedBalloonAnchor {
  /** Where the balloon tether is anchored. */
  d: number;
  startLateral: number;
  endLateral: number;
  driftStart: number;
  driftDuration: number;
  color: string;
}

export interface PlannedMirrorRoom {
  d: number;
  widthM: number;
  /** Which lanes contain phantom duplicates inside the room. */
  phantomLanes: number[];
  flickerPeriod: number;
  flickerPhase: number;
}

export interface PlannedFireHoop {
  d: number;
  lane: number;
  /** Radius of the emissive ring (m). */
  radius: number;
}

export interface StartPlatform {
  /** Along-track distance — always 0. */
  d: 0;
  /** Width/depth of the wire-hung launching pad (m). */
  widthM: number;
  depthM: number;
}

export interface FinishBanner {
  /** Along-track distance where the checkered banner stands. */
  d: number;
  /** Width of the goal platform past the banner (m). */
  goalPlatformDepthM: number;
}

export interface RunPlan {
  /** Total along-track distance baked (from start platform to finish goal). */
  distance: number;
  /** Master seed this plan was built from. */
  seed: number;
  startPlatform: StartPlatform;
  finishBanner: FinishBanner;
  obstacles: PlannedObstacle[];
  pickups: PlannedPickup[];
  balloons: PlannedBalloonAnchor[];
  mirrorRooms: PlannedMirrorRoom[];
  fireHoops: PlannedFireHoop[];
}

// ─── Pool helpers ───────────────────────────────────────────────────────────

const BALLOON_COLORS = ['#e53935', '#ffd600', '#1e88e5', '#8e24aa', '#f36f21', '#43a047'];

const CRITTER_KINDS: CritterKind[] = ['cow', 'horse', 'llama', 'pig'];

// ─── Planner ─────────────────────────────────────────────────────────────────

/**
 * Bake the full run plan from the track RNG channel. Advances trackRng only;
 * eventsRng is never touched here. Should run in well under 10ms even for a
 * 4km track (tens of thousands of entries).
 */
export function buildRunPlan(opts: { seed: number; trackRng: Rng; distance?: number }): RunPlan {
  const distance = opts.distance ?? RUN_PLAN_DISTANCE_M;
  const rng = opts.trackRng;

  const obstacles: PlannedObstacle[] = [];
  const pickups: PlannedPickup[] = [];
  const balloons: PlannedBalloonAnchor[] = [];
  const mirrorRooms: PlannedMirrorRoom[] = [];
  const fireHoops: PlannedFireHoop[] = [];

  // Obstacles: avg gap 18m, jitter ±6m.
  {
    let d = 40;
    while (d < distance) {
      const type = pickObstacleType(rng);
      const obs: PlannedObstacle = {
        d,
        lane: rng.int(0, 3),
        type,
        yaw: rng.range(0, Math.PI * 2),
        idlePhase: rng.range(0, Math.PI * 2),
      };
      if (type === 'critter') {
        obs.critter = CRITTER_KINDS[rng.int(0, CRITTER_KINDS.length)] ?? 'cow';
      }
      obstacles.push(obs);
      d += 18 + rng.range(-6, 6);
    }
  }

  // Pickups: avg gap 22m, jitter ±5m; tickets common, boost rarer, mega rare.
  {
    let d = 25;
    while (d < distance) {
      const roll = rng.next();
      const type: PickupType = roll < 0.75 ? 'ticket' : roll < 0.95 ? 'boost' : 'mega';
      pickups.push({
        d,
        lane: rng.int(0, 3),
        type,
        yaw: rng.range(0, Math.PI * 2),
      });
      d += 22 + rng.range(-5, 5);
    }
  }

  // Balloons: avg gap 28m, drift from one side to the other.
  {
    let d = 60;
    while (d < distance) {
      const startLat = rng.range(-8, 8);
      const endLat = startLat + rng.range(3, 10) * (rng.next() > 0.5 ? 1 : -1);
      balloons.push({
        d,
        startLateral: startLat,
        endLateral: endLat,
        driftStart: 0,
        driftDuration: 3.5 + rng.range(0, 1),
        color: BALLOON_COLORS[rng.int(0, BALLOON_COLORS.length)] ?? '#ffd600',
      });
      d += 28 + rng.range(-8, 8);
    }
  }

  // Mirror rooms: sparser, avg gap 220m.
  {
    let d = 180;
    while (d < distance) {
      const phantomCount = rng.int(1, 3);
      const phantomLanes: number[] = [];
      for (let i = 0; i < phantomCount; i++) {
        phantomLanes.push(rng.int(0, 3));
      }
      mirrorRooms.push({
        d,
        widthM: 24,
        phantomLanes,
        flickerPeriod: 0.1 + rng.range(0, 0.3),
        flickerPhase: rng.range(0, Math.PI * 2),
      });
      d += 220 + rng.range(-40, 40);
    }
  }

  // Fire hoops: rare, avg gap 340m, always ramp-like radii.
  {
    let d = 280;
    while (d < distance) {
      fireHoops.push({
        d,
        lane: rng.int(0, 3),
        radius: 2.4 + rng.range(0, 0.6),
      });
      d += 340 + rng.range(-60, 60);
    }
  }

  const startPlatform: StartPlatform = { d: 0, widthM: 14, depthM: 10 };
  const finishBanner: FinishBanner = {
    d: distance,
    goalPlatformDepthM: 24,
  };

  return {
    distance,
    seed: opts.seed,
    startPlatform,
    finishBanner,
    obstacles,
    pickups,
    balloons,
    mirrorRooms,
    fireHoops,
  };
}

// ─── Weighted obstacle picker ──────────────────────────────────────────────

/**
 * Per-type spawn weights. 'critter' is the most common because we want an
 * animal-dense circus; 'wall' and 'hoop-barrier' are rare tension spikes.
 */
const OBSTACLE_WEIGHTS: Record<ObstacleType, number> = {
  critter: 5,
  cones: 4,
  barrier: 2.5,
  oil: 1.5,
  hammer: 0.8,
  gate: 0.4,
};

function pickObstacleType(rng: Rng): ObstacleType {
  let total = 0;
  for (const w of Object.values(OBSTACLE_WEIGHTS)) total += w;
  let r = rng.next() * total;
  for (const [type, weight] of Object.entries(OBSTACLE_WEIGHTS)) {
    r -= weight;
    if (r <= 0) return type as ObstacleType;
  }
  return 'cones';
}
