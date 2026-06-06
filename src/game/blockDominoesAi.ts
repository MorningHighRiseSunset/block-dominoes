import {
  applyMove,
  applyPass,
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
  const myHand = after.hands[AI];
  let score = 0;

  if (after.phase === 'gameOver' && after.winner === AI) return 10_000;

  score -= handPipCount(myHand) * 12;
  score -= myHand.length * 8;

  const domino = state.hands[AI][move.handIndex];
  if (domino.low === domino.high) score += 6;
  score += domino.low + domino.high;

  const oppMoves =
    after.phase === 'playing' && after.current === 0 ? getLegalMoves(after, 0).length : 0;
  score += oppMoves === 0 ? 40 : -oppMoves * 5;

  const ends = [after.leftEnd, after.rightEnd].filter((e) => e !== null) as number[];
  const rareEnds = ends.filter((e) => countInHand(state.hands[0], e) === 0).length;
  score += rareEnds * 10;

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
  return applyPass(state);
}
