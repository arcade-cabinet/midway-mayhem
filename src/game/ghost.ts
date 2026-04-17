/**
 * Ghost recording + playback. During a live run, stepGhostRecorder appends
 * (time, distance, lateral) samples at a low rate. When the run ends we
 * persist the whole trace against its score. On bootstrap the best-scoring
 * saved trace is loaded back so the renderer can play it alongside the
 * live player — a self-competitive "beat your own ghost" loop.
 *
 * Storage: localStorage under `mm.ghost.v1`. Never hit the network.
 */
import type { World } from 'koota';
import { Player, Position, Score } from '@/ecs/traits';

export interface GhostSample {
  /** Seconds since run start. */
  t: number;
  distance: number;
  lateral: number;
}

export interface GhostRecord {
  score: number;
  samples: GhostSample[];
  createdAt: number;
}

const STORE_KEY = 'mm.ghost.v1';
const SAMPLE_INTERVAL = 0.1;

let recording: GhostSample[] = [];
let runStartMs = 0;
let lastSampleT = -1;

export function resetGhostRecorder(): void {
  recording = [];
  runStartMs = performance.now();
  lastSampleT = -1;
}

export function stepGhostRecorder(world: World): void {
  const e = world.query(Player, Position)[0];
  if (!e) return;
  const pos = e.get(Position);
  if (!pos) return;
  const t = (performance.now() - runStartMs) / 1000;
  if (t - lastSampleT < SAMPLE_INTERVAL) return;
  lastSampleT = t;
  recording.push({ t, distance: pos.distance, lateral: pos.lateral });
}

export function commitGhost(world: World): void {
  const e = world.query(Player, Score)[0];
  if (!e) return;
  const score = e.get(Score);
  if (!score) return;
  const record: GhostRecord = {
    score: score.value,
    samples: recording.slice(),
    createdAt: Date.now(),
  };
  try {
    const existing = loadBestGhost();
    if (!existing || record.score > existing.score) {
      localStorage.setItem(STORE_KEY, JSON.stringify(record));
    }
  } catch {
    // localStorage unavailable — silently skip; the ghost is ephemeral.
  }
}

export function loadBestGhost(): GhostRecord | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GhostRecord;
    if (!parsed || !Array.isArray(parsed.samples)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Elapsed time since the current run started (seconds). */
export function currentRunElapsed(): number {
  return (performance.now() - runStartMs) / 1000;
}

/** Interpolate a ghost's position at elapsed-time `t`. Returns null if the
 *  ghost has no samples. Out-of-range clamps to first / last sample. */
export function sampleGhost(
  ghost: GhostRecord,
  t: number,
): { distance: number; lateral: number } | null {
  const samples = ghost.samples;
  if (samples.length === 0) return null;
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (!first || !last) return null;
  if (t <= first.t) return { distance: first.distance, lateral: first.lateral };
  if (t >= last.t) return { distance: last.distance, lateral: last.lateral };

  // Binary search.
  let lo = 0;
  let hi = samples.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >>> 1;
    const s = samples[mid];
    if (!s) break;
    if (s.t <= t) lo = mid;
    else hi = mid;
  }
  const a = samples[lo];
  const b = samples[hi];
  if (!a || !b) return null;
  const span = Math.max(1e-6, b.t - a.t);
  const alpha = Math.max(0, Math.min(1, (t - a.t) / span));
  return {
    distance: a.distance + (b.distance - a.distance) * alpha,
    lateral: a.lateral + (b.lateral - a.lateral) * alpha,
  };
}
