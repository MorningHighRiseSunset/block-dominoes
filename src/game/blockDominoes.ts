import {
  extensionSlot,
  INITIAL_TRAVEL_DIR,
  layoutChain,
  rotationForTile,
} from '../render/chainLayout';

export type Pip = 0 | 1 | 2 | 3 | 4 | 5 | 6;
/** Seat index (0 … playerCount − 1). */
export type Player = number;
export type PlayerCount = 2 | 3 | 4;
export type Phase = 'playing' | 'gameOver';
export type ChainEnd = 'left' | 'right';
export type TravelDir = 'east' | 'west' | 'north' | 'south';
export type SnakeTurn = 'clockwise' | 'counterclockwise';

export interface TileLayout {
  x: number;
  z: number;
  rotationY: number;
  travelDir: TravelDir;
}

const DECK_SIZE = 28;

export interface Domino {
  low: Pip;
  high: Pip;
  id: number;
}

export interface PlayedTile {
  domino: Domino;
  leftPip: Pip;
  rightPip: Pip;
  isDouble: boolean;
  layout?: TileLayout;
}

export interface BlockMove {
  handIndex: number;
  end: ChainEnd;
}

export interface BlockDominoesState {
  playerCount: PlayerCount;
  hands: Domino[][];
  chain: PlayedTile[];
  leftEnd: Pip | null;
  rightEnd: Pip | null;
  current: Player;
  phase: Phase;
  winner: Player | null;
  gameOverReason: 'empty' | 'blocked' | null;
  passesInRow: number;
  lastMove: { player: Player; dominoId: number; end: ChainEnd } | null;
  /** Which way the chain turns when it hits the table edge. */
  snakeTurn: SnakeTurn;
}

/** Tiles dealt to each player at the start of a hand (block dominoes, double-six). */
export function tilesPerPlayer(playerCount: PlayerCount): number {
  switch (playerCount) {
    case 2:
    case 3:
      return 7;
    case 4:
      return 5;
  }
}

export function totalDealt(playerCount: PlayerCount): number {
  return playerCount * tilesPerPlayer(playerCount);
}

export function pipLabel(p: Pip): string {
  return String(p);
}

export function dominoLabel(d: Domino): string {
  return `${d.low}|${d.high}`;
}

export function handPipCount(hand: Domino[]): number {
  return hand.reduce((sum, d) => sum + d.low + d.high, 0);
}

export function makeDeck(): Domino[] {
  const deck: Domino[] = [];
  let id = 0;
  for (let a = 0; a <= 6; a++) {
    for (let b = a; b <= 6; b++) {
      deck.push({ low: a as Pip, high: b as Pip, id });
      id++;
    }
  }
  return deck;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function dealHands(deck: Domino[], playerCount: PlayerCount): Domino[][] {
  const perHand = tilesPerPlayer(playerCount);
  const dealt = totalDealt(playerCount);
  if (dealt > DECK_SIZE) {
    throw new Error(`Cannot deal ${dealt} tiles from a ${DECK_SIZE}-tile set`);
  }

  const hands: Domino[][] = [];
  let offset = 0;
  for (let i = 0; i < playerCount; i++) {
    hands.push(deck.slice(offset, offset + perHand));
    offset += perHand;
  }
  return hands;
}

export function findStarter(hands: Domino[][]): { player: Player; domino: Domino } {
  // Traditional domino starting rules:
  // 1. Highest double starts (6-6, then 5-5, then 4-4, etc.)
  // 2. If no doubles, highest pip sum starts
  let bestDouble: { player: Player; domino: Domino; pip: Pip } | null = null;
  let bestNonDouble: { player: Player; domino: Domino; sum: number } | null = null;

  for (let p = 0; p < hands.length; p++) {
    for (const d of hands[p]) {
      if (d.low === d.high) {
        // It's a double
        if (!bestDouble || d.low > bestDouble.pip) {
          bestDouble = { player: p, domino: d, pip: d.low };
        }
      } else {
        // Non-double
        const sum = d.low + d.high;
        if (!bestNonDouble || sum > bestNonDouble.sum) {
          bestNonDouble = { player: p, domino: d, sum };
        }
      }
    }
  }

  // Prefer doubles if any exist
  if (bestDouble) {
    return { player: bestDouble.player, domino: bestDouble.domino };
  }

  // Fall back to highest sum non-double
  if (bestNonDouble) {
    return { player: bestNonDouble.player, domino: bestNonDouble.domino };
  }

  // Should never happen with a valid deck
  throw new Error('No valid starter found');
}

export function findStarterWithPlayerAnswer(
  hands: Domino[][],
  playerHasDouble: { player: 0; double: Pip } | null,
): { player: Player; domino: Domino } {
  // If player claims to have a specific double, verify and use that
  if (playerHasDouble) {
    const { player, double } = playerHasDouble;
    const hand = hands[player];
    const claimedDomino = hand.find((d) => d.low === double && d.high === double);
    
    if (claimedDomino) {
      // Player actually has it, they start
      return { player, domino: claimedDomino };
    }
    
    // Player was wrong or lying, fall back to normal rules
    console.warn(`Player claimed to have double-${double} but doesn't. Using standard rules.`);
  }
  
  // Fall back to standard findStarter
  return findStarter(hands);
}

function blockedWinner(hands: Domino[][]): Player {
  let winner = 0;
  let bestPips = handPipCount(hands[0]);
  let bestTiles = hands[0].length;
  for (let p = 1; p < hands.length; p++) {
    const pips = handPipCount(hands[p]);
    const tiles = hands[p].length;
    if (pips < bestPips || (pips === bestPips && tiles < bestTiles)) {
      bestPips = pips;
      bestTiles = tiles;
      winner = p;
    }
  }
  return winner;
}

export function newGame(playerCount: PlayerCount = 2): BlockDominoesState {
  const deck = shuffle(makeDeck());
  const hands = dealHands(deck, playerCount);
  const { player: starter } = findStarter(hands);

  return {
    playerCount,
    hands,
    chain: [],
    leftEnd: null,
    rightEnd: null,
    current: starter,
    phase: 'playing',
    winner: null,
    gameOverReason: null,
    passesInRow: 0,
    lastMove: null,
    snakeTurn: 'clockwise',
  };
}

export function newGameWithSetup(
  playerCount: PlayerCount = 2,
  playerHasDouble: { player: 0; double: Pip } | null = null,
): BlockDominoesState {
  const deck = shuffle(makeDeck());
  const hands = dealHands(deck, playerCount);
  const { player: starter } = findStarterWithPlayerAnswer(hands, playerHasDouble);

  return {
    playerCount,
    hands,
    chain: [],
    leftEnd: null,
    rightEnd: null,
    current: starter,
    phase: 'playing',
    winner: null,
    gameOverReason: null,
    passesInRow: 0,
    lastMove: null,
    snakeTurn: 'clockwise',
  };
}

export function nextPlayer(state: BlockDominoesState, player: Player): Player {
  return (player + 1) % state.playerCount;
}

/** @deprecated Use nextPlayer(state, p) for N-player games. */
export function other(p: Player): Player {
  return p === 0 ? 1 : 0;
}

function matchesEnd(d: Domino, end: Pip): boolean {
  return d.low === end || d.high === end;
}

function orientForEnd(d: Domino, end: Pip, side: ChainEnd): { leftPip: Pip; rightPip: Pip } | null {
  if (d.low === end && d.high === end) {
    return { leftPip: d.low, rightPip: d.high };
  }
  if (d.low === end) {
    return side === 'left'
      ? { leftPip: d.high, rightPip: d.low }
      : { leftPip: d.low, rightPip: d.high };
  }
  if (d.high === end) {
    return side === 'left'
      ? { leftPip: d.low, rightPip: d.high }
      : { leftPip: d.high, rightPip: d.low };
  }
  return null;
}

export function getLegalMoves(state: BlockDominoesState, player: Player): BlockMove[] {
  if (state.phase !== 'playing' || state.current !== player) return [];
  if (player < 0 || player >= state.hands.length) return [];

  const hand = state.hands[player];
  const moves: BlockMove[] = [];

  if (state.chain.length === 0) {
    const { player: starterPlayer, domino: starter } = findStarter(state.hands);
    if (player !== starterPlayer) return [];
    const idx = hand.findIndex((d) => d.id === starter.id);
    if (idx >= 0) moves.push({ handIndex: idx, end: 'left' });
    return moves;
  }

  for (let i = 0; i < hand.length; i++) {
    const d = hand[i];
    if (state.leftEnd !== null && matchesEnd(d, state.leftEnd)) {
      moves.push({ handIndex: i, end: 'left' });
    }
    if (state.rightEnd !== null && matchesEnd(d, state.rightEnd)) {
      if (!moves.some((m) => m.handIndex === i && m.end === 'right')) {
        moves.push({ handIndex: i, end: 'right' });
      }
    }
  }

  return moves;
}

export function mustPass(state: BlockDominoesState, player: Player): boolean {
  return state.phase === 'playing' && state.current === player && getLegalMoves(state, player).length === 0;
}

export function applyPass(state: BlockDominoesState): BlockDominoesState {
  const player = state.current;
  if (!mustPass(state, player)) return state;

  const passesInRow = state.passesInRow + 1;
  if (passesInRow >= state.playerCount) {
    return {
      ...state,
      phase: 'gameOver',
      winner: blockedWinner(state.hands),
      gameOverReason: 'blocked',
      passesInRow,
      lastMove: null,
    };
  }

  return {
    ...state,
    current: nextPlayer(state, player),
    passesInRow,
    lastMove: null,
  };
}

export function setSnakeTurn(state: BlockDominoesState, turn: SnakeTurn): BlockDominoesState {
  if (state.phase !== 'playing') return state;
  return { ...state, snakeTurn: turn };
}

function computeTileLayout(
  state: BlockDominoesState,
  move: BlockMove,
  isDouble: boolean,
): TileLayout {
  if (state.chain.length === 0) {
    const travelDir = INITIAL_TRAVEL_DIR;
    return {
      x: 0,
      z: 0,
      rotationY: rotationForTile(travelDir, isDouble),
      travelDir,
    };
  }

  const placements = layoutChain(state.chain, state.snakeTurn);
  const ext = extensionSlot(placements, move.end, isDouble, state.snakeTurn);
  const travelDir = move.end === 'left' ? placements[0].travelDir : ext.travelDir;
  return {
    x: ext.x,
    z: ext.z,
    rotationY: ext.rotationY,
    travelDir,
  };
}

export function applyMove(state: BlockDominoesState, move: BlockMove): BlockDominoesState {
  const player = state.current;
  if (!isLegalMove(state, move, player)) return state;

  const hand = [...state.hands[player]];
  const domino = hand[move.handIndex];
  hand.splice(move.handIndex, 1);

  const hands = state.hands.map((h, i) => (i === player ? hand : [...h]));

  if (state.chain.length === 0) {
    const isDouble = domino.low === domino.high;
    const played: PlayedTile = {
      domino,
      leftPip: domino.low,
      rightPip: domino.high,
      isDouble,
      layout: computeTileLayout(state, move, isDouble),
    };
    const chain = [played];
    const gameOver = hand.length === 0;

    return {
      ...state,
      hands,
      chain,
      leftEnd: domino.low,
      rightEnd: domino.high,
      current: gameOver ? player : nextPlayer(state, player),
      phase: gameOver ? 'gameOver' : 'playing',
      winner: gameOver ? player : null,
      gameOverReason: gameOver ? 'empty' : null,
      passesInRow: 0,
      lastMove: { player, dominoId: domino.id, end: move.end },
    };
  }

  const endPip = move.end === 'left' ? state.leftEnd! : state.rightEnd!;
  const oriented = orientForEnd(domino, endPip, move.end)!;
  const isDouble = domino.low === domino.high;
  const played: PlayedTile = {
    domino,
    ...oriented,
    isDouble,
    layout: computeTileLayout(state, move, isDouble),
  };

  let chain: PlayedTile[];
  let leftEnd: Pip;
  let rightEnd: Pip;

  if (move.end === 'left') {
    chain = [played, ...state.chain];
    leftEnd = oriented.leftPip;
    rightEnd = state.rightEnd!;
  } else {
    chain = [...state.chain, played];
    leftEnd = state.leftEnd!;
    rightEnd = oriented.rightPip;
  }

  const gameOver = hand.length === 0;

  return {
    ...state,
    hands,
    chain,
    leftEnd,
    rightEnd,
    current: gameOver ? player : nextPlayer(state, player),
    phase: gameOver ? 'gameOver' : 'playing',
    winner: gameOver ? player : null,
    gameOverReason: gameOver ? 'empty' : null,
    passesInRow: 0,
    lastMove: { player, dominoId: domino.id, end: move.end },
  };
}

export function isLegalMove(
  state: BlockDominoesState,
  move: BlockMove,
  player: Player,
): boolean {
  return getLegalMoves(state, player).some(
    (m) => m.handIndex === move.handIndex && m.end === move.end,
  );
}

export function moveKey(m: BlockMove): string {
  return `${m.handIndex}:${m.end}`;
}
