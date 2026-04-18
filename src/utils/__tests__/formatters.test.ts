import { describe, expect, it } from 'vitest';
import {
  formatDistance,
  formatDuration,
  formatLeaderboardDistance,
  formatMs,
} from '@/utils/formatters';

describe('formatDistance', () => {
  it('uses metres below 1 km', () => {
    expect(formatDistance(50_000)).toBe('500 m');
    expect(formatDistance(99_999)).toBe('1000 m');
  });
  it('switches to km with 2 decimals at 1 km', () => {
    expect(formatDistance(100_000)).toBe('1.00 km');
    expect(formatDistance(250_000)).toBe('2.50 km');
  });
});

describe('formatDuration', () => {
  it('renders seconds below one minute', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(59)).toBe('59s');
  });
  it('renders minutes+seconds between 1 min and 1 hour', () => {
    expect(formatDuration(60)).toBe('1m 0s');
    expect(formatDuration(125)).toBe('2m 5s');
  });
  it('renders hours+minutes past 1 hour', () => {
    expect(formatDuration(3600)).toBe('1h 0m');
    expect(formatDuration(3900)).toBe('1h 5m');
  });
});

describe('formatMs', () => {
  it('renders ms as seconds with 2 decimals', () => {
    expect(formatMs(1234)).toBe('1.23s');
    expect(formatMs(0)).toBe('0.00s');
  });
});

describe('formatLeaderboardDistance', () => {
  it('uses cm below 100 cm (1 m)', () => {
    expect(formatLeaderboardDistance(0)).toBe('0cm');
    expect(formatLeaderboardDistance(99)).toBe('99cm');
  });
  it('uses metres between 1 m and 1 km', () => {
    expect(formatLeaderboardDistance(100)).toBe('1m');
    expect(formatLeaderboardDistance(50_000)).toBe('500m');
  });
  it('switches to km at 1 km', () => {
    expect(formatLeaderboardDistance(100_000)).toBe('1.00km');
    expect(formatLeaderboardDistance(250_000)).toBe('2.50km');
  });
});
