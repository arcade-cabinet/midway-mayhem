/**
 * RampDetect — samples track Y ahead of the player to decide whether
 * the car is airborne after a ramp launch.
 *
 * The detector fires when the look-ahead Y-rise >= rampYRiseThreshold AND
 * the current speed exceeds rampMinSpeedMps.  Once triggered the airborne
 * window is held for airborneWindowMs so short-lived ramp launches still
 * have enough time for the player to queue a trick input.
 *
 * All constants come from tunables.json under `tricks.*`.
 */
import { tunables } from '@/config';
import { sampleTrack } from '@/track/trackGenerator';

interface RampDetectState {
  airborne: boolean;
  airborneUntil: number;
}

export class RampDetect {
  private state: RampDetectState = { airborne: false, airborneUntil: 0 };

  /**
   * Evaluate whether the car is currently airborne.
   *
   * @param distanceM  Current player distance along the track (metres).
   * @param speedMps   Current player speed (m/s).
   * @param nowMs      Current timestamp (performance.now()).
   * @returns `true` while the airborne window is open.
   */
  update(distanceM: number, speedMps: number, nowMs: number): boolean {
    const t = tunables.tricks;
    const yHere = sampleTrack(distanceM).y;
    const yAhead = sampleTrack(distanceM + t.rampLookAheadM).y;
    const yRise = yAhead - yHere;

    const onRamp = yRise >= t.rampYRiseThreshold && speedMps >= t.rampMinSpeedMps;
    if (onRamp) {
      this.state.airborneUntil = nowMs + t.airborneWindowMs;
      this.state.airborne = true;
    } else if (nowMs >= this.state.airborneUntil) {
      this.state.airborne = false;
    }

    return this.state.airborne;
  }

  isAirborne(): boolean {
    return this.state.airborne;
  }

  reset(): void {
    this.state = { airborne: false, airborneUntil: 0 };
  }
}
