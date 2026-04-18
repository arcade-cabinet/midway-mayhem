/**
 * achievementBus unit tests — pub/sub wiring for achievement banners.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  type AchievementGrantedEvent,
  publishAchievement,
  resetAchievementBusForTests,
  subscribeAchievements,
} from '@/game/achievementBus';

function evt(slug: string): AchievementGrantedEvent {
  return { slug, title: `title for ${slug}`, at: 0 };
}

describe('achievementBus', () => {
  beforeEach(() => {
    resetAchievementBusForTests();
  });

  it('publishes to registered listeners', () => {
    const seen: AchievementGrantedEvent[] = [];
    subscribeAchievements((e) => seen.push(e));
    publishAchievement(evt('six-figures'));
    expect(seen).toHaveLength(1);
    expect(seen[0]?.slug).toBe('six-figures');
  });

  it('delivers to every active listener', () => {
    const a: string[] = [];
    const b: string[] = [];
    subscribeAchievements((e) => a.push(e.slug));
    subscribeAchievements((e) => b.push(e.slug));
    publishAchievement(evt('balloon-glutton'));
    expect(a).toEqual(['balloon-glutton']);
    expect(b).toEqual(['balloon-glutton']);
  });

  it('unsubscribe stops further delivery', () => {
    const seen: string[] = [];
    const unsub = subscribeAchievements((e) => seen.push(e.slug));
    publishAchievement(evt('one'));
    unsub();
    publishAchievement(evt('two'));
    expect(seen).toEqual(['one']);
  });

  it('resetAchievementBusForTests clears all listeners', () => {
    const seen: string[] = [];
    subscribeAchievements((e) => seen.push(e.slug));
    resetAchievementBusForTests();
    publishAchievement(evt('after-reset'));
    expect(seen).toEqual([]);
  });
});
