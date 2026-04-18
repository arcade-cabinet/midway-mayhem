/**
 * Pure formatting utilities for stats display.
 * Logic-only — no React, no imports from design system.
 */

export function formatDistance(cm: number): string {
  if (cm < 100_000) return `${(cm / 100).toFixed(0)} m`;
  return `${(cm / 100_000).toFixed(2)} km`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ${seconds % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function formatMs(ms: number): string {
  const s = ms / 1000;
  return `${s.toFixed(2)}s`;
}

/** Format a distance in cm for leaderboard display. */
export function formatLeaderboardDistance(cm: number): string {
  if (cm < 100) return `${cm}cm`;
  const m = cm / 100;
  if (m < 1000) return `${m.toFixed(0)}m`;
  return `${(m / 1000).toFixed(2)}km`;
}
