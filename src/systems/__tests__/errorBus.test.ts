import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearErrorsForTests, isHalted, reportError, subscribeErrors } from '../errorBus';

describe('errorBus', () => {
  beforeEach(() => {
    clearErrorsForTests();
  });
  afterEach(() => {
    clearErrorsForTests();
  });

  it('starts unhalted with no errors', () => {
    expect(isHalted()).toBe(false);
    let snapshot: unknown = null;
    const unsub = subscribeErrors((errors) => {
      snapshot = errors;
    });
    expect(snapshot).toEqual([]);
    unsub();
  });

  it('halts on first reported error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    reportError(new Error('boom'), 'test-context');
    expect(isHalted()).toBe(true);
  });

  it('wraps non-Error values as Errors', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    reportError('plain string failure', 'string-context');
    let collected: readonly { message: string }[] = [];
    subscribeErrors((errors) => {
      collected = errors;
    });
    expect(collected).toHaveLength(1);
    expect(collected[0]?.message).toBe('plain string failure');
  });

  it('preserves error.cause chain', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const root = new Error('root cause');
    const wrapper = new Error('wrapped', { cause: root });
    reportError(wrapper, 'causal-context');
    let collected: readonly { cause: string | null }[] = [];
    subscribeErrors((errors) => {
      collected = errors;
    });
    expect(collected[0]?.cause).toContain('root cause');
  });

  it('notifies subscribers after each reportError', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fn = vi.fn();
    subscribeErrors(fn);
    fn.mockClear();
    reportError(new Error('one'), 'ctx1');
    reportError(new Error('two'), 'ctx2');
    expect(fn).toHaveBeenCalledTimes(2);
    const lastCall = fn.mock.calls[fn.mock.calls.length - 1];
    expect(lastCall?.[0]).toHaveLength(2);
  });

  it('captures context field verbatim', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    reportError(new Error('err'), 'preloadAllAssets');
    let collected: readonly { context: string }[] = [];
    subscribeErrors((e) => {
      collected = e;
    });
    expect(collected[0]?.context).toBe('preloadAllAssets');
  });
});
