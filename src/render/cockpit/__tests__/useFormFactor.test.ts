/**
 * useFormFactor unit tests — responsiveCockpitTransform mapping.
 * The hook itself requires a DOM; we cover the pure transform function.
 */
import { describe, expect, it } from 'vitest';
import { type FormTier, responsiveCockpitTransform } from '@/render/cockpit/useFormFactor';

describe('responsiveCockpitTransform', () => {
  it('phone-portrait scales the cockpit down to 0.8 and pushes hood back', () => {
    expect(responsiveCockpitTransform('phone-portrait')).toEqual({
      scale: 0.8,
      hoodZOffset: -0.4,
    });
  });

  it('phone-landscape uses a mild 0.92 scale', () => {
    expect(responsiveCockpitTransform('phone-landscape')).toEqual({
      scale: 0.92,
      hoodZOffset: -0.1,
    });
  });

  it('tablet-portrait uses 0.9 scale', () => {
    expect(responsiveCockpitTransform('tablet-portrait')).toEqual({
      scale: 0.9,
      hoodZOffset: -0.2,
    });
  });

  it('tablet-landscape uses 0.96 scale', () => {
    expect(responsiveCockpitTransform('tablet-landscape')).toEqual({
      scale: 0.96,
      hoodZOffset: 0,
    });
  });

  it('desktop runs at full 1.0 scale with no offset', () => {
    expect(responsiveCockpitTransform('desktop')).toEqual({
      scale: 1.0,
      hoodZOffset: 0,
    });
  });

  it('ultrawide uses desktop transform', () => {
    expect(responsiveCockpitTransform('ultrawide')).toEqual({
      scale: 1.0,
      hoodZOffset: 0,
    });
  });

  it('scales are strictly ≤ 1 (cockpit never grows beyond desktop size)', () => {
    const tiers: FormTier[] = [
      'phone-portrait',
      'phone-landscape',
      'tablet-portrait',
      'tablet-landscape',
      'desktop',
      'ultrawide',
    ];
    for (const t of tiers) {
      expect(responsiveCockpitTransform(t).scale).toBeLessThanOrEqual(1);
    }
  });

  it('hoodZOffset is always ≤ 0 (hood only pushes forward/away)', () => {
    const tiers: FormTier[] = [
      'phone-portrait',
      'phone-landscape',
      'tablet-portrait',
      'tablet-landscape',
      'desktop',
      'ultrawide',
    ];
    for (const t of tiers) {
      expect(responsiveCockpitTransform(t).hoodZOffset).toBeLessThanOrEqual(0);
    }
  });

  it('phone tiers scale tighter than tablet tiers', () => {
    expect(responsiveCockpitTransform('phone-portrait').scale).toBeLessThan(
      responsiveCockpitTransform('tablet-portrait').scale,
    );
    expect(responsiveCockpitTransform('phone-landscape').scale).toBeLessThan(
      responsiveCockpitTransform('tablet-landscape').scale,
    );
  });

  it('portrait tiers push hood further back than landscape tiers in same class', () => {
    expect(responsiveCockpitTransform('phone-portrait').hoodZOffset).toBeLessThan(
      responsiveCockpitTransform('phone-landscape').hoodZOffset,
    );
    expect(responsiveCockpitTransform('tablet-portrait').hoodZOffset).toBeLessThan(
      responsiveCockpitTransform('tablet-landscape').hoodZOffset,
    );
  });

  it('is deterministic — same tier → same transform across repeated calls', () => {
    expect(responsiveCockpitTransform('phone-portrait')).toEqual(
      responsiveCockpitTransform('phone-portrait'),
    );
  });
});
