/**
 * @module config/shopCatalog
 *
 * Static catalog of all purchasable items in the Ticket Shop.
 * Each entry has: slug, label, cost (tickets), and preview data.
 *
 * Preview data varies by kind:
 *   palette    → { bg: string, dot1: string, dot2: string } — swatch colors
 *   ornament   → { emoji: string }
 *   horn       → { emoji: string, description: string }
 *   horn_shape → { emoji: string }
 *   rim        → { color: string }
 *   dice       → { bg: string, dot: string }
 *
 * The "classic" slug of each kind is the free starter item.
 */

import type { UnlockKind } from '../persistence/schema';

export interface PalettePreview {
  bg: string;
  dot1: string;
  dot2: string;
}

export interface OrnamentPreview {
  emoji: string;
}

export interface HornPreview {
  emoji: string;
  description: string;
}

export interface RimPreview {
  color: string;
}

export interface DicePreview {
  bg: string;
  dot: string;
}

export interface HornShapePreview {
  emoji: string;
}

export type ShopItemPreview =
  | PalettePreview
  | OrnamentPreview
  | HornPreview
  | RimPreview
  | DicePreview
  | HornShapePreview;

export interface ShopItem<P extends ShopItemPreview = ShopItemPreview> {
  slug: string;
  label: string;
  cost: number;
  kind: UnlockKind;
  /** Free starter item — granted on first run without spending tickets. */
  starter?: boolean;
  preview: P;
}

// ─── Palettes ──────────────────────────────────────────────────────────────

export const PALETTES: ShopItem<PalettePreview>[] = [
  {
    slug: 'classic',
    label: 'Classic Clown',
    cost: 0,
    kind: 'palette',
    starter: true,
    preview: { bg: '#ff3e3e', dot1: '#ffd700', dot2: '#00a8ff' },
  },
  {
    slug: 'neon-circus',
    label: 'Neon Circus',
    cost: 30,
    kind: 'palette',
    preview: { bg: '#0d0d0d', dot1: '#00ffe0', dot2: '#ff00cc' },
  },
  {
    slug: 'pastel-dream',
    label: 'Pastel Dream',
    cost: 50,
    kind: 'palette',
    preview: { bg: '#ffd6e0', dot1: '#c9b8ff', dot2: '#b8ffc9' },
  },
  {
    slug: 'golden-hour',
    label: 'Golden Hour',
    cost: 80,
    kind: 'palette',
    preview: { bg: '#c8860a', dot1: '#ffe680', dot2: '#ffffff' },
  },
];

// ─── Ornaments ─────────────────────────────────────────────────────────────

export const ORNAMENTS: ShopItem<OrnamentPreview>[] = [
  {
    slug: 'flower',
    label: 'Squirt Flower',
    cost: 0,
    kind: 'ornament',
    starter: true,
    preview: { emoji: '🌸' },
  },
  {
    slug: 'propeller',
    label: 'Propeller Hat',
    cost: 25,
    kind: 'ornament',
    preview: { emoji: '🌀' },
  },
  {
    slug: 'siren',
    label: 'Clown Siren',
    cost: 45,
    kind: 'ornament',
    preview: { emoji: '🚨' },
  },
  {
    slug: 'megaphone',
    label: 'Megaphone',
    cost: 70,
    kind: 'ornament',
    preview: { emoji: '📢' },
  },
];

// ─── Horns ─────────────────────────────────────────────────────────────────

export const HORNS: ShopItem<HornPreview>[] = [
  {
    slug: 'classic-beep',
    label: 'Classic Beep',
    cost: 0,
    kind: 'horn',
    starter: true,
    preview: { emoji: '📯', description: 'The original honk' },
  },
  {
    slug: 'circus-fanfare',
    label: 'Circus Fanfare',
    cost: 20,
    kind: 'horn',
    preview: { emoji: '🎺', description: 'Da-da-da-DUM!' },
  },
  {
    slug: 'slide-whistle',
    label: 'Slide Whistle',
    cost: 35,
    kind: 'horn',
    preview: { emoji: '🎵', description: 'Wheeeee~' },
  },
  {
    slug: 'air-horn',
    label: 'Air Horn',
    cost: 60,
    kind: 'horn',
    preview: { emoji: '📣', description: 'BWAAAAP' },
  },
];

// ─── Horn Shapes ───────────────────────────────────────────────────────────

export const HORN_SHAPES: ShopItem<HornShapePreview>[] = [
  {
    slug: 'round',
    label: 'Round Button',
    cost: 0,
    kind: 'horn_shape',
    starter: true,
    preview: { emoji: '🔴' },
  },
  {
    slug: 'star',
    label: 'Star Badge',
    cost: 15,
    kind: 'horn_shape',
    preview: { emoji: '⭐' },
  },
  {
    slug: 'diamond',
    label: 'Diamond',
    cost: 30,
    kind: 'horn_shape',
    preview: { emoji: '💎' },
  },
  {
    slug: 'clover',
    label: 'Lucky Clover',
    cost: 55,
    kind: 'horn_shape',
    preview: { emoji: '🍀' },
  },
  {
    slug: 'ringmasters-horn',
    label: "Ringmaster's Horn",
    cost: 0,
    kind: 'horn_shape',
    preview: { emoji: '🎪' },
  },
];

// ─── Rims ──────────────────────────────────────────────────────────────────

export const RIMS: ShopItem<RimPreview>[] = [
  {
    slug: 'chrome',
    label: 'Chrome',
    cost: 0,
    kind: 'rim',
    starter: true,
    preview: { color: '#cccccc' },
  },
  {
    slug: 'gold',
    label: 'Gold',
    cost: 40,
    kind: 'rim',
    preview: { color: '#ffd700' },
  },
  {
    slug: 'purple-candy',
    label: 'Purple Candy',
    cost: 55,
    kind: 'rim',
    preview: { color: '#9c27b0' },
  },
  {
    slug: 'rainbow',
    label: 'Rainbow',
    cost: 100,
    kind: 'rim',
    preview: { color: 'linear-gradient(90deg,#ff3e3e,#ffd700,#00a8ff,#9c27b0)' },
  },
];

// ─── Dice ──────────────────────────────────────────────────────────────────

export const DICE: ShopItem<DicePreview>[] = [
  {
    slug: 'red-spots',
    label: 'Red & White',
    cost: 0,
    kind: 'dice',
    starter: true,
    preview: { bg: '#ff3e3e', dot: '#ffffff' },
  },
  {
    slug: 'blue-spots',
    label: 'Blue & White',
    cost: 20,
    kind: 'dice',
    preview: { bg: '#1e88e5', dot: '#ffffff' },
  },
  {
    slug: 'gold-black',
    label: 'Gold & Black',
    cost: 45,
    kind: 'dice',
    preview: { bg: '#ffd700', dot: '#0b0f1a' },
  },
  {
    slug: 'neon-green',
    label: 'Neon Green',
    cost: 75,
    kind: 'dice',
    preview: { bg: '#00ffe0', dot: '#0b0f1a' },
  },
];

// ─── Full catalog ───────────────────────────────────────────────────────────

export const SHOP_CATALOG = {
  palette: PALETTES,
  ornament: ORNAMENTS,
  horn: HORNS,
  horn_shape: HORN_SHAPES,
  rim: RIMS,
  dice: DICE,
} as const;

/** All starter items (free, granted on first run). */
export const STARTER_ITEMS: ShopItem[] = [
  ...PALETTES,
  ...ORNAMENTS,
  ...HORNS,
  ...HORN_SHAPES,
  ...RIMS,
  ...DICE,
].filter((item) => item.starter);
