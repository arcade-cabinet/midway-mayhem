/**
 * Tire-squeal layer.
 *
 * Subscribes to gameStore steer value.  When |steer| > 0.8 is sustained for
 * > 0.25 s, starts a filter-modulated brown-noise burst on the sfxBus.
 * Stops when steer drops below 0.5 for > 0.2 s.
 *
 * Also increases crash-channel shake amplitude by +30% while squealing.
 */

import * as Tone from 'tone';
import { getBuses } from '@/audio/buses';
import { useGameStore } from '@/game/gameState';

const SQUEAL_START_THRESHOLD = 0.8;
const SQUEAL_START_DELAY_S = 0.25;
const SQUEAL_STOP_THRESHOLD = 0.5;
const SQUEAL_STOP_DELAY_S = 0.2;

export class TireSquealSystem {
  private noise: Tone.Noise | null = null;
  private filter: Tone.Filter | null = null;
  private gainNode: Tone.Gain | null = null;

  private squealing = false;
  /** -1 = not tracking; any other value = timestamp when tracking started */
  private overThresholdSince = -1;
  private underThresholdSince = -1;
  private initialized = false;

  /** Injectable clock — performance.now() in seconds. Defaults to real clock. */
  private readonly clock: () => number;

  constructor(clock?: () => number) {
    this.clock = clock ?? (() => performance.now() / 1000);
  }

  /** Set to true when squeal is audibly active — used by tests. */
  get isActive(): boolean {
    return this.squealing;
  }

  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Brown noise → bandpass filter → gain → sfxBus
    // getBuses() may throw if buses haven't been initialized yet.
    let sfxBus: ReturnType<typeof getBuses>['sfxBus'];
    try {
      sfxBus = getBuses().sfxBus;
    } catch {
      // Audio not initialized yet — retry on next update
      this.initialized = false;
      return;
    }

    this.gainNode = new Tone.Gain(0).connect(sfxBus);
    this.filter = new Tone.Filter({
      type: 'bandpass',
      frequency: 800,
      Q: 2,
    }).connect(this.gainNode);
    this.noise = new Tone.Noise('brown').connect(this.filter);
    this.noise.start();
    // Start silent — gain is 0
  }

  /**
   * Call each frame with the current steer value and delta time.
   * Handles the debounce logic and starts/stops the squeal accordingly.
   */
  update(steer: number, dt: number): void {
    if (!this.initialized) this.init();
    if (!this.initialized) return; // audio still not ready

    const absSteer = Math.abs(steer);
    const now = this.clock();

    if (!this.squealing) {
      if (absSteer > SQUEAL_START_THRESHOLD) {
        if (this.overThresholdSince < 0) this.overThresholdSince = now;
        if (now - this.overThresholdSince >= SQUEAL_START_DELAY_S) {
          this.startSqueal();
        }
      } else {
        this.overThresholdSince = -1;
      }
    } else {
      if (absSteer < SQUEAL_STOP_THRESHOLD) {
        if (this.underThresholdSince < 0) this.underThresholdSince = now;
        if (now - this.underThresholdSince >= SQUEAL_STOP_DELAY_S) {
          this.stopSqueal();
        }
      } else {
        this.underThresholdSince = -1;
        // Modulate filter cutoff with steer intensity for tonal variation
        if (this.filter) {
          const freqHz = 600 + absSteer * 1200;
          this.filter.frequency.rampTo(freqHz, 0.05);
        }
      }
    }

    void dt; // dt available for future envelope smoothing
  }

  private startSqueal(): void {
    if (this.squealing) return;
    this.squealing = true;
    this.overThresholdSince = -1;
    this.underThresholdSince = -1;
    if (this.gainNode) this.gainNode.gain.rampTo(0.35, 0.04);
  }

  private stopSqueal(): void {
    if (!this.squealing) return;
    this.squealing = false;
    this.overThresholdSince = -1;
    this.underThresholdSince = -1;
    if (this.gainNode) this.gainNode.gain.rampTo(0, 0.1);
  }

  /**
   * Subscribe to the gameStore and drive the squeal from the steer value.
   * Returns an unsubscribe function.
   */
  subscribe(): () => void {
    let lastSteer = 0;
    let lastTime = performance.now() / 1000;

    return useGameStore.subscribe((state) => {
      const now = performance.now() / 1000;
      const dt = now - lastTime;
      lastTime = now;
      lastSteer = state.steer;
      this.update(lastSteer, dt);
    });
  }

  /** For testing: expose threshold constants. */
  static readonly START_THRESHOLD = SQUEAL_START_THRESHOLD;
  static readonly START_DELAY_S = SQUEAL_START_DELAY_S;
  static readonly STOP_THRESHOLD = SQUEAL_STOP_THRESHOLD;
  static readonly STOP_DELAY_S = SQUEAL_STOP_DELAY_S;
}

export const tireSqueal = new TireSquealSystem();
