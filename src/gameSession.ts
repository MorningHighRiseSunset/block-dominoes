import {
  applyMove,
  applyPass,
  getLegalMoves,
  isLegalMove,
  mustPass,
  canDraw,
  drawFromBoneyard,
  newGame,
  pipLabel,
  findStarter,
  findStarterWithPlayerAnswer,
  dealHandsWithBoneyard,
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
  const btnNoDouble = document.getElementById('btn-nodouble')!;
  const gameToast = document.getElementById('game-toast')!;
  const boneyardPanel = document.getElementById('boneyard-panel')!;
  const boneyardCount = document.getElementById('boneyard-count')!;
  const lastPlayedPanel = document.getElementById('last-played-panel')!;
  const lastPlayedImage = document.getElementById('last-played-image') as HTMLImageElement;
  const lastPlayedDesc = document.getElementById('last-played-desc')!;
  const btnDraw = document.getElementById('btn-draw')! as HTMLButtonElement;
  const btnPass = document.getElementById('btn-pass')! as HTMLButtonElement;
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

    // Check which big doubles the player has (only show Big 6, 5, 4)
    const hasDouble6 = hand.some(d => d.low === 6 && d.high === 6);
    const hasDouble5 = hand.some(d => d.low === 5 && d.high === 5);
    const hasDouble4 = hand.some(d => d.low === 4 && d.high === 4);
    const hasAnyBigDouble = hasDouble6 || hasDouble5 || hasDouble4;

    // Find CPU's highest double and highest big double (6, 5, or 4).
    let cpuHighestDouble: Pip | null = null;
    let cpuHighestBigDouble: Pip | null = null;
    for (let p = 6; p >= 0; p--) {
      if (cpuHand.some(d => d.low === (p as Pip) && d.high === (p as Pip))) {
        if (cpuHighestDouble === null) {
          cpuHighestDouble = p as Pip;
        }
        if (cpuHighestBigDouble === null && p >= 4) {
          cpuHighestBigDouble = p as Pip;
        }
      }
    }

    // Update modal text based on what the player has
    const setupLead = document.querySelector('#setup-modal .modal-lead') as HTMLElement;
    if (hasAnyBigDouble) {
      const playerMaxDouble = hasDouble6 ? 6 : (hasDouble5 ? 5 : 4);
      if (cpuHighestBigDouble !== null && cpuHighestBigDouble > playerMaxDouble) {
        setupLead.textContent = `CPU has Big ${cpuHighestBigDouble} and will go first. Select your double for reference:`;
      } else {
        setupLead.textContent = 'Traditional domino setup: Which double would you like to start with?';
      }
      setupInstruction.classList.remove('hidden');
    } else {
      if (cpuHighestBigDouble !== null) {
        setupLead.textContent = `CPU has Big ${cpuHighestBigDouble}. The game will start normally.`;
      } else if (cpuHighestDouble !== null) {
        setupLead.textContent = `CPU has highest double ${cpuHighestDouble}. The game will start normally.`;
      } else {
        setupLead.textContent = 'You have no big doubles. The game will start normally.';
      }
      setupInstruction.classList.add('hidden');
    }

    // Show buttons only for doubles the player actually has (only Big 6, 5, 4)
    if (hasDouble6) btnBig6.classList.remove('hidden');
    if (hasDouble5) btnBig5.classList.remove('hidden');
    if (hasDouble4) btnBig4.classList.remove('hidden');

    // If player has no big doubles, hide all big-double buttons and only show "Begin game"
    if (!hasAnyBigDouble) {
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
      const deck = shuffle(makeDeck());
      const result = dealHandsWithBoneyard(deck, 2);
      previewHands = result.hands;
      previewBoneyard = result.boneyard;
    }
    const hands = previewHands;
    const boneyard = previewBoneyard ?? [];
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
      boneyard,
    };
    previewHands = null; // Clear the preview hands
    previewBoneyard = null;
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
  btnDraw.addEventListener('click', () => {
    unlockAudio();
    applyHumanDraw();
  });

  btnPass.addEventListener('click', () => {
    if (mustPass(state, 0)) {
      inputLocked = true;
      state = applyPass(state);
      updateHud();
      if (state.phase === 'gameOver') {
        showGameOverOverlay();
        inputLocked = false;
        return;
      }
      scheduleAi();
    }
  });

  canvas.addEventListener('pointerdown', () => unlockAudio());

  let state: BlockDominoesState = newGame();
  let inputLocked = false;
  let pendingAi = false;
  let passScheduled = false;
  let loopRunning = false;
  let paused = true;
  let previewHands: Domino[][] | null = null;
  let previewBoneyard: Domino[] | null = null;
  let prevLastMoveId: number | null = null;
  let lastPlayedHidden = false;

  const btnCloseLastPlayed = document.getElementById('btn-close-last-played') as HTMLButtonElement | null;
  if (btnCloseLastPlayed) {
    btnCloseLastPlayed.addEventListener('click', () => {
      lastPlayedHidden = true;
      lastPlayedPanel.classList.add('hidden');
    });
  }

  function updateHud() {
    // Muggins scoring: show points
    const youScore = state.scores[0];
    const cpuScore = state.scores[1];

    scoreYou.textContent = String(youScore);
    scoreAi.textContent = String(cpuScore);

    // Update boneyard panel
    boneyardCount.textContent = String(state.boneyard.length);
    if (state.phase === 'playing') {
      const canDrawNow = canDraw(state, 0);
      const mustPassNow = mustPass(state, 0);
      const showBoneyard = canDrawNow || mustPassNow || state.boneyard.length > 0;
      boneyardPanel.classList.toggle('hidden', !showBoneyard);
      btnDraw.classList.toggle('hidden', !canDrawNow);
      btnDraw.disabled = !canDrawNow;
      btnPass.classList.toggle('hidden', !mustPassNow);
      btnPass.disabled = !mustPassNow;
    } else {
      boneyardPanel.classList.add('hidden');
    }

    const lastMove = state.lastMove;
    // If a new lastMove appears, reset the hidden flag so it will show once.
    if (lastMove && lastMove.dominoId !== prevLastMoveId) {
      lastPlayedHidden = false;
    }
    prevLastMoveId = lastMove ? lastMove.dominoId : null;

    if (lastMove && !lastPlayedHidden) {
      const playedTile = state.chain.find((t) => t.domino.id === lastMove.dominoId);
      if (playedTile) {
        lastPlayedImage.src = dominoFaceDataUrl(playedTile.domino.low, playedTile.domino.high);
        lastPlayedImage.alt = `Last played ${dominoLabel(playedTile.domino)}`;
        lastPlayedDesc.textContent = `${lastMove.player === 0 ? 'You played' : 'CPU played'} ${dominoLabel(playedTile.domino)}`;
        lastPlayedPanel.classList.remove('hidden');
      } else {
        lastPlayedPanel.classList.add('hidden');
      }
    } else {
      lastPlayedPanel.classList.add('hidden');
    }

    if (state.chain.length === 0) {
      endLeft.textContent = '—';
      endRight.textContent = '—';
    } else {
      endLeft.textContent = pipLabel(state.leftEnd!);
      endRight.textContent = pipLabel(state.rightEnd!);
    }

    if (state.phase === 'gameOver') {
      const isDraw = state.winner === -1;
      const won = state.winner === 0;
      statusEl.textContent = isDraw ? 'Draw!' : (won ? 'You win!' : 'CPU wins.');
      hintEl.textContent =
        state.gameOverReason === 'empty'
          ? 'You emptied your hand.'
          : state.gameOverReason === 'blocked'
            ? 'Game blocked — Highest score wins!'
            : '';
      btnNew.classList.remove('hidden');
      scene.sync(state, [], false);
      return;
    }

    const legal = getLegalMoves(state, state.current);

    if (state.current === 0) {
      if (canDraw(state, 0)) {
        statusEl.textContent = 'Your turn — draw from boneyard';
        hintEl.textContent = `No matching tile. Click the boneyard to draw (${state.boneyard.length} tiles remaining).`;
        scene.sync(state, [], true);
        return;
      }
      if (mustPass(state, 0)) {
        statusEl.textContent = 'Your turn';
        hintEl.textContent = 'No matching tiles and boneyard is empty — passing.';
        scene.sync(state, [], false);
        schedulePass('You have no matching tile — passing.');
        return;
      }
      statusEl.textContent = 'Your turn';
      hintEl.textContent =
        state.chain.length === 0
          ? 'Select your opening tile, then drag it to the highlighted spot on the table.'
          : 'Drag matching tiles to the table to play them.';
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
      const isDraw = state.winner === -1;
      const won = state.winner === 0;
      overlayTitle.textContent = isDraw ? 'Draw!' : (won ? 'You win!' : 'CPU wins');
      if (state.gameOverReason === 'empty') {
        overlayMsg.textContent = won
          ? 'You played your last tile.'
          : 'The CPU emptied its hand.';
      } else {
        // Muggins scoring: show scores
        if (isDraw) {
          overlayMsg.textContent = `Game blocked. It's a tie! Both have ${state.scores[0]} points.`;
        } else {
          overlayMsg.textContent = won
            ? `Game blocked. Your score: ${state.scores[0]}. CPU: ${state.scores[1]}.`
            : `Game blocked. CPU had higher score (${state.scores[1]} vs your ${state.scores[0]}).`;
        }
      }
      overlay.classList.remove('hidden');
      btnNew.classList.add('hidden'); // Hide the "New game" button when overlay is shown
    }, 4500);
  }

  function applyHumanDraw() {
    if (inputLocked || state.current !== 0 || state.phase !== 'playing') return;
    if (!canDraw(state, 0)) return;
    inputLocked = true;
    state = drawFromBoneyard(state, 0);
    updateHud();
    
    // Check if player can now play after drawing
    const legal = getLegalMoves(state, 0);
    if (legal.length === 0) {
      // Still no legal moves, check if can draw again or must pass
      if (canDraw(state, 0)) {
        // Can draw again, let them continue
        scene.sync(state, [], false);
        inputLocked = false;
        return;
      } else if (mustPass(state, 0)) {
        // Must pass
        inputLocked = false;
        schedulePass('You have no matching tile — passing.');
        return;
      }
    }
    
    // Player has legal moves, sync scene with legal moves
    scene.sync(state, legal, true);
    inputLocked = false;
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
    
    // CPU may need to draw multiple tiles until it can play or boneyard is empty
    let drewCount = 0;
    while (canDraw(state, 1) && getLegalMoves(state, 1).length === 0) {
      state = drawFromBoneyard(state, 1);
      drewCount++;
    }
    
    if (drewCount > 0) {
      showToast(`CPU drew ${drewCount} tile${drewCount > 1 ? 's' : ''} from boneyard.`);
    }

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
    const result = dealHandsWithBoneyard(deck, 2);
    previewHands = result.hands;
    previewBoneyard = result.boneyard;
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
      boneyard: previewBoneyard,
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
