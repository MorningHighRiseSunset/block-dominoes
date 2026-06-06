import {
  applyMove,
  applyPass,
  getLegalMoves,
  handPipCount,
  mustPass,
  newGame,
  type BlockDominoesState,
  type BlockMove,
} from '../src/game/blockDominoes';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function chainOk(state: BlockDominoesState): boolean {
  const c = state.chain;
  for (let i = 0; i < c.length - 1; i++) {
    if (c[i].rightPip !== c[i + 1].leftPip) return false;
  }
  if (c.length) {
    if (state.leftEnd !== c[0].leftPip) return false;
    if (state.rightEnd !== c[c.length - 1].rightPip) return false;
  }
  return true;
}

let passed = 0;
function ok(msg: string) {
  passed++;
  console.log(`  ok: ${msg}`);
}

// Deal
const g = newGame(2);
assert(g.hands[0].length === 7 && g.hands[1].length === 7, '7 tiles each');
ok('2-player deal (7 each)');

// Opening
const opener = g.current;
const openMoves = getLegalMoves(g, opener);
assert(openMoves.length === 1, 'starter has exactly one opening move');
assert(getLegalMoves(g, 1 - opener).length === 0, 'non-starter has no moves on empty chain');
ok('opening restricted to starter tile');

let state = applyMove(g, openMoves[0]);
assert(state.chain.length === 1, 'chain has one tile after open');
assert(chainOk(state), 'chain ends consistent after open');
ok('opening play');

// Both-end matching: build synthetic state
const bothEnds: BlockDominoesState = {
  ...state,
  hands: [
    [
      { low: 3, high: 5, id: 99 },
      { low: 4, high: 6, id: 100 },
      { low: 3, high: 3, id: 101 },
    ],
    state.hands[1],
  ],
  chain: [{ domino: { low: 3, high: 4, id: 50 }, leftPip: 3, rightPip: 4 }],
  leftEnd: 3,
  rightEnd: 4,
  current: 0,
  phase: 'playing',
};
const both = getLegalMoves(bothEnds, 0);
assert(both.some((m) => m.end === 'left' && m.handIndex === 0), '3-5 on left');
assert(both.some((m) => m.end === 'right' && m.handIndex === 1), '4-6 on right');
assert(both.some((m) => m.end === 'left' && m.handIndex === 2), '3-3 on left');
assert(both.filter((m) => m.handIndex === 0).length === 1, '3-5 only fits left');
ok('end matching is pip-correct');

// Play through games
for (let trial = 0; trial < 20; trial++) {
  let s = newGame(2);
  let guard = 0;
  while (s.phase === 'playing' && guard++ < 200) {
    const p = s.current;
    const legal = getLegalMoves(s, p);
    if (legal.length) {
      const m = legal[Math.floor(Math.random() * legal.length)];
      const next = applyMove(s, m);
      assert(chainOk(next), `chain broken after move trial ${trial}`);
      s = next;
    } else {
      assert(mustPass(s, p), 'no moves implies must pass');
      s = applyPass(s);
    }
  }
  assert(guard < 200, `trial ${trial} finished`);
}
ok('20 random playthroughs');

// Blocked game
const tieState: BlockDominoesState = {
  playerCount: 2,
  hands: [
    [{ low: 1, high: 2, id: 0 }],
    [{ low: 0, high: 3, id: 1 }],
  ],
  chain: [{ domino: { low: 4, high: 5, id: 2 }, leftPip: 4, rightPip: 5 }],
  leftEnd: 4,
  rightEnd: 5,
  current: 0,
  phase: 'playing',
  winner: null,
  gameOverReason: null,
  passesInRow: 0,
  lastMove: null,
};
let blocked = applyPass(tieState);
assert(blocked.passesInRow === 1 && blocked.current === 1, 'pass advances');
blocked = applyPass(blocked);
assert(blocked.phase === 'gameOver' && blocked.gameOverReason === 'blocked', 'blocked after 2 passes');
assert(handPipCount(blocked.hands[0]) === handPipCount(blocked.hands[1]), 'tie pips');
console.log(`  note: tie winner is player ${blocked.winner} (pips equal — tie-break undefined)`);
ok('blocked game ends after both pass');

// Win on empty hand
const winState: BlockDominoesState = {
  playerCount: 2,
  hands: [[{ low: 3, high: 3, id: 10 }], []],
  chain: [{ domino: { low: 3, high: 6, id: 11 }, leftPip: 3, rightPip: 6 }],
  leftEnd: 3,
  rightEnd: 6,
  current: 0,
  phase: 'playing',
  winner: null,
  gameOverReason: null,
  passesInRow: 0,
  lastMove: null,
};
const won = applyMove(winState, { handIndex: 0, end: 'left' });
assert(won.phase === 'gameOver' && won.winner === 0 && won.gameOverReason === 'empty', 'win on last tile');
ok('empty hand wins');

console.log(`\n${passed} rule checks passed`);
