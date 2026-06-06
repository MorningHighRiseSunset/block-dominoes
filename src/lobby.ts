import { unlockAudio } from './audio/sounds';
import { LobbyScene } from './render/lobbyScene';

export interface LobbyCallbacks {
  onSinglePlayer: () => void;
}

export function initLobby(callbacks: LobbyCallbacks) {
  const lobbyEl = document.getElementById('lobby')!;
  const lobbyCanvas = document.getElementById('lobby-canvas') as HTMLCanvasElement;
  const btnSingle = document.getElementById('btn-single-player')!;
  const btnMulti = document.getElementById('btn-multiplayer')!;
  const btnLobbyInstr = document.getElementById('btn-lobby-instructions')!;
  const multiModal = document.getElementById('multiplayer-modal')!;
  const btnMultiClose = document.getElementById('btn-multi-close')!;

  const scene = new LobbyScene(lobbyCanvas);
  scene.start();

  function showMultiplayerModal() {
    multiModal.classList.remove('hidden');
  }

  function hideMultiplayerModal() {
    multiModal.classList.add('hidden');
  }

  btnSingle.addEventListener('click', () => {
    unlockAudio();
    callbacks.onSinglePlayer();
  });

  btnMulti.addEventListener('click', () => {
    unlockAudio();
    showMultiplayerModal();
  });

  btnLobbyInstr.addEventListener('click', () => {
    document.getElementById('instructions')?.classList.remove('hidden');
  });

  btnMultiClose.addEventListener('click', hideMultiplayerModal);
  multiModal.addEventListener('click', (e) => {
    if (e.target === multiModal) hideMultiplayerModal();
  });

  return {
    show() {
      lobbyEl.classList.remove('hidden');
      scene.start();
      scene.resize();
    },
    hide() {
      lobbyEl.classList.add('hidden');
      scene.stop();
      hideMultiplayerModal();
    },
  };
}
