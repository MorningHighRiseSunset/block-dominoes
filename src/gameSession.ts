import {
  applyMove,
  applyPass,
  getLegalMoves,
  isLegalMove,
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
  const btnCloseOverlay = document.getElementById('btn-close-overlay')!;
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
  const btnBig3 = document.getElementById('btn-big3')!;
  const btnBig2 = document.getElementById('btn-big2')!;
  const btnBig1 = document.getElementById('btn-big1')!;
  const btnBig0 = document.getElementById('btn-big0')!;
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
    const cpuHand = previewHands?.[1] ?? (state.hands.length > 1 ? state.hands[1] : []);
    renderSetupHand(hand);

    // Hide all double buttons by default first
    btnBig6.classList.add('hidden');
    btnBig5.classList.add('hidden');
    btnBig4.classList.add('hidden');
    btnBig3.classList.add('hidden');
    btnBig2.classList.add('hidden');
    btnBig1.classList.add('hidden');
    btnBig0.classList.add('hidden');

    // Check which doubles the player has
    const hasDouble6 = hand.some(d => d.low === 6 && d.high === 6);
    const hasDouble5 = hand.some(d => d.low === 5 && d.high === 5);
    const hasDouble4 = hand.some(d => d.low === 4 && d.high === 4);
    const hasDouble3 = hand.some(d => d.low === 3 && d.high === 3);
    const hasDouble2 = hand.some(d => d.low === 2 && d.high === 2);
    const hasDouble1 = hand.some(d => d.low === 1 && d.high === 1);
    const hasDouble0 = hand.some(d => d.low === 0 && d.high === 0);
    const hasAnyDouble = hasDouble6 || hasDouble5 || hasDouble4 || hasDouble3 || hasDouble2 || hasDouble1 || hasDouble0;

    // Find CPU's highest double
    let cpuHighestDouble: Pip | null = null;
    for (let p = 6; p >= 0; p--) {
      if (cpuHand.some(d => d.low === (p as Pip) && d.high === (p as Pip))) {
        cpuHighestDouble = p as Pip;
        break;
      }
    }

    // Update modal text based on what the player has
    const setupLead = document.querySelector('#setup-modal .modal-lead') as HTMLElement;
    if (hasAnyDouble) {
      setupLead.textContent = 'Traditional domino setup: Which double would you like to start with?';
      setupInstruction.classList.remove('hidden');
    } else {
      if (cpuHighestDouble !== null) {
        setupLead.textContent = `CPU has Big ${cpuHighestDouble}. You have no big doubles. The game will start normally.`;
      } else {
        setupLead.textContent = 'You have no big doubles. The game will start normally.';
      }
      setupInstruction.classList.add('hidden');
    }

    // Show buttons only for doubles the player actually has
    if (hasDouble6) btnBig6.classList.remove('hidden');
    if (hasDouble5) btnBig5.classList.remove('hidden');
    if (hasDouble4) btnBig4.classList.remove('hidden');
    if (hasDouble3) btnBig3.classList.remove('hidden');
    if (hasDouble2) btnBig2.classList.remove('hidden');
    if (hasDouble1) btnBig1.classList.remove('hidden');
    if (hasDouble0) btnBig0.classList.remove('hidden');

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
    // Always use the preview hands that were shown in the modal
    if (!previewHands) {
      previewHands = dealHands(shuffle(makeDeck()), 2);
    }
    const hands = previewHands;
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
      scores: [0, 0],
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
  btnBig3.addEventListener('click', () => startGameWithSetup({ player: 0, double: 3 as Pip }));
  btnBig2.addEventListener('click', () => startGameWithSetup({ player: 0, double: 2 as Pip }));
  btnBig1.addEventListener('click', () => startGameWithSetup({ player: 0, double: 1 as Pip }));
  btnBig0.addEventListener('click', () => startGameWithSetup({ player: 0, double: 0 as Pip }));
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
    // Muggins scoring: show points
    const youScore = state.scores[0];
    const cpuScore = state.scores[1];

    scoreYou.textContent = String(youScore);
    scoreAi.textContent = String(cpuScore);

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
        // Muggins scoring: show scores
        overlayMsg.textContent = won
          ? `Game blocked. Your score: ${state.scores[0]}. CPU: ${state.scores[1]}.`
          : `Game blocked. CPU had higher score (${state.scores[1]} vs your ${state.scores[0]}).`;
      }
      overlay.classList.remove('hidden');
      btnNew.classList.add('hidden'); // Hide the "New game" button when overlay is shown
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
    if (state.current !== 1) return;
    if (state.phase !== 'playing') return;
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
    const chainBefore = state.chain.length;
    state = runAiTurn(state);

    if (state.chain.length > chainBefore) {
      // CPU played a tile
      const lastMove = state.lastMove;
      if (lastMove) {
        const playedDomino = state.chain.find(t => t.domino.id === lastMove.dominoId);
        if (playedDomino) {
          const label = dominoLabel(playedDomino.domino);
          showToast(`CPU played ${label}.`);
        }
      }
    }

    if (state.phase === 'gameOver') {
      updateHud();
      showGameOverOverlay();
      inputLocked = false;
      return;
    }

    inputLocked = false;
    updateHud();

    // Only schedule AI pass if it's still CPU's turn and they must pass
    if (state.current === 1 && mustPass(state, 1)) {
      showToast('CPU has no matching tile — passing.');
      setTimeout(() => {
        state = applyPass(state);
        inputLocked = false;
        if (state.phase === 'gameOver') {
          updateHud();
          showGameOverOverlay();
          return;
        }
        updateHud();
        if (state.current === 1) scheduleAi();
      }, 2000);
    }
  }

  btnContinue.addEventListener('click', () => {
    overlay.classList.add('hidden');
    startNewGame();
  });

  btnCloseOverlay.addEventListener('click', () => {
    overlay.classList.add('hidden');
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
      scores: [0, 0],
    };
    // Clear the overlay and button states
    overlay.classList.add('hidden');
    btnNew.classList.add('hidden');
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
