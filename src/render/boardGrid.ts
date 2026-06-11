import * as THREE from 'three';

/** Domino length along the chain axis (world units). */
export const DOMINO_LENGTH = 1.0;
/** Domino width (short edge). */
export const TILE_W = 0.6;

export const WOOD_COLOR = 0x6b4423;
export const FELT_COLOR = 0x4a1520;
export const FELT_LIGHT = 0xd4c4a8;
export const FELT_DARK = 0x8b7355;

export const FELT_CSS = '#4a1520';
export const WOOD_CSS = '#6b4423';
export const BOARD_BG_CSS = '#2a1810';

/** One checker rectangle = one domino footprint (width × length). */
export const CHECKER_CELL_W = TILE_W;
export const CHECKER_CELL_L = DOMINO_LENGTH;

function makeCheckerTexture(): THREE.CanvasTexture {
  const cellPxW = 60;
  const cellPxL = Math.round(cellPxW * (DOMINO_LENGTH / TILE_W));
  const cols = 4;
  const rows = 4;
  const canvas = document.createElement('canvas');
  canvas.width = cols * cellPxW;
  canvas.height = rows * cellPxL;
  const ctx = canvas.getContext('2d')!;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const light = (row + col) % 2 === 0;
      ctx.fillStyle = light ? '#d4c4a8' : '#8b7355';
      ctx.fillRect(col * cellPxW, row * cellPxL, cellPxW, cellPxL);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Felt play surface — checker rectangles match domino footprint. */
export function buildPlaySurface(
  width: number,
  depth: number,
  surfaceY: number,
): THREE.Group {
  const group = new THREE.Group();
  const checker = makeCheckerTexture();
  checker.repeat.set(width / CHECKER_CELL_W, depth / CHECKER_CELL_L);

  const felt = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.03, depth),
    new THREE.MeshStandardMaterial({
      map: checker,
      roughness: 0.88,
      metalness: 0.02,
    }),
  );
  felt.position.y = surfaceY;
  felt.receiveShadow = true;
  group.add(felt);
  return group;
}
