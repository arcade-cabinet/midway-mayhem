/**
 * @module game/rampDetect
 *
 * Ramp detection via track Y-displacement sampling.
 *
 * Because the procedural track has no explicit ramp-piece metadata, we
 * detect launch conditions by comparing the track surface Y at the
 * player's current distance against Y at a look-ahead distance. When
 * the surface rises significantly within a short look-ahead window AND
 * the player is moving fast enough, the player is on an upward-sloped
 * launch ramp and will soon be airborne.
 *
 * Airborne window: once the player crosses the crest (Y stops rising),
 * we hold the `airborne` flag for `airborneWindowMs` milliseconds to
 * give the player time to input a trick. The flag clears automatically.
 *
 * All thresholds come from tunables.tricks — never hardcoded here.
 */
import { tunables } from '@/config';
import { sampleTrack } from '@/track/trackGenerator';

const t = tunables.tricks;

interface RampDetectState {
  /** Whether the player is currently in the airborne window. */
  airborne: boolean;
  /** performance.now() timestamp when the airborne window expires. */
  airborneUntil: number;
}

/**
 * Stateful ramp detector. One instance lives for the duration of a run
 * (created/reset alongside TrickSystem in useGameSystems).
 */
export class RampDetect {
  private state: RampDetectState = { airborne: false, airborneUntil: 0 };

  /**
   * Call once per frame while the run is active.
   *
   * @param distanceM  Player's current track distance (meters)
   * @param speedMps   Player's current speed (m/s)
   * @param nowMs      Current timestamp (performance.now())
   * @returns          true when the player is in the airborne window
   */
  update(distanceM: number, speedMps: number, nowMs: number): boolean {
    const yHere = sampleTrack(distanceM).y;
    const yAhead = sampleTrack(distanceM + t.rampLookAheadM).y;
    const yRise = yAhead - yHere;

    const onRamp = yRise >= t.rampYRiseThreshold && speedMps >= t.rampMinSpeedMps;

    if (onRamp) {
      // Extend (or start) the airborne window from now
      this.state.airborneUntil = nowMs + t.airborneWindowMs;
      this.state.airborne = true;
    } else if (nowMs >= this.state.airborneUntil) {
      this.state.airborne = false;
    }

    return this.state.airborne;
  }

  /** True while inside the airborne window (without advancing the simulation). */
  isAirborne(): boolean {
    return this.state.airborne;
  }

  reset(): void {
    this.state = { airborne: false, airborneUntil: 0 };
  }
}
