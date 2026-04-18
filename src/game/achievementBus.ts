/**
 * @module systems/achievementBus
 *
 * Lightweight pub/sub for newly-earned achievement events.
 * When grantAchievement() stamps a slug it publishes here;
 * AchievementToast subscribes and queues slide-in banners.
 *
 * Intentionally thin — no Zustand, no React imports. Pure TS
 * so it can be called from persistence layer without bundler
 * concerns.
 */

export interface AchievementGrantedEvent {
  slug: string;
  title: string;
  at: number;
}

type Listener = (event: AchievementGrantedEvent) => void;

const _listeners = new Set<Listener>();

export function subscribeAchievements(fn: Listener): () => void {
  _listeners.add(fn);
  return () => {
    _listeners.delete(fn);
  };
}

export function publishAchievement(event: AchievementGrantedEvent): void {
  for (const fn of _listeners) fn(event);
}

/** Reset for tests — clears all listeners. */
export function resetAchievementBusForTests(): void {
  _listeners.clear();
}
