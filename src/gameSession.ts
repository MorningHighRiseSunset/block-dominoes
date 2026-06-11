import {
  applyMove,
  applyPass,
  getLegalMoves,
  isLegalMove,
  handPipCount,
  mustPass,
  newGame,
  pipLabel,
  findStarter,
  findStarterWithPlayerAnswer,
  dealHands,
  makeDeck,
  shuffle,
  dominoLabel,
  setSnakeTurn,
  type BlockDominoesState,
  type BlockMove,
  type Pip,
  type Domino,
  type SnakeTurn,
} from './game/blockDominoes';
import { runAiTurn } from './game/blockDominoesAi';
import { playPlaceSound, unlockAudio } from './audio/sounds';
import { BlockDominoScene } from './render/blockDominoScene';
import { dominoFaceDataUrl } from './render/dominoMesh';

export function initGameSession(canvas: HTMLCanvasElement, onBackToLobby: () => void) {
  const statusEl = document.getElementById('status')!;
  const hintEl = document.getElementById('hint')!;
  const scoreYou = document.getElementById('score-you')!;
  const scoreAi = document.getElementById('score-ai')!;
  const endLeft = document.getElementById('end-left')!;
  const endRight = document.getElementById('end-right')!;
  const overlay = document.getElementById('overlay')!;
  const overlayTitle = document.getElementById('overlay-title')!;
  const overlayMsg = document.getElementById('overlay-msg')!;
  const btnContinue = document.getElementById('btn-continue')!;
  const btnNew = document.getElementById('btn-new')!;
  const btnInstructions = document.getElementById('btn-instructions')!;
  const btnBackLobby = document.getElementById('btn-back-lobby')!;
  const instructionsModal = document.getElementById('instructions')!;
  const btnCloseInstr = document.getElementById('btn-close-instr')!;
  const btnInstrDone = document.getElementById('btn-instr-done')!;
  const setupModal = document.getElementById('setup-modal')!;
  const setupHandTiles = document.getElementById('setup-hand-tiles')!;
  const setupInstruction = document.getElementById('setup-instruction')!;
  const btnBig6 = document.getElementById('btn-big6')!;
  const btnBig5 = document.getElementById('btn-big5')!;
  const btnBig4 = document.getElementById('btn-big4')!;
  const btnNoDouble = document.getElementById('btn-nodouble')!;
  const gameToast = document.getElementById('game-toast')!;
  const btnTurnCw = document.getElementById('btn-turn-cw') as HTMLButtonElement;
  const btnTurnCcw = document.getElementById('btn-turn-ccw') as HTMLButtonElement;

  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  function showToast(message: string, durationMs = 3000) {
    if (toastTimer) clearTimeout(toastTimer);
    gameToast.textContent = message;
    gameToast.classList.remove('hidden');
    toastTimer = setTimeout(() => {
      gameToast.classList.add('hidden');
      toastTimer = null;
    }, durationMs);
  }

  function updateTurnButtons(turn: SnakeTurn) {
    const yours = state.current === 0 && state.phase === 'playing';
    btnTurnCw.classList.toggle('active', turn === 'clockwise');
    btnTurnCcw.classList.toggle('active', turn === 'counterclockwise');
    btnTurnCw.disabled = !yours;
    btnTurnCcw.disabled = !yours;
  }

  function applySnakeTurn(turn: SnakeTurn) {
    if (state.phase !== 'playing' || state.current !== 0) return;
    state = setSnakeTurn(state, turn);
    updateTurnButtons(turn);
    updateHud();
  }

  btnTurnCw.addEventListener('click', () => applySnakeTurn('clockwise'));
  btnTurnCcw.addEventListener('click', () => applySnakeTurn('counterclockwise'));

  function openInstructions() {
    instructionsModal.classList.remove('hidden');
  }

  function closeInstructions() {
    instructionsModal.classList.add('hidden');
  }

  function renderSetupHand(hand: Domino[]) {
    setupHandTiles.replaceChildren();
    const sorted = [...hand].sort((a, b) => b.high - a.high || b.low - a.low);
    for (const d of sorted) {
      const tile = document.createElement('div');
      tile.className = 'setup-domino';
      const img = document.createElement('img');
      img.src = dominoFaceDataUrl(d.low, d.high);
      img.alt = dominoLabel(d);
      img.draggable = false;
      tile.appendChild(img);
      setupHandTiles.appendChild(tile);
    }
  }

  function openSetupModal() {
    const hand = previewHands?.[0] ?? state.hands[0];
    renderSetupHand(hand);

    // Check which doubles the player has
    const hasDouble6 = hand.some(d => d.low === 6 && d.high === 6);
    const hasDouble5 = hand.some(d => d.low === 5 && d.high === 5);
    const hasDouble4 = hand.some(d => d.low === 4 && d.high === 4);
    const hasAnyDouble = hasDouble6 || hasDouble5 || hasDouble4;

    // Update modal text based on what the player has
    const setupLead = document.querySelector('#setup-modal .modal-lead') as HTMLElement;
    if (hasAnyDouble) {
      setupLead.textContent = 'Traditional domino setup: Which double would you like to start with?';
      setupInstruction.classList.remove('hidden');
    } else {
      setupLead.textContent = 'You have no big doubles. The game will start normally.';
      setupInstruction.classList.add('hidden');
    }

    // Show/hide buttons based on what the player has
    btnBig6.classList.toggle('hidden', !hasDouble6);
    btnBig5.classList.toggle('hidden', !hasDouble5);
    btnBig4.classList.toggle('hidden', !hasDouble4);

    // If player has no doubles, hide all double buttons and only show "no double"
    if (!hasAnyDouble) {
      btnNoDouble.classList.remove('btn-secondary');
      btnNoDouble.classList.add('btn-primary');
      btnNoDouble.textContent = 'Begin game';
    } else {
      btnNoDouble.classList.remove('btn-primary');
      btnNoDouble.classList.add('btn-secondary');
      btnNoDouble.textContent = "I don't have any of these";
    }

    setupModal.classList.remove('hidden');
  }

  function closeSetupModal() {
    setupModal.classList.add('hidden');
  }

  function startGameWithSetup(playerHasDouble: { player: 0; double: Pip } | null) {
    closeSetupModal();
    // Use the preview hands if available, otherwise create new ones
    const hands = previewHands || dealHands(shuffle(makeDeck()), 2);
    const { player: starter } = findStarterWithPlayerAnswer(hands, playerHasDouble);
    state = {
      playerCount: 2,
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
    previewHands = null; // Clear the preview hands
    overlay.classList.add('hidden');
    btnNew.classList.add('hidden');
    inputLocked = false;
    pendingAi = false;
    passScheduled = false;
    updateHud();
    if (state.current === 1) scheduleAi();
  }

  btnInstructions.addEventListener('click', openInstructions);
  btnCloseInstr.addEventListener('click', closeInstructions);
  btnInstrDone.addEventListener('click', closeInstructions);
  instructionsModal.addEventListener('click', (e) => {
    if (e.target === instructionsModal) closeInstructions();
  });
  btnBackLobby.addEventListener('click', onBackToLobby);

  // Setup modal button handlers
  btnBig6.addEventListener('click', () => startGameWithSetup({ player: 0, double: 6 as Pip }));
  btnBig5.addEventListener('click', () => startGameWithSetup({ player: 0, double: 5 as Pip }));
  btnBig4.addEventListener('click', () => startGameWithSetup({ player: 0, double: 4 as Pip }));
  btnNoDouble.addEventListener('click', () => startGameWithSetup(null));

  const scene = new BlockDominoScene(canvas);
  scene.setPlacementListener((player) => {
    unlockAudio();
    playPlaceSound(player);
  });
  scene.setDropListener((move) => {
    unlockAudio();
    applyHumanMove(move);
  });

  canvas.addEventListener('pointerdown', () => unlockAudio());

  let state: BlockDominoesState = newGame();
  let inputLocked = false;
  let pendingAi = false;
  let passScheduled = false;
  let loopRunning = false;
  let paused = true;
  let previewHands: Domino[][] | null = null;

  function updateHud() {
    const youPips = handPipCount(state.hands[0]);
    const cpuPips = handPipCount(state.hands[1]);

    scoreYou.textContent = String(youPips);
    scoreAi.textContent = String(cpuPips);

    if (state.chain.length === 0) {
      endLeft.textContent = '—';
      endRight.textContent = '—';
    } else {
      endLeft.textContent = pipLabel(state.leftEnd!);
      endRight.textContent = pipLabel(state.rightEnd!);
    }

    if (state.phase === 'gameOver') {
      const won = state.winner === 0;
      statusEl.textContent = won ? 'You win!' : 'CPU wins.';
      hintEl.textContent =
        state.gameOverReason === 'empty'
          ? 'You emptied your hand.'
          : state.gameOverReason === 'blocked'
            ? 'Game blocked — fewest pips in hand wins (all players passed).'
            : '';
      btnNew.classList.remove('hidden');
      scene.sync(state, [], false);
      return;
    }

    const legal = getLegalMoves(state, state.current);

    if (state.current === 0) {
      if (mustPass(state, 0)) {
        statusEl.textContent = 'Your turn';
        hintEl.textContent = 'Block rules: no draw from the boneyard.';
        scene.sync(state, [], false);
        schedulePass('You have no matching tile — passing.');
        return;
      }
      statusEl.textContent = 'Your turn — pick a tile, then choose where to play it';
      hintEl.textContent =
        state.chain.length === 0
          ? 'Select your opening tile, then click the highlighted spot on the table.'
          : 'Gold ghost = left end · Blue-tint ghost = right end. Click the preview to place there.';
    } else {
      statusEl.textContent = 'CPU is thinking…';
      hintEl.textContent = `${state.hands[1].length} tile(s) hidden.`;
    }

    updateTurnButtons(state.snakeTurn);
    scene.sync(
      state,
      state.current === 0 ? legal : [],
      state.current === 0 && !inputLocked,
    );
  }

  function showGameOverOverlay() {
    setTimeout(() => {
      const won = state.winner === 0;
      overlayTitle.textContent = won ? 'You win!' : 'CPU wins';
      if (state.gameOverReason === 'empty') {
        overlayMsg.textContent = won
          ? 'You played your last tile.'
          : 'The CPU emptied its hand.';
      } else {
        overlayMsg.textContent = won
          ? `Game blocked. Your hand: ${handPipCount(state.hands[0])} pips. CPU: ${handPipCount(state.hands[1])}.`
          : `Game blocked. CPU had fewer pips (${handPipCount(state.hands[1])} vs your ${handPipCount(state.hands[0])}).`;
      }
      overlay.classList.remove('hidden');
    }, 4500);
  }

  function applyHumanMove(move: BlockMove) {
    if (inputLocked || state.current !== 0 || state.phase !== 'playing') return;
    if (!isLegalMove(state, move, 0)) return;
    inputLocked = true;
    state = applyMove(state, move);
    if (state.phase === 'gameOver') {
      updateHud();
      showGameOverOverlay();
      inputLocked = false;
      return;
    }
    updateHud();
    scheduleAi();
  }

  function schedulePass(message: string) {
    if (passScheduled) return;
    passScheduled = true;
    inputLocked = true;
    showToast(message, 3000);
    setTimeout(() => {
      passScheduled = false;
      state = applyPass(state);
      inputLocked = false;
      if (state.phase === 'gameOver') {
        updateHud();
        showGameOverOverlay();
        return;
      }
      updateHud();
      if (state.current === 1) scheduleAi();
    }, 3000);
  }

  function scheduleAi() {
    if (pendingAi) return;
    if (state.current !== 1) return; // Only schedule if it's actually AI's turn
    if (state.phase !== 'playing') return; // Only schedule if game is still playing
    pendingAi = true;
    setTimeout(runAiTurnLoop, 450);
  }

  function runAiTurnLoop() {
    if (!pendingAi) return;
    pendingAi = false;
    if (state.phase !== 'playing' || state.current !== 1) {
      inputLocked = false;
      return;
    }

    inputLocked = true;
    const passesBefore = state.passesInRow;
    const chainBefore = state.chain.length;
    state = runAiTurn(state);

    if (state.passesInRow > passesBefore && state.chain.length === chainBefore) {
      showToast('CPU has no matching tile — passing.');
    }

    if (state.phase === 'gameOver') {
      updateHud();
      showGameOverOverlay();
      inputLocked = false;
      return;
    }

    inputLocked = false;
    updateHud();

    if (state.current === 1 && mustPass(state, 1)) {
      scheduleAi();
    }
  }

  btnContinue.addEventListener('click', () => {
    overlay.classList.add('hidden');
    startNewGame();
  });

  btnNew.addEventListener('click', startNewGame);

  function startNewGame() {
    // Create preview hands so player can see their dominoes before answering
    const deck = shuffle(makeDeck());
    previewHands = dealHands(deck, 2);
    const { player: starter } = findStarter(previewHands);
    state = {
      playerCount: 2,
      hands: previewHands,
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
    // Sync the scene to show the player's hand
    updateHud();
    // Show setup modal immediately (it's now positioned at top and semi-transparent)
    openSetupModal();
  }

  function loop() {
    if (!loopRunning) return;
    if (!paused) scene.render();
    requestAnimationFrame(loop);
  }

  return {
    start() {
      paused = false;
      if (!loopRunning) {
        loopRunning = true;
        loop();
      }
      startNewGame();
      if (!localStorage.getItem('block-dominoes-seen-instr')) {
        openInstructions();
        localStorage.setItem('block-dominoes-seen-instr', '1');
      }
    },
    pause() {
      paused = true;
    },
  };
}
