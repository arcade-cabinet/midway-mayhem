/**
 * typography unit tests — font stack exports + typeStyle CSSProperties
 * conversion.
 */
import { describe, expect, it } from 'vitest';
import { display, font, mono, type TypeStyle, typeStyle, ui } from '@/design/typography';

describe('font stacks', () => {
  it('every font stack is a non-empty string', () => {
    expect(typeof font.display).toBe('string');
    expect(font.display.length).toBeGreaterThan(0);
    expect(typeof font.ui).toBe('string');
    expect(font.ui.length).toBeGreaterThan(0);
    expect(typeof font.mono).toBe('string');
    expect(font.mono.length).toBeGreaterThan(0);
  });

  it('display stack names Bangers first', () => {
    expect(font.display).toMatch(/^"Bangers"/);
  });

  it('ui stack names Rajdhani first', () => {
    expect(font.ui).toMatch(/^"Rajdhani"/);
  });

  it('mono stack uses ui-monospace before fallbacks', () => {
    expect(font.mono).toMatch(/^ui-monospace/);
  });
});

describe('display scale', () => {
  it('every key has a complete TypeStyle', () => {
    for (const k of ['hero', 'banner', 'score', 'button', 'tag'] as const) {
      const s = display[k];
      expect(s.family).toBe(font.display);
      expect(typeof s.size).toBe('string');
      expect(s.weight).toBeGreaterThan(0);
      expect(typeof s.tracking).toBe('string');
    }
  });

  it('hero is larger than banner than score than button', () => {
    // Display tier uses clamp values. Loose sanity — each has a size string.
    for (const k of ['hero', 'banner'] as const) {
      expect(display[k].size).toMatch(/clamp\(/);
    }
  });
});

describe('ui scale', () => {
  it('every key has a complete TypeStyle', () => {
    for (const k of ['label', 'body', 'small', 'meta'] as const) {
      const s = ui[k];
      expect(s.family).toBe(font.ui);
      expect(s.size.length).toBeGreaterThan(0);
      expect(s.weight).toBeGreaterThan(0);
    }
  });

  it('label is uppercase', () => {
    expect(ui.label.upper).toBe(true);
  });

  it('body/small/meta are NOT uppercase', () => {
    expect(ui.body.upper).toBeUndefined();
    expect(ui.small.upper).toBeUndefined();
    expect(ui.meta.upper).toBeUndefined();
  });
});

describe('mono scale', () => {
  it('stack + inline both use the mono family', () => {
    expect(mono.stack.family).toBe(font.mono);
    expect(mono.inline.family).toBe(font.mono);
  });

  it('stack has a lineHeight set (for multi-line stack traces)', () => {
    expect(mono.stack.lineHeight).toBeGreaterThan(1);
  });
});

describe('typeStyle', () => {
  const base: TypeStyle = {
    family: '"X"',
    size: '1rem',
    weight: 500,
    tracking: '0.01em',
  };

  it('maps the minimum required fields to CSSProperties', () => {
    const out = typeStyle(base);
    expect(out.fontFamily).toBe('"X"');
    expect(out.fontSize).toBe('1rem');
    expect(out.fontWeight).toBe(500);
    expect(out.letterSpacing).toBe('0.01em');
  });

  it('includes lineHeight when present', () => {
    const out = typeStyle({ ...base, lineHeight: 1.5 });
    expect(out.lineHeight).toBe(1.5);
  });

  it('omits lineHeight when not provided', () => {
    const out = typeStyle(base);
    expect('lineHeight' in out).toBe(false);
  });

  it('includes textTransform:uppercase when upper=true', () => {
    const out = typeStyle({ ...base, upper: true });
    expect(out.textTransform).toBe('uppercase');
  });

  it('omits textTransform when upper is falsy', () => {
    const out = typeStyle(base);
    expect('textTransform' in out).toBe(false);
  });

  it('applies cleanly to the display.hero scale', () => {
    const out = typeStyle(display.hero);
    expect(out.fontFamily).toBe(font.display);
    expect(out.fontSize).toMatch(/^clamp/);
    expect(out.lineHeight).toBe(0.95);
  });

  it('applies cleanly to the ui.label scale (uppercase)', () => {
    const out = typeStyle(ui.label);
    expect(out.fontFamily).toBe(font.ui);
    expect(out.textTransform).toBe('uppercase');
    expect(out.fontWeight).toBe(700);
  });
});
