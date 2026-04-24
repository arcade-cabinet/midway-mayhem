/**
 * First-launch player name onboarding.
 *
 * Mounts on the title screen when PREF_KEYS.PLAYER_NAME is missing.
 * Collects a display name (1-20 chars, trimmed), stores it in
 * preferences, then unmounts. Used by the scoreboard to label runs.
 */
import { useEffect, useRef, useState } from 'react';
import { PREF_KEYS, prefGetString, prefSetString } from '@/persistence/preferences';

const MIN_LENGTH = 1;
const MAX_LENGTH = 20;

export function NameOnboardingModal({ onComplete }: { onComplete: (name: string) => void }) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // E2e hatch: ?nonameonboard=1 disables the first-launch overlay so
    // nightly specs that navigate on a fresh browser context (no OPFS
    // prefs yet) can reach the title UI without having to script past a
    // full-screen modal on every spec. Production UX is unchanged.
    // useEffect only runs in the browser, so `window` is always defined here.
    const params = new URLSearchParams(window.location.search);
    if (params.get('nonameonboard') === '1' || params.get('autoplay') === '1') {
      return;
    }
    let cancelled = false;
    (async () => {
      const existing = await prefGetString(PREF_KEYS.PLAYER_NAME);
      if (!cancelled && !existing) setVisible(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (visible) {
      // Focus the input after mount (replaces the blocked autoFocus prop).
      const id = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [visible]);

  if (!visible) return null;

  async function submit() {
    const trimmed = value.trim();
    if (trimmed.length < MIN_LENGTH) {
      setError('Name required');
      return;
    }
    if (trimmed.length > MAX_LENGTH) {
      setError(`Too long — max ${MAX_LENGTH} chars`);
      return;
    }
    await prefSetString(PREF_KEYS.PLAYER_NAME, trimmed);
    setVisible(false);
    onComplete(trimmed);
  }

  return (
    <div
      data-testid="name-onboarding"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11, 15, 26, 0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        padding: '24px',
      }}
    >
      <div
        style={{
          background: '#0b0f1a',
          border: '3px solid #ffd600',
          borderRadius: 14,
          padding: 'clamp(20px, 3vw, 36px)',
          maxWidth: 'min(92vw, 480px)',
          color: '#fff1db',
          fontFamily: '"Helvetica Neue", Arial, sans-serif',
          textAlign: 'center',
          boxShadow: '0 12px 60px rgba(255, 214, 0, 0.35)',
        }}
      >
        <div
          style={{
            fontSize: 'clamp(28px, 4vw, 42px)',
            fontWeight: 900,
            color: '#ffd600',
            letterSpacing: '0.04em',
            marginBottom: 12,
            lineHeight: 1,
          }}
        >
          WHO'S DRIVING?
        </div>
        <div
          style={{
            fontSize: 'clamp(13px, 1.4vw, 15px)',
            color: '#c0c0c8',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 20,
          }}
        >
          Enter a name for the scoreboard
        </div>
        <input
          ref={inputRef}
          type="text"
          data-testid="name-onboarding-input"
          value={value}
          onChange={(e) => {
            setError(null);
            setValue(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
          maxLength={MAX_LENGTH + 4}
          placeholder="Clown McHonkface"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '14px 16px',
            fontSize: 'clamp(18px, 2vw, 24px)',
            fontWeight: 700,
            background: '#1a2034',
            border: '2px solid #3a4462',
            borderRadius: 8,
            color: '#fff1db',
            outline: 'none',
            marginBottom: 12,
            letterSpacing: '0.02em',
            textAlign: 'center',
          }}
        />
        {error !== null && (
          <div
            style={{
              color: '#ff2d87',
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 14,
              letterSpacing: '0.05em',
            }}
          >
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={() => void submit()}
          data-testid="name-onboarding-submit"
          style={{
            padding: '12px 36px',
            fontSize: 'clamp(16px, 1.8vw, 22px)',
            fontWeight: 900,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#0b0f1a',
            background: '#ffd600',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(255, 214, 0, 0.35), 0 0 0 3px #ff2d87 inset',
          }}
        >
          Drive
        </button>
      </div>
    </div>
  );
}
