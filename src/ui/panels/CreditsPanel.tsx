import { useEffect, useRef } from 'react';
import { BrandButton } from '@/design/components/BrandButton';
import { Dialog } from '@/design/components/Dialog';
import { color, space } from '@/design/tokens';
import { display, typeStyle, ui } from '@/design/typography';
import creditsData from './credits.json';

interface Props {
  onClose: () => void;
}

interface Credit {
  title: string;
  author: string;
  license: string;
  url: string;
}

function Section({ label, items }: { label: string; items: Credit[] }) {
  return (
    <div>
      <div style={{ ...typeStyle(ui.label), color: color.blue, marginBottom: space.xs }}>
        {label}
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: space.xs }}>
        {items.map((c) => (
          <li key={`${c.title}-${c.author}`} style={{ ...typeStyle(ui.body) }}>
            <strong style={{ color: color.yellow }}>{c.title}</strong>
            {' — '}
            {c.author} <span style={{ opacity: 0.7 }}>({c.license})</span>{' '}
            <a
              href={c.url}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${c.title} (external)`}
              style={{ color: color.blue, ...typeStyle(ui.small) }}
            >
              {c.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CreditsPanel({ onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <Dialog role="dialog" ariaLabel="Credits" testId="credits-panel" tone="info">
      <div style={{ maxWidth: 720, padding: space.xl, display: 'grid', gap: space.lg }}>
        <div style={{ ...typeStyle(display.banner), color: color.yellow }}>CREDITS</div>
        <div style={{ ...typeStyle(ui.body), opacity: 0.85 }}>
          Midway Mayhem is built on top of this open community of creators. All assets are CC-clean
          and license-compatible.
        </div>
        <Section label="ART + MODELS + HDRI" items={creditsData.ART} />
        <Section label="AUDIO" items={creditsData.AUDIO} />
        <Section label="TYPOGRAPHY" items={creditsData.FONTS} />
        <Section label="CODE + LIBRARIES" items={creditsData.CODE} />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <BrandButton
            ref={closeRef}
            kind="primary"
            size="md"
            onClick={onClose}
            testId="credits-close"
          >
            THANKS
          </BrandButton>
        </div>
      </div>
    </Dialog>
  );
}
