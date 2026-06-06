/** Grid-snapped domino train — each tile occupies exactly two chess cells. */

import {
  cellsForSlot,
  dominoSlotCenter,
  GRID_COLS,
  GRID_ROWS,
} from './boardGrid';

export type TravelDir = 'east' | 'west' | 'north' | 'south';
export type SlotAxis = 'x' | 'z';

export interface ChainTilePlacement {
  x: number;
  z: number;
  rotationY: number;
  travelDir: TravelDir;
  col: number;
  row: number;
  axis: SlotAxis;
}

const MAX_RUN = 5;

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

function inBounds(col: number, row: number, axis: SlotAxis): boolean {
  if (col < 0 || row < 0) return false;
  if (axis === 'x') return col + 1 < GRID_COLS && row < GRID_ROWS;
  return col < GRID_COLS && row + 1 < GRID_ROWS;
}

function stepAlong(col: number, row: number, dir: TravelDir): { col: number; row: number } {
  switch (dir) {
    case 'east':
      return { col: col + 2, row };
    case 'west':
      return { col: col - 2, row };
    case 'south':
      return { col, row: row + 2 };
    case 'north':
      return { col, row: row - 2 };
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

/** Corner step when the train turns right on the grid. */
function turnSlot(
  col: number,
  row: number,
  _axis: SlotAxis,
  fromDir: TravelDir,
): { col: number; row: number; axis: SlotAxis; dir: TravelDir } {
  const dir = turnRight(fromDir);
  if (fromDir === 'east') return { col: col + 1, row: row + 1, axis: 'z', dir };
  if (fromDir === 'south') return { col: col - 1, row: row + 1, axis: 'x', dir };
  if (fromDir === 'west') return { col: col - 1, row: row - 1, axis: 'z', dir };
  return { col: col + 1, row: row - 1, axis: 'x', dir };
}

function toPlacement(
  col: number,
  row: number,
  axis: SlotAxis,
  travelDir: TravelDir,
): ChainTilePlacement {
  const { x, z } = dominoSlotCenter(col, row, axis);
  return { x, z, rotationY: rotationYForDir(travelDir), travelDir, col, row, axis };
}

export function layoutChain(chainLength: number): ChainTilePlacement[] {
  if (chainLength === 0) return [];

  const startCol = Math.floor(GRID_COLS / 2) - 1;
  const startRow = Math.floor(GRID_ROWS / 2);

  const out: ChainTilePlacement[] = [];
  let col = startCol;
  let row = startRow;
  let axis: SlotAxis = 'x';
  let dir: TravelDir = 'east';
  let runLen = 0;

  for (let i = 0; i < chainLength; i++) {
    out.push(toPlacement(col, row, axis, dir));
    if (i === chainLength - 1) break;

    const fwd = stepAlong(col, row, dir);
    const needTurn = runLen >= MAX_RUN - 1 || !inBounds(fwd.col, fwd.row, axis);

    if (needTurn) {
      const t = turnSlot(col, row, axis, dir);
      col = t.col;
      row = t.row;
      axis = t.axis;
      dir = t.dir;
      runLen = 1;
    } else {
      col = fwd.col;
      row = fwd.row;
      runLen++;
    }
  }

  return out;
}

export function extensionSlot(
  placements: ChainTilePlacement[],
  end: 'left' | 'right',
): ChainTilePlacement | null {
  if (!placements.length) return null;

  const anchor = end === 'left' ? placements[0] : placements[placements.length - 1];
  const dir = end === 'left' ? oppositeDir(anchor.travelDir) : anchor.travelDir;
  const next = stepAlong(anchor.col, anchor.row, dir);

  if (!inBounds(next.col, next.row, anchor.axis)) {
    const turned = turnSlot(anchor.col, anchor.row, anchor.axis, end === 'left' ? oppositeDir(anchor.travelDir) : anchor.travelDir);
    if (!inBounds(turned.col, turned.row, turned.axis)) return null;
    return toPlacement(turned.col, turned.row, turned.axis, turned.dir);
  }

  return toPlacement(next.col, next.row, anchor.axis, dir);
}

export function cellsForPlacement(p: ChainTilePlacement): { col: number; row: number }[] {
  return cellsForSlot(p.col, p.row, p.axis);
}

/** @deprecated Use extensionSlot for grid-aligned ends. */
export function endMarkerOffset(
  placements: ChainTilePlacement[],
  end: 'left' | 'right',
): { x: number; z: number } {
  const slot = extensionSlot(placements, end);
  return slot ? { x: slot.x, z: slot.z } : { x: 0, z: 0 };
}
