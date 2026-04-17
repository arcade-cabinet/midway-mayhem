import { Environment } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useRef, useState } from 'react';
import * as THREE from 'three';
import { assetUrl } from '@/assets/manifest';
import { Cockpit } from '@/cockpit/Cockpit';
import { ExplosionFX } from '@/cockpit/ExplosionFX';
import { RacingLineGhost } from '@/cockpit/RacingLineGhost';
import { useGameStore } from '@/game/gameState';
import { Governor } from '@/game/governor/Governor';
import { useKeyboardControls } from '@/hooks/useKeyboardControls';
import { useSteering } from '@/hooks/useSteering';
import { useTouchGestures } from '@/hooks/useTouchGestures';
import { HUD } from '@/hud/HUD';
import { LiveRegion } from '@/hud/LiveRegion';
import {
  PhotoModeControls,
  PhotoModeDownloadCapture,
  PhotoModeOverlay,
  triggerDownload,
} from '@/hud/PhotoMode';
import { ReactErrorBoundary } from '@/hud/ReactErrorBoundary';
import { ZoneBanner } from '@/hud/ZoneBanner';
import { BalloonLayer } from '@/obstacles/BalloonLayer';
import { BarkerCrowd } from '@/obstacles/BarkerCrowd';
import { FireHoopGate } from '@/obstacles/FireHoopGate';
import { GhostCar } from '@/obstacles/GhostCar';
import { MirrorLayer } from '@/obstacles/MirrorLayer';
import { ObstacleSystem } from '@/obstacles/ObstacleSystem';
import { PickupSystem } from '@/obstacles/PickupSystem';
import { RaidLayer } from '@/obstacles/RaidLayer';
import { FinishBanner } from '@/track/FinishBanner';
import { StartPlatform } from '@/track/StartPlatform';
import { TrackSystem } from '@/track/TrackSystem';
import { WorldScroller } from '@/track/WorldScroller';
import { GameLoop } from './GameLoop';
import { PostFX } from './PostFX';
import { useGameSystems } from './useGameSystems';

export function Game() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const startRun = useGameStore((s) => s.startRun);
  const photoMode = useGameStore((s) => s.photoMode);

  useGameSystems(startRun);

  useSteering(canvasEl);
  useKeyboardControls();
  useTouchGestures(canvasEl);

  return (
    <div ref={wrapperRef} data-testid="mm-game" style={{ position: 'absolute', inset: 0 }}>
      <Canvas
        onCreated={({ gl, scene }) => {
          setCanvasEl(gl.domElement);
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
              <StartPlatform />
              <FinishBanner />
              <ObstacleSystem />
              <PickupSystem />
              {/* Feature A: Zone gimmick layers */}
              <BalloonLayer />
              <FireHoopGate />
              <MirrorLayer />
              <BarkerCrowd />
              {/* Feature B: Raid entities */}
              <RaidLayer />
              {/* Ghost car replay for daily route */}
              <GhostCar />
              {/* Racing-line ghost: optimal lateral guide ahead of player */}
              <RacingLineGhost />
            </WorldScroller>

            {/* COCKPIT — world-origin, camera inside */}
            <Cockpit />

            {/* Clown explosion on game-over */}
            <ExplosionFX />

            <Governor />
            <PostFX />
            {photoMode && <PhotoModeControls />}
            {photoMode && (
              <PhotoModeDownloadCapture onCapture={(dataUrl) => triggerDownload(dataUrl)} />
            )}
          </Suspense>
        </ReactErrorBoundary>
      </Canvas>
      <HUD />
      <ZoneBanner />
      <LiveRegion />
      {photoMode && <PhotoModeOverlay />}
    </div>
  );
}
