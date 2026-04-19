/**
 * config unit tests — validates that the shipped tunables.json +
 * track-pieces.json parse against the zod schemas, and that downstream
 * consumers see sensible defaults.
 */
import { describe, expect, it } from 'vitest';
import { trackArchetypes, tunables } from '@/config';
import { TrackArchetypeSetSchema, TunablesSchema } from '@/config/schema';

describe('tunables (parsed tunables.json)', () => {
  it('parses cleanly against TunablesSchema', () => {
    expect(() => TunablesSchema.parse(tunables)).not.toThrow();
  });

  it('cruiseMps is a positive finite number', () => {
    expect(tunables.cruiseMps).toBeGreaterThan(0);
    expect(Number.isFinite(tunables.cruiseMps)).toBe(true);
  });

  it('exposes core nested groups (speed, tricks, cockpit)', () => {
    expect(tunables.speed).toBeDefined();
    expect(tunables.tricks).toBeDefined();
    expect(tunables.cockpit).toBeDefined();
  });

  it('tricks durations are all positive', () => {
    expect(tunables.tricks.barrelRollDuration).toBeGreaterThan(0);
    expect(tunables.tricks.wheelieDuration).toBeGreaterThan(0);
    expect(tunables.tricks.handstandDuration).toBeGreaterThan(0);
    expect(tunables.tricks.spin180Duration).toBeGreaterThan(0);
  });

  it('tricks cleanLandingToleranceDeg is a positive degree value', () => {
    expect(tunables.tricks.cleanLandingToleranceDeg).toBeGreaterThan(0);
    expect(tunables.tricks.cleanLandingToleranceDeg).toBeLessThanOrEqual(180);
  });

  it('speed.cruiseMps is distinct from legacy tunables.cruiseMps', () => {
    // Both exist; schema docstring: "Speed targets (gameStateTick) — distinct"
    expect(Number.isFinite(tunables.speed.cruiseMps)).toBe(true);
  });
});

describe('trackArchetypes (parsed track-pieces.json)', () => {
  it('parses cleanly against TrackArchetypeSetSchema', () => {
    expect(() => TrackArchetypeSetSchema.parse(trackArchetypes)).not.toThrow();
  });

  it('laneWidth is positive', () => {
    expect(trackArchetypes.laneWidth).toBeGreaterThan(0);
  });

  it('lanes is a positive integer', () => {
    expect(Number.isInteger(trackArchetypes.lanes)).toBe(true);
    expect(trackArchetypes.lanes).toBeGreaterThan(0);
  });

  it('surfaceThickness is positive', () => {
    expect(trackArchetypes.surfaceThickness).toBeGreaterThan(0);
  });

  it('runLength is a positive integer', () => {
    expect(Number.isInteger(trackArchetypes.runLength)).toBe(true);
    expect(trackArchetypes.runLength).toBeGreaterThan(0);
  });

  it('archetypes array is non-empty', () => {
    expect(trackArchetypes.archetypes.length).toBeGreaterThan(0);
  });

  it('every archetype has a non-empty id + positive length + positive weight', () => {
    for (const a of trackArchetypes.archetypes) {
      expect(a.id.length).toBeGreaterThan(0);
      expect(a.length).toBeGreaterThan(0);
      expect(a.weight).toBeGreaterThan(0);
    }
  });

  it('archetype ids are unique', () => {
    const ids = trackArchetypes.archetypes.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('Schema validation — spot-check rejections', () => {
  it('TunablesSchema rejects missing required fields', () => {
    expect(() => TunablesSchema.parse({})).toThrow();
  });

  it('TunablesSchema rejects negative cruiseMps', () => {
    const bad = { ...tunables, cruiseMps: -1 };
    expect(() => TunablesSchema.parse(bad)).toThrow();
  });

  it('TrackArchetypeSetSchema rejects lanes=0', () => {
    const bad = { ...trackArchetypes, lanes: 0 };
    expect(() => TrackArchetypeSetSchema.parse(bad)).toThrow();
  });

  it('TrackArchetypeSetSchema rejects empty archetype arrays', () => {
    const bad = { ...trackArchetypes, archetypes: [] };
    expect(() => TrackArchetypeSetSchema.parse(bad)).toThrow();
  });

  it('TrackArchetypeSetSchema defaults weight to 1 when omitted', () => {
    const minimalArchetype = {
      id: 'x',
      label: 'X',
      length: 1,
      deltaYaw: 0,
      deltaPitch: 0,
    };
    const parsed = TrackArchetypeSetSchema.parse({
      laneWidth: 4,
      lanes: 4,
      surfaceThickness: 0.5,
      runLength: 10,
      archetypes: [minimalArchetype],
    });
    expect(parsed.archetypes[0]?.weight).toBe(1);
    expect(parsed.archetypes[0]?.bank).toBe(0);
  });
});
