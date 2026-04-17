import * as THREE from 'three';
import { assetUrl } from '@/assets/manifest';

/**
 * PBR material factory — modeled on marmalade-drops/src/game/pbrMaterials.ts.
 * Materials load via TextureLoader on first call; textures are paid-for once
 * via the asset preloader (HEAD probe), so these loader calls will succeed.
 */

const loader = new THREE.TextureLoader();

function loadRepeated(id: string, repeatX = 1, repeatY = 1): THREE.Texture {
  const tex = loader.load(assetUrl(id));
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  return tex;
}

function loadSrgb(id: string, repeatX = 1, repeatY = 1): THREE.Texture {
  const tex = loadRepeated(id, repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Hot Wheels track — plastic with orange tint layered on top */
export function createTrackMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: loadSrgb('tex:track_color', 2, 8),
    normalMap: loadRepeated('tex:track_normal', 2, 8),
    roughnessMap: loadRepeated('tex:track_rough', 2, 8),
    color: new THREE.Color('#F36F21'), // Track Orange tint
    roughness: 0.55,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
}

/** Mirror-finish chrome — cockpit trim, steering wheel spokes */
export function createChromeMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: loadSrgb('tex:chrome_color'),
    normalMap: loadRepeated('tex:chrome_normal'),
    roughnessMap: loadRepeated('tex:chrome_rough'),
    metalnessMap: loadRepeated('tex:chrome_metal'),
    roughness: 0.1,
    metalness: 1.0,
  });
}

/** Clown-car hood base — painted metal that the procedural polka-dot layer sits atop */
export function createHoodPBRMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: loadSrgb('tex:hood_color'),
    normalMap: loadRepeated('tex:hood_normal'),
    roughnessMap: loadRepeated('tex:hood_rough'),
    color: new THREE.Color('#ff3e3e'),
    roughness: 0.45,
    metalness: 0.25,
  });
}
