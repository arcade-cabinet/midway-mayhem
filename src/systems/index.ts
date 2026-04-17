/**
 * @/systems — public barrel for cross-cutting singletons.
 * errorBus, diagnosticsBus, hapticsBus.
 */
export {
  reportError,
  subscribeErrors,
  isHalted,
  clearErrorsForTests,
  installGlobalErrorHandlers,
} from './errorBus';
export type { GameError } from './errorBus';

export { installDiagnosticsBus } from './diagnosticsBus';
export { hapticsBus, initHapticsSafely } from './hapticsBus';
