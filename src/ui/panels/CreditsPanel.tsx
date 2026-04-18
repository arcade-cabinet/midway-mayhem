import { useEffect, useRef } from 'react';
import { BrandButton } from '@/design/components/BrandButton';
import { Dialog } from '@/design/components/Dialog';
import { color, space } from '@/design/tokens';
import { display, typeStyle, ui } from '@/design/typography';

interface Props {
  onClose: () => void;
}

interface Credit {
  title: string;
  author: string;
  license: string;
  url: string;
}

const ART: Credit[] = [
  {
    title: 'Racing Kit',
    author: 'Kenney',
    license: 'CC0 1.0',
    url: 'https://kenney.nl/assets/racing-kit',
  },
  {
    title: 'Ultimate Animated Farm Animals',
    author: 'Quaternius',
    license: 'CC0 1.0',
    url: 'https://quaternius.com/packs/ultimateanimatedfarmanimals.html',
  },
  {
    title: 'circus_arena HDRI',
    author: 'Poly Haven',
    license: 'CC0 1.0',
    url: 'https://polyhaven.com/a/circus_arena',
  },
];

const AUDIO: Credit[] = [
  {
    title: 'GeneralUser GS 1.472',
    author: 'S. Christian Collins',
    license: 'GUGS license',
    url: 'https://schristiancollins.com/generaluser.php',
  },
  {
    title: 'Sonatina Symphonic Orchestra',
    author: 'M. Stillman',
    license: 'CC Sampling Plus',
    url: 'https://sso.mattiaswestlund.net/',
  },
];

const CODE: Credit[] = [
  {
    title: 'React Three Fiber + drei',
    author: 'Poimandres',
    license: 'MIT',
    url: 'https://github.com/pmndrs/react-three-fiber',
  },
  {
    title: 'Tone.js',
    author: 'Yotam Mann et al.',
    license: 'MIT',
    url: 'https://tonejs.github.io/',
  },
  {
    title: 'spessasynth_lib',
    author: 'spessasus',
    license: 'Apache-2.0',
    url: 'https://github.com/spessasus/spessasynth_lib',
  },
  { title: 'Yuka.js', author: 'Mugen87', license: 'MIT', url: 'https://mugen87.github.io/yuka/' },
  {
    title: 'drizzle-orm + Capacitor SQLite',
    author: 'drizzle-team + jeep',
    license: 'Apache-2.0 / MIT',
    url: 'https://orm.drizzle.team/',
  },
  {
    title: 'koota',
    author: 'Poimandres',
    license: 'MIT',
    url: 'https://github.com/pmndrs/koota',
  },
];

const FONTS: Credit[] = [
  {
    title: 'Bangers',
    author: 'Vernon Adams',
    license: 'SIL OFL 1.1',
    url: 'https://fonts.google.com/specimen/Bangers',
  },
  {
    title: 'Rajdhani',
    author: 'Indian Type Foundry',
    license: 'SIL OFL 1.1',
    url: 'https://fonts.google.com/specimen/Rajdhani',
  },
];

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
              style={{ color: color.blue, ...typeStyle(ui.small) }}
            >
              link
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
        <Section label="ART + MODELS + HDRI" items={ART} />
        <Section label="AUDIO" items={AUDIO} />
        <Section label="TYPOGRAPHY" items={FONTS} />
        <Section label="CODE + LIBRARIES" items={CODE} />
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
