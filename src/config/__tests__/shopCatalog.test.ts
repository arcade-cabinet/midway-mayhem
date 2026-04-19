/**
 * shopCatalog unit tests — structural invariants over every purchasable
 * item and per-kind aggregate (palettes / ornaments / horns / horn_shapes
 * / rims / dice).
 */
import { describe, expect, it } from 'vitest';
import {
  DICE,
  HORN_SHAPES,
  HORNS,
  ORNAMENTS,
  PALETTES,
  RIMS,
  SHOP_CATALOG,
  type ShopItem,
  STARTER_ITEMS,
} from '@/config/shopCatalog';

const ALL_ITEMS: ShopItem[] = [
  ...PALETTES,
  ...ORNAMENTS,
  ...HORNS,
  ...HORN_SHAPES,
  ...RIMS,
  ...DICE,
];

const HEX = /^#[0-9a-fA-F]{6}$/;

describe('Shop catalog — global invariants', () => {
  it('every ShopItem has non-empty slug + label', () => {
    for (const item of ALL_ITEMS) {
      expect(item.slug.length).toBeGreaterThan(0);
      expect(item.label.length).toBeGreaterThan(0);
    }
  });

  it('slugs are kebab-case', () => {
    const kebab = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    for (const item of ALL_ITEMS) expect(item.slug).toMatch(kebab);
  });

  it('slugs within a kind are unique', () => {
    for (const [_, items] of Object.entries(SHOP_CATALOG)) {
      const slugs = items.map((i) => i.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it('costs are non-negative finite numbers', () => {
    for (const item of ALL_ITEMS) {
      expect(item.cost).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(item.cost)).toBe(true);
    }
  });

  it('all starter items cost 0 (starter → free)', () => {
    for (const item of ALL_ITEMS) {
      if (item.starter) {
        expect(item.cost).toBe(0);
      }
    }
  });

  it('each ShopItem.kind matches its catalog bucket', () => {
    const buckets: { items: ShopItem[]; kind: ShopItem['kind'] }[] = [
      { items: PALETTES, kind: 'palette' },
      { items: ORNAMENTS, kind: 'ornament' },
      { items: HORNS, kind: 'horn' },
      { items: HORN_SHAPES, kind: 'horn_shape' },
      { items: RIMS, kind: 'rim' },
      { items: DICE, kind: 'dice' },
    ];
    for (const { items, kind } of buckets) {
      for (const item of items) expect(item.kind).toBe(kind);
    }
  });
});

describe('SHOP_CATALOG aggregate', () => {
  it('exposes every kind bucket', () => {
    for (const k of ['palette', 'ornament', 'horn', 'horn_shape', 'rim', 'dice'] as const) {
      expect(SHOP_CATALOG[k]).toBeDefined();
      expect(Array.isArray(SHOP_CATALOG[k])).toBe(true);
    }
  });

  it('each bucket references the same arrays as the named exports', () => {
    expect(SHOP_CATALOG.palette).toBe(PALETTES);
    expect(SHOP_CATALOG.ornament).toBe(ORNAMENTS);
    expect(SHOP_CATALOG.horn).toBe(HORNS);
    expect(SHOP_CATALOG.horn_shape).toBe(HORN_SHAPES);
    expect(SHOP_CATALOG.rim).toBe(RIMS);
    expect(SHOP_CATALOG.dice).toBe(DICE);
  });
});

describe('Palettes', () => {
  it('every palette preview has bg/dot1/dot2 hex colors', () => {
    for (const p of PALETTES) {
      expect(p.preview.bg).toMatch(HEX);
      expect(p.preview.dot1).toMatch(HEX);
      expect(p.preview.dot2).toMatch(HEX);
    }
  });

  it('has a "classic" starter palette', () => {
    const classic = PALETTES.find((p) => p.slug === 'classic');
    expect(classic).toBeDefined();
    expect(classic?.starter).toBe(true);
    expect(classic?.cost).toBe(0);
  });
});

describe('Ornaments / Horn shapes', () => {
  it('every ornament preview has an emoji', () => {
    for (const o of ORNAMENTS) {
      expect(o.preview.emoji.length).toBeGreaterThan(0);
    }
  });

  it('every horn_shape preview has an emoji', () => {
    for (const h of HORN_SHAPES) {
      expect(h.preview.emoji.length).toBeGreaterThan(0);
    }
  });
});

describe('Horns', () => {
  it('every horn preview has emoji + non-empty description', () => {
    for (const h of HORNS) {
      expect(h.preview.emoji.length).toBeGreaterThan(0);
      expect(h.preview.description.length).toBeGreaterThan(0);
    }
  });

  it('has at least one starter horn', () => {
    expect(HORNS.some((h) => h.starter)).toBe(true);
  });
});

describe('Rims', () => {
  it('every rim preview has a color (hex or CSS gradient)', () => {
    for (const r of RIMS) {
      expect(r.preview.color.length).toBeGreaterThan(0);
    }
  });
});

describe('Dice', () => {
  it('every dice preview has bg + dot hex colors', () => {
    for (const d of DICE) {
      expect(d.preview.bg).toMatch(HEX);
      expect(d.preview.dot).toMatch(HEX);
    }
  });

  it('has a "red-spots" starter die', () => {
    const red = DICE.find((d) => d.slug === 'red-spots');
    expect(red).toBeDefined();
    expect(red?.starter).toBe(true);
    expect(red?.cost).toBe(0);
  });
});

describe('STARTER_ITEMS', () => {
  it('contains only starter=true items', () => {
    for (const s of STARTER_ITEMS) expect(s.starter).toBe(true);
  });

  it('contains every starter across all buckets', () => {
    const starters = ALL_ITEMS.filter((i) => i.starter === true);
    expect(STARTER_ITEMS).toHaveLength(starters.length);
  });

  it('includes at least one of each kind that has a starter', () => {
    const kinds = new Set(STARTER_ITEMS.map((s) => s.kind));
    // Every bucket that has a starter should appear.
    for (const bucket of [PALETTES, HORNS, DICE]) {
      if (bucket.some((i) => i.starter)) {
        expect(kinds.has(bucket[0]?.kind ?? 'palette')).toBe(true);
      }
    }
  });

  it('all starters cost 0', () => {
    for (const s of STARTER_ITEMS) expect(s.cost).toBe(0);
  });
});
