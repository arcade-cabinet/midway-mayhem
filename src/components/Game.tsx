import { Environment } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { assetUrl } from '../assets/manifest';
import { useSteering } from '../hooks/useSteering';
import { useGameStore } from '../systems/gameState';
import { audioBus } from '../systems/audioBus';
import { Governor } from '../systems/governor/Governor';
import { Cockpit } from './Cockpit';
import { GameLoop } from './GameLoop';
import { HUD } from './HUD';
import { ObstacleSystem } from './ObstacleSystem';
import { PickupSystem } from './PickupSystem';
import { PostFX } from './PostFX';
import { ReactErrorBoundary } from './ReactErrorBoundary';
import { TrackSystem } from './TrackSystem';
import { ZoneBanner } from './ZoneBanner';
import { WorldScroller } from './WorldScroller';

export function Game() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const startRun = useGameStore((s) => s.startRun);

  useEffect(() => {
    startRun();
    // biome-ignore lint/suspicious/noExplicitAny: dev hook
    (window as any).__mmHonk = () => audioBus.playHonk();
  }, [startRun]);

  useSteering(canvasElRef.current);

  return (
    <div ref={wrapperRef} data-testid="mm-game" style={{ position: 'absolute', inset: 0 }}>
      <Canvas
        onCreated={({ gl, scene }) => {
          canvasElRef.current = gl.domElement;
          scene.fog = new THREE.FogExp2(0x140820, 0.008);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.15;
        }}
        shadows={false}
        dpr={[1, 2]}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
      >
        <ReactErrorBoundary context="canvas-root">
          <Suspense fallback={null}>
            {/* Immersive big-top HDRI — the dome surrounding the whole world */}
            <Environment
              files={assetUrl('hdri:circus_arena')}
              background={true}
              environmentIntensity={0.55}
              environmentRotation={[0, Math.PI * 0.25, 0]}
            />
            <ambientLight intensity={0.45} color="#ffd6a8" />

            <GameLoop />

            {/* WORLD — scrolls past the fixed cockpit at origin */}
            <WorldScroller>
              <TrackSystem />
              <ObstacleSystem />
              <PickupSystem />
            </WorldScroller>

            {/* COCKPIT — world-origin, camera inside */}
            <Cockpit />

            <Governor />
            <PostFX />
          </Suspense>
        </ReactErrorBoundary>
      </Canvas>
      <HUD />
      <ZoneBanner />
    </div>
  );
}
