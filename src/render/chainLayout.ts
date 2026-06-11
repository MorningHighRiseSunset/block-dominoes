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

const PLAY_MIN_X = -8;
const PLAY_MAX_X = 8;
const PLAY_MIN_Z = -5;
/** Keep the chain off the player rack (+Z is toward the human hand). */
const PLAY_MAX_Z = 2.2;
const MAX_RUN = 8;

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

function turnRight(d: TravelDir): TravelDir {
  const order: TravelDir[] = ['east', 'south', 'west', 'north'];
  return order[(order.indexOf(d) + 1) % 4];
}

function turnLeft(d: TravelDir): TravelDir {
  const order: TravelDir[] = ['east', 'south', 'west', 'north'];
  return order[(order.indexOf(d) + 3) % 4];
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

function wouldFit(x: number, z: number, dir: TravelDir, halfStep: number): boolean {
  const margin = halfStep;
  switch (dir) {
    case 'east':
      return x + margin <= PLAY_MAX_X;
    case 'west':
      return x - margin >= PLAY_MIN_X;
    case 'south':
      return z + margin <= PLAY_MAX_Z;
    case 'north':
      return z - margin >= PLAY_MIN_Z;
  }
}

function pickTurn(from: TravelDir, snakeTurn: SnakeTurn): TravelDir {
  return snakeTurn === 'clockwise' ? turnRight(from) : turnLeft(from);
}

/** Minimum center-to-center distance so tile faces touch along the chain axis. */
function centerDistance(
  fromRot: number,
  _fromDouble: boolean,
  toRot: number,
  _toDouble: boolean,
  dir: TravelDir,
): number {
  // Add small epsilon to prevent overlaps while keeping tiles close
  return halfExtentAlongDir(fromRot, dir) + halfExtentAlongDir(toRot, dir) + 0.02;
}

function tileAabb(placement: ChainTilePlacement): { hw: number; hd: number } {
  const fp = tileFootprint(placement.rotationY);
  return { hw: fp.w * 0.5, hd: fp.d * 0.5 };
}

function overlapsAny(
  x: number,
  z: number,
  rotationY: number,
  existing: ChainTilePlacement[],
): boolean {
  const fp = tileFootprint(rotationY);
  const hw = fp.w * 0.5;
  const hd = fp.d * 0.5;

  for (const p of existing) {
    const o = tileAabb(p);
    if (Math.abs(x - p.x) < hw + o.hw && Math.abs(z - p.z) < hd + o.hd) {
      return true;
    }
  }
  return false;
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
  snakeTurn: SnakeTurn,
  existing: ChainTilePlacement[],
): { x: number; z: number; dir: TravelDir; runLen: number } {
  const dist = centerDistance(fromRot, fromDouble, toRot, toDouble, dir);
  const fwd = stepFrom(x, z, dir, dist);
  const needTurn =
    runLen >= MAX_RUN - 1 ||
    !wouldFit(fwd.x, fwd.z, dir, halfExtentAlongDir(toRot, dir)) ||
    overlapsAny(fwd.x, fwd.z, toRot, existing);

  if (!needTurn) {
    return { x: fwd.x, z: fwd.z, dir, runLen: runLen + 1 };
  }

  const halfWidth = TILE_W * 0.5;
  let tryDir = pickTurn(dir, snakeTurn);
  for (let t = 0; t < 4; t++) {
    let offsetX = 0;
    let offsetZ = 0;

    if (dir === 'north' || dir === 'south') {
      if (tryDir === 'east') offsetX = halfWidth;
      else if (tryDir === 'west') offsetX = -halfWidth;
      else if (tryDir === 'north') offsetZ = -halfWidth;
      else if (tryDir === 'south') offsetZ = halfWidth;
    } else {
      if (tryDir === 'north') offsetZ = -halfWidth;
      else if (tryDir === 'south') offsetZ = halfWidth;
      else if (tryDir === 'east') offsetX = halfWidth;
      else if (tryDir === 'west') offsetX = -halfWidth;
    }

    const tryRot = rotationForTile(tryDir, toDouble);
    const turnDist = centerDistance(fromRot, fromDouble, tryRot, toDouble, tryDir);
    const candidate = stepFrom(x + offsetX, z + offsetZ, tryDir, turnDist);
    if (
      wouldFit(candidate.x, candidate.z, tryDir, halfExtentAlongDir(tryRot, tryDir)) &&
      !overlapsAny(candidate.x, candidate.z, tryRot, existing)
    ) {
      return { x: candidate.x, z: candidate.z, dir: tryDir, runLen: 1 };
    }
    tryDir = pickTurn(tryDir, snakeTurn);
  }

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
  snakeTurn: SnakeTurn = 'clockwise',
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

  if (
    wouldFit(fwd.x, fwd.z, dir, halfExtentAlongDir(newRot, dir)) &&
    !overlapsAny(fwd.x, fwd.z, newRot, placements)
  ) {
    const travelDir = dir;
    return {
      x: fwd.x,
      z: fwd.z,
      rotationY: newRot,
      travelDir,
      isDouble,
    };
  }

  const halfWidth = TILE_W * 0.5;
  let tryDir = pickTurn(dir, snakeTurn);
  for (let t = 0; t < 3; t++) {
    let offsetX = 0;
    let offsetZ = 0;

    if (dir === 'north' || dir === 'south') {
      if (tryDir === 'east') offsetX = halfWidth;
      else if (tryDir === 'west') offsetX = -halfWidth;
      else if (tryDir === 'north') offsetZ = -halfWidth;
      else if (tryDir === 'south') offsetZ = halfWidth;
    } else {
      if (tryDir === 'north') offsetZ = -halfWidth;
      else if (tryDir === 'south') offsetZ = halfWidth;
      else if (tryDir === 'east') offsetX = halfWidth;
      else if (tryDir === 'west') offsetX = -halfWidth;
    }

    const tryRot = rotationForTile(tryDir, isDouble);
    const turnDist = centerDistance(anchorRot, anchor.isDouble, tryRot, isDouble, tryDir);
    const candidate = stepFrom(anchor.x + offsetX, anchor.z + offsetZ, tryDir, turnDist);
    if (
      wouldFit(candidate.x, candidate.z, tryDir, halfExtentAlongDir(tryRot, tryDir)) &&
      !overlapsAny(candidate.x, candidate.z, tryRot, placements)
    ) {
      const travelDir = tryDir;
      return {
        x: candidate.x,
        z: candidate.z,
        rotationY: tryRot,
        travelDir,
        isDouble,
      };
    }
    tryDir = pickTurn(tryDir, snakeTurn);
  }

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
