/**
 * errorBus unit tests — the single "halt on first error" surface.
 *
 * Because the bus is a module singleton, tests reset it between runs
 * via clearErrorsForTests(). Console.error is muted per test so the
 * test output isn't polluted.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearErrorsForTests,
  getReportedErrors,
  isHalted,
  reportError,
  subscribeErrors,
} from '@/game/errorBus';

describe('errorBus', () => {
  beforeEach(() => {
    clearErrorsForTests();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts empty and un-halted', () => {
    expect(getReportedErrors()).toHaveLength(0);
    expect(isHalted()).toBe(false);
  });

  it('reportError appends an entry with the context attached', () => {
    reportError(new Error('boom'), 'test.context');
    const errs = getReportedErrors();
    expect(errs).toHaveLength(1);
    expect(errs[0]?.message).toBe('boom');
    expect(errs[0]?.context).toBe('test.context');
    expect(isHalted()).toBe(true);
  });

  it('wraps string values into Error messages', () => {
    reportError('raw string failure', 'ctx');
    expect(getReportedErrors()[0]?.message).toBe('raw string failure');
  });

  it('wraps non-Error, non-string payloads via safeStringify', () => {
    reportError({ code: 500, detail: 'internal' }, 'ctx');
    const msg = getReportedErrors()[0]?.message ?? '';
    expect(msg).toContain('500');
  });

  it('handles circular payloads without throwing', () => {
    // biome-ignore lint/suspicious/noExplicitAny: circular payload fixture
    const circular: any = { name: 'circle' };
    circular.self = circular;
    expect(() => reportError(circular, 'ctx')).not.toThrow();
    const msg = getReportedErrors()[0]?.message ?? '';
    expect(msg).toContain('[Circular]');
  });

  it('ids are strictly monotonically increasing', () => {
    reportError(new Error('a'), 'c');
    reportError(new Error('b'), 'c');
    reportError(new Error('c'), 'c');
    const ids = getReportedErrors().map((e) => e.id);
    expect(ids).toEqual([1, 2, 3]);
  });

  it('subscribeErrors fires synchronously with the current list and on each new error', () => {
    const snapshots: number[] = [];
    const unsub = subscribeErrors((errs) => snapshots.push(errs.length));
    // initial synchronous call fires with the empty state
    expect(snapshots).toEqual([0]);
    reportError(new Error('a'), 'c');
    expect(snapshots).toEqual([0, 1]);
    reportError(new Error('b'), 'c');
    expect(snapshots).toEqual([0, 1, 2]);
    unsub();
    reportError(new Error('c'), 'c');
    expect(snapshots).toEqual([0, 1, 2]);
  });
});
