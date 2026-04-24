/**
 * @module ui/ghost/GhostMenu
 *
 * D4 — Watch Ghost replay UI.
 *
 * Shown after game-over. Presents the player's last 5 runs as a list.
 * Selecting one enters replay mode:
 *   - Normal input is DISABLED (the component gates the `enabled` prop on
 *     input bridges via the onEnterReplay / onExitReplay callbacks).
 *   - The recorded steer + lateral trace is fed into the ECS each frame at
 *     the selected playback speed.
 *   - A playback control bar (pause / play / 2x / exit) appears at the bottom.
 *
 * Usage:
 *   <GhostMenu
 *     visible={gameOver}
 *     onEnterReplay={() => setInputDisabled(true)}
 *     onExitReplay={() => setInputDisabled(false)}
 *   />
 *
 * The component calls persistence.getRecentRuns(5) on mount (lazy — only
 * when visible is true for the first time).
 */

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/game/gameState';
import type { ReplayRow, ReplaySample } from '@/persistence/replay';
import { getRecentRuns, saveReplay } from '@/persistence/replay';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GhostMenuProps {
  /** Whether the game-over overlay (and this menu) should be visible. */
  visible: boolean;
  /** Called when the player enters replay mode — the caller should disable inputs. */
  onEnterReplay?: () => void;
  /** Called when the player exits replay mode — the caller should re-enable inputs. */
  onExitReplay?: () => void;
}

type PlaybackSpeed = 1 | 2;

interface PlaybackState {
  replay: ReplayRow;
  playing: boolean;
  speed: PlaybackSpeed;
  /** Current elapsed seconds in the replay playback clock. */
  elapsedS: number;
  /** performance.now() at last tick. */
  lastTick: number;
}

// ─── Interpolation helper (shared with GhostCar) ────────────────────────────

function lerpSample(a: ReplaySample, b: ReplaySample, t: number): ReplaySample {
  const f = (t - a.t) / (b.t - a.t);
  return {
    t,
    lateral: a.lateral + (b.lateral - a.lateral) * f,
    speedMps: a.speedMps + (b.speedMps - a.speedMps) * f,
    steer: a.steer + (b.steer - a.steer) * f,
  };
}

function sampleAtTime(trace: ReplaySample[], t: number): ReplaySample | null {
  if (trace.length === 0) return null;
  const first = trace[0];
  const last = trace[trace.length - 1];
  if (t <= (first?.t ?? 0)) return first ?? null;
  if (t >= (last?.t ?? 0)) return last ?? null;
  let lo = 0;
  let hi = trace.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    const midSample = trace[mid];
    if (midSample && midSample.t <= t) lo = mid;
    else hi = mid;
  }
  const a = trace[lo];
  const b = trace[hi];
  if (!a || !b) return null;
  return lerpSample(a, b, t);
}

// ─── Formatting helpers ──────────────────────────────────────────────────────

function formatDistance(cm: number): string {
  const m = cm / 100;
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(0)} m`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GhostMenu({ visible, onEnterReplay, onExitReplay }: GhostMenuProps) {
  const [runs, setRuns] = useState<ReplayRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [playback, setPlayback] = useState<PlaybackState | null>(null);

  const { setSteer, setLateral, startRun } = useGameStore.getState();
  const rafRef = useRef<number | null>(null);

  // Load recent runs once when visible
  useEffect(() => {
    if (!visible || loaded) return;
    setLoaded(true);
    getRecentRuns(5)
      .then(setRuns)
      .catch((err) => {
        console.error('[GhostMenu] failed to load recent runs', err);
      });
  }, [visible, loaded]);

  // Replay tick loop — runs only while playback is active.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — re-mount only when playback presence changes, not on every state update
  useEffect(() => {
    if (!playback) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const tick = () => {
      setPlayback((prev) => {
        if (!prev?.playing) return prev;

        const now = performance.now();
        const dtS = ((now - prev.lastTick) / 1000) * prev.speed;
        const nextElapsed = prev.elapsedS + dtS;

        const trace = prev.replay.trace;
        const sample = sampleAtTime(trace, nextElapsed);

        if (sample) {
          setSteer(sample.steer);
          setLateral(sample.lateral);
        }

        // Auto-stop at end of trace
        const lastSample = trace[trace.length - 1];
        if (!lastSample || nextElapsed >= lastSample.t) {
          return { ...prev, playing: false, elapsedS: lastSample?.t ?? nextElapsed, lastTick: now };
        }

        return { ...prev, elapsedS: nextElapsed, lastTick: now };
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [playback !== null, setSteer, setLateral]);

  if (!visible) return null;

  // ── Replay mode UI ───────────────────────────────────────────────────────

  if (playback) {
    const trace = playback.replay.trace;
    const lastT = trace[trace.length - 1]?.t ?? 1;
    const progress = Math.min(1, playback.elapsedS / lastT);

    return (
      <div
        data-testid="ghost-menu-replay"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(11, 15, 26, 0.92)',
          backdropFilter: 'blur(8px)',
          padding: '16px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          zIndex: 60,
          fontFamily: '"Helvetica Neue", Arial, sans-serif',
          color: '#fff1db',
        }}
      >
        {/* Progress bar */}
        <div
          style={{
            height: '3px',
            background: 'rgba(255,255,255,0.15)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${(progress * 100).toFixed(1)}%`,
              background: '#ffd600',
              transition: 'width 0.1s linear',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Play / Pause */}
          <button
            type="button"
            data-testid="ghost-replay-playpause"
            onClick={() => {
              setPlayback((prev) =>
                prev ? { ...prev, playing: !prev.playing, lastTick: performance.now() } : null,
              );
            }}
            style={controlBtnStyle}
          >
            {playback.playing ? '⏸' : '▶'}
          </button>

          {/* 2x speed toggle */}
          <button
            type="button"
            data-testid="ghost-replay-speed"
            onClick={() => {
              setPlayback((prev) => (prev ? { ...prev, speed: prev.speed === 1 ? 2 : 1 } : null));
            }}
            style={{
              ...controlBtnStyle,
              background: playback.speed === 2 ? '#ffd600' : 'rgba(255,255,255,0.12)',
              color: playback.speed === 2 ? '#0b0f1a' : '#fff1db',
            }}
          >
            2×
          </button>

          <div style={{ flex: 1, fontSize: '13px', opacity: 0.7 }}>
            {formatDistance(playback.replay.distanceCm)} · {formatDate(playback.replay.createdAt)}
          </div>

          {/* Exit replay */}
          <button
            type="button"
            data-testid="ghost-replay-exit"
            onClick={() => {
              setPlayback(null);
              onExitReplay?.();
            }}
            style={{ ...controlBtnStyle, background: 'rgba(255, 45, 135, 0.2)' }}
          >
            ✕ Exit
          </button>
        </div>
      </div>
    );
  }

  // ── Run list UI ──────────────────────────────────────────────────────────

  return (
    <div
      data-testid="ghost-menu"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(11, 15, 26, 0.95)',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid rgba(255,214,0,0.2)',
        padding: '20px 24px',
        zIndex: 60,
        fontFamily: '"Helvetica Neue", Arial, sans-serif',
        color: '#fff1db',
        maxHeight: '45vh',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          fontSize: 'clamp(14px, 2vw, 18px)',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#ffd600',
          marginBottom: '14px',
        }}
      >
        Watch Ghost
      </div>

      {runs.length === 0 ? (
        <div style={{ opacity: 0.5, fontSize: '14px' }}>
          {loaded ? 'No runs recorded yet.' : 'Loading…'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {runs.map((run) => (
            <button
              key={run.id}
              type="button"
              data-testid={`ghost-run-${run.id}`}
              onClick={() => {
                onEnterReplay?.();
                // Start a fresh run to activate the game engine tick + GhostCar
                startRun({ seed: 42, difficulty: 'plenty', initialThrottle: 0 });

                setPlayback({
                  replay: run,
                  playing: true,
                  speed: 1,
                  elapsedS: 0,
                  lastTick: performance.now(),
                });
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                cursor: 'pointer',
                color: '#fff1db',
                textAlign: 'left',
                fontFamily: 'inherit',
                fontSize: 'clamp(13px, 1.8vw, 16px)',
                transition: 'background 0.15s',
              }}
            >
              <span style={{ fontWeight: 600 }}>{formatDistance(run.distanceCm)}</span>
              <span style={{ opacity: 0.65, fontSize: '12px' }}>{formatDate(run.createdAt)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const controlBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: 'rgba(255,255,255,0.12)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '6px',
  cursor: 'pointer',
  color: '#fff1db',
  fontFamily: 'inherit',
  fontSize: '14px',
  fontWeight: 700,
  letterSpacing: '0.05em',
};

// ─── Re-export saveReplay for browser test use ────────────────────────────────

export { saveReplay };
