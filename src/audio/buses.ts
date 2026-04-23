import * as Tone from 'tone';

/**
 * Midway Mayhem audio bus architecture.
 *
 *   master
 *     ├── musicBus  (calliope lead + oom-pah backing, -6 dB)
 *     ├── sfxBus    (whip/horn/crash/pickup/honk, -3 dB)
 *     └── ambBus    (crowd, rigging, canvas, -14 dB, bypasses reverb)
 *
 *   musicBus and sfxBus can route through a shared tent convolver
 *   (once we have an IR) via per-source gain sends.
 *
 *   Sidechain ducking: Tone.Meter on sfxBus drives musicBus.volume
 *   down when SFX stingers hit. Additionally, explicit hard-duck calls
 *   (duckMusicBus) let callers impose a fixed-duration duck for honk
 *   (180 ms) and crash (400 ms) that overrides the meter-based duck.
 */

export interface Buses {
  master: Tone.Volume;
  musicBus: Tone.Channel;
  sfxBus: Tone.Channel;
  ambBus: Tone.Channel;
  sfxMeter: Tone.Meter;
}

let buses: Buses | null = null;

export function getBuses(): Buses {
  if (!buses) throw new Error('[audio] Buses not initialized — call initBuses() first');
  return buses;
}

export function initBuses(): Buses {
  if (buses) return buses;
  const master = new Tone.Volume(-6).toDestination();
  const compressor = new Tone.Compressor(-18, 4).connect(master);

  const musicBus = new Tone.Channel({ volume: -6 }).connect(compressor);
  const sfxBus = new Tone.Channel({ volume: -3 }).connect(compressor);
  const ambBus = new Tone.Channel({ volume: -14 }).connect(compressor);

  // Meter the SFX bus level so we can duck the music during stingers
  const sfxMeter = new Tone.Meter(0.7);
  sfxBus.connect(sfxMeter);

  buses = { master, musicBus, sfxBus, ambBus, sfxMeter };

  // Sidechain ducking loop: watch sfxMeter, attenuate musicBus volume
  startDuckingLoop(buses);
  return buses;
}

let duckingLoopId: number | null = null;

export function stopDuckingLoop(): void {
  if (duckingLoopId !== null && typeof cancelAnimationFrame !== 'undefined') {
    cancelAnimationFrame(duckingLoopId);
    duckingLoopId = null;
  }
}

function startDuckingLoop(b: Buses): void {
  const DUCK_DEPTH_DB = -8;
  const DUCK_THRESHOLD_DB = -24;
  const REST_VOL_DB = b.musicBus.volume.value;

  const loop = () => {
    // Skip the meter-based loop while a hard duck is in progress — the
    // explicit duckMusicBus() ramp has priority and we don't want the loop
    // to fight it by ramping toward REST_VOL_DB simultaneously.
    if (!hardDuckActive) {
      const level = b.sfxMeter.getValue();
      const levelDb = typeof level === 'number' ? level : (level[0] ?? -Infinity);
      const over = Math.max(0, levelDb - DUCK_THRESHOLD_DB);
      const duck = Math.min(1, over / 10) * DUCK_DEPTH_DB;
      const target = REST_VOL_DB + duck;
      b.musicBus.volume.rampTo(target, 0.08);
    }
    if (typeof requestAnimationFrame !== 'undefined') {
      duckingLoopId = requestAnimationFrame(loop);
    }
  };
  if (typeof requestAnimationFrame !== 'undefined') {
    duckingLoopId = requestAnimationFrame(loop);
  }
}

// ─── Explicit hard-duck ──────────────────────────────────────────────────────
// Called by audioBus for honk (180 ms) and crash (400 ms). Takes priority
// over the sfxMeter-driven loop so the duck is crisp and predictable.

let hardDuckActive = false;
let hardDuckRestoreId: ReturnType<typeof setTimeout> | null = null;
const HARD_DUCK_DB = -10;

/**
 * Duck the music bus by HARD_DUCK_DB for `durationMs`, then restore to the
 * pre-duck level. Safe to call before initBuses() — if buses aren't ready
 * the call is a no-op (the meter-based duck from sfxBus traffic still works).
 */
export function duckMusicBus(durationMs: number): void {
  if (!buses) return;
  const { musicBus } = buses;
  const restoreDb = musicBus.volume.value;

  if (hardDuckRestoreId !== null) {
    clearTimeout(hardDuckRestoreId);
    hardDuckRestoreId = null;
  }

  hardDuckActive = true;
  musicBus.volume.rampTo(restoreDb + HARD_DUCK_DB, 0.02);

  hardDuckRestoreId = setTimeout(() => {
    hardDuckActive = false;
    hardDuckRestoreId = null;
    musicBus.volume.rampTo(restoreDb, 0.05);
  }, durationMs);
}

/** For tests: query whether a hard duck is currently in progress. */
export function isHardDuckActive(): boolean {
  return hardDuckActive;
}
