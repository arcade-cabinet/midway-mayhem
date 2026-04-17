/**
 * RaidDirector — Feature B (Ringmaster Raids).
 *
 * Schedules tentpole hazard events every 30-45s. Each raid fires a 2s telegraph
 * (zoom-in warning banner), executes the event, then cleans up.
 *
 * Three raid types:
 *   TIGER    — critter crosses laterally; jump (ramp trick) to dodge, else heavy crash.
 *   KNIVES   — 5 knives drop over 2s; each missed = light damage.
 *   CANNONBALL — cannonball at player's lane; swerve within 1s or heavy crash.
 */

import type { Rng } from '@/utils/rng';

export type RaidKind = 'TIGER' | 'KNIVES' | 'CANNONBALL';

export type RaidPhase = 'idle' | 'telegraph' | 'active' | 'cleanup';

export interface KnifeState {
  lane: number;
  dropAt: number; // performance.now() when this knife hits
  hit: boolean; // player was in lane when knife fell
  dodged: boolean;
}

export interface RaidState {
  kind: RaidKind;
  phase: RaidPhase;
  startedAt: number; // performance.now() when raid began
  telegraphDuration: number; // ms
  activeDuration: number; // ms
  /** TIGER: track distance of the tiger */
  tigerD?: number;
  tigerLateralProgress?: number; // 0–1 crossing progress
  /** KNIVES: array of knife states */
  knives?: KnifeState[];
  /** CANNONBALL: which lane is targeted */
  cannonballLane?: number;
  cannonballFiredAt?: number;
  cannonballDodged?: boolean;
}

const TELEGRAPH_MS = 2000;
const TIGER_ACTIVE_MS = 3000;
const KNIVES_ACTIVE_MS = 2500;
const CANNONBALL_ACTIVE_MS = 2000;

export class RaidDirector {
  private state: RaidState | null = null;
  private nextRaidAt: number = 0; // performance.now() epoch

  constructor(private rng: Rng) {}

  /** Call each frame with current game time and player state. */
  update(
    nowMs: number,
    playerDistance: number,
    playerLateral: number,
    airborne: boolean,
    running: boolean,
    callbacks: {
      onTelegraph: (kind: RaidKind) => void;
      onHeavyCrash: () => void;
      onLightCrash: () => void;
      onCrowdBonus: (amount: number) => void;
    },
  ) {
    if (!running) {
      this.state = null;
      return;
    }

    // Schedule first raid
    if (this.nextRaidAt === 0) {
      this.nextRaidAt = nowMs + this.rng.range(30_000, 45_000);
    }

    // Start a new raid?
    if (!this.state && nowMs >= this.nextRaidAt) {
      this.beginRaid(nowMs, playerDistance, playerLateral);
      const started = this.state as RaidState | null;
      if (started) callbacks.onTelegraph(started.kind);
    }

    if (!this.state) return;
    const s = this.state;
    const elapsed = nowMs - s.startedAt;

    // Telegraph → active transition
    if (s.phase === 'telegraph' && elapsed >= s.telegraphDuration) {
      s.phase = 'active';
    }

    // Active → cleanup transition
    const totalDuration = s.telegraphDuration + s.activeDuration;
    if (s.phase === 'active' && elapsed >= totalDuration) {
      s.phase = 'cleanup';
      this.resolveRaid(playerLateral, airborne, callbacks);
      this.nextRaidAt = nowMs + this.rng.range(30_000, 45_000);
      // Cleanup auto-finishes after one frame
      this.state = null;
      return;
    }

    // Per-kind active logic
    if (s.phase === 'active') {
      const activeElapsed = elapsed - s.telegraphDuration;

      if (s.kind === 'TIGER') {
        // Tiger crosses at constant pace — lateral from -6 to +6
        s.tigerLateralProgress = Math.min(1, activeElapsed / s.activeDuration);
      }

      if (s.kind === 'KNIVES' && s.knives) {
        for (const knife of s.knives) {
          if (knife.hit || knife.dodged) continue;
          if (nowMs >= knife.dropAt) {
            // Check collision: player in same lane?
            const knifeLat = (knife.lane - 1) * 3.3; // lane center X
            const inLane = Math.abs(knifeLat - playerLateral) < 1.65;
            if (inLane) {
              knife.hit = true;
              callbacks.onLightCrash();
            } else {
              knife.dodged = true;
            }
          }
        }
      }

      if (s.kind === 'CANNONBALL' && s.cannonballFiredAt !== undefined && !s.cannonballDodged) {
        if (nowMs >= s.cannonballFiredAt + s.activeDuration) {
          // Time's up — check if player swerved
          const cbLat = ((s.cannonballLane ?? 1) - 1) * 3.3;
          const inLane = Math.abs(cbLat - playerLateral) < 1.65;
          if (inLane) {
            callbacks.onHeavyCrash();
          } else {
            callbacks.onCrowdBonus(75);
          }
          s.cannonballDodged = true;
        }
      }
    }
  }

  private beginRaid(nowMs: number, playerDistance: number, playerLateral: number) {
    const kind = (['TIGER', 'KNIVES', 'CANNONBALL'] as const)[this.rng.int(0, 3)] ?? 'TIGER';
    const activeDuration =
      kind === 'TIGER'
        ? TIGER_ACTIVE_MS
        : kind === 'KNIVES'
          ? KNIVES_ACTIVE_MS
          : CANNONBALL_ACTIVE_MS;

    const state: RaidState = {
      kind,
      phase: 'telegraph',
      startedAt: nowMs,
      telegraphDuration: TELEGRAPH_MS,
      activeDuration,
    };

    if (kind === 'TIGER') {
      state.tigerD = playerDistance + 30;
      state.tigerLateralProgress = 0;
    }

    if (kind === 'KNIVES') {
      const activeMsPerKnife = KNIVES_ACTIVE_MS / 5;
      state.knives = Array.from({ length: 5 }, (_, i) => ({
        lane: this.rng.int(0, 3),
        dropAt: nowMs + TELEGRAPH_MS + activeMsPerKnife * i + activeMsPerKnife * 0.5,
        hit: false,
        dodged: false,
      }));
    }

    if (kind === 'CANNONBALL') {
      // Target player's current lane
      const playerLane = playerLateral < -1.65 ? 0 : playerLateral > 1.65 ? 2 : 1;
      state.cannonballLane = playerLane;
      state.cannonballFiredAt = nowMs + TELEGRAPH_MS;
      state.cannonballDodged = false;
    }

    this.state = state;
  }

  private resolveRaid(
    playerLateral: number,
    airborne: boolean,
    callbacks: {
      onHeavyCrash: () => void;
      onCrowdBonus: (amount: number) => void;
      onLightCrash: () => void;
    },
  ) {
    const s = this.state;
    if (!s) return;

    if (s.kind === 'TIGER') {
      // Tiger is at 50% lateral progress when it crosses player zone
      if (airborne) {
        callbacks.onCrowdBonus(100);
      } else {
        // Check if tiger path crosses player lateral
        const tigerLat = -6 + (s.tigerLateralProgress ?? 0.5) * 12;
        if (Math.abs(tigerLat - playerLateral) < 2) {
          callbacks.onHeavyCrash();
        } else {
          callbacks.onCrowdBonus(50);
        }
      }
    }
    // KNIVES and CANNONBALL are resolved per-frame in update()
  }

  getState(): Readonly<RaidState> | null {
    return this.state;
  }

  reset(nowMs: number) {
    this.state = null;
    this.nextRaidAt = nowMs + this.rng.range(30_000, 45_000);
  }

  /** For testing: force schedule next raid immediately */
  forceNextRaidAt(nowMs: number) {
    this.nextRaidAt = nowMs;
  }
}
