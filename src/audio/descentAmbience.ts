/**
 * @module audio/descentAmbience
 *
 * Crowd-ambience bed that swells as the player descends the spiral
 * (PRQ C-DESCENT-AMBIENCE + C3 positional crowd).
 *
 * Architecture:
 *   - Base layer (3 pink-noise sources): panned hard-L / center / hard-R at
 *     the ≈14 m dome seat ring. Present since the original C-DESCENT-AMBIENCE.
 *   - C3 extended crowd: 12 additional pink-noise sources placed at positions
 *     sampled from audiencePositions (src/render/env/audiencePositions.ts).
 *     Positions are sampled at 12 evenly-spaced angles from the 2000-seat ring
 *     (r averaged across radial bands) so the spatial image matches exactly
 *     what the visual renderer shows. Each section gets an independent
 *     Tone.Panner3D so the crowd "surrounds" the player realistically.
 *   - A Tone.Filter (lowpass) per layer tracks descent depth so the crowd
 *     sounds more present and articulate (higher cutoff) as you get closer.
 *   - Master gain scales 0 (top of descent) → -12 dBFS (floor), driven by
 *     the normalised descent value (0 = top, 1 = floor).
 *   - Subscribes to the diagnostics bus `reportScene` call via a plain
 *     module-level subscription on useGameStore for the cameraPos.y value.
 *     Falls back to a direct `setDescentT(t)` API for test / manual driving.
 *
 * All Tone.js construction is deferred until `initDescentAmbience()` is
 * called (after a user gesture unlocks the AudioContext). Before that, every
 * method is a no-op.
 */

import * as Tone from 'tone';
import { tunables } from '@/config';
import { onCameraPos } from '@/game/diagnosticsBus';
import { audiencePositions } from '@/render/env/audiencePositions';
import { getBuses } from './buses';

// ─── Gain curve ──────────────────────────────────────────────────────────────

/**
 * Maps a normalised descent value (0 = top of coil, 1 = dome floor) to a
 * dBFS volume for the ambience bed.
 *
 * At t = 0 the crowd is effectively silent (very far away).
 * At t = 1 the crowd is at full roar — the player is at floor level.
 *
 * Uses a square-root curve so the swell feels perceptually linear.
 */
export function descentGainDb(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped === 0) return -Infinity;
  const a = tunables.audio.descentAmbienceTopDb;
  const b = tunables.audio.descentAmbienceFloorDb;
  // Lerp on sqrt so the swell is fast at first and slow at the end.
  return a + (b - a) * Math.sqrt(clamped);
}

/**
 * Maps a normalised descent value to a lowpass cutoff frequency (Hz).
 * Higher t → higher cutoff → crowd sounds more articulate.
 */
export function descentLpHz(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  const lo = tunables.audio.descentAmbienceLpTopHz;
  const hi = tunables.audio.descentAmbienceLpFloorHz;
  return lo + (hi - lo) * clamped;
}

// ─── Ambience engine ─────────────────────────────────────────────────────────

interface AmbienceLayer {
  noise: Tone.Noise;
  filter: Tone.Filter;
  gain: Tone.Gain;
  panner3d: Tone.Panner3D;
}

/** Seat-ring radius in the dome (metres, from track centre) — base layer. */
const SEAT_RING_RADIUS_M = 14;
/** Height of the crowd seats above the track floor — base layer. */
const SEAT_HEIGHT_M = 5;

/** Pan positions around the audience ring (radians from forward) — base layer. */
const SEAT_ANGLES_RAD = [Math.PI * -0.4, 0, Math.PI * 0.4];

// ─── C3: 12-section crowd positions (sampled from audiencePositions) ─────────

/**
 * Sample 12 evenly-distributed crowd-section centroids from the audience ring.
 *
 * We use audiencePositions() with a fixed seed (same one the Audience renderer
 * uses — 42) but only sample 12 representative points at even angular sectors
 * (every 30°) to build our Panner3D positions. Rather than averaging thousands
 * of points we compute the centroid analytically using the same r/y range that
 * audiencePositions uses so the audio positions match the visual geometry.
 */
function buildCrowdSectionPositions(): Array<{ x: number; y: number; z: number }> {
  // Derive 12 section centroids from the live audience data (seed 42 = renderer default).
  // We sample ~24 positions and cluster them into 12 angular sectors for centroids.
  const allPos = audiencePositions(42, 240); // 240 = 12 sections × 20 samples each
  const NUM_SECTIONS = 12;
  const positions: Array<{ x: number; y: number; z: number }> = [];

  for (let s = 0; s < NUM_SECTIONS; s++) {
    const sectionSamples = allPos.slice(s * 20, (s + 1) * 20);
    if (sectionSamples.length === 0) continue;
    // Centroid of section
    const cx = sectionSamples.reduce((acc, p) => acc + p.x, 0) / sectionSamples.length;
    const cy = sectionSamples.reduce((acc, p) => acc + p.y, 0) / sectionSamples.length;
    const cz = sectionSamples.reduce((acc, p) => acc + p.z, 0) / sectionSamples.length;
    positions.push({ x: cx, y: cy, z: cz });
  }

  return positions;
}

const CROWD_SECTION_POSITIONS = buildCrowdSectionPositions();

class DescentAmbienceSystem {
  private layers: AmbienceLayer[] = [];
  /** C3 crowd-section layers — separate from the base 3-layer bed. */
  private crowdSectionLayers: AmbienceLayer[] = [];
  private masterGain: Tone.Gain | null = null;
  private initialized = false;
  private currentT = 0;
  private unsubStore: (() => void) | null = null;

  init(): void {
    if (this.initialized) return;

    let ambBus: ReturnType<typeof getBuses>['ambBus'];
    try {
      ambBus = getBuses().ambBus;
    } catch {
      // Buses not ready — will be retried when setDescentT is called.
      return;
    }

    this.masterGain = new Tone.Gain(0).connect(ambBus);

    // ── Base layer (original 3 panned sources) ──────────────────────────────
    for (const angleRad of SEAT_ANGLES_RAD) {
      const x = Math.sin(angleRad) * SEAT_RING_RADIUS_M;
      const z = -Math.cos(angleRad) * SEAT_RING_RADIUS_M; // forward = -Z in three.js

      const panner3d = new Tone.Panner3D({
        positionX: x,
        positionY: SEAT_HEIGHT_M,
        positionZ: z,
        panningModel: 'equalpower',
        distanceModel: 'linear',
        refDistance: 1,
        maxDistance: 30,
        rolloffFactor: 1,
      }).connect(this.masterGain);

      const gain = new Tone.Gain(1).connect(panner3d);

      const filter = new Tone.Filter({
        type: 'lowpass',
        frequency: tunables.audio.descentAmbienceLpTopHz,
        Q: 0.7,
      }).connect(gain);

      const noise = new Tone.Noise('pink').connect(filter);
      noise.start();

      this.layers.push({ noise, filter, gain, panner3d });
    }

    // ── C3: 12-section positional crowd layers ──────────────────────────────
    // Each section is a separate pink-noise source at its centroid world position.
    // Volume is -6 dB relative to base layers so they add spatial width without
    // dominating the overall level balance.
    for (const pos of CROWD_SECTION_POSITIONS) {
      const panner3d = new Tone.Panner3D({
        positionX: pos.x,
        positionY: pos.y,
        positionZ: pos.z,
        panningModel: 'equalpower',
        distanceModel: 'linear',
        refDistance: 1,
        maxDistance: 200, // audience is far from track — higher max
        rolloffFactor: 0.8,
      }).connect(this.masterGain);

      const gain = new Tone.Gain(0.5).connect(panner3d); // -6 dB relative to base

      const filter = new Tone.Filter({
        type: 'lowpass',
        frequency: tunables.audio.descentAmbienceLpTopHz * 0.7, // slightly muffled at distance
        Q: 0.5,
      }).connect(gain);

      const noise = new Tone.Noise('pink').connect(filter);
      noise.start();

      this.crowdSectionLayers.push({ noise, filter, gain, panner3d });
    }

    this.initialized = true;
    // Apply any pending descent value set before init completed.
    this._applyT(this.currentT);
  }

  private _applyT(t: number): void {
    if (!this.initialized || !this.masterGain) return;
    const gainDb = descentGainDb(t);
    const lpHz = descentLpHz(t);
    // -Infinity maps to 0 linear gain; Tone handles the ramp gracefully.
    const linearGain = gainDb === -Infinity ? 0 : 10 ** (gainDb / 20);
    this.masterGain.gain.rampTo(linearGain, 0.5);
    // Update base layers and C3 crowd-section layers
    for (const layer of this.layers) {
      layer.filter.frequency.rampTo(lpHz, 0.5);
    }
    // C3 crowd sections use a slightly lower cutoff (more air = more muffled at distance)
    const crowdLpHz = lpHz * 0.75;
    for (const layer of this.crowdSectionLayers) {
      layer.filter.frequency.rampTo(crowdLpHz, 0.5);
    }
  }

  /**
   * Drive the ambience from a normalised descent value (0 = top, 1 = floor).
   * Call this every frame or subscribe to the gameStore for cameraPos.y.
   */
  setDescentT(t: number): void {
    this.currentT = t;
    if (!this.initialized) {
      // Try lazy init on first value push — audioBus may have initialized
      // buses by the time descent data starts flowing.
      this.init();
    } else {
      this._applyT(t);
    }
  }

  /**
   * Subscribe to the diagnosticsBus camera-Y stream and auto-drive the ambience.
   * descentTopY / descentFloorY define the world-Y range of the spiral coil.
   *
   * TrackScroller calls reportScene (and therefore onCameraPos) every frame,
   * so this runs at frame-rate with no extra polling.
   */
  subscribe(descentTopY: number, descentFloorY: number): () => void {
    if (this.unsubStore) {
      this.unsubStore();
      this.unsubStore = null;
    }

    const rangeY = descentTopY - descentFloorY;
    const unsub = onCameraPos((pos) => {
      const camY = pos[1];
      const t = rangeY > 0 ? Math.max(0, Math.min(1, (descentTopY - camY) / rangeY)) : 0;
      this.setDescentT(t);
    });

    this.unsubStore = unsub;
    return () => {
      unsub();
      this.unsubStore = null;
    };
  }

  dispose(): void {
    if (this.unsubStore) {
      this.unsubStore();
      this.unsubStore = null;
    }
    for (const layer of [...this.layers, ...this.crowdSectionLayers]) {
      layer.noise.stop();
      layer.noise.dispose();
      layer.filter.dispose();
      layer.gain.dispose();
      layer.panner3d.dispose();
    }
    this.masterGain?.dispose();
    this.masterGain = null;
    this.layers = [];
    this.crowdSectionLayers = [];
    this.initialized = false;
  }

  /** Exposed for tests — count of C3 crowd-section layers (should be 12). */
  get crowdSectionCount(): number {
    return this.crowdSectionLayers.length;
  }

  /** Exposed for tests — whether the engine is running. */
  get isInitialized(): boolean {
    return this.initialized;
  }

  /** Exposed for tests — current normalised descent t. */
  get currentDescentT(): number {
    return this.currentT;
  }
}

export const descentAmbience = new DescentAmbienceSystem();

/**
 * Wire the descent-ambience system into the bus graph and subscribe it to
 * camera Y. Call once, after audioBus.init() has resolved.
 *
 * `descentTopY` and `descentFloorY` are the world-Y extents of the descent
 * spiral; sourced from track geometry constants (A-DESC-1 coil). If not
 * supplied, sensible defaults from the track geometry are used.
 */
export function initDescentAmbience(descentTopY = 20, descentFloorY = 0): () => void {
  descentAmbience.init();
  return descentAmbience.subscribe(descentTopY, descentFloorY);
}
