import * as THREE from 'three';

/** Domino length along the chain axis (world units). */
export const DOMINO_LENGTH = 1.3;

export const WOOD_COLOR = 0x9a7048;
export const FELT_COLOR = 0x2a4a68;

export const FELT_CSS = '#2a4a68';
export const WOOD_CSS = '#9a7048';
export const BOARD_BG_CSS = '#1a2433';

/** Flat blue felt play surface — no checkerboard grid. */
export function buildPlaySurface(
  width: number,
  depth: number,
  surfaceY: number,
): THREE.Group {
  const group = new THREE.Group();
  const felt = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.03, depth),
    new THREE.MeshStandardMaterial({ color: FELT_COLOR, roughness: 0.9, metalness: 0.02 }),
  );
  felt.position.y = surfaceY;
  felt.receiveShadow = true;
  group.add(felt);
  return group;
}
