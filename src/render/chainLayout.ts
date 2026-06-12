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

/** Default growth heads to the right (east) for horizontal chain. */
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

export function rotationForTile(_travelDir: TravelDir, isDouble: boolean, isFirst: boolean): number {
  // First domino is always vertical (rotation 0 from player's perspective)
  if (isFirst) {
    return 0;
  }
  // Subsequent dominoes: horizontal unless double
  if (isDouble) {
    return 0; // Vertical for doubles
  }
  // Horizontal for non-doubles (rotation PI/2)
  return Math.PI / 2;
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
  toRot: number,
  _toDouble: boolean,
  snakeTurn: SnakeTurn,
  _existing: ChainTilePlacement[],
): { x: number; z: number; dir: TravelDir; runLen: number } {
  const dist = centerDistance(fromRot, toRot, dir);
  let fwd = stepFrom(x, z, dir, dist);
  let newDir = dir;

  // Check if the next position would be out of bounds
  if (isOutOfBounds(fwd.x, fwd.z)) {
    // Turn based on snakeTurn setting
    newDir = snakeTurn === 'clockwise' ? turnClockwise(dir) : turnCounterclockwise(dir);
    // Recalculate position with new direction
    fwd = stepFrom(x, z, newDir, dist);
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
    const nextRot = rotationForTile(dir, next.isDouble, false);
    const step = nextStep(
      x,
      z,
      dir,
      runLen,
      rotationY,
      tile.isDouble,
      nextRot,
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
  
  // For right placement: extend in the same direction as the anchor's travel
  // For left placement: always extend in the opposite direction of INITIAL_TRAVEL_DIR (west)
  // This ensures consistent left-side growth regardless of the anchor's travelDir
  let dir = end === 'left' ? oppositeDir(INITIAL_TRAVEL_DIR) : anchor.travelDir;
  
  const anchorRot = rotationForTile(anchor.travelDir, anchor.isDouble, false);
  const newRot = rotationForTile(dir, isDouble, false);
  const dist = centerDistance(anchorRot, newRot, dir);
  let fwd = stepFrom(anchor.x, anchor.z, dir, dist);

  // Check if the next position would be out of bounds and turn if needed
  if (isOutOfBounds(fwd.x, fwd.z)) {
    dir = snakeTurn === 'clockwise' ? turnClockwise(dir) : turnCounterclockwise(dir);
    fwd = stepFrom(anchor.x, anchor.z, dir, dist);
  }

  // The travel direction for the new tile should be the direction it extends
  const travelDir = dir;
  return {
    x: fwd.x,
    z: fwd.z,
    rotationY: newRot,
    travelDir,
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
