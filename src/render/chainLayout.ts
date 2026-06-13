/** World-space domino train — grid-aligned, tiles touch with no overlap. */

import { DOMINO_LENGTH } from './boardGrid';
import { TILE_W } from './dominoMesh';
import type { PlayedTile, SnakeTurn, TravelDir } from '../game/blockDominoes';

export const STEP = DOMINO_LENGTH;

/** Board dimensions (must match buildPlaySurface call in blockDominoScene.ts) */
const BOARD_WIDTH = 17.2;
const BOARD_DEPTH = 10.4;
/** Margin from board edge to keep tiles visible */
const BOARD_MARGIN = 0.5;

export type { TravelDir, SnakeTurn };

export interface ChainTilePlacement {
  x: number;
  z: number;
  rotationY: number;
  travelDir: TravelDir;
  isDouble: boolean;
}

/** Default growth heads rightward (east) for the opening vertical tile. */
export const INITIAL_TRAVEL_DIR: TravelDir = 'east';

function oppositeDir(d: TravelDir): TravelDir {
  switch (d) {
    case 'east':
      return 'west';
    case 'west':
      return 'east';
    case 'south':
      return 'north';
    case 'north':
      return 'south';
  }
}

function turnClockwise(dir: TravelDir): TravelDir {
  switch (dir) {
    case 'east':
      return 'south';
    case 'south':
      return 'west';
    case 'west':
      return 'north';
    case 'north':
      return 'east';
  }
}

function turnCounterclockwise(dir: TravelDir): TravelDir {
  switch (dir) {
    case 'east':
      return 'north';
    case 'north':
      return 'west';
    case 'west':
      return 'south';
    case 'south':
      return 'east';
  }
}

function isOutOfBounds(x: number, z: number): boolean {
  return (
    x < -BOARD_WIDTH / 2 + BOARD_MARGIN ||
    x > BOARD_WIDTH / 2 - BOARD_MARGIN ||
    z < -BOARD_DEPTH / 2 + BOARD_MARGIN ||
    z > BOARD_DEPTH / 2 - BOARD_MARGIN
  );
}

function stepFrom(x: number, z: number, dir: TravelDir, dist: number): { x: number; z: number } {
  switch (dir) {
    case 'east':
      return { x: x + dist, z };
    case 'west':
      return { x: x - dist, z };
    case 'south':
      return { x, z: z + dist };
    case 'north':
      return { x, z: z - dist };
  }
}

function axisForDir(dir: TravelDir): 'x' | 'z' {
  return dir === 'east' || dir === 'west' ? 'x' : 'z';
}

export function halfExtentOnAxis(rotationY: number, axis: 'x' | 'z'): number {
  const hx = TILE_W * 0.5;
  const hz = DOMINO_LENGTH * 0.5;
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  const extX = Math.abs(hx * cos + hz * sin);
  const extZ = Math.abs(-hx * sin + hz * cos);
  return axis === 'x' ? extX : extZ;
}

export function halfExtentAlongDir(rotationY: number, dir: TravelDir): number {
  return halfExtentOnAxis(rotationY, axisForDir(dir));
}

export function rotationForTile(travelDir: TravelDir, isDouble: boolean, _isFirst: boolean): number {
  if (isDouble) {
    return 0; // Doubles remain vertical regardless of travel direction
  }
  return travelDir === 'east' || travelDir === 'west' ? Math.PI / 2 : 0;
}

/** Minimum center-to-center distance so tile faces touch along the chain axis. */
function centerDistance(
  fromRot: number,
  toRot: number,
  dir: TravelDir,
): number {
  // No epsilon - tiles should touch exactly without overlap
  return halfExtentAlongDir(fromRot, dir) + halfExtentAlongDir(toRot, dir);
}

function nextStep(
  x: number,
  z: number,
  dir: TravelDir,
  runLen: number,
  fromRot: number,
  _fromDouble: boolean,
  toIsDouble: boolean,
  snakeTurn: SnakeTurn,
  _existing: ChainTilePlacement[],
): { x: number; z: number; dir: TravelDir; runLen: number } {
  const distanceAlong = (travelDir: TravelDir) => {
    const toRot = rotationForTile(travelDir, toIsDouble, false);
    return centerDistance(fromRot, toRot, travelDir);
  };

  const dist = distanceAlong(dir);
  let fwd = stepFrom(x, z, dir, dist);
  let newDir = dir;

  // Check if the next position would be out of bounds
  if (isOutOfBounds(fwd.x, fwd.z)) {
    // Turn based on snakeTurn setting
    newDir = snakeTurn === 'clockwise' ? turnClockwise(dir) : turnCounterclockwise(dir);
    // Recalculate position with new direction
    const turnedDist = distanceAlong(newDir);
    fwd = stepFrom(x, z, newDir, turnedDist);
  }

  return { x: fwd.x, z: fwd.z, dir: newDir, runLen: runLen + 1 };
}

/** Use stored positions when available so tiles never jump after a left-end play. */
export function layoutChain(
  chain: PlayedTile[],
  snakeTurn: SnakeTurn = 'clockwise',
): ChainTilePlacement[] {
  if (chain.length > 0 && chain.every((t) => t.layout)) {
    return chain.map((tile) => ({
      x: tile.layout!.x,
      z: tile.layout!.z,
      rotationY: tile.layout!.rotationY,
      travelDir: tile.layout!.travelDir,
      isDouble: tile.isDouble,
    }));
  }

  return layoutChainAuto(chain, snakeTurn);
}

export function layoutChainAuto(
  chain: PlayedTile[],
  snakeTurn: SnakeTurn,
): ChainTilePlacement[] {
  if (chain.length === 0) return [];

  const out: ChainTilePlacement[] = [];
  let x = 0;
  let z = 0;
  let dir: TravelDir = INITIAL_TRAVEL_DIR;
  let runLen = 0;

  for (let i = 0; i < chain.length; i++) {
    const tile = chain[i];
    const isFirst = i === 0;
    const rotationY = rotationForTile(dir, tile.isDouble, isFirst);
    out.push({ x, z, rotationY, travelDir: dir, isDouble: tile.isDouble });
    if (i === chain.length - 1) break;

    const next = chain[i + 1];
    const step = nextStep(
      x,
      z,
      dir,
      runLen,
      rotationY,
      tile.isDouble,
      next.isDouble,
      snakeTurn,
      out,
    );
    x = step.x;
    z = step.z;
    dir = step.dir;
    runLen = step.runLen;
  }

  return out;
}

export function extensionSlot(
  placements: ChainTilePlacement[],
  end: 'left' | 'right',
  isDouble: boolean,
  snakeTurn: SnakeTurn = 'clockwise',
): ChainTilePlacement {
  if (!placements.length) {
    const travelDir = INITIAL_TRAVEL_DIR;
    return {
      x: 0,
      z: 0,
      rotationY: rotationForTile(travelDir, isDouble, true),
      travelDir,
      isDouble,
    };
  }

  const anchor = end === 'left' ? placements[0] : placements[placements.length - 1];

  // Try multiple candidate directions to avoid placing a new tile overlapping
  // any existing placements. This makes placement robust when the chain has
  // turned and tiles exist on all four sides.
  const preferred = end === 'left' ? oppositeDir(anchor.travelDir) : anchor.travelDir;
  let candidates: TravelDir[];

  // Special case: if this is the first extension (anchor is the opening tile at origin),
  // only allow horizontal placement left/right from the starter tile.
  if (placements.length === 1 && placements[0].x === 0 && placements[0].z === 0) {
    candidates = [preferred, oppositeDir(preferred)];
  } else {
    candidates = [preferred, turnClockwise(preferred), turnCounterclockwise(preferred), oppositeDir(preferred)];
  }

  // Helper: compute axis-aligned bbox for a tile centered at (x,z)
  function bboxFor(x: number, z: number, rot: number) {
    const hx = halfExtentOnAxis(rot, 'x');
    const hz = halfExtentOnAxis(rot, 'z');
    return { minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz };
  }

  // Helper: check intersection between two bboxes
  function intersects(a: ReturnType<typeof bboxFor>, b: ReturnType<typeof bboxFor>) {
    return !(a.maxX <= b.minX || a.minX >= b.maxX || a.maxZ <= b.minZ || a.minZ >= b.maxZ);
  }

  // Precompute existing bboxes to test collisions
  const existing = placements.map((p) => bboxFor(p.x, p.z, p.rotationY));

  for (let cand of candidates) {
    let dir = cand;
    const anchorRot = anchor.rotationY;
    let newRot = rotationForTile(dir, isDouble, false);
    let dist = centerDistance(anchorRot, newRot, dir);
    let fwd = stepFrom(anchor.x, anchor.z, dir, dist);

    // If out of bounds, try turning according to snakeTurn for this candidate
    if (isOutOfBounds(fwd.x, fwd.z)) {
      dir = snakeTurn === 'clockwise' ? turnClockwise(dir) : turnCounterclockwise(dir);
      newRot = rotationForTile(dir, isDouble, false);
      dist = centerDistance(anchorRot, newRot, dir);
      fwd = stepFrom(anchor.x, anchor.z, dir, dist);
    }

    const candidateBox = bboxFor(fwd.x, fwd.z, newRot);
    let collision = false;
    for (const ex of existing) {
      if (intersects(candidateBox, ex)) {
        collision = true;
        break;
      }
    }
    if (!collision) {
      return {
        x: fwd.x,
        z: fwd.z,
        rotationY: newRot,
        travelDir: end === 'right' ? dir : oppositeDir(dir),
        isDouble,
      };
    }
  }

  // Fallback: use preferred direction even if collision detected
  const fallbackDir = preferred;
  let fallbackRot = rotationForTile(fallbackDir, isDouble, false);
  let fallbackDist = centerDistance(anchor.rotationY, fallbackRot, fallbackDir);
  let fallbackFwd = stepFrom(anchor.x, anchor.z, fallbackDir, fallbackDist);
  if (isOutOfBounds(fallbackFwd.x, fallbackFwd.z)) {
    const turned = snakeTurn === 'clockwise' ? turnClockwise(fallbackDir) : turnCounterclockwise(fallbackDir);
    fallbackRot = rotationForTile(turned, isDouble, false);
    fallbackDist = centerDistance(anchor.rotationY, fallbackRot, turned);
    fallbackFwd = stepFrom(anchor.x, anchor.z, turned, fallbackDist);
    return {
      x: fallbackFwd.x,
      z: fallbackFwd.z,
      rotationY: fallbackRot,
      travelDir: end === 'right' ? turned : oppositeDir(turned),
      isDouble,
    };
  }
  return {
    x: fallbackFwd.x,
    z: fallbackFwd.z,
    rotationY: fallbackRot,
    travelDir: end === 'right' ? fallbackDir : oppositeDir(fallbackDir),
    isDouble,
  };
}

/** Footprint width (X) and depth (Z) for a highlight/box from rotationY. */
export function tileFootprint(rotationY: number): { w: number; d: number } {
  const alongX = Math.abs(Math.sin(rotationY)) > 0.5;
  return alongX
    ? { w: DOMINO_LENGTH, d: TILE_W }
    : { w: TILE_W, d: DOMINO_LENGTH };
}
