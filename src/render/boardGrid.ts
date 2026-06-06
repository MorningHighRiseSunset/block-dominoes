/** Chess-board grid: one domino spans two cells. */

import * as THREE from 'three';

export const CELL = 0.8;
export const DOMINO_SPAN = 2;
/** Chain step & domino length — tiles touch end-to-end. */
export const DOMINO_LENGTH = CELL * DOMINO_SPAN;
export const STEP = DOMINO_LENGTH;

export const GRID_COLS = 14;
export const GRID_ROWS = 7;

export const CHESS_LIGHT = 0x7a9eb8;
export const CHESS_DARK = 0x4d6d85;
export const WOOD_COLOR = 0x9a7048;

export const CHESS_LIGHT_CSS = '#7a9eb8';
export const CHESS_DARK_CSS = '#4d6d85';
export const WOOD_CSS = '#9a7048';
export const BOARD_BG_CSS = '#1a2433';

export function gridOrigin(cols = GRID_COLS, rows = GRID_ROWS, cell = CELL): { startX: number; startZ: number } {
  const startX = -((cols * cell) / 2) + cell / 2;
  const startZ = -((rows * cell) / 2) + cell / 2;
  return { startX, startZ };
}

export function cellCenter(col: number, row: number, cell = CELL, cols = GRID_COLS, rows = GRID_ROWS): { x: number; z: number } {
  const { startX, startZ } = gridOrigin(cols, rows, cell);
  return { x: startX + col * cell, z: startZ + row * cell };
}

export function worldToCell(x: number, z: number, cell = CELL, cols = GRID_COLS, rows = GRID_ROWS): { col: number; row: number } | null {
  const { startX, startZ } = gridOrigin(cols, rows, cell);
  const col = Math.round((x - startX) / cell);
  const row = Math.round((z - startZ) / cell);
  if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
  return { col, row };
}

export function dominoSlotCenter(
  col: number,
  row: number,
  axis: 'x' | 'z',
  cell = CELL,
  cols = GRID_COLS,
  rows = GRID_ROWS,
): { x: number; z: number } {
  const { startX, startZ } = gridOrigin(cols, rows, cell);
  if (axis === 'x') {
    return { x: startX + (col + 1) * cell, z: startZ + row * cell };
  }
  return { x: startX + col * cell, z: startZ + (row + 1) * cell };
}

export function cellsForSlot(
  col: number,
  row: number,
  axis: 'x' | 'z',
): { col: number; row: number }[] {
  if (axis === 'x') {
    return [
      { col, row },
      { col: col + 1, row },
    ];
  }
  return [
    { col, row },
    { col, row: row + 1 },
  ];
}

export function openingSlot(): { x: number; z: number; rotationY: number; cells: { col: number; row: number }[] } {
  const col = Math.floor(GRID_COLS / 2) - 1;
  const row = Math.floor(GRID_ROWS / 2);
  const center = dominoSlotCenter(col, row, 'x');
  return {
    ...center,
    rotationY: Math.PI / 2,
    cells: cellsForSlot(col, row, 'x'),
  };
}

/** Shared chess-board mesh group for game & lobby. */
export function buildChessBoard(
  cols: number,
  rows: number,
  cell: number,
  surfaceY: number,
  squareHeight = 0.04,
): THREE.Group {
  const group = new THREE.Group();
  const { startX, startZ } = gridOrigin(cols, rows, cell);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const isLight = (row + col) % 2 === 0;
      const square = new THREE.Mesh(
        new THREE.BoxGeometry(cell, squareHeight, cell),
        new THREE.MeshStandardMaterial({
          color: isLight ? CHESS_LIGHT : CHESS_DARK,
          roughness: 0.88,
        }),
      );
      square.position.set(startX + col * cell, surfaceY, startZ + row * cell);
      square.receiveShadow = true;
      square.userData = { col, row };
      group.add(square);
    }
  }
  return group;
}
