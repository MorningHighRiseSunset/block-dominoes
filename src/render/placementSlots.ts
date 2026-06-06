import type { BlockDominoesState, BlockMove } from '../game/blockDominoes';
import {
  cellsForPlacement,
  extensionSlot,
  layoutChain,
  type ChainTilePlacement,
} from './chainLayout';
import { openingSlot } from './boardGrid';

export interface PlacementSlot {
  move: BlockMove;
  x: number;
  z: number;
  rotationY: number;
  cells: { col: number; row: number }[];
  placement: ChainTilePlacement;
}

export function buildPlacementSlots(
  state: BlockDominoesState,
  legal: BlockMove[],
  handIndex: number | null,
): PlacementSlot[] {
  const filtered = handIndex === null ? legal : legal.filter((m) => m.handIndex === handIndex);
  if (!filtered.length) return [];

  if (state.chain.length === 0) {
    const open = openingSlot();
    const placement: ChainTilePlacement = {
      x: open.x,
      z: open.z,
      rotationY: open.rotationY,
      travelDir: 'east',
      col: Math.floor(open.cells[0].col),
      row: open.cells[0].row,
      axis: 'x',
    };
    return filtered.map((move) => ({
      move,
      x: open.x,
      z: open.z,
      rotationY: open.rotationY,
      cells: open.cells,
      placement,
    }));
  }

  const placements = layoutChain(state.chain.length);
  const slots: PlacementSlot[] = [];

  for (const move of filtered) {
    const ext = extensionSlot(placements, move.end);
    if (!ext) continue;
    slots.push({
      move,
      x: ext.x,
      z: ext.z,
      rotationY: ext.rotationY,
      cells: cellsForPlacement(ext),
      placement: ext,
    });
  }

  return slots;
}

export function findSlotAt(
  slots: PlacementSlot[],
  x: number,
  z: number,
  handIndex: number,
  maxDist = 0.85,
): PlacementSlot | null {
  let best: PlacementSlot | null = null;
  let bestD = maxDist;
  for (const slot of slots) {
    if (slot.move.handIndex !== handIndex) continue;
    const d = Math.hypot(slot.x - x, slot.z - z);
    if (d < bestD) {
      bestD = d;
      best = slot;
    }
  }
  return best;
}
