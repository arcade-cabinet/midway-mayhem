/**
 * seedZones unit tests — cycles theme list across evenly spaced distance bins.
 */
import { createWorld } from 'koota';
import { describe, expect, it } from 'vitest';
import { seedZones } from '@/ecs/systems/seedZones';
import { Zone, type ZoneTheme } from '@/ecs/traits';

function collectZones(w: ReturnType<typeof createWorld>) {
  const out: { theme: ZoneTheme; distance: number }[] = [];
  w.query(Zone).forEach((e) => {
    const z = e.get(Zone);
    if (z) out.push({ theme: z.theme, distance: z.distance });
  });
  return out.sort((a, b) => a.distance - b.distance);
}

describe('seedZones', () => {
  it('spawns zones every intervalM starting at lead=120m', () => {
    const w = createWorld();
    seedZones(w, 1600, 500);
    const zs = collectZones(w);
    const expectedDs = [120, 620, 1120]; // 120+500, 120+1000 within 1600
    expect(zs.map((z) => z.distance)).toEqual(expectedDs);
  });

  it('cycles themes in order: carnival → funhouse → ringmaster → grandfinale', () => {
    const w = createWorld();
    seedZones(w, 3000, 500); // 120, 620, 1120, 1620, 2120, 2620 → 6 zones
    const zs = collectZones(w);
    const themes: ZoneTheme[] = ['carnival', 'funhouse', 'ringmaster', 'grandfinale'];
    for (let i = 0; i < zs.length; i++) {
      expect(zs[i]?.theme).toBe(themes[i % themes.length]);
    }
  });

  it('wraps themes past the 4-item cycle', () => {
    const w = createWorld();
    seedZones(w, 5000, 500);
    const zs = collectZones(w);
    // Zone #4 (index 4) → themes[4 % 4] = carnival again
    expect(zs[4]?.theme).toBe('carnival');
    expect(zs[5]?.theme).toBe('funhouse');
  });

  it('spawns no zones when trackLength is below lead=120', () => {
    const w = createWorld();
    seedZones(w, 100, 500);
    expect(collectZones(w)).toEqual([]);
  });

  it('uses default args trackLength=1600, interval=500', () => {
    const w = createWorld();
    seedZones(w);
    const zs = collectZones(w);
    expect(zs.map((z) => z.distance)).toEqual([120, 620, 1120]);
  });

  it('does not spawn a zone AT trackLength boundary (strict less-than)', () => {
    const w = createWorld();
    seedZones(w, 620, 500);
    const zs = collectZones(w);
    expect(zs.map((z) => z.distance)).toEqual([120]);
  });

  it('is deterministic — same args produce the same zone list', () => {
    const w1 = createWorld();
    const w2 = createWorld();
    seedZones(w1, 2000, 500);
    seedZones(w2, 2000, 500);
    expect(collectZones(w1)).toEqual(collectZones(w2));
  });
});
