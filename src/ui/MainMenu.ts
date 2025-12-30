import { DifficultyLevel } from '../game/GameState';
import { Rank } from '../systems/ScoringSystem';

/**
 * MainMenu - Title screen and difficulty selection
 */
export class MainMenu {
  private container: HTMLElement;
  private menuElement: HTMLElement;
  private onStartCallback: ((difficulty: DifficultyLevel) => void) | null = null;

  private selectedDifficulty: DifficultyLevel = DifficultyLevel.NOVICE;

  constructor(container: HTMLElement) {
    this.container = container;
    this.menuElement = this.createMenu();
    this.container.appendChild(this.menuElement);
    this.addStyles();
  }

  /**
   * Create the menu HTML
   */
  private createMenu(): HTMLElement {
    const menu = document.createElement('div');
    menu.className = 'main-menu';
    menu.innerHTML = `
      <div class="menu-content">
        <h1 class="game-title">STAR RAIDERS</h1>
        <p class="subtitle">A Classic Recreation</p>

        <div class="difficulty-section">
          <p class="section-title">SELECT DIFFICULTY</p>
          <div class="difficulty-options">
            <button class="difficulty-btn selected" data-difficulty="NOVICE">
              <span class="diff-name">NOVICE</span>
              <span class="diff-desc">24 enemies • No damage</span>
            </button>
            <button class="difficulty-btn" data-difficulty="PILOT">
              <span class="diff-name">PILOT</span>
              <span class="diff-desc">36 enemies • Damage active</span>
            </button>
            <button class="difficulty-btn" data-difficulty="WARRIOR">
              <span class="diff-name">WARRIOR</span>
              <span class="diff-desc">45 enemies • Aggressive AI</span>
            </button>
            <button class="difficulty-btn" data-difficulty="COMMANDER">
              <span class="diff-name">COMMANDER</span>
              <span class="diff-desc">60 enemies • Maximum challenge</span>
            </button>
          </div>
        </div>

        <button class="start-btn">START MISSION</button>

        <div class="controls-section">
          <p class="section-title">CONTROLS</p>
          <div class="controls-grid">
            <span>MOUSE</span><span>Aim ship</span>
            <span>SPACE</span><span>Fire torpedoes</span>
            <span>0-9</span><span>Engine speed</span>
            <span>S</span><span>Toggle shields</span>
            <span>F/A</span><span>Front/Aft view</span>
            <span>G</span><span>Galactic Chart</span>
            <span>L</span><span>Long Range Scan</span>
            <span>H</span><span>Hyperwarp</span>
            <span>T/M</span><span>Target selection</span>
          </div>
        </div>
      </div>
    `;

    // Add event listeners
    const buttons = menu.querySelectorAll('.difficulty-btn');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        buttons.forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedDifficulty = (btn as HTMLElement).dataset.difficulty as DifficultyLevel;
      });
    });

    const startBtn = menu.querySelector('.start-btn');
    startBtn?.addEventListener('click', () => {
      this.hide();
      if (this.onStartCallback) {
        this.onStartCallback(this.selectedDifficulty);
      }
    });

    return menu;
  }

  /**
   * Add CSS styles
   */
  private addStyles(): void {
    if (document.getElementById('main-menu-styles')) return;

    const style = document.createElement('style');
    style.id = 'main-menu-styles';
    style.textContent = `
      .main-menu {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: radial-gradient(ellipse at center, #001030 0%, #000000 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        font-family: 'Courier New', monospace;
        color: #00ffff;
      }

      .menu-content {
        text-align: center;
        max-width: 600px;
        padding: 20px;
      }

      .game-title {
        font-size: 48px;
        font-weight: bold;
        color: #ffffff;
        text-shadow: 0 0 20px #00ffff, 0 0 40px #0066ff;
        margin-bottom: 5px;
        letter-spacing: 8px;
      }

      .subtitle {
        font-size: 14px;
        color: #008888;
        margin-bottom: 40px;
      }

      .section-title {
        font-size: 12px;
        color: #008888;
        margin-bottom: 15px;
        letter-spacing: 2px;
      }

      .difficulty-section {
        margin-bottom: 30px;
      }

      .difficulty-options {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .difficulty-btn {
        background: rgba(0, 40, 60, 0.8);
        border: 2px solid #004060;
        padding: 12px 20px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: all 0.2s;
      }

      .difficulty-btn:hover {
        border-color: #00ffff;
        background: rgba(0, 60, 80, 0.8);
      }

      .difficulty-btn.selected {
        border-color: #00ff00;
        background: rgba(0, 80, 40, 0.8);
      }

      .diff-name {
        font-size: 16px;
        font-weight: bold;
        color: #ffffff;
      }

      .diff-desc {
        font-size: 11px;
        color: #00ffff;
      }

      .start-btn {
        background: linear-gradient(to bottom, #004080, #002040);
        border: 3px solid #00ffff;
        color: #ffffff;
        font-size: 20px;
        font-weight: bold;
        padding: 15px 50px;
        cursor: pointer;
        font-family: 'Courier New', monospace;
        letter-spacing: 3px;
        transition: all 0.2s;
        margin-bottom: 30px;
      }

      .start-btn:hover {
        background: linear-gradient(to bottom, #0060a0, #003060);
        border-color: #ffffff;
        box-shadow: 0 0 20px rgba(0, 255, 255, 0.5);
      }

      .controls-section {
        border-top: 1px solid #004040;
        padding-top: 20px;
      }

      .controls-grid {
        display: grid;
        grid-template-columns: auto auto;
        gap: 5px 20px;
        font-size: 11px;
        text-align: left;
        max-width: 300px;
        margin: 0 auto;
      }

      .controls-grid span:nth-child(odd) {
        color: #ffff00;
        font-weight: bold;
        text-align: right;
      }

      .controls-grid span:nth-child(even) {
        color: #00ffff;
      }

      /* Game Over Screen */
      .game-over-screen {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        font-family: 'Courier New', monospace;
        color: #00ffff;
      }

      .game-over-content {
        text-align: center;
        padding: 40px;
        border: 3px solid #00ffff;
        background: rgba(0, 20, 40, 0.95);
      }

      .game-over-title {
        font-size: 36px;
        font-weight: bold;
        margin-bottom: 20px;
      }

      .game-over-title.victory {
        color: #00ff00;
      }

      .game-over-title.defeat {
        color: #ff0000;
      }

      .score-breakdown {
        text-align: left;
        margin: 20px 0;
        font-size: 14px;
      }

      .score-row {
        display: flex;
        justify-content: space-between;
        margin: 5px 0;
        padding: 5px 10px;
      }

      .score-row.total {
        border-top: 2px solid #00ffff;
        margin-top: 15px;
        padding-top: 15px;
        font-size: 18px;
        font-weight: bold;
      }

      .rank-display {
        font-size: 24px;
        font-weight: bold;
        color: #ffff00;
        margin: 20px 0;
      }

      .restart-btn {
        background: linear-gradient(to bottom, #004080, #002040);
        border: 2px solid #00ffff;
        color: #ffffff;
        font-size: 16px;
        padding: 10px 30px;
        cursor: pointer;
        font-family: 'Courier New', monospace;
        margin-top: 20px;
      }

      .restart-btn:hover {
        background: linear-gradient(to bottom, #0060a0, #003060);
        border-color: #ffffff;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Set callback for when game starts
   */
  public onStart(callback: (difficulty: DifficultyLevel) => void): void {
    this.onStartCallback = callback;
  }

  /**
   * Show the menu
   */
  public show(): void {
    this.menuElement.style.display = 'flex';
  }

  /**
   * Hide the menu
   */
  public hide(): void {
    this.menuElement.style.display = 'none';
  }

  /**
   * Show game over screen
   */
  public showGameOver(
    victory: boolean,
    score: number,
    rank: Rank,
    breakdown: {
      enemyScore: number;
      timeBonus: number;
      energyBonus: number;
      starbasePenalty: number;
    },
    onRestart: () => void
  ): void {
    // Remove existing game over screen if any
    const existing = this.container.querySelector('.game-over-screen');
    if (existing) {
      existing.remove();
    }

    const screen = document.createElement('div');
    screen.className = 'game-over-screen';
    screen.innerHTML = `
      <div class="game-over-content">
        <h1 class="game-over-title ${victory ? 'victory' : 'defeat'}">
          ${victory ? 'MISSION COMPLETE' : 'MISSION FAILED'}
        </h1>

        <div class="score-breakdown">
          <div class="score-row">
            <span>Enemies Destroyed:</span>
            <span>+${breakdown.enemyScore}</span>
          </div>
          <div class="score-row">
            <span>Time Bonus:</span>
            <span>+${breakdown.timeBonus}</span>
          </div>
          <div class="score-row">
            <span>Energy Efficiency:</span>
            <span>+${breakdown.energyBonus}</span>
          </div>
          ${breakdown.starbasePenalty > 0 ? `
          <div class="score-row">
            <span>Starbases Lost:</span>
            <span style="color: #ff0000">-${breakdown.starbasePenalty}</span>
          </div>
          ` : ''}
          <div class="score-row total">
            <span>TOTAL SCORE:</span>
            <span>${score}</span>
          </div>
        </div>

        <div class="rank-display">
          RANK: ${rank}
        </div>

        <button class="restart-btn">PLAY AGAIN</button>
      </div>
    `;

    const restartBtn = screen.querySelector('.restart-btn');
    restartBtn?.addEventListener('click', () => {
      screen.remove();
      onRestart();
    });

    this.container.appendChild(screen);
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    if (this.menuElement.parentElement) {
      this.menuElement.parentElement.removeChild(this.menuElement);
    }
    const gameOver = this.container.querySelector('.game-over-screen');
    if (gameOver) {
      gameOver.remove();
    }
    const styles = document.getElementById('main-menu-styles');
    if (styles) {
      styles.remove();
    }
  }
}
