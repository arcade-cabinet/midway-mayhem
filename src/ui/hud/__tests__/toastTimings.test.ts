/**
 * toastTimings unit tests — pure function deriving animation delays.
 */
import { describe, expect, it } from 'vitest';
import { computeToastTimings } from '@/ui/hud/toastTimings';

describe('computeToastTimings', () => {
  it('enterDelay is always 16ms (one frame @60Hz)', () => {
    expect(computeToastTimings(1000).enterDelay).toBe(16);
    expect(computeToastTimings(5000).enterDelay).toBe(16);
  });

  it('exitDelay is duration - 400 (400ms slide-out before clear)', () => {
    expect(computeToastTimings(2000).exitDelay).toBe(1600);
    expect(computeToastTimings(500).exitDelay).toBe(100);
  });

  it('clearDelay equals duration', () => {
    expect(computeToastTimings(3000).clearDelay).toBe(3000);
  });

  it('is deterministic', () => {
    expect(computeToastTimings(1234)).toEqual(computeToastTimings(1234));
  });

  it('exitDelay < clearDelay (exit must precede clear)', () => {
    const t = computeToastTimings(2000);
    expect(t.exitDelay).toBeLessThan(t.clearDelay);
  });

  it('handles short durations (exitDelay may go negative)', () => {
    const t = computeToastTimings(100);
    expect(t.exitDelay).toBe(-300);
    expect(t.clearDelay).toBe(100);
  });
});
