import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initDb, resetDbForTests } from '../db';
import {
  addTickets,
  getLoadout,
  getProfile,
  grantUnlock,
  hasUnlock,
  listUnlocks,
  recordRun,
  setLoadout,
  spendTickets,
} from '../profile';

beforeEach(async () => {
  await resetDbForTests();
  await initDb();
});

afterEach(async () => {
  await resetDbForTests();
});

describe('profile — ticket flow', () => {
  it('starts with 0 tickets', async () => {
    const p = await getProfile();
    expect(p.tickets).toBe(0);
  });

  it('addTickets increments balance', async () => {
    await addTickets(5);
    const p = await getProfile();
    expect(p.tickets).toBe(5);
  });

  it('multiple addTickets calls accumulate', async () => {
    await addTickets(3);
    await addTickets(7);
    const p = await getProfile();
    expect(p.tickets).toBe(10);
  });

  it('spendTickets deducts', async () => {
    await addTickets(20);
    await spendTickets(8);
    const p = await getProfile();
    expect(p.tickets).toBe(12);
  });

  it('spendTickets throws when insufficient', async () => {
    await addTickets(3);
    await expect(spendTickets(5)).rejects.toThrow('Not enough tickets');
  });

  it('spendTickets exact balance leaves 0', async () => {
    await addTickets(10);
    await spendTickets(10);
    const p = await getProfile();
    expect(p.tickets).toBe(0);
  });
});

describe('profile — run recording', () => {
  it('increments totalRuns', async () => {
    await recordRun({ distance: 100, crowd: 50 });
    const p = await getProfile();
    expect(p.totalRuns).toBe(1);
  });

  it('tracks bestDistanceCm', async () => {
    await recordRun({ distance: 50.5, crowd: 10 });
    await recordRun({ distance: 200.0, crowd: 5 });
    await recordRun({ distance: 100.0, crowd: 30 });
    const p = await getProfile();
    expect(p.bestDistanceCm).toBe(20000); // 200m in cm
  });

  it('tracks bestCrowd', async () => {
    await recordRun({ distance: 10, crowd: 300 });
    await recordRun({ distance: 500, crowd: 100 });
    const p = await getProfile();
    expect(p.bestCrowd).toBe(300);
  });
});

describe('unlocks', () => {
  it('grantUnlock records an unlock', async () => {
    await grantUnlock('palette', 'neon-circus');
    expect(await hasUnlock('palette', 'neon-circus')).toBe(true);
  });

  it('grantUnlock is idempotent', async () => {
    await grantUnlock('palette', 'neon-circus');
    await grantUnlock('palette', 'neon-circus');
    const list = await listUnlocks('palette');
    expect(list.filter((s) => s === 'neon-circus').length).toBe(1);
  });

  it('hasUnlock returns false for a never-granted item', async () => {
    expect(await hasUnlock('horn', 'never-granted-slug')).toBe(false);
  });

  it('hasUnlock returns true after grantUnlock', async () => {
    await grantUnlock('horn', 'circus-fanfare');
    expect(await hasUnlock('horn', 'circus-fanfare')).toBe(true);
  });

  it('listUnlocks filters by kind', async () => {
    await grantUnlock('palette', 'classic');
    await grantUnlock('palette', 'neon-circus');
    await grantUnlock('ornament', 'spinner');
    const palettes = await listUnlocks('palette');
    expect(palettes).toContain('classic');
    expect(palettes).toContain('neon-circus');
    expect(palettes).not.toContain('spinner');
  });
});

describe('loadout', () => {
  it('default loadout has expected slugs', async () => {
    const l = await getLoadout();
    expect(l.palette).toBe('classic');
    expect(l.ornament).toBe('flower');
    expect(l.horn).toBe('classic-beep');
  });

  it('setLoadout updates individual fields', async () => {
    await setLoadout({ palette: 'neon-circus' });
    const l = await getLoadout();
    expect(l.palette).toBe('neon-circus');
    expect(l.ornament).toBe('flower'); // unchanged
  });

  it('setLoadout with multiple fields', async () => {
    await setLoadout({ palette: 'pastel-dream', rim: 'gold', dice: 'blue-spots' });
    const l = await getLoadout();
    expect(l.palette).toBe('pastel-dream');
    expect(l.rim).toBe('gold');
    expect(l.dice).toBe('blue-spots');
  });

  it('setLoadout with empty partial is no-op', async () => {
    const before = await getLoadout();
    await setLoadout({});
    const after = await getLoadout();
    expect(after).toEqual(before);
  });
});
