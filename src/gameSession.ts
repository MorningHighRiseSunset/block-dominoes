import {
  applyMove,
  applyPass,
  getLegalMoves,
  isLegalMove,
  handPipCount,
  mustPass,
  newGame,
  newGameWithSetup,
  pipLabel,
  type BlockDominoesState,
  type BlockMove,
  type Pip,
} from './game/blockDominoes';
import { runAiTurn } from './game/blockDominoesAi';
import { playPlaceSound, unlockAudio } from './audio/sounds';
import { BlockDominoScene } from './render/blockDominoScene';

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
  const btnBig6 = document.getElementById('btn-big6')!;
  const btnBig5 = document.getElementById('btn-big5')!;
  const btnBig4 = document.getElementById('btn-big4')!;
  const btnNoDouble = document.getElementById('btn-nodouble')!;

  function openInstructions() {
    instructionsModal.classList.remove('hidden');
  }

  function closeInstructions() {
    instructionsModal.classList.add('hidden');
  }

  function openSetupModal() {
    setupModal.classList.remove('hidden');
  }

  function closeSetupModal() {
    setupModal.classList.add('hidden');
  }

  function startGameWithSetup(playerHasDouble: { player: 0; double: Pip } | null) {
    closeSetupModal();
    state = newGameWithSetup(2, playerHasDouble);
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
        statusEl.textContent = 'No playable tile — passing…';
        hintEl.textContent = 'Block rules: no draw from the boneyard.';
        scene.sync(state, [], false);
        schedulePass();
        return;
      }
      statusEl.textContent = 'Your turn — select a tile, then click where to place it';
      hintEl.textContent =
        state.chain.length === 0
          ? 'Click a teal tile to select it, then click the highlighted spot to place.'
          : 'Click a teal tile to select it, then click a gold marker to choose placement.';
    } else {
      statusEl.textContent = 'CPU is thinking…';
      hintEl.textContent = `${state.hands[1].length} tile(s) hidden.`;
    }

    scene.sync(
      state,
      state.current === 0 ? legal : [],
      state.current === 0 && !inputLocked,
    );
  }

  function showGameOverOverlay() {
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

  function schedulePass() {
    if (passScheduled) return;
    passScheduled = true;
    inputLocked = true;
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
    }, 500);
  }

  function scheduleAi() {
    if (pendingAi) return;
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
    state = runAiTurn(state);

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
    // Show setup modal for traditional Big 6/4/5 question
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
