/** World-space domino train — tiles touch end-to-end, no grid snapping. */

import { DOMINO_LENGTH } from './boardGrid';

export const STEP = DOMINO_LENGTH;

export type TravelDir = 'east' | 'west' | 'north' | 'south';

export interface ChainTilePlacement {
  x: number;
  z: number;
  rotationY: number;
  travelDir: TravelDir;
}

const PLAY_MIN_X = -5;
const PLAY_MAX_X = 5;
const PLAY_MIN_Z = -2.6;
const PLAY_MAX_Z = 2.6;
const MAX_RUN = 6;

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

function stepFrom(x: number, z: number, dir: TravelDir): { x: number; z: number } {
  switch (dir) {
    case 'east':
      return { x: x + STEP, z };
    case 'west':
      return { x: x - STEP, z };
    case 'south':
      return { x, z: z + STEP };
    case 'north':
      return { x, z: z - STEP };
  }
}

function wouldFit(x: number, z: number, dir: TravelDir): boolean {
  const half = STEP * 0.52;
  switch (dir) {
    case 'east':
      return x + half <= PLAY_MAX_X;
    case 'west':
      return x - half >= PLAY_MIN_X;
    case 'south':
      return z + half <= PLAY_MAX_Z;
    case 'north':
      return z - half >= PLAY_MIN_Z;
  }
}

function nextStep(
  x: number,
  z: number,
  dir: TravelDir,
  runLen: number,
): { x: number; z: number; dir: TravelDir; runLen: number } {
  const fwd = stepFrom(x, z, dir);
  const needTurn = runLen >= MAX_RUN - 1 || !wouldFit(fwd.x, fwd.z, dir);

  if (!needTurn) {
    return { x: fwd.x, z: fwd.z, dir, runLen: runLen + 1 };
  }

  let tryDir = turnRight(dir);
  for (let t = 0; t < 4; t++) {
    const candidate = stepFrom(x, z, tryDir);
    if (wouldFit(candidate.x, candidate.z, tryDir)) {
      return { x: candidate.x, z: candidate.z, dir: tryDir, runLen: 1 };
    }
    tryDir = turnRight(tryDir);
  }

  return { x: fwd.x, z: fwd.z, dir, runLen: runLen + 1 };
}

export function layoutChain(chainLength: number): ChainTilePlacement[] {
  if (chainLength === 0) return [];

  const out: ChainTilePlacement[] = [];
  let x = 0;
  let z = 0;
  let dir: TravelDir = 'east';
  let runLen = 0;

  for (let i = 0; i < chainLength; i++) {
    out.push({ x, z, rotationY: rotationYForDir(dir), travelDir: dir });
    if (i === chainLength - 1) break;
    const next = nextStep(x, z, dir, runLen);
    x = next.x;
    z = next.z;
    dir = next.dir;
    runLen = next.runLen;
  }

  return out;
}

export function extensionSlot(
  placements: ChainTilePlacement[],
  end: 'left' | 'right',
): ChainTilePlacement {
  if (!placements.length) {
    return { x: 0, z: 0, rotationY: rotationYForDir('east'), travelDir: 'east' };
  }

  const anchor = end === 'left' ? placements[0] : placements[placements.length - 1];
  const dir = end === 'left' ? oppositeDir(anchor.travelDir) : anchor.travelDir;
  const fwd = stepFrom(anchor.x, anchor.z, dir);

  if (wouldFit(fwd.x, fwd.z, dir)) {
    return { x: fwd.x, z: fwd.z, rotationY: rotationYForDir(dir), travelDir: dir };
  }

  // When turning, need to account for domino width to ensure touching
  let tryDir = turnRight(dir);
  for (let t = 0; t < 3; t++) {
    const candidate = stepFrom(anchor.x, anchor.z, tryDir);
    if (wouldFit(candidate.x, candidate.z, tryDir)) {
      return { x: candidate.x, z: candidate.z, rotationY: rotationYForDir(tryDir), travelDir: tryDir };
    }
    tryDir = turnRight(tryDir);
  }

  return { x: fwd.x, z: fwd.z, rotationY: rotationYForDir(dir), travelDir: dir };
}
