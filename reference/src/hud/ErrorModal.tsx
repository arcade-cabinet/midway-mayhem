import { useEffect, useState } from 'react';
import { BrandButton } from '@/design/components/BrandButton';
import { Dialog } from '@/design/components/Dialog';
import { color, space } from '@/design/tokens';
import { display, mono, typeStyle, ui } from '@/design/typography';
import { type GameError, subscribeErrors } from '@/game/errorBus';

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
    <Dialog
      tone="danger"
      testId="error-modal"
      role="alertdialog"
      ariaLabel="Mayhem Halted"
      ariaDescribedBy="error-modal-message"
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: space.base,
          borderBottom: `2px solid ${color.borderAccent}`,
          paddingBottom: space.md,
        }}
      >
        <div
          style={{
            ...typeStyle(display.banner),
            color: color.red,
            fontSize: '2.5rem',
            textShadow: '3px 3px 0 #000',
          }}
        >
          MAYHEM HALTED
        </div>
        <div style={{ ...typeStyle(ui.label), color: color.yellow }}>
          {errors.length === 1 ? '1 error' : `${errors.length} errors`}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: space.sm,
          alignItems: 'baseline',
          marginBottom: space.md,
        }}
      >
        <span style={{ ...typeStyle(ui.label), color: color.blue }}>Context:</span>
        <span
          data-testid="error-modal-context"
          style={{ ...typeStyle(mono.inline), color: color.yellow }}
        >
          {latest.context}
        </span>
      </div>

      <div
        data-testid="error-modal-message"
        style={{
          padding: `${space.md}px ${space.base}px`,
          background: 'rgba(229, 57, 53, 0.15)',
          borderLeft: `4px solid ${color.red}`,
          borderRadius: 4,
          marginBottom: space.sm,
          ...typeStyle(mono.inline),
          fontSize: '1.05rem',
          lineHeight: 1.4,
          wordBreak: 'break-word',
        }}
      >
        {latest.message}
      </div>

      {latest.cause && (
        <div
          style={{
            marginBottom: space.sm,
            padding: space.md,
            background: 'rgba(30, 136, 229, 0.12)',
            borderLeft: `4px solid ${color.blue}`,
            borderRadius: 4,
          }}
        >
          <div
            style={{
              ...typeStyle(ui.label),
              color: color.blue,
              marginBottom: space.xs,
            }}
          >
            Caused by
          </div>
          <div style={{ ...typeStyle(mono.inline) }}>{latest.cause}</div>
        </div>
      )}

      <details
        style={{
          marginBottom: space.md,
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: 6,
          padding: space.sm + 2,
        }}
      >
        <summary
          style={{
            cursor: 'pointer',
            ...typeStyle(ui.small),
            color: color.purple,
            fontWeight: 700,
          }}
        >
          Stack trace
        </summary>
        <pre
          data-testid="error-modal-stack"
          style={{
            ...typeStyle(mono.stack),
            marginTop: space.sm + 2,
            color: '#bbb',
            overflow: 'auto',
            maxHeight: 260,
            padding: space.sm + 2,
            background: 'rgba(0, 0, 0, 0.5)',
            borderRadius: 4,
          }}
        >
          {latest.stack}
        </pre>
      </details>

      {errors.length > 1 && (
        <details
          style={{
            marginBottom: space.md,
            background: 'rgba(255, 255, 255, 0.04)',
            borderRadius: 6,
            padding: space.sm + 2,
          }}
        >
          <summary
            style={{
              cursor: 'pointer',
              ...typeStyle(ui.small),
              color: color.purple,
              fontWeight: 700,
            }}
          >
            All {errors.length} errors
          </summary>
          <pre
            style={{
              ...typeStyle(mono.stack),
              marginTop: space.sm + 2,
              color: '#bbb',
              overflow: 'auto',
              maxHeight: 260,
              padding: space.sm + 2,
              background: 'rgba(0, 0, 0, 0.5)',
              borderRadius: 4,
            }}
          >
            {errors
              .map(
                (e, i) =>
                  `${i + 1}. [${e.context}] ${e.message}\n    ${e.stack.split('\n')[1]?.trim() ?? ''}`,
              )
              .join('\n\n')}
          </pre>
        </details>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: space.md,
          ...typeStyle(ui.meta),
          color: 'rgba(255, 255, 255, 0.5)',
          marginBottom: space.base,
          paddingTop: space.md,
          borderTop: `1px solid ${color.borderSubtle}`,
        }}
      >
        <div>
          <span style={{ color: color.blue, fontWeight: 700 }}>URL:</span> {latest.url}
        </div>
        <div>
          <span style={{ color: color.blue, fontWeight: 700 }}>When:</span>{' '}
          {new Date(latest.at).toLocaleTimeString()}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: space.md,
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
        }}
      >
        <BrandButton kind="primary" size="sm" onClick={copyToClipboard} testId="error-modal-copy">
          Copy report
        </BrandButton>
        <BrandButton
          kind="secondary"
          size="sm"
          onClick={() => window.location.reload()}
          testId="error-modal-reload"
        >
          Reload
        </BrandButton>
        <BrandButton
          kind="ghost"
          size="sm"
          onClick={() => setDismissed(true)}
          testId="error-modal-dismiss"
        >
          Dismiss
        </BrandButton>
      </div>
    </Dialog>
  );
}
