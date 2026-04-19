/**
 * photoUtils unit tests — filename formatting.
 * triggerDownload depends on document and is covered by browser tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildFilename } from '@/ui/panels/photoUtils';

describe('buildFilename', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('matches the expected midway-mayhem-YYYYMMDD-hhmmss.png shape', () => {
    expect(buildFilename()).toMatch(/^midway-mayhem-\d{8}-\d{6}\.png$/);
  });

  it('zero-pads month/day/hour/minute/second single digits', () => {
    vi.setSystemTime(new Date(2026, 0, 2, 3, 4, 5));
    expect(buildFilename()).toBe('midway-mayhem-20260102-030405.png');
  });

  it('handles double-digit date components', () => {
    vi.setSystemTime(new Date(2026, 11, 31, 23, 59, 59));
    expect(buildFilename()).toBe('midway-mayhem-20261231-235959.png');
  });

  it('is deterministic for a fixed system time', () => {
    vi.setSystemTime(new Date(2026, 5, 15, 12, 34, 56));
    expect(buildFilename()).toBe(buildFilename());
  });

  it('uses YYYY (4-digit year)', () => {
    vi.setSystemTime(new Date(2100, 0, 1));
    expect(buildFilename()).toMatch(/^midway-mayhem-2100/);
  });
});
