/**
 * GhostMenu — D4 Watch-Ghost replay UI browser test.
 *
 * Verifies:
 *  1. When visible=false the component renders nothing.
 *  2. When visible=true with no replays saved, the "No runs recorded yet." empty state shows.
 *  3. After saving a fake replay, the run list renders one row with the formatted distance.
 *  4. Selecting a run switches to replay mode (ghost-menu-replay testid visible, playpause + exit buttons present).
 *  5. The exit button returns to the run list (ghost-menu testid visible again).
 */
import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initDb, resetDbForTests } from '@/persistence/db';
import { GhostMenu, saveReplay } from '../GhostMenu';

const TRACE = [
  { t: 0, lateral: 0, speedMps: 30, steer: 0 },
  { t: 0.1, lateral: 0.1, speedMps: 31, steer: 0.05 },
  { t: 0.2, lateral: 0, speedMps: 32, steer: 0 },
];

beforeEach(async () => {
  await resetDbForTests();
  await initDb();
});

afterEach(async () => {
  await resetDbForTests();
});

describe('GhostMenu — D4', () => {
  it('renders nothing when visible=false', () => {
    const { container } = render(<GhostMenu visible={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows empty state when visible=true and no replays exist', async () => {
    const { container } = render(<GhostMenu visible={true} />);
    await waitFor(
      () => {
        const menu = container.querySelector('[data-testid="ghost-menu"]');
        if (!menu) throw new Error('ghost-menu not mounted');
        const text = menu.textContent ?? '';
        if (!text.includes('No runs recorded yet.')) {
          throw new Error(`Expected empty-state text, got: ${text}`);
        }
        return menu;
      },
      { timeout: 5_000 },
    );
  });

  it('renders saved run in list', async () => {
    // distance=200m → distanceCm=20000 → formatDistance shows "200 m"
    await saveReplay('2026-04-24', 200, 100, TRACE);

    const { container } = render(<GhostMenu visible={true} />);

    await waitFor(
      () => {
        const menu = container.querySelector('[data-testid="ghost-menu"]');
        if (!menu) throw new Error('ghost-menu not mounted');
        const text = menu.textContent ?? '';
        if (!text.includes('200')) {
          throw new Error(`Expected distance "200" in list, got: ${text}`);
        }
        return menu;
      },
      { timeout: 5_000 },
    );
  });

  it('entering replay mode shows the replay control bar', async () => {
    await saveReplay('2026-04-24', 200, 100, TRACE);

    const enterCalled: boolean[] = [];
    const { container } = render(
      <GhostMenu
        visible={true}
        onEnterReplay={() => {
          enterCalled.push(true);
        }}
      />,
    );

    // Wait for the run to appear, then click it.
    const runBtn = await waitFor(
      () => {
        const btns = container.querySelectorAll('[data-testid^="ghost-run-"]');
        if (btns.length === 0) throw new Error('no ghost-run-* button found yet');
        return btns[0] as HTMLButtonElement;
      },
      { timeout: 5_000 },
    );

    runBtn.click();

    // Replay control bar should appear.
    await waitFor(
      () => {
        const bar = container.querySelector('[data-testid="ghost-menu-replay"]');
        if (!bar) throw new Error('ghost-menu-replay not mounted after click');
        return bar;
      },
      { timeout: 3_000 },
    );

    expect(enterCalled.length).toBeGreaterThan(0);

    const playPause = container.querySelector('[data-testid="ghost-replay-playpause"]');
    expect(playPause, 'playpause button missing').toBeTruthy();

    const exitBtn = container.querySelector('[data-testid="ghost-replay-exit"]');
    expect(exitBtn, 'exit button missing').toBeTruthy();
  });

  it('clicking exit returns to run list', async () => {
    await saveReplay('2026-04-24', 200, 100, TRACE);

    const exitCalled: boolean[] = [];
    const { container } = render(
      <GhostMenu
        visible={true}
        onExitReplay={() => {
          exitCalled.push(true);
        }}
      />,
    );

    // Click the run to enter replay mode.
    const runBtn = await waitFor(
      () => {
        const btns = container.querySelectorAll('[data-testid^="ghost-run-"]');
        if (btns.length === 0) throw new Error('no ghost-run-* button found yet');
        return btns[0] as HTMLButtonElement;
      },
      { timeout: 5_000 },
    );
    runBtn.click();

    // Wait for replay bar to appear, then click exit.
    const exitBtn = await waitFor(
      () => {
        const el = container.querySelector('[data-testid="ghost-replay-exit"]');
        if (!el) throw new Error('exit button not found');
        return el as HTMLButtonElement;
      },
      { timeout: 3_000 },
    );
    exitBtn.click();

    // Run list should be back.
    await waitFor(
      () => {
        const menu = container.querySelector('[data-testid="ghost-menu"]');
        if (!menu) throw new Error('ghost-menu not back after exit');
        return menu;
      },
      { timeout: 3_000 },
    );

    expect(exitCalled.length).toBeGreaterThan(0);
  });
});
