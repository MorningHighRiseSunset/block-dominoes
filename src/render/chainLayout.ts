/** World-space domino train — grid-aligned, tiles touch with no overlap. */

import { DOMINO_LENGTH } from './boardGrid';
import { TILE_W } from './dominoMesh';
import type { PlayedTile, SnakeTurn, TravelDir } from '../game/blockDominoes';

export const STEP = DOMINO_LENGTH;

export type { TravelDir, SnakeTurn };

export interface ChainTilePlacement {
  x: number;
  z: number;
  rotationY: number;
  travelDir: TravelDir;
  isDouble: boolean;
}

/** Default growth heads away from the player hand (+Z). */
export const INITIAL_TRAVEL_DIR: TravelDir = 'north';

function rotationYForDir(d: TravelDir): number {
  switch (d) {
    case 'east':
      return Math.PI / 2;
    case 'west':
      return -Math.PI / 2;
    case 'south':
      return 0;
    case 'north':
      return Math.PI;
  }
}

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

export function rotationForTile(travelDir: TravelDir, isDouble: boolean): number {
  let rotationY = rotationYForDir(travelDir);
  if (isDouble) rotationY += Math.PI / 2;
  return rotationY;
}

/** Minimum center-to-center distance so tile faces touch along the chain axis. */
function centerDistance(
  fromRot: number,
  _fromDouble: boolean,
  toRot: number,
  _toDouble: boolean,
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
  fromDouble: boolean,
  toRot: number,
  toDouble: boolean,
  _snakeTurn: SnakeTurn,
  _existing: ChainTilePlacement[],
): { x: number; z: number; dir: TravelDir; runLen: number } {
  // Truly linear layout - never turn, always extend in the same direction
  const dist = centerDistance(fromRot, fromDouble, toRot, toDouble, dir);
  const fwd = stepFrom(x, z, dir, dist);
  return { x: fwd.x, z: fwd.z, dir, runLen: runLen + 1 };
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
    const rotationY = rotationForTile(dir, tile.isDouble);
    out.push({ x, z, rotationY, travelDir: dir, isDouble: tile.isDouble });
    if (i === chain.length - 1) break;

    const next = chain[i + 1];
    const nextRot = rotationForTile(dir, next.isDouble);
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
  _snakeTurn: SnakeTurn = 'clockwise',
): ChainTilePlacement {
  if (!placements.length) {
    const travelDir = INITIAL_TRAVEL_DIR;
    return {
      x: 0,
      z: 0,
      rotationY: rotationForTile(travelDir, isDouble),
      travelDir,
      isDouble,
    };
  }

  const anchor = end === 'left' ? placements[0] : placements[placements.length - 1];
  const dir = end === 'left' ? oppositeDir(anchor.travelDir) : anchor.travelDir;
  const anchorRot = rotationForTile(anchor.travelDir, anchor.isDouble);
  const newRot = rotationForTile(dir, isDouble);
  const dist = centerDistance(anchorRot, anchor.isDouble, newRot, isDouble, dir);
  const fwd = stepFrom(anchor.x, anchor.z, dir, dist);

  // Truly linear layout - always place in the forward direction
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
