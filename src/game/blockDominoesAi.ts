import {
  applyMove,
  applyPass,
  canDraw,
  drawFromBoneyard,
  getLegalMoves,
  handPipCount,
  type BlockDominoesState,
  type BlockMove,
  type Player,
} from './blockDominoes';

const AI: Player = 1;

export function chooseAiMove(state: BlockDominoesState): BlockMove | null {
  const moves = getLegalMoves(state, AI);
  if (!moves.length) return null;

  let best = moves[0];
  let bestScore = -Infinity;

  for (const m of moves) {
    const score = scoreMove(state, m);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }

  return best;
}

function scoreMove(state: BlockDominoesState, move: BlockMove): number {
  const after = applyMove(state, move);
  const domino = state.hands[AI][move.handIndex];
  let score = 0;

  if (after.phase === 'gameOver' && after.winner === AI) return 100_000;

  const myHand = after.hands[AI];
  score -= handPipCount(myHand) * 18;
  score -= myHand.length * 12;

  // Unload heavy tiles and doubles while we can still play them.
  score += (domino.low + domino.high) * 3;
  if (domino.low === domino.high) score += 14;

  if (after.phase === 'playing' && after.current === 0) {
    const oppMoves = getLegalMoves(after, 0);
    if (oppMoves.length === 0) {
      score += 90;
      const afterPass = applyPass(after);
      if (afterPass.phase === 'gameOver' && afterPass.winner === AI) {
        score += 600;
      }
    } else {
      score -= oppMoves.length * 10;
    }

    const ends = [after.leftEnd, after.rightEnd].filter((e) => e !== null) as number[];
    for (const pip of ends) {
      if (countInHand(state.hands[0], pip) === 0) score += 18;
    }
  }

  // Prefer ends we still hold — keeps options open for later turns.
  if (after.leftEnd !== null && countInHand(myHand, after.leftEnd) > 0) score += 4;
  if (after.rightEnd !== null && countInHand(myHand, after.rightEnd) > 0) score += 4;

  return score;
}

function countInHand(hand: { low: number; high: number }[], pip: number): number {
  let n = 0;
  for (const d of hand) {
    if (d.low === pip || d.high === pip) n++;
  }
  return n;
}

export function runAiTurn(state: BlockDominoesState): BlockDominoesState {
  const move = chooseAiMove(state);
  if (move) return applyMove(state, move);
  
  // If no legal moves, draw from boneyard if possible
  if (canDraw(state, AI)) {
    return drawFromBoneyard(state, AI);
  }
  
  return applyPass(state);
}
