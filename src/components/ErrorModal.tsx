import { useEffect, useState } from 'react';
import { type GameError, subscribeErrors } from '../systems/errorBus';

export function ErrorModal() {
  const [errors, setErrors] = useState<readonly GameError[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => subscribeErrors(setErrors), []);

  if (errors.length === 0 || dismissed) {
    return (
      <div
        data-testid="error-modal-root"
        data-error-count={errors.length}
        style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
      />
    );
  }

  const latest = errors[errors.length - 1] as GameError;

  const copyToClipboard = async () => {
    const payload = errors
      .map(
        (e) =>
          `[${new Date(e.at).toISOString()}] ${e.context}\n${e.message}\nCause: ${e.cause ?? '(none)'}\nURL: ${e.url}\nUA: ${e.userAgent}\n${e.stack}`,
      )
      .join('\n\n────────────\n\n');
    await navigator.clipboard.writeText(payload);
  };

  return (
    <div
      data-testid="error-modal"
      role="alertdialog"
      aria-live="assertive"
      style={overlay}
    >
      <div style={panel}>
        <div style={header}>
          <div style={title}>MAYHEM HALTED</div>
          <div style={subtitle}>{errors.length === 1 ? '1 error' : `${errors.length} errors`}</div>
        </div>

        <div style={contextRow}>
          <span style={contextLabel}>Context:</span>
          <span data-testid="error-modal-context" style={contextValue}>
            {latest.context}
          </span>
        </div>

        <div data-testid="error-modal-message" style={message}>
          {latest.message}
        </div>

        {latest.cause && (
          <div style={causeBlock}>
            <div style={causeLabel}>Caused by</div>
            <div style={causeText}>{latest.cause}</div>
          </div>
        )}

        <details style={stackDetails}>
          <summary style={stackSummary}>Stack trace</summary>
          <pre data-testid="error-modal-stack" style={stackPre}>
            {latest.stack}
          </pre>
        </details>

        {errors.length > 1 && (
          <details style={stackDetails}>
            <summary style={stackSummary}>All {errors.length} errors</summary>
            <pre style={stackPre}>
              {errors
                .map(
                  (e, i) => `${i + 1}. [${e.context}] ${e.message}\n    ${e.stack.split('\n')[1]?.trim() ?? ''}`,
                )
                .join('\n\n')}
            </pre>
          </details>
        )}

        <div style={metaRow}>
          <div>
            <span style={metaLabel}>URL:</span> {latest.url}
          </div>
          <div>
            <span style={metaLabel}>When:</span> {new Date(latest.at).toLocaleTimeString()}
          </div>
        </div>

        <div style={actionRow}>
          <button
            type="button"
            data-testid="error-modal-copy"
            onClick={copyToClipboard}
            style={buttonPrimary}
          >
            Copy report
          </button>
          <button
            type="button"
            data-testid="error-modal-reload"
            onClick={() => window.location.reload()}
            style={buttonSecondary}
          >
            Reload
          </button>
          <button
            type="button"
            data-testid="error-modal-dismiss"
            onClick={() => setDismissed(true)}
            style={buttonGhost}
            title="Dismiss modal (game stays halted; reload to restart)"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(10, 0, 15, 0.88)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 10000,
  padding: 24,
  fontFamily: 'Rajdhani, system-ui, sans-serif',
  color: '#fff',
};

const panel: React.CSSProperties = {
  width: 'min(780px, 100%)',
  maxHeight: '90vh',
  overflowY: 'auto',
  background: '#120718',
  border: '3px solid #E53935',
  borderRadius: 12,
  padding: 24,
  boxShadow: '0 0 64px rgba(229, 57, 53, 0.45)',
};

const header: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  marginBottom: 16,
  borderBottom: '2px solid rgba(255, 214, 0, 0.3)',
  paddingBottom: 12,
};

const title: React.CSSProperties = {
  fontFamily: 'Bangers, Impact, sans-serif',
  fontSize: '2.5rem',
  letterSpacing: '0.08em',
  color: '#E53935',
  textShadow: '3px 3px 0 #000',
};

const subtitle: React.CSSProperties = {
  fontSize: '0.9rem',
  color: '#FFD600',
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
};

const contextRow: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'baseline',
  marginBottom: 12,
};
const contextLabel: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#1E88E5',
  letterSpacing: '0.15em',
  fontWeight: 700,
  textTransform: 'uppercase',
};
const contextValue: React.CSSProperties = {
  fontFamily: 'ui-monospace, Menlo, monospace',
  fontSize: '0.95rem',
  color: '#FFD600',
};

const message: React.CSSProperties = {
  padding: '12px 16px',
  background: 'rgba(229, 57, 53, 0.15)',
  borderLeft: '4px solid #E53935',
  borderRadius: 4,
  marginBottom: 14,
  fontSize: '1.05rem',
  lineHeight: 1.4,
  fontFamily: 'ui-monospace, Menlo, monospace',
  wordBreak: 'break-word',
};

const causeBlock: React.CSSProperties = {
  marginBottom: 14,
  padding: 12,
  background: 'rgba(30, 136, 229, 0.12)',
  borderLeft: '4px solid #1E88E5',
  borderRadius: 4,
};
const causeLabel: React.CSSProperties = {
  fontSize: '0.7rem',
  color: '#1E88E5',
  letterSpacing: '0.15em',
  fontWeight: 700,
  textTransform: 'uppercase',
  marginBottom: 4,
};
const causeText: React.CSSProperties = {
  fontFamily: 'ui-monospace, Menlo, monospace',
  fontSize: '0.9rem',
};

const stackDetails: React.CSSProperties = {
  marginBottom: 12,
  background: 'rgba(255, 255, 255, 0.04)',
  borderRadius: 6,
  padding: 10,
};
const stackSummary: React.CSSProperties = {
  cursor: 'pointer',
  fontSize: '0.9rem',
  color: '#8E24AA',
  fontWeight: 700,
  letterSpacing: '0.05em',
};
const stackPre: React.CSSProperties = {
  marginTop: 10,
  fontSize: '0.78rem',
  lineHeight: 1.4,
  fontFamily: 'ui-monospace, Menlo, monospace',
  color: '#bbb',
  overflow: 'auto',
  maxHeight: 260,
  padding: 10,
  background: 'rgba(0, 0, 0, 0.5)',
  borderRadius: 4,
};

const metaRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 12,
  fontSize: '0.75rem',
  color: 'rgba(255, 255, 255, 0.5)',
  marginBottom: 16,
  paddingTop: 12,
  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
};
const metaLabel: React.CSSProperties = { color: '#1E88E5', fontWeight: 700 };

const actionRow: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  justifyContent: 'flex-end',
  flexWrap: 'wrap',
};
const buttonBase: React.CSSProperties = {
  padding: '10px 18px',
  fontFamily: 'Bangers, Impact, sans-serif',
  fontSize: '1.1rem',
  letterSpacing: '0.08em',
  borderRadius: 8,
  cursor: 'pointer',
  border: '2px solid',
};
const buttonPrimary: React.CSSProperties = {
  ...buttonBase,
  borderColor: '#FFD600',
  background: '#E53935',
  color: '#fff',
};
const buttonSecondary: React.CSSProperties = {
  ...buttonBase,
  borderColor: '#1E88E5',
  background: 'transparent',
  color: '#1E88E5',
};
const buttonGhost: React.CSSProperties = {
  ...buttonBase,
  borderColor: 'rgba(255,255,255,0.2)',
  background: 'transparent',
  color: 'rgba(255,255,255,0.7)',
};
