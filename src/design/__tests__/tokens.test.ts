/**
 * design tokens unit tests — structural invariants of the single-source-of-truth
 * design-system tokens. Guards against accidental breakage of spacing scale
 * monotonicity, palette derivation, motion-duration ordering, and breakpoint
 * consistency.
 */
import { describe, expect, it } from 'vitest';
import {
  breakpoints,
  color,
  elevation,
  layout,
  motion,
  radius,
  safeArea,
  space,
  zLayer,
} from '@/design/tokens';
import { COLORS } from '@/utils/constants';

describe('color', () => {
  it('brand colours match the canonical COLORS table (constants.ts is source of truth)', () => {
    expect(color.red).toBe(COLORS.RED);
    expect(color.yellow).toBe(COLORS.YELLOW);
    expect(color.blue).toBe(COLORS.BLUE);
    expect(color.purple).toBe(COLORS.PURPLE);
    expect(color.orange).toBe(COLORS.ORANGE);
    expect(color.green).toBe(COLORS.GREEN);
    expect(color.night).toBe(COLORS.NIGHT);
  });

  it('brand colours are 7-char hex strings', () => {
    const hex = /^#[0-9a-fA-F]{6}$/;
    for (const c of ['red', 'yellow', 'blue', 'purple', 'orange', 'green', 'night'] as const) {
      expect(color[c]).toMatch(hex);
    }
  });

  it('status tones are 7-char hex strings', () => {
    const hex = /^#[0-9a-fA-F]{6}$/;
    expect(color.toneDanger).toMatch(hex);
    expect(color.toneWarn).toMatch(hex);
    expect(color.toneSuccess).toMatch(hex);
    expect(color.toneInfo).toMatch(hex);
  });
});

describe('radius + space scales', () => {
  it('radius scale is strictly increasing (xs < sm < md < lg < xl)', () => {
    expect(radius.xs).toBeLessThan(radius.sm);
    expect(radius.sm).toBeLessThan(radius.md);
    expect(radius.md).toBeLessThan(radius.lg);
    expect(radius.lg).toBeLessThan(radius.xl);
    expect(radius.pill).toBeGreaterThanOrEqual(radius.xl);
  });

  it('space scale is strictly increasing from none → xxxxl', () => {
    const order: (keyof typeof space)[] = [
      'none',
      'xs',
      'sm',
      'md',
      'base',
      'lg',
      'xl',
      'xxl',
      'xxxl',
      'xxxxl',
    ];
    for (let i = 1; i < order.length; i++) {
      const prev = space[order[i - 1] as keyof typeof space];
      const cur = space[order[i] as keyof typeof space];
      expect(cur).toBeGreaterThan(prev);
    }
  });
});

describe('elevation', () => {
  it('every elevation value is a non-empty CSS box-shadow string', () => {
    for (const v of Object.values(elevation)) {
      expect(typeof v).toBe('string');
      expect(v.length).toBeGreaterThan(0);
    }
  });
});

describe('motion', () => {
  it('durations are ordered instant < fast < base < slow', () => {
    expect(motion.instant).toBeLessThan(motion.fast);
    expect(motion.fast).toBeLessThan(motion.base);
    expect(motion.base).toBeLessThan(motion.slow);
  });

  it('zone banner duration is in the seconds range (> 1s)', () => {
    expect(motion.zoneBanner).toBeGreaterThan(1000);
  });

  it('every easing function is a CSS cubic-bezier (or linear)', () => {
    expect(motion.easing.linear).toBe('linear');
    const cb = /^cubic-bezier\([^)]+\)$/;
    expect(motion.easing.out).toMatch(cb);
    expect(motion.easing.soft).toMatch(cb);
    expect(motion.easing.punch).toMatch(cb);
  });
});

describe('zLayer', () => {
  it('is strictly increasing: canvas < hud < banner < dialog < errorModal', () => {
    expect(zLayer.canvas).toBeLessThan(zLayer.hud);
    expect(zLayer.hud).toBeLessThan(zLayer.banner);
    expect(zLayer.banner).toBeLessThan(zLayer.dialog);
    expect(zLayer.dialog).toBeLessThan(zLayer.errorModal);
  });

  it('errorModal sits on top at a very high z-index', () => {
    expect(zLayer.errorModal).toBeGreaterThanOrEqual(9999);
  });
});

describe('breakpoints', () => {
  it('aspect thresholds are strictly increasing', () => {
    expect(breakpoints.aspect.phonePortrait).toBeLessThan(breakpoints.aspect.tabletPortrait);
    expect(breakpoints.aspect.tabletPortrait).toBeLessThan(breakpoints.aspect.landscapeThreshold);
    expect(breakpoints.aspect.landscapeThreshold).toBeLessThan(breakpoints.aspect.wide);
    expect(breakpoints.aspect.wide).toBeLessThan(breakpoints.aspect.ultrawide);
  });

  it('viewport scale is strictly increasing sm→xxl', () => {
    expect(breakpoints.viewport.sm).toBeLessThan(breakpoints.viewport.md);
    expect(breakpoints.viewport.md).toBeLessThan(breakpoints.viewport.lg);
    expect(breakpoints.viewport.lg).toBeLessThan(breakpoints.viewport.xl);
    expect(breakpoints.viewport.xl).toBeLessThan(breakpoints.viewport.xxl);
  });
});

describe('safeArea', () => {
  it('exposes CSS env(safe-area-inset-*) strings for all four sides', () => {
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      expect(safeArea[side]).toMatch(/^env\(safe-area-inset-(top|right|bottom|left), 0px\)$/);
    }
  });
});

describe('layout', () => {
  it('panelBottomOffset is 2 × space.xxxl + 48 (nav bar)', () => {
    expect(layout.panelBottomOffset).toBe(space.xxxl * 2 + 48);
  });

  it('panelBottomOffset is a positive finite number', () => {
    expect(layout.panelBottomOffset).toBeGreaterThan(0);
    expect(Number.isFinite(layout.panelBottomOffset)).toBe(true);
  });
});
