import { Component, type ReactNode } from 'react';
import { reportError } from '../systems/errorBus';

/**
 * React Error Boundary — catches render-time errors in the tree and
 * funnels them into the global error bus. Used at both the app root
 * and as an <ErrorBoundary> inside <Canvas> (for R3F).
 */
export class ReactErrorBoundary extends Component<
  { context: string; children: ReactNode; fallback?: ReactNode },
  { errored: boolean }
> {
  state = { errored: false };

  static getDerivedStateFromError() {
    return { errored: true };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    const err = error as Error & { cause?: unknown };
    const augmented = new Error(`${err.message}\n\nComponent stack:\n${info.componentStack ?? ''}`, {
      cause: err,
    });
    reportError(augmented, this.props.context);
  }

  render() {
    if (this.state.errored) return this.props.fallback ?? null;
    return this.props.children;
  }
}
