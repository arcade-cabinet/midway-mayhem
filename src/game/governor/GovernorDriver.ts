/**
 * @module game/governor/GovernorDriver
 *
 * Cockpit-POV autonomous driver. Uses a simplified form of
 * FollowPath + ObstacleAvoidance + Seek to compute a steer scalar.
 * Used by the Governor R3F component and the e2e autoplay harness.
 */
import { eventsRng } from '@/game/runRngBus';
import { sampleLookahead } from '@/track/trackGenerator';
import { TRACK } from '@/utils/constants';

export interface GovernorInput {
  playerD: number;
  playerLateral: number;
  obstacles: Array<{ d: number; x: number; z: number; type: string; radius: number }>;
  pickups: Array<{ d: number; x: number; z: number; type: string; radius: number }>;
}

export interface GovernorOutput {
  steer: number; // normalized [-1, 1]
  debug: {
    targetLane: number;
    targetX: number;
    avoidedObstacles: number;
    seekingPickup: boolean;
  };
}

export class GovernorDriver {
  private jitter = 0;

  constructor(
    private params = {
      lookaheadMeters: 40,
      avoidWindow: 30,
      pickupWindow: 20,
      laneSwitchBias: 0.6,
      skill: 0.92,
    },
  ) {}

  step(input: GovernorInput, dt: number): GovernorOutput {
    const samples = sampleLookahead(input.playerD, 8, 5);
    const target =
      samples[Math.min(samples.length - 1, Math.floor(this.params.lookaheadMeters / 5))];
    if (!target)
      return {
        steer: 0,
        debug: { targetLane: 0, targetX: 0, avoidedObstacles: 0, seekingPickup: false },
      };

    // Obstacles, pickups, and playerLateral are all in TRACK-RELATIVE
    // coords — lateral offset from the track centerline, in meters.
    // laneCenterAt returns WORLD coords (includes track curve offset),
    // which is wrong for comparing against .x/.lateral here. Compute
    // the lateral offset for each lane directly instead.
    const halfWidth = (TRACK.LANE_COUNT - 1) * TRACK.LANE_WIDTH * 0.5;
    const laneLateralAt = (lane: number): number => lane * TRACK.LANE_WIDTH - halfWidth;

    const laneScores: number[] = [];
    let avoidedObstacles = 0;
    for (let lane = 0; lane < TRACK.LANE_COUNT; lane++) {
      let score = 0;
      const laneLateral = laneLateralAt(lane);
      for (const o of input.obstacles) {
        const dd = o.d - input.playerD;
        if (dd < 2 || dd > this.params.avoidWindow) continue;
        const dx = Math.abs(laneLateral - o.x);
        if (dx < 2.2) {
          score -= 4 * (1 - dd / this.params.avoidWindow);
          avoidedObstacles++;
        }
      }
      for (const p of input.pickups) {
        const dd = p.d - input.playerD;
        if (dd < 2 || dd > this.params.pickupWindow) continue;
        const dx = Math.abs(laneLateral - p.x);
        if (dx < 2.2) {
          const weight = p.type === 'mega' ? 3 : p.type === 'boost' ? 1.2 : 0.5;
          score += weight * (1 - dd / this.params.pickupWindow);
        }
      }
      laneScores.push(score);
    }

    let bestLane = 0;
    let bestScore = -Infinity;
    const currentLaneFloat = (input.playerLateral + halfWidth) / TRACK.LANE_WIDTH;
    for (let lane = 0; lane < TRACK.LANE_COUNT; lane++) {
      const proximityPenalty = Math.abs(lane - currentLaneFloat) * this.params.laneSwitchBias;
      const score = (laneScores[lane] ?? 0) - proximityPenalty;
      if (score > bestScore) {
        bestScore = score;
        bestLane = lane;
      }
    }

    // Drive toward the best lane's TRACK-RELATIVE center, not a world-space
    // point that includes the track's curve offset — previously the curve
    // offset got added on top of lateral, which consistently pinned the
    // steer right and crashed the autopilot into obstacles around 300m.
    const targetLateral = laneLateralAt(bestLane);
    const offset = targetLateral - input.playerLateral;
    this.jitter += (eventsRng().next() - 0.5) * dt * 2;
    this.jitter = Math.max(-0.08, Math.min(0.08, this.jitter));
    const steerRaw = Math.max(-1, Math.min(1, offset * 0.08 + this.jitter));
    const steer = steerRaw * this.params.skill;

    return {
      steer,
      debug: {
        targetLane: bestLane,
        targetX: targetLateral,
        avoidedObstacles,
        seekingPickup: bestScore > 0,
      },
    };
  }
}
