import './style.css';
import { Game } from './game/Game';

// Initialize the game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('game-container');
  if (!container) {
    console.error('Game container not found');
    return;
  }

  const game = new Game(container);
  game.start();
});
