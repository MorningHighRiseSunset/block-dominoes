import {
  applyMove,
  applyPass,
  getLegalMoves,
  isLegalMove,
  handPipCount,
  mustPass,
  newGame,
  pipLabel,
  type BlockDominoesState,
  type BlockMove,
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

  function openInstructions() {
    instructionsModal.classList.remove('hidden');
  }

  function closeInstructions() {
    instructionsModal.classList.add('hidden');
  }

  btnInstructions.addEventListener('click', openInstructions);
  btnCloseInstr.addEventListener('click', closeInstructions);
  btnInstrDone.addEventListener('click', closeInstructions);
  instructionsModal.addEventListener('click', (e) => {
    if (e.target === instructionsModal) closeInstructions();
  });
  btnBackLobby.addEventListener('click', onBackToLobby);

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
      statusEl.textContent = 'Your turn — drag a tile onto the board';
      hintEl.textContent =
        state.chain.length === 0
          ? 'Teal tiles are playable · drag the opener onto the highlighted spot in the center.'
          : 'Teal = playable · gold markers = valid drop zones · drag a tile onto them.';
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
    state = newGame();
    overlay.classList.add('hidden');
    btnNew.classList.add('hidden');
    inputLocked = false;
    pendingAi = false;
    passScheduled = false;
    updateHud();
    if (state.current === 1) scheduleAi();
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
