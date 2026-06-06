import type { BlockDominoesState, BlockMove } from '../game/blockDominoes';
import {
  extensionSlot,
  layoutChain,
  type ChainTilePlacement,
} from './chainLayout';

export interface PlacementSlot {
  move: BlockMove;
  x: number;
  z: number;
  rotationY: number;
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
    const placement: ChainTilePlacement = {
      x: 0,
      z: 0,
      rotationY: Math.PI / 2,
      travelDir: 'east',
    };
    return filtered.map((move) => ({
      move,
      x: placement.x,
      z: placement.z,
      rotationY: placement.rotationY,
      placement,
    }));
  }

  const placements = layoutChain(state.chain.length);
  const slots: PlacementSlot[] = [];

  for (const move of filtered) {
    const ext = extensionSlot(placements, move.end);
    slots.push({
      move,
      x: ext.x,
      z: ext.z,
      rotationY: ext.rotationY,
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
  maxDist = 0.95,
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
