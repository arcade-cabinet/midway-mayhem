import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  finishAndMaybeSave,
  getRingBuffer,
  resetRecorder,
  sampleFrame,
  startRecording,
  stopRecording,
} from '@/game/replayRecorder';
import { initDb, resetDbForTests } from '@/persistence/db';
import { getBestReplayForDate, listReplaysForDate } from '@/persistence/replay';

beforeEach(async () => {
  await resetDbForTests();
  await initDb();
  resetRecorder();
});

afterEach(async () => {
  resetRecorder();
  await resetDbForTests();
});

describe('replayRecorder — sampling', () => {
  it('does not sample when not recording', () => {
    sampleFrame(100, 0.5, 30, 0.2);
    expect(getRingBuffer()).toHaveLength(0);
  });

  it('records samples at ~30Hz', () => {
    startRecording();
    const start = 0;
    // Simulate 1 second of frames at ~60fps, expected ~30 samples
    for (let i = 0; i < 60; i++) {
      sampleFrame(start + i * (1000 / 60), 0, 30, 0);
    }
    const buf = getRingBuffer();
    // Should have roughly 30 samples (one per ~33ms over 1 second of 60fps
    // input). Float comparison + first-frame-always-samples produces a
    // tolerance band of ~20-32 depending on start phase.
    expect(buf.length).toBeGreaterThanOrEqual(20);
    expect(buf.length).toBeLessThanOrEqual(32);
  });

  it('throttles to avoid double-sampling within same interval', () => {
    startRecording();
    // Two frames very close together (1ms apart)
    sampleFrame(0, 0, 30, 0);
    sampleFrame(1, 0.1, 31, 0.1);
    const buf = getRingBuffer();
    // Only 1 should have been recorded (second is within 33ms window)
    expect(buf.length).toBe(1);
  });

  it('captures lateral, speedMps, steer values', () => {
    startRecording();
    sampleFrame(0, 1.5, 45.7, -0.8);
    const buf = getRingBuffer();
    expect(buf.length).toBe(1);
    expect(buf[0]?.lateral).toBeCloseTo(1.5, 2);
    expect(buf[0]?.speedMps).toBeCloseTo(45.7, 1);
    expect(buf[0]?.steer).toBeCloseTo(-0.8, 2);
  });

  it('stopRecording halts sampling', () => {
    startRecording();
    sampleFrame(0, 0, 30, 0);
    stopRecording();
    sampleFrame(100, 0.5, 35, 0.3);
    // Still only 1 sample from before stop
    expect(getRingBuffer().length).toBe(1);
  });
});

describe('replayRecorder — downsampling + save', () => {
  it('saves replay when distance beats best', async () => {
    startRecording();
    // Simulate 2 seconds of samples
    for (let i = 0; i < 60; i++) {
      sampleFrame(i * (1000 / 30), 0, 50, 0);
    }
    await finishAndMaybeSave(500, 100, true);

    const today = new Date().toISOString().split('T')[0];
    const replays = await listReplaysForDate(today ?? '');
    expect(replays.length).toBeGreaterThan(0);
  });

  it('does not save in practice mode', async () => {
    startRecording();
    for (let i = 0; i < 30; i++) {
      sampleFrame(i * (1000 / 30), 0, 50, 0);
    }
    await finishAndMaybeSave(500, 100, false);

    const today = new Date().toISOString().split('T')[0];
    const replays = await listReplaysForDate(today ?? '');
    expect(replays).toHaveLength(0);
  });

  it('does not save when distance is worse than best', async () => {
    // First run: 500m
    startRecording();
    for (let i = 0; i < 30; i++) {
      sampleFrame(i * (1000 / 30), 0, 50, 0);
    }
    await finishAndMaybeSave(500, 100, true);

    // Second run: 200m (worse)
    startRecording();
    for (let i = 0; i < 30; i++) {
      sampleFrame(i * (1000 / 30), 0, 30, 0);
    }
    await finishAndMaybeSave(200, 50, true);

    const today = new Date().toISOString().split('T')[0];
    const best = await getBestReplayForDate(today ?? '');
    expect(best?.distanceCm).toBe(50000); // 500m wins
  });

  it('clears ring buffer after finishAndMaybeSave', async () => {
    startRecording();
    sampleFrame(0, 0, 30, 0);
    await finishAndMaybeSave(100, 10, false);
    expect(getRingBuffer()).toHaveLength(0);
  });
});
