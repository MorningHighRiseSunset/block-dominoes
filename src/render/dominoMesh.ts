import * as THREE from 'three';
import type { Pip, Player } from '../game/blockDominoes';
import { DOMINO_LENGTH } from './boardGrid';
import { dominoMaterials } from './materials';

export const TILE_W = 0.48;
export const TILE_H = 0.08;
/** Long edge — exactly two chess cells. */
export const TILE_D = DOMINO_LENGTH;

const FACE_TEX_CACHE = new Map<string, THREE.CanvasTexture>();

export const DOMINO_MAT = {
  human: dominoMaterials.face,
  cpu: dominoMaterials.face.clone(),
  back: dominoMaterials.back,
  pip: dominoMaterials.pip,
  groove: dominoMaterials.divider,
  highlight: new THREE.MeshBasicMaterial({
    color: 0x2dd4bf,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  }),
  slotHint: new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  }),
  endMarker: new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  }),
  placementHighlight: new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  }),
};

DOMINO_MAT.cpu.color.setHex(0xe8e0d4);

export function createDominoBack(_player: Player): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(TILE_W, TILE_H, TILE_D),
    DOMINO_MAT.back,
  );
  body.castShadow = true;
  g.add(body);
  return g;
}

export function createDominoMesh(
  leftPip: Pip,
  rightPip: Pip,
  player: Player,
  forHand: boolean,
  options?: { highlight?: boolean; outline?: boolean },
): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = player === 0 ? DOMINO_MAT.human : DOMINO_MAT.cpu;

  const body = new THREE.Mesh(new THREE.BoxGeometry(TILE_W, TILE_H, TILE_D), bodyMat);
  body.castShadow = forHand;
  body.receiveShadow = !forHand;
  g.add(body);

  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(TILE_W * 0.96, TILE_D * 0.96),
    new THREE.MeshBasicMaterial({
      map: getFaceTexture(leftPip, rightPip),
      transparent: false,
    }),
  );
  face.name = 'face';
  face.rotation.x = -Math.PI / 2;
  face.position.y = TILE_H * 0.5 + 0.002;
  face.renderOrder = 1;
  g.add(face);

  if (options?.outline !== false) {
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(TILE_W * 1.02, TILE_H * 1.12, TILE_D * 1.02)),
      new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9 }),
    );
    edges.position.y = TILE_H * 0.02;
    edges.visible = false;
    g.add(edges);
    g.userData.outline = edges;
  }

  if (options?.highlight !== false) {
    const hi = new THREE.Mesh(
      new THREE.BoxGeometry(TILE_W * 1.06, TILE_H * 0.35, TILE_D * 1.06),
      DOMINO_MAT.highlight,
    );
    hi.position.y = TILE_H * 0.52;
    hi.name = 'highlight';
    hi.visible = false;
    g.add(hi);
  }

  return g;
}

export function updateDominoFace(g: THREE.Group, leftPip: Pip, rightPip: Pip) {
  const face = g.getObjectByName('face') as THREE.Mesh | undefined;
  if (!face) return;
  const mat = face.material as THREE.MeshBasicMaterial;
  const old = mat.map;
  mat.map = getFaceTexture(leftPip, rightPip);
  if (old && old !== mat.map) old.dispose();
}

function getFaceTexture(left: Pip, right: Pip): THREE.CanvasTexture {
  const key = `${left}:${right}`;
  const cached = FACE_TEX_CACHE.get(key);
  if (cached) return cached;

  const w = 96;
  const h = 320;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f4ece0';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#b5a898';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(4, h / 2);
  ctx.lineTo(w - 4, h / 2);
  ctx.stroke();

  drawPipHalf(ctx, left, 0, 0, w, h / 2);
  drawPipHalf(ctx, right, 0, h / 2, w, h / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  FACE_TEX_CACHE.set(key, tex);
  return tex;
}

function drawPipHalf(
  ctx: CanvasRenderingContext2D,
  count: Pip,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const positions = pipLayout(count);
  const r = Math.min(w, h) * 0.09;

  for (const [ox, oy] of positions) {
    const px = x + w * (0.5 + ox * 0.34);
    const py = y + h * (0.5 + oy * 0.34);
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = '#141820';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px - r * 0.15, py - r * 0.15, r * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fill();
  }
}

function pipLayout(n: number): [number, number][] {
  const layouts: Record<number, [number, number][]> = {
    0: [],
    1: [[0, 0]],
    2: [[-0.38, -0.38], [0.38, 0.38]],
    3: [[-0.38, -0.38], [0, 0], [0.38, 0.38]],
    4: [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]],
    5: [[-0.38, -0.38], [0.38, -0.38], [0, 0], [-0.38, 0.38], [0.38, 0.38]],
    6: [
      [-0.38, -0.38],
      [0.38, -0.38],
      [-0.38, 0],
      [0.38, 0],
      [-0.38, 0.38],
      [0.38, 0.38],
    ],
  };
  return layouts[n] ?? [];
}

export function disposeGroup(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
      child.geometry.dispose();
      if (child instanceof THREE.Mesh) {
        const mat = child.material;
        if (mat instanceof THREE.Material && 'map' in mat && mat.map) {
          /* shared cached textures — do not dispose */
        } else if (Array.isArray(mat)) {
          mat.forEach((m) => m.dispose());
        } else {
          mat.dispose();
        }
      }
    }
  });
}
