/**
 * replayRecorder unit tests — ring-buffer capture of replay samples.
 * Covers recording lifecycle, 30Hz throttle, sample quantisation,
 * ring eviction at capacity, and the persistence path via mocks.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetBest = vi.fn<() => Promise<{ distanceCm: number } | null>>();
const mockSaveReplay = vi.fn<() => Promise<void>>();
const mockReportError = vi.fn();

vi.mock('@/persistence/replay', () => ({
  getBestReplayForDate: (...args: unknown[]) => mockGetBest(...(args as [])),
  saveReplay: (...args: unknown[]) => mockSaveReplay(...(args as [])),
}));

vi.mock('@/track/dailyRoute', () => ({
  utcDateString: () => '2026-04-18',
}));

vi.mock('@/game/errorBus', () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}));

import {
  finishAndMaybeSave,
  getRingBuffer,
  resetRecorder,
  sampleFrame,
  startRecording,
  stopRecording,
} from '@/game/replayRecorder';

describe('replayRecorder', () => {
  beforeEach(() => {
    resetRecorder();
    mockGetBest.mockReset();
    mockSaveReplay.mockReset();
    mockReportError.mockReset();
  });

  afterEach(() => {
    resetRecorder();
  });

  it('starts with an empty buffer', () => {
    expect(getRingBuffer()).toEqual([]);
  });

  it('sampleFrame is a no-op before startRecording', () => {
    sampleFrame(1000, 1, 10, 0.5);
    expect(getRingBuffer()).toHaveLength(0);
  });

  it('captures the first frame after startRecording', () => {
    const t0 = performance.now();
    startRecording();
    sampleFrame(t0, 0.123, 15.67, 0.5);
    const buf = getRingBuffer();
    expect(buf).toHaveLength(1);
    expect(buf[0]?.lateral).toBeCloseTo(0.123, 6);
    expect(buf[0]?.speedMps).toBeCloseTo(15.7, 6);
    expect(buf[0]?.steer).toBeCloseTo(0.5, 6);
  });

  it('quantises fields (lateral/steer ~1e-3, speed ~1e-1)', () => {
    const t0 = performance.now();
    startRecording();
    sampleFrame(t0, 0.12399, 15.678, 0.9999);
    const s = getRingBuffer()[0];
    expect(s?.lateral).toBe(0.124);
    expect(s?.speedMps).toBe(15.7);
    expect(s?.steer).toBe(1);
  });

  it('throttles samples to 30Hz (~33.33ms per sample)', () => {
    const t0 = performance.now();
    startRecording();
    sampleFrame(t0, 0, 0, 0); // elapsed = 0, accepted
    sampleFrame(t0 + 10, 0, 0, 0); // elapsed 0.010s, < 1/30 → rejected
    sampleFrame(t0 + 20, 0, 0, 0); // elapsed 0.020s → rejected
    sampleFrame(t0 + 40, 0, 0, 0); // elapsed 0.040s → accepted
    expect(getRingBuffer()).toHaveLength(2);
  });

  it('stopRecording halts further capture', () => {
    const t0 = performance.now();
    startRecording();
    sampleFrame(t0, 0, 0, 0);
    stopRecording();
    sampleFrame(t0 + 100, 0, 0, 0);
    expect(getRingBuffer()).toHaveLength(1);
  });

  it('startRecording clears the previous buffer', () => {
    const t0 = performance.now();
    startRecording();
    sampleFrame(t0, 1, 1, 1);
    expect(getRingBuffer()).toHaveLength(1);
    startRecording();
    expect(getRingBuffer()).toHaveLength(0);
  });

  it('ring buffer evicts oldest sample when capacity exceeded', () => {
    const t0 = performance.now();
    startRecording();
    // 1800 samples = capacity. Push 1802 and confirm size stays capped.
    for (let i = 0; i < 1802; i++) {
      sampleFrame(t0 + i * 40, i, 0, 0); // 40ms → always passes throttle
    }
    const buf = getRingBuffer();
    expect(buf.length).toBeLessThanOrEqual(1800);
    // First sample (lateral=0) should have been evicted.
    expect(buf[0]?.lateral).not.toBe(0);
  });

  it('finishAndMaybeSave is a no-op when not dailyMode', async () => {
    const t0 = performance.now();
    startRecording();
    sampleFrame(t0, 0, 0, 0);
    await finishAndMaybeSave(500, 50, false);
    expect(mockGetBest).not.toHaveBeenCalled();
    expect(mockSaveReplay).not.toHaveBeenCalled();
  });

  it('finishAndMaybeSave is a no-op when trace is empty', async () => {
    startRecording();
    await finishAndMaybeSave(500, 50, true);
    expect(mockGetBest).not.toHaveBeenCalled();
    expect(mockSaveReplay).not.toHaveBeenCalled();
  });

  it('saves replay when distance beats previous best (daily mode)', async () => {
    mockGetBest.mockResolvedValue({ distanceCm: 10_000 });
    mockSaveReplay.mockResolvedValue();

    const t0 = performance.now();
    startRecording();
    sampleFrame(t0, 0, 10, 0);
    sampleFrame(t0 + 40, 1, 10, 0);

    // distance=200m → 20000cm, beats 10000cm best.
    await finishAndMaybeSave(200, 50, true);
    expect(mockGetBest).toHaveBeenCalledWith('2026-04-18');
    expect(mockSaveReplay).toHaveBeenCalledTimes(1);
    const call = mockSaveReplay.mock.calls[0] as unknown[];
    expect(call[0]).toBe('2026-04-18');
    expect(call[1]).toBe(200);
    expect(call[2]).toBe(50);
    expect(Array.isArray(call[3])).toBe(true);
  });

  it('does not save when distance does not beat best', async () => {
    mockGetBest.mockResolvedValue({ distanceCm: 100_000 });
    mockSaveReplay.mockResolvedValue();

    const t0 = performance.now();
    startRecording();
    sampleFrame(t0, 0, 10, 0);

    // 500m = 50000cm, loses to 100000cm best.
    await finishAndMaybeSave(500, 50, true);
    expect(mockSaveReplay).not.toHaveBeenCalled();
  });

  it('saves when there is no previous best', async () => {
    mockGetBest.mockResolvedValue(null);
    mockSaveReplay.mockResolvedValue();

    const t0 = performance.now();
    startRecording();
    sampleFrame(t0, 0, 10, 0);

    await finishAndMaybeSave(10, 5, true);
    expect(mockSaveReplay).toHaveBeenCalledTimes(1);
  });

  it('forwards persistence errors to errorBus', async () => {
    mockGetBest.mockRejectedValue(new Error('db down'));

    const t0 = performance.now();
    startRecording();
    sampleFrame(t0, 0, 10, 0);

    await finishAndMaybeSave(100, 10, true);
    expect(mockReportError).toHaveBeenCalledTimes(1);
    expect(mockReportError.mock.calls[0]?.[1]).toBe('replayRecorder.finishAndMaybeSave');
  });

  it('downsamples to ≤900 samples when saving', async () => {
    mockGetBest.mockResolvedValue(null);
    mockSaveReplay.mockResolvedValue();

    const t0 = performance.now();
    startRecording();
    for (let i = 0; i < 1500; i++) {
      sampleFrame(t0 + i * 40, 0, 0, 0);
    }
    await finishAndMaybeSave(100, 10, true);
    const call = mockSaveReplay.mock.calls[0] as unknown[];
    const savedTrace = call[3] as unknown[];
    expect(savedTrace.length).toBeLessThanOrEqual(900);
  });

  it('finishAndMaybeSave stops recording', async () => {
    const t0 = performance.now();
    startRecording();
    sampleFrame(t0, 0, 0, 0);
    await finishAndMaybeSave(10, 5, false);
    // Recorder should now be stopped — new samples rejected.
    sampleFrame(t0 + 1000, 99, 99, 99);
    expect(getRingBuffer()).toEqual([]);
  });
});
