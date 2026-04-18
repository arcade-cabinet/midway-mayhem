/**
 * input/haptics unit tests — native Capacitor + web fallback routing.
 * Mocks @capacitor/haptics import and navigator.vibrate.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const impactMock = vi.fn<(opts: { style: string }) => Promise<void>>();
const ImpactStyleFixture = {
  Light: 'LIGHT',
  Medium: 'MEDIUM',
  Heavy: 'HEAVY',
} as const;

vi.mock('@capacitor/haptics', () => ({
  Haptics: { impact: (opts: { style: string }) => impactMock(opts) },
  ImpactStyle: ImpactStyleFixture,
}));

describe('haptic', () => {
  let originalNavigator: typeof globalThis.navigator | undefined;
  let vibrateMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    impactMock.mockReset();
    impactMock.mockResolvedValue(undefined);
    vibrateMock = vi.fn<(pattern: number | number[]) => boolean>().mockReturnValue(true);
    originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { vibrate: vibrateMock },
    });
  });

  afterEach(() => {
    if (originalNavigator) {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: originalNavigator,
      });
    }
  });

  it('native path routes light → ImpactStyle.Light', async () => {
    const { haptic } = await import('@/input/haptics');
    await haptic('light');
    expect(impactMock).toHaveBeenCalledWith({ style: 'LIGHT' });
    expect(vibrateMock).not.toHaveBeenCalled();
  });

  it('native path routes medium → ImpactStyle.Medium', async () => {
    const { haptic } = await import('@/input/haptics');
    await haptic('medium');
    expect(impactMock).toHaveBeenCalledWith({ style: 'MEDIUM' });
  });

  it('native path routes heavy → ImpactStyle.Heavy', async () => {
    const { haptic } = await import('@/input/haptics');
    await haptic('heavy');
    expect(impactMock).toHaveBeenCalledWith({ style: 'HEAVY' });
  });

  it('falls back to navigator.vibrate when native impact throws', async () => {
    impactMock.mockRejectedValue(new Error('plugin not available'));
    const { haptic } = await import('@/input/haptics');
    await haptic('light');
    expect(vibrateMock).toHaveBeenCalledWith(15);
  });

  it('web fallback pattern: light=15, medium=40, heavy=90 ms', async () => {
    impactMock.mockRejectedValue(new Error('no native'));
    const { haptic } = await import('@/input/haptics');

    vibrateMock.mockClear();
    await haptic('light');
    expect(vibrateMock).toHaveBeenLastCalledWith(15);

    vibrateMock.mockClear();
    await haptic('medium');
    expect(vibrateMock).toHaveBeenLastCalledWith(40);

    vibrateMock.mockClear();
    await haptic('heavy');
    expect(vibrateMock).toHaveBeenLastCalledWith(90);
  });

  it('is silent when navigator.vibrate is absent and native fails', async () => {
    impactMock.mockRejectedValue(new Error('no native'));
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {},
    });
    const { haptic } = await import('@/input/haptics');
    await expect(haptic('light')).resolves.toBeUndefined();
  });
});
