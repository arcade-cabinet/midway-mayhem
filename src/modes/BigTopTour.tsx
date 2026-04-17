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
 */
import { Environment, useGLTF } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { assetUrl } from '@/assets/manifest';
import { ReactErrorBoundary } from '@/hud/ReactErrorBoundary';
import { color, space, zLayer } from '@/design/tokens';
import { display, typeStyle } from '@/design/typography';
import { composeTrack, DEFAULT_TRACK, type PiecePlacement } from '@/track/trackComposer';
import { useWalkControls } from '@/hooks/useWalkControls';
import { startApplauseBed } from '@/audio/sfx';
import { initAudioBusSafely } from '@/audio/audioBus';
import { reportError } from '@/game/errorBus';
import { Collectibles } from '../tour/Collectibles';
import { BalloonScene3D, CutsceneBalloons } from '../tour/CutsceneBalloons';
import { CutsceneFire, FireScene3D } from '../tour/CutsceneFire';
import { CutsceneFunhouse, FunhouseScene3D } from '../tour/CutsceneFunhouse';
import { CutsceneStrip } from '../tour/CutsceneStrip';

// Zone trigger positions (world Z along the composed track — tuned to midpoints)
const ZONE_TRIGGERS: ReadonlyArray<{
  id: 'midway-strip' | 'balloon-alley' | 'ring-of-fire' | 'funhouse-frenzy';
  position: THREE.Vector3;
  radius: number;
}> = [
  { id: 'midway-strip', position: new THREE.Vector3(0, 1.7, -20), radius: 6 },
  { id: 'balloon-alley', position: new THREE.Vector3(-4, 1.7, -50), radius: 6 },
  { id: 'ring-of-fire', position: new THREE.Vector3(4, 1.7, -75), radius: 6 },
  { id: 'funhouse-frenzy', position: new THREE.Vector3(-4, 1.7, -100), radius: 6 },
];

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

  // Shared progress refs for 3D scene objects (driven by HTML rAF timers)
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
        try { stop(); } catch { /* cleanup — not fatal */ }
      }
    };
  }, []);

  const handleCanvasClick = () => {
    const canvas = containerRef.current?.querySelector('canvas');
    if (canvas) requestLock(canvas);
  };

  return (
    <div
      ref={containerRef}
      data-testid="bigtop-tour"
      style={{ position: 'absolute', inset: 0 }}
      onClick={handleCanvasClick}
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

            {/* First-person walker — drives camera, proximity checks */}
            <Walker
              walkState={walkState}
              playerPositionRef={playerPositionRef}
              onZoneTrigger={(id) => {
                if (!seenCutscenes.current.has(id) && activeCutscene === null) {
                  seenCutscenes.current.add(id);
                  // Reset progress ref for this cutscene
                  if (id === 'balloon-alley') balloonProgressRef.current = 0;
                  if (id === 'ring-of-fire') fireProgressRef.current = 0;
                  if (id === 'funhouse-frenzy') funhouseProgressRef.current = 0;
                  setActiveCutscene(id as CutsceneId);
                }
              }}
            />

            {/* Static track as walkable surface */}
            <StaticTrack />

            {/* Arena props (instanced) */}
            <ArenaProps />

            {/* Collectible horn pickups */}
            <Collectibles
              playerPositionRef={playerPositionRef}
              onAllCollected={() => setAllCollected(true)}
            />

            {/* Cutscene 3D props — only the Three.js parts */}
            {activeCutscene === 'balloon-alley' && (
              <BalloonScene3D progressRef={balloonProgressRef} />
            )}
            {activeCutscene === 'ring-of-fire' && (
              <FireScene3D progressRef={fireProgressRef} />
            )}
            {activeCutscene === 'funhouse-frenzy' && (
              <FunhouseScene3D progressRef={funhouseProgressRef} />
            )}
          </Suspense>
        </ReactErrorBoundary>
      </Canvas>

      {/* HTML overlay cutscenes (outside Canvas — can render divs + buttons) */}
      {activeCutscene === 'midway-strip' && (
        <CutsceneStrip onDismiss={dismissCutscene} />
      )}
      {activeCutscene === 'balloon-alley' && (
        <CutsceneBalloons onDismiss={dismissCutscene} />
      )}
      {activeCutscene === 'ring-of-fire' && (
        <CutsceneFire onDismiss={dismissCutscene} />
      )}
      {activeCutscene === 'funhouse-frenzy' && (
        <CutsceneFunhouse onDismiss={dismissCutscene} />
      )}

      {/* Mobile virtual joystick */}
      <MobileJoystick joystick={joystick} />

      {/* All 4 collected — Ringmaster's Horn toast */}
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

      {/* Exit button — always visible */}
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

      {/* Click-to-lock hint */}
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

// ─── Walker: first-person camera controller ────────────────────────────────

interface WalkerProps {
  walkState: React.MutableRefObject<{
    forward: number;
    right: number;
    lookYaw: number;
    lookPitch: number;
  }>;
  playerPositionRef: React.MutableRefObject<THREE.Vector3>;
  onZoneTrigger: (id: string) => void;
}

const WALK_SPEED = 6.0; // m/s
const _fwd = new THREE.Vector3();
const _rgt = new THREE.Vector3();

function Walker({ walkState, playerPositionRef, onZoneTrigger }: WalkerProps) {
  const { camera } = useThree();

  useFrame((_, dt) => {
    const s = walkState.current;

    // Apply look (YXZ order prevents gimbal lock for FPS camera)
    camera.rotation.order = 'YXZ';
    camera.rotation.y = s.lookYaw;
    camera.rotation.x = s.lookPitch;

    // Movement in yaw-plane (ignore pitch for forward direction)
    const yaw = s.lookYaw;
    _fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    _rgt.set(Math.cos(yaw), 0, -Math.sin(yaw));

    const step = WALK_SPEED * dt;
    camera.position.addScaledVector(_fwd, s.forward * step);
    camera.position.addScaledVector(_rgt, s.right * step);
    camera.position.y = 1.7; // fixed eye height

    // Update shared position ref for proximity checks
    playerPositionRef.current.copy(camera.position);

    // Zone proximity checks
    for (const trigger of ZONE_TRIGGERS) {
      if (camera.position.distanceTo(trigger.position) < trigger.radius) {
        onZoneTrigger(trigger.id);
      }
    }
  });

  return null;
}

// ─── StaticTrack ────────────────────────────────────────────────────────────

function StaticTrack() {
  const composition = composeTrack(DEFAULT_TRACK, 10);
  return (
    <group name="tour-track">
      {composition.placements.map((p) => (
        <TourTrackPiece key={p.index} placement={p} />
      ))}
    </group>
  );
}

function TourTrackPiece({ placement }: { placement: PiecePlacement }) {
  const gltf = useGLTF(assetUrl(`gltf:${placement.assetId}`)) as unknown as {
    scene: THREE.Object3D;
  };
  const cloned = gltf.scene.clone(true);
  return (
    <group position={placement.position} rotation={[0, placement.rotationY, 0]} scale={10}>
      <primitive object={cloned} />
    </group>
  );
}

// Preload all track pieces for the tour
const TOUR_PIECES = [
  'gltf:roadStart',
  'gltf:roadStraight',
  'gltf:roadStraightLong',
  'gltf:roadStraightArrow',
  'gltf:roadEnd',
  'gltf:roadCornerLarge',
  'gltf:roadCornerLarger',
  'gltf:roadCornerSmall',
  'gltf:roadRamp',
  'gltf:roadRampLong',
  'gltf:roadRampLongCurved',
  'gltf:roadCurved',
];
for (const id of TOUR_PIECES) {
  useGLTF.preload(assetUrl(id));
}

// ─── ArenaProps — instanced props ────────────────────────────────────────────

const TENT_POSITIONS: Array<[number, number, number]> = [];
const BALLOON_POSITIONS: Array<[number, number, number]> = [];
const POLE_POSITIONS: Array<[number, number, number]> = [];

for (let i = 0; i < 24; i++) {
  const z = -5 - i * 9;
  const side = i % 2 === 0 ? 1 : -1;
  TENT_POSITIONS.push([side * 14, 0, z]);
  POLE_POSITIONS.push([side * 18, 0, z - 3]);
}
for (let i = 0; i < 32; i++) {
  const z = -8 - i * 6;
  const side = i % 3 === 0 ? 1 : i % 3 === 1 ? -1 : 0;
  BALLOON_POSITIONS.push([side * 10 + (i % 2 === 0 ? 2 : -2), 3 + (i % 4), z]);
}

const _tentGeo = new THREE.ConeGeometry(2.5, 5, 8);
const _poleGeo = new THREE.CylinderGeometry(0.18, 0.22, 14, 8);
const _balloonGeo = new THREE.SphereGeometry(0.5, 8, 6);
const _spotlightGeo = new THREE.CylinderGeometry(0.0, 1.2, 6, 12, 1, true);

const _tentMat = new THREE.MeshStandardMaterial({ color: 0xe53935, roughness: 0.7 });
const _poleMat = new THREE.MeshStandardMaterial({ color: 0xffd600, metalness: 0.6, roughness: 0.3 });
const _balloonColorList = [0xe53935, 0xffd600, 0x1e88e5, 0x8e24aa, 0xf36f21];
const _spotlightMat = new THREE.MeshBasicMaterial({
  color: 0xffffcc,
  transparent: true,
  opacity: 0.08,
  side: THREE.BackSide,
});

function ArenaProps() {
  const tentRef = useRef<THREE.InstancedMesh>(null);
  const poleRef = useRef<THREE.InstancedMesh>(null);
  const spotRef = useRef<THREE.InstancedMesh>(null);
  const d = useRef(new THREE.Object3D()).current;

  useEffect(() => {
    if (tentRef.current) {
      TENT_POSITIONS.forEach(([x, y, z], i) => {
        d.position.set(x, y + 2.5, z);
        d.rotation.set(0, (i * 0.7) % (Math.PI * 2), 0);
        d.scale.set(1, 1, 1);
        d.updateMatrix();
        tentRef.current!.setMatrixAt(i, d.matrix);
      });
      tentRef.current.instanceMatrix.needsUpdate = true;
    }
    if (poleRef.current) {
      POLE_POSITIONS.forEach(([x, y, z], i) => {
        d.position.set(x, y + 7, z);
        d.rotation.set(0, 0, 0);
        d.scale.set(1, 1, 1);
        d.updateMatrix();
        poleRef.current!.setMatrixAt(i, d.matrix);
      });
      poleRef.current.instanceMatrix.needsUpdate = true;
    }
    if (spotRef.current) {
      POLE_POSITIONS.forEach(([x, , z], i) => {
        d.position.set(x * 0.6, 18, z);
        d.rotation.set(0, 0, Math.PI);
        d.scale.set(1, 1, 1);
        d.updateMatrix();
        spotRef.current!.setMatrixAt(i, d.matrix);
      });
      spotRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [d]);

  return (
    <>
      <instancedMesh ref={tentRef} args={[_tentGeo, _tentMat, TENT_POSITIONS.length]} />
      <instancedMesh ref={poleRef} args={[_poleGeo, _poleMat, POLE_POSITIONS.length]} />
      <instancedMesh ref={spotRef} args={[_spotlightGeo, _spotlightMat, POLE_POSITIONS.length]} />
      {_balloonColorList.map((c, ci) => (
        <BalloonCluster key={ci} colorHex={c} slotIndex={ci} />
      ))}
    </>
  );
}

function BalloonCluster({ colorHex, slotIndex }: { colorHex: number; slotIndex: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const mat = useRef(
    new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.35, roughness: 0.2 }),
  );
  const d = useRef(new THREE.Object3D()).current;
  const mine = BALLOON_POSITIONS.filter((_, i) => i % 5 === slotIndex);

  useEffect(() => {
    if (!meshRef.current || mine.length === 0) return;
    mine.forEach(([x, y, z], i) => {
      d.position.set(x, y, z);
      d.rotation.set(0, 0, 0);
      d.scale.set(1, 1, 1);
      d.updateMatrix();
      meshRef.current!.setMatrixAt(i, d.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [mine, d]);

  if (mine.length === 0) return null;
  return (
    <instancedMesh ref={meshRef} args={[_balloonGeo, mat.current, mine.length]} />
  );
}

// ─── Mobile virtual joystick (HTML, outside Canvas) ───────────────────────

interface MobileJoystickProps {
  joystick: ReturnType<typeof useWalkControls>['joystick'];
}

function MobileJoystick({ joystick }: MobileJoystickProps) {
  const leftOrigin = useRef({ x: 0, y: 0 });
  const rightOrigin = useRef({ x: 0, y: 0 });
  const [leftThumb, setLeftThumb] = useState({ x: 0, y: 0 });
  const [rightThumb, setRightThumb] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(
      typeof window !== 'undefined' &&
        ('ontouchstart' in window || navigator.maxTouchPoints > 0),
    );
  }, []);

  if (!visible) return null;

  const STICK_RADIUS = 36;

  const handleTouchStart = (side: 'left' | 'right', e: React.TouchEvent) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    if (!t) return;
    if (side === 'left') leftOrigin.current = { x: t.clientX, y: t.clientY };
    else rightOrigin.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchMove = (side: 'left' | 'right', e: React.TouchEvent) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    if (!t) return;
    const origin = side === 'left' ? leftOrigin.current : rightOrigin.current;
    const dx = Math.max(-1, Math.min(1, (t.clientX - origin.x) / 60));
    const dy = Math.max(-1, Math.min(1, (t.clientY - origin.y) / 60));
    if (side === 'left') {
      setLeftThumb({ x: dx, y: dy });
      joystick.setMoveStick(dx, dy);
    } else {
      setRightThumb({ x: dx, y: dy });
      joystick.setLookStick(dx, dy);
    }
  };

  const handleTouchEnd = (side: 'left' | 'right') => {
    if (side === 'left') {
      setLeftThumb({ x: 0, y: 0 });
      joystick.setMoveStick(0, 0);
    } else {
      setRightThumb({ x: 0, y: 0 });
      joystick.setLookStick(0, 0);
    }
  };

  const Stick = ({ side, thumb }: { side: 'left' | 'right'; thumb: { x: number; y: number } }) => (
    <div
      data-testid={`joystick-${side}`}
      onTouchStart={(e) => handleTouchStart(side, e)}
      onTouchMove={(e) => handleTouchMove(side, e)}
      onTouchEnd={() => handleTouchEnd(side)}
      onTouchCancel={() => handleTouchEnd(side)}
      style={{
        position: 'absolute',
        bottom: 24,
        [side === 'left' ? 'left' : 'right']: 16,
        width: 110,
        height: 110,
        borderRadius: '50%',
        background: `${color.night}99`,
        border: `2px solid ${color.yellow}66`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: STICK_RADIUS * 2,
          height: STICK_RADIUS * 2,
          borderRadius: '50%',
          background: `${color.yellow}88`,
          transform: `translate(${thumb.x * 28}px, ${thumb.y * 28}px)`,
          pointerEvents: 'none',
        }}
      />
    </div>
  );

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: zLayer.hud,
      }}
    >
      <Stick side="left" thumb={leftThumb} />
      <Stick side="right" thumb={rightThumb} />
    </div>
  );
}
