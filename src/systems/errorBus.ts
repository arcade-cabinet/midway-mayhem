/**
 * Global error bus — every failure in the game routes here, triggering
 * the <ErrorModal>. Policy: HALT ON FIRST ERROR. Modal is dismissible for
 * debugging screenshots but the game itself does NOT resume until reload.
 */

export interface GameError {
  id: number;
  message: string;
  stack: string;
  cause: string | null;
  context: string;
  at: number;
  url: string;
  userAgent: string;
}

type Listener = (errors: readonly GameError[]) => void;

const state = {
  errors: [] as GameError[],
  listeners: new Set<Listener>(),
  nextId: 1,
  halted: false,
};

export function reportError(error: unknown, context: string): void {
  const now = Date.now();
  const e =
    error instanceof Error
      ? error
      : new Error(typeof error === 'string' ? error : JSON.stringify(error));

  const gameErr: GameError = {
    id: state.nextId++,
    message: e.message || '(no message)',
    stack: e.stack || '(no stack)',
    cause: describeCause(e),
    context,
    at: now,
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  };
  // Allocate a new array on every push so React re-renders on subscriber notification
  state.errors = [...state.errors, gameErr];

  if (!state.halted) {
    state.halted = true;
    // biome-ignore lint/suspicious/noConsole: intentional hard-fail signal
    console.error(`[mm:halt] ${context}: ${gameErr.message}`, e);
  }

  for (const fn of state.listeners) fn(state.errors);
}

function describeCause(e: Error): string | null {
  const cause = (e as { cause?: unknown }).cause;
  if (!cause) return null;
  if (cause instanceof Error) return `${cause.name}: ${cause.message}`;
  return String(cause);
}

export function subscribeErrors(fn: Listener): () => void {
  state.listeners.add(fn);
  fn(state.errors);
  return () => {
    state.listeners.delete(fn);
  };
}

export function isHalted(): boolean {
  return state.halted;
}

export function clearErrorsForTests(): void {
  state.errors = [];
  state.halted = false;
  state.nextId = 1;
  // Notify remaining listeners before clearing them so any pending assertions resolve cleanly
  for (const fn of state.listeners) fn(state.errors);
  state.listeners.clear();
}

let installed = false;
export function installGlobalErrorHandlers(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (ev) => {
    reportError(ev.error ?? ev.message, `window.onerror @ ${ev.filename}:${ev.lineno}:${ev.colno}`);
  });
  window.addEventListener('unhandledrejection', (ev) => {
    reportError(ev.reason, 'unhandledrejection');
  });
}
