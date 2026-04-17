/**
 * @module systems/replayRecorder
 *
 * Records input/state samples during a run at 30Hz into a ring buffer.
 * On run-end, if the final distance beats the stored best for today's seed,
 * saves the trace via replay.saveReplay().
 *
 * Ring buffer capacity: 60 seconds × 30Hz = 1800 samples max.
 * Before saving, the trace is downsampled to ≤900 samples to limit blob size.
 */

import { getBestReplayForDate, type ReplaySample, saveReplay } from '@/persistence/replay';
import { utcDateString } from '@/track/dailyRoute';
import { reportError } from './errorBus';

const SAMPLE_HZ = 30;
const SAMPLE_INTERVAL_S = 1 / SAMPLE_HZ;
const MAX_RING_SAMPLES = 1800; // 60s × 30Hz
const MAX_SAVED_SAMPLES = 900; // downsampled cap

/** State for the active recording session. */
let _recording = false;
let _runStartedAt = 0; // performance.now() epoch
let _ringBuffer: ReplaySample[] = [];
let _lastSampleTime = 0;

/** Start a new recording. Clears any previous buffer. */
export function startRecording(): void {
  _recording = true;
  _runStartedAt = performance.now();
  _ringBuffer = [];
  _lastSampleTime = -Infinity;
}

/** Stop recording without saving (e.g., practice mode or cancelled run). */
export function stopRecording(): void {
  _recording = false;
}

/**
 * Sample the current game state. Call this every frame (or from the GameLoop).
 * Internally throttles to ~30Hz.
 */
export function sampleFrame(nowMs: number, lateral: number, speedMps: number, steer: number): void {
  if (!_recording) return;

  const elapsedS = (nowMs - _runStartedAt) / 1000;
  if (elapsedS - _lastSampleTime < SAMPLE_INTERVAL_S) return;

  _lastSampleTime = elapsedS;

  const sample: ReplaySample = {
    t: Math.round(elapsedS * 1000) / 1000, // round to ms
    lateral: Math.round(lateral * 1000) / 1000,
    speedMps: Math.round(speedMps * 10) / 10,
    steer: Math.round(steer * 1000) / 1000,
  };

  if (_ringBuffer.length >= MAX_RING_SAMPLES) {
    _ringBuffer.shift();
  }
  _ringBuffer.push(sample);
}

/**
 * Downsample trace to at most `max` samples using uniform stride.
 * Preserves first + last samples.
 */
function downsample(trace: ReplaySample[], max: number): ReplaySample[] {
  if (trace.length <= max) return trace;
  const result: ReplaySample[] = [];
  const stride = (trace.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) {
    const idx = Math.round(i * stride);
    const sample = trace[Math.min(idx, trace.length - 1)];
    if (sample) result.push(sample);
  }
  return result;
}

/**
 * Finish the run. If distance beats today's best, saves replay to SQLite.
 * Stops recording regardless.
 *
 * @param distance  Run distance in meters
 * @param crowd     Final crowd/score value
 * @param dailyMode Pass false to skip saving (practice mode)
 */
export async function finishAndMaybeSave(
  distance: number,
  crowd: number,
  dailyMode: boolean,
): Promise<void> {
  _recording = false;
  const trace = [..._ringBuffer];
  _ringBuffer = [];

  if (!dailyMode || trace.length === 0) return;

  const today = utcDateString();
  try {
    const best = await getBestReplayForDate(today);
    const bestDistCm = best?.distanceCm ?? 0;
    const thisCm = Math.round(distance * 100);
    if (thisCm >= bestDistCm) {
      const downsampled = downsample(trace, MAX_SAVED_SAMPLES);
      await saveReplay(today, distance, crowd, downsampled);
    }
  } catch (err) {
    reportError(err, 'replayRecorder.finishAndMaybeSave');
  }
}

/** Return a copy of the current ring buffer (for tests). */
export function getRingBuffer(): readonly ReplaySample[] {
  return [..._ringBuffer];
}

/** Reset recorder state (for tests). */
export function resetRecorder(): void {
  _recording = false;
  _runStartedAt = 0;
  _ringBuffer = [];
  _lastSampleTime = 0;
}
