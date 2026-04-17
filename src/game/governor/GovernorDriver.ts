import { eventsRng } from '@/game/runRngBus';
import { laneCenterAt, sampleLookahead } from '@/track/trackGenerator';
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

/**
 * Cockpit-POV autonomous driver. Uses a simplified form of Yuka's
 * FollowPath + ObstacleAvoidance + Seek, without requiring the full Yuka
 * Vehicle hierarchy — we only need a steering scalar.
 */
export class GovernorDriver {
  private jitter = 0;

  constructor(
    private params = {
      lookaheadMeters: 40,
      avoidWindow: 30,
      pickupWindow: 20,
      laneSwitchBias: 0.6,
      skill: 0.92, // 0..1
    },
  ) {}

  step(input: GovernorInput, dt: number): GovernorOutput {
    // 1. Sample upcoming track center; pick a point ahead to aim at
    const samples = sampleLookahead(input.playerD, 8, 5);
    const target =
      samples[Math.min(samples.length - 1, Math.floor(this.params.lookaheadMeters / 5))];
    if (!target)
      return {
        steer: 0,
        debug: { targetLane: 0, targetX: 0, avoidedObstacles: 0, seekingPickup: false },
      };

    // 2. Evaluate each lane for "safety" in the avoid window
    const laneScores: number[] = [];
    let avoidedObstacles = 0;
    for (let lane = 0; lane < TRACK.LANE_COUNT; lane++) {
      let score = 0;
      const laneWorld = laneCenterAt(input.playerD + this.params.lookaheadMeters, lane);
      for (const o of input.obstacles) {
        const dd = o.d - input.playerD;
        if (dd < 2 || dd > this.params.avoidWindow) continue;
        const dx = Math.abs(laneWorld.x - o.x);
        if (dx < 2.2) {
          score -= 4 * (1 - dd / this.params.avoidWindow);
          avoidedObstacles++;
        }
      }
      for (const p of input.pickups) {
        const dd = p.d - input.playerD;
        if (dd < 2 || dd > this.params.pickupWindow) continue;
        const dx = Math.abs(laneWorld.x - p.x);
        if (dx < 2.2) {
          const weight = p.type === 'mega' ? 3 : p.type === 'boost' ? 1.2 : 0.5;
          score += weight * (1 - dd / this.params.pickupWindow);
        }
      }
      laneScores.push(score);
    }

    // 3. Pick the best lane (weighted by proximity to current)
    let bestLane = 0;
    let bestScore = -Infinity;
    const halfWidth = (TRACK.LANE_COUNT - 1) * TRACK.LANE_WIDTH * 0.5;
    const currentLaneFloat = (input.playerLateral + halfWidth) / TRACK.LANE_WIDTH;
    for (let lane = 0; lane < TRACK.LANE_COUNT; lane++) {
      const proximityPenalty = Math.abs(lane - currentLaneFloat) * this.params.laneSwitchBias;
      const score = (laneScores[lane] ?? 0) - proximityPenalty;
      if (score > bestScore) {
        bestScore = score;
        bestLane = lane;
      }
    }

    // 4. Compute target world X for the chosen lane at lookahead point
    const targetWorld = laneCenterAt(input.playerD + this.params.lookaheadMeters, bestLane);
    const offset = targetWorld.x - (input.playerLateral + 0);
    // Normalize offset into a steer value; add small jitter to avoid perfection
    // Events channel so governor play is replay-deterministic per seed.
    this.jitter += (eventsRng().next() - 0.5) * dt * 2;
    this.jitter = Math.max(-0.08, Math.min(0.08, this.jitter));
    const steerRaw = Math.max(-1, Math.min(1, offset * 0.08 + this.jitter));
    const steer = steerRaw * this.params.skill;

    return {
      steer,
      debug: {
        targetLane: bestLane,
        targetX: targetWorld.x,
        avoidedObstacles,
        seekingPickup: bestScore > 0,
      },
    };
  }
}
