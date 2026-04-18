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
 *   down when SFX stingers hit.
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
    const level = b.sfxMeter.getValue();
    const levelDb = typeof level === 'number' ? level : (level[0] ?? -Infinity);
    const over = Math.max(0, levelDb - DUCK_THRESHOLD_DB);
    const duck = Math.min(1, over / 10) * DUCK_DEPTH_DB;
    const target = REST_VOL_DB + duck;
    b.musicBus.volume.rampTo(target, 0.08);
    if (typeof requestAnimationFrame !== 'undefined') {
      duckingLoopId = requestAnimationFrame(loop);
    }
  };
  if (typeof requestAnimationFrame !== 'undefined') {
    duckingLoopId = requestAnimationFrame(loop);
  }
}
