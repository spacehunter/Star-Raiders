import './style.css';
import { Game } from './game/Game';
import { MainMenu } from './ui/MainMenu';
import { DifficultyLevel } from './game/GameState';

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
  private startGame(difficulty: DifficultyLevel): void {
    // Clean up existing game if any
    if (this.game) {
      this.game.dispose();
      this.game = null;
    }

    // Create new game
    this.game = new Game(this.container, difficulty, (victory, score, rank, breakdown) => {
      this.handleGameOver(victory, score, rank, breakdown);
    });
    this.game.start();
  }

  /**
   * Handle game over
   */
  private handleGameOver(
    victory: boolean,
    score: number,
    rank: string,
    breakdown: {
      enemyScore: number;
      timeBonus: number;
      energyBonus: number;
      starbasePenalty: number;
    }
  ): void {
    this.mainMenu.showGameOver(victory, score, rank as any, breakdown, () => {
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

  new GameManager(container);
});
