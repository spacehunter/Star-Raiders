import './style.css';
import { Game } from './game/Game';
import { MainMenu } from './ui/MainMenu';
import { DifficultyLevel } from './game/GameState';
import { installDebugHook } from './core/debug';
import type { MissionRating } from './sim/rating';

/**
 * GameManager - Handles game lifecycle and menu transitions
 */
class GameManager {
  private container: HTMLElement;
  private mainMenu: MainMenu;
  private game: Game | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.mainMenu = new MainMenu(container);

    // Set up menu callback
    this.mainMenu.onStart((difficulty) => {
      this.startGame(difficulty);
    });

    // Show menu initially
    this.mainMenu.show();
  }

  /**
   * Start a new game with selected difficulty
   */
  public getGame(): Game | null {
    return this.game;
  }

  public startGame(difficulty: DifficultyLevel): void {
    // Clean up existing game if any
    if (this.game) {
      this.game.dispose();
      this.game = null;
    }

    // Create new game
    this.game = new Game(this.container, difficulty, (rating) => {
      this.handleGameOver(rating);
    });
    this.game.start();
  }

  public hideMenu(): void {
    this.mainMenu.hide();
  }

  /**
   * Handle game over
   */
  private handleGameOver(rating: MissionRating): void {
    this.mainMenu.showGameOver(rating, () => {
      this.mainMenu.show();
    });
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('game-container');
  if (!container) {
    console.error('Game container not found');
    return;
  }

  const manager = new GameManager(container);

  if (new URLSearchParams(window.location.search).get('debug') === '1') {
    installDebugHook({
      getGame: () => manager.getGame(),
      startGame: (difficulty) => {
        manager.hideMenu();
        manager.startGame(difficulty);
      },
    });
  }
});
