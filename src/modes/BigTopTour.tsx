/**
 * BigTopTour — standalone first-person walkaround of the big-top arena.
 *
 * Scene: same HDRI dome, full composed track as a walkable surface, first-person
 * camera 1.7m above the ground. Four proximity-triggered cutscenes (one per zone).
 * Four collectible horn pickups hidden around the arena.
 *
 * Controls:
 *   Desktop: click canvas to lock pointer → WASD + mouselook
 *   Mobile:  two virtual thumb zones (left = move, right = look)
 *
 * Perf: props instanced via InstancedMesh; total draw calls ≤ ~200.
 *
 * Architecture:
 *   All Three.js objects live inside <Canvas>.
 *   All HTML overlays (cutscene text, HUD, joystick) live outside <Canvas>.
 *   Cutscene 3D props (BalloonScene3D, FireScene3D, FunhouseScene3D) are R3F
 *   components mounted inside Canvas alongside their HTML sibling.
 *
 * Sub-modules (extracted to stay under 300 LOC):
 *   tour/TourWalker        — FPS camera controller + ZONE_TRIGGERS
 *   tour/TourStaticTrack   — composed track pieces + preloads
 *   tour/TourMobileJoystick — dual virtual thumb-sticks
 *
 * Arena geometry (tents, poles, spotlights, balloons) intentionally removed —
 * the circus_arena HDRI is the big-top interior, and low-poly props in front
 * of a high-fidelity HDRI looked jarringly out of place.
 */
import { Environment } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { assetUrl } from '@/assets/manifest';
import { initAudioBusSafely } from '@/audio/audioBus';
import { startApplauseBed } from '@/audio/sfx';
import { color, space, zLayer } from '@/design/tokens';
import { display, typeStyle } from '@/design/typography';
import { reportError } from '@/game/errorBus';
import { useWalkControls } from '@/hooks/useWalkControls';
import { ReactErrorBoundary } from '@/hud/ReactErrorBoundary';
import { Collectibles } from '../tour/Collectibles';
import { BalloonScene3D, CutsceneBalloons } from '../tour/CutsceneBalloons';
import { CutsceneFire, FireScene3D } from '../tour/CutsceneFire';
import { CutsceneFunhouse, FunhouseScene3D } from '../tour/CutsceneFunhouse';
import { CutsceneStrip } from '../tour/CutsceneStrip';
import { TourMobileJoystick } from './tour/TourMobileJoystick';
import { TourStaticTrack } from './tour/TourStaticTrack';
import { TourWalker } from './tour/TourWalker';

type CutsceneId = 'midway-strip' | 'balloon-alley' | 'ring-of-fire' | 'funhouse-frenzy' | null;

interface BigTopTourProps {
  onExit: () => void;
}

export function BigTopTour({ onExit }: BigTopTourProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeCutscene, setActiveCutscene] = useState<CutsceneId>(null);
  const [allCollected, setAllCollected] = useState(false);
  const seenCutscenes = useRef(new Set<string>());

  const playerPositionRef = useRef(new THREE.Vector3(0, 1.7, 2));
  const { state: walkState, joystick, requestLock } = useWalkControls();

  const balloonProgressRef = useRef(0);
  const fireProgressRef = useRef(0);
  const funhouseProgressRef = useRef(0);

  const dismissCutscene = useCallback(() => setActiveCutscene(null), []);

  // ESC exits tour (without pointer lock = full exit; with lock = release lock first)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.pointerLockElement) {
          document.exitPointerLock();
        } else {
          onExit();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  // Audio: applause bed at lower volume
  useEffect(() => {
    initAudioBusSafely();
    let stop: (() => void) | null = null;
    const timer = setTimeout(() => {
      try {
        stop = startApplauseBed(-26);
      } catch (err) {
        reportError(err, 'BigTopTour.applauseBed');
      }
    }, 500);
    return () => {
      clearTimeout(timer);
      if (stop) {
        try {
          stop();
        } catch {
          /* cleanup — not fatal */
        }
      }
    };
  }, []);

  const handleCanvasClick = () => {
    const canvas = containerRef.current?.querySelector('canvas');
    if (canvas) requestLock(canvas);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCanvasClick();
    }
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: full-canvas overlay, div w/ role=button is correct
    <div
      ref={containerRef}
      data-testid="bigtop-tour"
      role="button"
      tabIndex={0}
      aria-label="Enter pointer-lock first-person tour"
      style={{ position: 'absolute', inset: 0 }}
      onClick={handleCanvasClick}
      onKeyDown={handleKey}
    >
      <Canvas
        onCreated={({ gl, scene }) => {
          scene.fog = new THREE.FogExp2(0x140820, 0.006);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.1;
        }}
        shadows={false}
        dpr={[1, 2]}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        camera={{ fov: 75, near: 0.1, far: 300, position: [0, 1.7, 2] }}
      >
        <ReactErrorBoundary context="bigtop-tour-canvas">
          <Suspense fallback={null}>
            <Environment
              files={assetUrl('hdri:circus_arena')}
              background={true}
              environmentIntensity={0.6}
              environmentRotation={[0, Math.PI * 0.25, 0]}
            />
            <ambientLight intensity={0.4} color="#ffd6a8" />

            <TourWalker
              walkState={walkState}
              playerPositionRef={playerPositionRef}
              onZoneTrigger={(id) => {
                if (!seenCutscenes.current.has(id) && activeCutscene === null) {
                  seenCutscenes.current.add(id);
                  if (id === 'balloon-alley') balloonProgressRef.current = 0;
                  if (id === 'ring-of-fire') fireProgressRef.current = 0;
                  if (id === 'funhouse-frenzy') funhouseProgressRef.current = 0;
                  setActiveCutscene(id as CutsceneId);
                }
              }}
            />

            <TourStaticTrack />

            <Collectibles
              playerPositionRef={playerPositionRef}
              onAllCollected={() => setAllCollected(true)}
            />

            {activeCutscene === 'balloon-alley' && (
              <BalloonScene3D progressRef={balloonProgressRef} />
            )}
            {activeCutscene === 'ring-of-fire' && <FireScene3D progressRef={fireProgressRef} />}
            {activeCutscene === 'funhouse-frenzy' && (
              <FunhouseScene3D progressRef={funhouseProgressRef} />
            )}
          </Suspense>
        </ReactErrorBoundary>
      </Canvas>

      {/* HTML overlay cutscenes (outside Canvas) */}
      {activeCutscene === 'midway-strip' && <CutsceneStrip onDismiss={dismissCutscene} />}
      {activeCutscene === 'balloon-alley' && <CutsceneBalloons onDismiss={dismissCutscene} />}
      {activeCutscene === 'ring-of-fire' && <CutsceneFire onDismiss={dismissCutscene} />}
      {activeCutscene === 'funhouse-frenzy' && <CutsceneFunhouse onDismiss={dismissCutscene} />}

      <TourMobileJoystick joystick={joystick} />

      {allCollected && (
        <div
          style={{
            position: 'absolute',
            top: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            background: `${color.yellow}ee`,
            color: color.night,
            padding: `${space.sm}px ${space.xl}px`,
            borderRadius: 10,
            ...typeStyle(display.banner),
            zIndex: zLayer.banner,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          RINGMASTER'S HORN UNLOCKED!
        </div>
      )}

      <button
        type="button"
        data-testid="tour-exit-button"
        style={{
          position: 'absolute',
          top: space.base,
          right: space.base,
          padding: `${space.sm}px ${space.lg}px`,
          background: `${color.night}cc`,
          border: `2px solid ${color.yellow}`,
          color: color.yellow,
          borderRadius: 8,
          cursor: 'pointer',
          ...typeStyle(display.button),
          fontSize: '1rem',
          zIndex: zLayer.hud,
        }}
        onClick={onExit}
      >
        EXIT
      </button>

      <div
        style={{
          position: 'absolute',
          bottom: space.base,
          left: '50%',
          transform: 'translateX(-50%)',
          color: `${color.white}88`,
          ...typeStyle(display.tag),
          fontSize: '0.8rem',
          pointerEvents: 'none',
          zIndex: zLayer.hud,
        }}
      >
        Click to look around · WASD to walk · ESC to exit
      </div>
    </div>
  );
}
