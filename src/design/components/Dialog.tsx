import type { CSSProperties, ReactNode } from 'react';
import { color, elevation, radius, space, zLayer } from '../tokens';

interface Props {
  children: ReactNode;
  tone?: 'danger' | 'info';
  testId?: string;
  style?: CSSProperties;
  role?: 'dialog' | 'alertdialog';
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
}

const BORDER: Record<'danger' | 'info', string> = {
  danger: color.borderDanger,
  info: color.borderInfo,
};

const SHADOW: Record<'danger' | 'info', string> = {
  danger: elevation.danger,
  info: elevation.success,
};

export function Dialog({
  children,
  tone = 'danger',
  testId,
  style,
  role = 'dialog',
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
}: Props) {
  if (!ariaLabel && !ariaLabelledBy) {
    throw new Error('Dialog requires ariaLabel or ariaLabelledBy for accessibility.');
  }
  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is dialog|alertdialog, aria-modal is valid
    <div
      data-testid={testId}
      role={role}
      aria-modal="true"
      aria-live={role === 'alertdialog' ? 'assertive' : undefined}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      style={{
        position: 'fixed',
        inset: 0,
        background: color.overlayDim,
        display: 'grid',
        placeItems: 'center',
        zIndex: zLayer.errorModal,
        padding: space.xl,
        ...style,
      }}
    >
      <div
        style={{
          width: 'min(780px, 100%)',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: color.walnut,
          border: `3px solid ${BORDER[tone]}`,
          borderRadius: radius.md,
          padding: space.xl,
          boxShadow: SHADOW[tone],
        }}
      >
        {children}
      </div>
    </div>
  );
}
