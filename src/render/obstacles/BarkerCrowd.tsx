/**
 * BarkerCrowd — Feature A (Midway Strip zone gimmick).
 *
 * NPC crowd figures lining the sides of the midway at regular d-intervals.
 * Honking within 12m ahead of a barker = crowd bonus + barker wave animation.
 *
 * Each figure: box body + sphere head + two thin box legs, colored from
 * brand palette. Wave: right arm rotates up over 0.6s on honk.
 */

import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { onHonk } from '@/audio/honkBus';
import { sampleTrackPoseOrNull } from '@/ecs/systems/trackSampler';
import { useSampledTrack } from '@/ecs/systems/useSampledTrack';
import { combo } from '@/game/comboSystem';
import { useGameStore } from '@/game/gameState';
import { TRACK } from '@/utils/constants';

const BARKER_INTERVAL = 25; // meters between barkers
const HONK_RADIUS_M = 12;
const BARKER_CROWD_BONUS = 15;
const CHEER_DURATION_S = 1.2;
const COOLDOWN_S = 3;

const BARKER_COLORS = [
  0xe53935, // red
  0xffd600, // yellow
  0x1e88e5, // blue
  0x8e24aa, // purple
  0xf36f21, // orange
] as const;

interface Barker {
  d: number;
  side: -1 | 1; // left or right of track
  colorIndex: number;
  cheerStartedAt: number; // ms, 0 = not cheering
  lastHonkAt: number; // ms, for cooldown
}

function buildBarkers(): Barker[] {
  const barkers: Barker[] = [];
  // Spawn barkers for first two zone cycles
  for (let d = 10; d < 900; d += BARKER_INTERVAL) {
    barkers.push({
      d,
      side: d % (BARKER_INTERVAL * 2) < BARKER_INTERVAL ? -1 : 1,
      colorIndex: Math.floor(d / BARKER_INTERVAL) % BARKER_COLORS.length,
      cheerStartedAt: 0,
      lastHonkAt: 0,
    });
  }
  return barkers;
}

// Shared geometry
const BODY_GEO = new THREE.BoxGeometry(0.5, 0.8, 0.3);
const HEAD_GEO = new THREE.SphereGeometry(0.22, 8, 6);
const ARM_GEO = new THREE.BoxGeometry(0.12, 0.5, 0.12);
const LEG_GEO = new THREE.BoxGeometry(0.14, 0.55, 0.14);

interface BarkerSlot {
  group: THREE.Group;
  body: THREE.Mesh;
  head: THREE.Mesh;
  armRight: THREE.Group; // pivoting arm group
  legL: THREE.Mesh;
  legR: THREE.Mesh;
}

export function BarkerCrowd() {
  const barkers = useRef<Barker[]>(buildBarkers());
  const groupRef = useRef<THREE.Group>(null);
  const slots = useRef<BarkerSlot[]>([]);
  const sampled = useSampledTrack();

  // Build pool
  useFrame(() => {
    const g = groupRef.current;
    if (!g || slots.current.length > 0) return;
    for (let i = 0; i < barkers.current.length; i++) {
      const colorHex = BARKER_COLORS[i % BARKER_COLORS.length] ?? 0xe53935;
      const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.7 });
      const skinMat = new THREE.MeshStandardMaterial({ color: 0xf5cba7, roughness: 0.9 });

      const group = new THREE.Group();
      group.position.set(0, -9999, 0);

      const body = new THREE.Mesh(BODY_GEO, mat);
      body.position.set(0, 0, 0);
      group.add(body);

      const head = new THREE.Mesh(HEAD_GEO, skinMat);
      head.position.set(0, 0.62, 0);
      group.add(head);

      // Right arm (pivoting for wave)
      const armGroup = new THREE.Group();
      armGroup.position.set(0.31, 0.2, 0); // shoulder offset
      const armMesh = new THREE.Mesh(ARM_GEO, mat);
      armMesh.position.set(0, -0.25, 0); // pivot at top
      armGroup.add(armMesh);
      group.add(armGroup);

      const legL = new THREE.Mesh(LEG_GEO, mat);
      legL.position.set(-0.15, -0.67, 0);
      group.add(legL);

      const legR = new THREE.Mesh(LEG_GEO, mat);
      legR.position.set(0.15, -0.67, 0);
      group.add(legR);

      g.add(group);
      slots.current.push({ group, body, head, armRight: armGroup, legL, legR });
    }
  });

  // Wire honk bus
  useEffect(() => {
    return onHonk(() => {
      const s = useGameStore.getState();
      if (!s.running || s.currentZone !== 'midway-strip') return;
      const now = performance.now();
      for (const b of barkers.current) {
        const ahead = b.d - s.distance;
        if (ahead < 0 || ahead > HONK_RADIUS_M) continue;
        if (now - b.lastHonkAt < COOLDOWN_S * 1000) continue;
        b.cheerStartedAt = now;
        b.lastHonkAt = now;
        // Register a combo event so consecutive barker-honks within the
        // chain-expiry window (5s) accumulate to climb through the
        // multiplier tiers (PRQ B4).
        combo.registerEvent('scare');
        const mult = combo.getMultiplier();
        useGameStore.setState({
          crowdReaction: useGameStore.getState().crowdReaction + BARKER_CROWD_BONUS * mult,
        });
      }
    });
  }, []);

  useFrame(() => {
    const s = useGameStore.getState();
    if (!s.running || s.currentZone !== 'midway-strip') {
      for (const sl of slots.current) {
        sl.group.position.set(0, -9999, 0);
      }
      return;
    }

    const now = performance.now();
    const sideOffset = TRACK.HALF_WIDTH + 1.5;

    for (let i = 0; i < barkers.current.length; i++) {
      const b = barkers.current[i];
      const sl = slots.current[i];
      if (!b || !sl) continue;

      const distAhead = b.d - s.distance;
      if (distAhead < -20 || distAhead > 200) {
        sl.group.position.set(0, -9999, 0);
        continue;
      }

      const lat = b.side * sideOffset;
      if (sampled.length === 0) continue;
      const p = sampleTrackPoseOrNull(sampled, b.d);
      if (!p) {
        sl.group.position.set(0, -9999, 0);
        continue;
      }
      // Apply lateral offset along the track's perpendicular (right-hand).
      const rightX = Math.cos(p.yaw);
      const rightZ = -Math.sin(p.yaw);
      const worldX = p.x + rightX * lat;
      const worldZ = p.z + rightZ * lat;
      sl.group.position.set(worldX, p.y + 0.6, worldZ);
      // Face toward the track center
      sl.group.rotation.set(0, p.yaw + (b.side > 0 ? Math.PI : 0), 0);

      // Wave animation
      const elapsedSec = b.cheerStartedAt > 0 ? (now - b.cheerStartedAt) / 1000 : 0;
      if (b.cheerStartedAt > 0 && elapsedSec < CHEER_DURATION_S) {
        const t = elapsedSec / CHEER_DURATION_S;
        // Arm swings up then back down
        const waveAngle = Math.sin(t * Math.PI) * (-Math.PI / 2);
        sl.armRight.rotation.z = waveAngle;
      } else {
        sl.armRight.rotation.z = 0;
      }
    }

    if (import.meta.env.DEV) {
      // biome-ignore lint/suspicious/noExplicitAny: diagnostics
      (window as any).__mmDiag_barkers = barkers.current.filter(
        (b) => b.d > s.distance - 20 && b.d < s.distance + 200,
      ).length;
    }
  });

  return <group ref={groupRef} data-testid="barker-crowd" />;
}
