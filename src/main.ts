import { initGameSession } from './gameSession';
import { initLobby } from './lobby';

declare global {
  interface Window {
    __dominoesReady?: boolean;
  }
}
window.__dominoesReady = true;

const gameScreen = document.getElementById('game-screen')!;
const gameCanvas = document.getElementById('game-canvas') as HTMLCanvasElement;

let game: ReturnType<typeof initGameSession> | null = null;

const lobby = initLobby({
  onSinglePlayer() {
    lobby.hide();
    gameScreen.classList.remove('hidden');
    if (!game) {
      game = initGameSession(gameCanvas, () => {
        game?.pause();
        gameScreen.classList.add('hidden');
        document.getElementById('overlay')?.classList.add('hidden');
        lobby.show();
      });
    }
    game.start();
  },
});

lobby.show();
