/**
 * accessibility.browser.test.tsx
 *
 * Real-browser ARIA + focus-management tests for HUD overlays.
 * Uses a real Chromium event loop to validate:
 *   - role / aria-modal attributes on dialogs
 *   - Escape key firing onClose callbacks
 *   - alertdialog / dialog roles
 *
 * Mocks: @capacitor/preferences, DB, achievements, profile, and loadout —
 * because those APIs require native plugins or SQLite not wired in the
 * test harness. The focus / keyboard behaviour we care about is in React + DOM.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearErrorsForTests, reportError } from '@/game/errorBus';
import { resetGameState, useGameStore } from '@/game/gameState';

// ─── Mock Capacitor preferences (used by SettingsPanel) ──────────────────────
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn().mockResolvedValue({ value: null }),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

// ─── Mock DB (used by AchievementsPanel + TicketShop) ────────────────────────
vi.mock('@/persistence/db', () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  db: vi.fn(),
  persistToOpfs: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/persistence/achievements', () => ({
  listAll: vi.fn().mockResolvedValue([]),
  checkRunAchievements: vi.fn().mockResolvedValue(undefined),
  grantAchievement: vi.fn().mockResolvedValue(undefined),
  updateProgress: vi.fn().mockResolvedValue(undefined),
  ACHIEVEMENT_CATALOG: [],
}));

vi.mock('@/persistence/profile', () => ({
  getProfile: vi.fn().mockResolvedValue({ tickets: 0 }),
  hasUnlock: vi.fn().mockResolvedValue(false),
  spendTickets: vi.fn().mockResolvedValue(undefined),
  grantUnlock: vi.fn().mockResolvedValue(undefined),
  addTickets: vi.fn().mockResolvedValue(undefined),
  recordRun: vi.fn().mockResolvedValue(undefined),
  listUnlocks: vi.fn().mockResolvedValue([]),
  getLoadout: vi.fn().mockResolvedValue({}),
  setLoadout: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/hooks/useLoadout', () => ({
  useLoadoutStore: (sel: (s: { loadout: null; equip: () => void }) => unknown) =>
    sel({ loadout: null, equip: vi.fn() }),
}));

import { AchievementsPanel } from '@/hud/AchievementsPanel';
import { ErrorModal } from '@/hud/ErrorModal';
import { HUD } from '@/hud/HUD';
import { SettingsPanel } from '@/hud/SettingsPanel';
import { TicketShop } from '@/hud/TicketShop';

// ─── ErrorModal ──────────────────────────────────────────────────────────────

describe('ErrorModal aria attributes', () => {
  beforeEach(() => clearErrorsForTests());
  afterEach(() => clearErrorsForTests());

  it('has role="alertdialog" and aria-modal when visible', () => {
    reportError(new Error('Test failure'), 'test');
    render(<ErrorModal />);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('has aria-label="Mayhem Halted"', () => {
    reportError(new Error('Test failure'), 'test');
    render(<ErrorModal />);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAttribute('aria-label', 'Mayhem Halted');
  });

  it('has aria-describedby pointing at the message element', () => {
    reportError(new Error('Test description'), 'test');
    render(<ErrorModal />);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAttribute('aria-describedby', 'error-modal-message');
  });

  it('dismiss button closes the modal', async () => {
    const user = userEvent.setup();
    reportError(new Error('Dismiss test'), 'test');
    render(<ErrorModal />);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await user.click(screen.getByTestId('error-modal-dismiss'));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

// ─── GameOverOverlay ──────────────────────────────────────────────────────────

describe('GameOverOverlay focus + aria', () => {
  beforeEach(() => resetGameState());

  it('RESTART button has role=button and is present', () => {
    useGameStore.setState({ gameOver: true, running: false, distance: 500, crowdReaction: 1000 });
    render(<HUD />);
    const restart = screen.getByTestId('restart-button');
    expect(restart).toBeInTheDocument();
    expect(restart.tagName).toBe('BUTTON');
  });

  it('game-over overlay has role="dialog" and aria-modal', () => {
    useGameStore.setState({ gameOver: true, running: false, distance: 500, crowdReaction: 1000 });
    render(<HUD />);
    const overlay = screen.getByTestId('game-over');
    expect(overlay).toHaveAttribute('role', 'dialog');
    expect(overlay).toHaveAttribute('aria-modal', 'true');
  });
});

// ─── TicketShop ───────────────────────────────────────────────────────────────

describe('TicketShop aria + keyboard', () => {
  it('has role="dialog" and aria-modal', () => {
    render(<TicketShop tickets={100} onClose={() => {}} onTicketsChange={() => {}} />);
    const shop = screen.getByTestId('ticket-shop');
    expect(shop).toHaveAttribute('role', 'dialog');
    expect(shop).toHaveAttribute('aria-modal', 'true');
    expect(shop).toHaveAttribute('aria-label', 'Ticket Shop');
  });

  it('Esc key fires onClose (real browser keyboard event)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<TicketShop tickets={100} onClose={onClose} onTicketsChange={() => {}} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ─── SettingsPanel ─────────────────────────────────────────────────────────────

describe('SettingsPanel aria + keyboard', () => {
  it('renders with role="dialog"', async () => {
    render(<SettingsPanel onClose={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('settings-panel')).toBeInTheDocument());
    expect(screen.getByTestId('settings-panel')).toHaveAttribute('role', 'dialog');
  });

  it('Esc key fires onClose (real browser keyboard event)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SettingsPanel onClose={onClose} />);
    await waitFor(() => screen.getByTestId('settings-panel'));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ─── AchievementsPanel ────────────────────────────────────────────────────────

describe('AchievementsPanel aria + keyboard', () => {
  it('renders with role="dialog"', async () => {
    render(<AchievementsPanel onClose={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('achievements-panel')).toBeInTheDocument());
    expect(screen.getByTestId('achievements-panel')).toHaveAttribute('role', 'dialog');
  });

  it('Esc key fires onClose (real browser keyboard event)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AchievementsPanel onClose={onClose} />);
    await waitFor(() => screen.getByTestId('achievements-panel'));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
