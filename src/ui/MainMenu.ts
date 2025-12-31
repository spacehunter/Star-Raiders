import { DifficultyLevel } from '../game/GameState';
import { Rank } from '../systems/ScoringSystem';

/**
 * MainMenu - Title screen and difficulty selection
 */
export class MainMenu {
  private container: HTMLElement;
  private menuElement: HTMLElement;
  private starfieldCanvas: HTMLCanvasElement;
  private animationId: number | null = null;
  private onStartCallback: ((difficulty: DifficultyLevel) => void) | null = null;

  private selectedDifficulty: DifficultyLevel = DifficultyLevel.NOVICE;

  constructor(container: HTMLElement) {
    this.container = container;
    this.menuElement = this.createMenu();
    this.starfieldCanvas = this.createStarfield();

    this.container.appendChild(this.starfieldCanvas);
    this.container.appendChild(this.menuElement);

    this.addStyles();
    this.startStarfieldAnimation();
  }

  /**
   * Create the starfield canvas
   */
  private createStarfield(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.className = 'menu-starfield';
    return canvas;
  }

  /**
   * Start the warp speed starfield animation
   */
  private startStarfieldAnimation(): void {
    const ctx = this.starfieldCanvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas
    const resize = () => {
      this.starfieldCanvas.width = window.innerWidth;
      this.starfieldCanvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    // Star data
    const stars: { x: number; y: number; z: number }[] = [];
    const numStars = 400;
    const speed = 2;

    // Initialize stars
    for (let i = 0; i < numStars; i++) {
      stars.push({
        x: (Math.random() - 0.5) * window.innerWidth * 2,
        y: (Math.random() - 0.5) * window.innerHeight * 2,
        z: Math.random() * window.innerWidth
      });
    }

    const animate = () => {
      // Clear background (with fade effect for trails)
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, this.starfieldCanvas.width, this.starfieldCanvas.height);

      const cx = this.starfieldCanvas.width / 2;
      const cy = this.starfieldCanvas.height / 2;

      ctx.fillStyle = '#FFFFFF';

      for (let i = 0; i < numStars; i++) {
        const star = stars[i];

        // Move star closer
        star.z -= speed;

        // Reset if passed viewer
        if (star.z <= 0) {
          star.x = (Math.random() - 0.5) * this.starfieldCanvas.width * 2;
          star.y = (Math.random() - 0.5) * this.starfieldCanvas.height * 2;
          star.z = this.starfieldCanvas.width;
        }

        // Project 3D position to 2D
        const k = 128.0 / star.z;
        const screenX = star.x * k + cx;
        const screenY = star.y * k + cy;

        // Draw star
        if (screenX >= 0 && screenX < this.starfieldCanvas.width &&
          screenY >= 0 && screenY < this.starfieldCanvas.height) {
          const size = (1 - star.z / this.starfieldCanvas.width) * 4;
          ctx.fillRect(screenX, screenY, size, size);
        }
      }

      this.animationId = requestAnimationFrame(animate);
    };

    animate();
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
        <p class="subtitle">A CLASSIC RECREATION</p>

        <div class="difficulty-section">
          <p class="section-title">SELECT DIFFICULTY</p>
          <div class="difficulty-options">
            <button class="difficulty-btn selected" data-difficulty="NOVICE">
              <span class="diff-name">NOVICE</span>
            </button>
            <button class="difficulty-btn" data-difficulty="PILOT">
              <span class="diff-name">PILOT</span>
            </button>
            <button class="difficulty-btn" data-difficulty="WARRIOR">
              <span class="diff-name">WARRIOR</span>
            </button>
            <button class="difficulty-btn" data-difficulty="COMMANDER">
              <span class="diff-name">COMMANDER</span>
            </button>
          </div>
        </div>

        <button class="start-btn">START MISSION</button>

        <div class="controls-section">
          <p class="section-title">CONTROLS</p>
          <div class="controls-grid">
            <span>MOUSE</span><span>AIM SHIP</span>
            <span>SPACE</span><span>FIRE</span>
            <span>0-9</span><span>SPEED</span>
            <span>S</span><span>SHIELDS</span>
            <span>F/A</span><span>VIEWS</span>
            <span>G</span><span>CHART</span>
            <span>L</span><span>SCAN</span>
            <span>H</span><span>WARP</span>
          </div>
        </div>
      </div>
    `;

    // Add event listeners (same as before)
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
      @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

      .menu-starfield {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 900;
        image-rendering: pixelated;
      }

      .main-menu {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Press Start 2P', monospace;
        image-rendering: pixelated;
      }

      .menu-content {
        text-align: center;
        width: 90vw;
        max-width: 80vh; /* Keep it constrained */
      }

      .game-title {
        font-size: 6vh;
        line-height: 1.2;
        margin-bottom: 2vh;
        
        /* Authentic "Star Raiders" Logo Style */
        color: #FFD700; /* Gold */
        background: -webkit-linear-gradient(#FFD700, #FF4500);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        filter: drop-shadow(0.5vh 0.5vh 0px #8B0000);
        transform: perspective(500px) rotateX(20deg); /* 3D tilt effect */
      }

      .subtitle {
        font-size: 2vh;
        color: #00FFFF;
        margin-bottom: 6vh;
        text-shadow: 0.25vh 0.25vh 0 #000;
        letter-spacing: 0.5vw;
      }

      .section-title {
        font-size: 2vh;
        color: #BAFF00;
        margin-bottom: 2vh;
        text-shadow: 0.25vh 0.25vh 0 #000;
      }

      .difficulty-options {
        display: flex;
        flex-direction: column;
        gap: 1.5vh;
        align-items: center;
        margin-bottom: 4vh;
      }

      .difficulty-btn {
        background: transparent;
        border: 0.5vh solid #55AAFF;
        padding: 1.5vh 4vw;
        cursor: pointer;
        width: 60%;
        font-family: 'Press Start 2P', monospace;
        color: #55AAFF;
        text-align: center;
        transition: all 0.2s;
        box-shadow: 0 0 0.5vh #55AAFF;
      }

      .difficulty-btn:hover {
        background: rgba(85, 170, 255, 0.2);
        color: #FFFFFF;
        border-color: #FFFFFF;
      }

      .difficulty-btn.selected {
        background: #55AAFF;
        color: #000000;
        border-color: #FFFFFF;
        box-shadow: 0 0 1.5vh #55AAFF;
        transform: scale(1.05);
      }

      .diff-name {
        font-size: 2vh;
      }

      .start-btn {
        background: #FF0000;
        border: 0.5vh solid #FF8888;
        color: #FFFFFF;
        font-size: 3vh;
        padding: 2vh 4vw;
        cursor: pointer;
        font-family: 'Press Start 2P', monospace;
        margin-bottom: 4vh;
        text-shadow: 0.25vh 0.25vh 0 #000;
        box-shadow: 0 0.5vh 0 #880000;
      }

      .start-btn:hover {
        background: #FF4444;
        transform: translateY(0.2vh);
        box-shadow: 0 0.3vh 0 #880000;
      }

      .start-btn:active {
        transform: translateY(0.5vh);
        box-shadow: none;
      }

      .controls-section {
        border-top: 0.5vh solid #55AAFF;
        padding-top: 2vh;
        width: 100%;
      }

      .controls-grid {
        display: grid;
        grid-template-columns: auto auto;
        gap: 1vh 4vw;
        font-size: 1.5vh;
        text-align: left;
        max-width: 80%;
        margin: 0 auto;
      }

      .controls-grid span:nth-child(odd) {
        color: #BAFF00;
        text-align: right;
      }

      .controls-grid span:nth-child(even) {
        color: #CEFFFF;
      }

      /* Game Over Screen Updates */
      .game-over-screen {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.9);
        z-index: 2000;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Press Start 2P', monospace;
        image-rendering: pixelated;
      }

      .game-over-content {
        text-align: center;
        padding: 4vh;
        border: 0.5vh solid #CEFFFF;
        background: #001030;
        width: 80vw;
        max-width: 80vh;
      }

      .game-over-title {
        font-size: 4vh;
        margin-bottom: 4vh;
        text-shadow: 0.5vh 0.5vh 0 #000;
      }
      
      .score-row {
        display: flex;
        justify-content: space-between;
        margin: 1vh 0;
        font-size: 2vh;
        color: #CEFFFF;
      }
      
      .rank-display {
        font-size: 3vh;
        color: #BAFF00;
        margin: 4vh 0;
        text-shadow: 0.25vh 0.25vh 0 #000;
      }
      
      .restart-btn {
        background: #55AAFF;
        border: 0.5vh solid #FFFFFF;
        color: #000000;
        font-size: 2vh;
        padding: 2vh 4vw;
        font-family: 'Press Start 2P', monospace;
        cursor: pointer;
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
    this.starfieldCanvas.style.display = 'block';
    if (!this.animationId) {
      this.startStarfieldAnimation();
    }
  }

  /**
   * Hide the menu
   */
  public hide(): void {
    this.menuElement.style.display = 'none';
    this.starfieldCanvas.style.display = 'none';
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Show game over screen (Updated for simple pass-through)
   */
  public showGameOver(
    victory: boolean,
    score: number,
    rank: Rank,
    breakdown: any,
    onRestart: () => void
  ): void {
    // Basic implementation for now, reusing new styles
    const screen = document.createElement('div');
    screen.className = 'game-over-screen';
    screen.innerHTML = `
      <div class="game-over-content">
        <h1 class="game-over-title" style="color: ${victory ? '#BAFF00' : '#FF0000'}">
          ${victory ? 'MISSION COMPLETE' : 'MISSION FAILED'}
        </h1>
        <div class="score-breakdown">
          <div class="score-row"><span>SCORE:</span><span>${score}</span></div>
        </div>
        <div class="rank-display">RANK: ${rank}</div>
        <button class="restart-btn">PLAY AGAIN</button>
      </div>
    `;

    screen.querySelector('.restart-btn')?.addEventListener('click', () => {
      screen.remove();
      this.show(); // Show main menu
      onRestart();
    });

    this.container.appendChild(screen);
  }

  public dispose(): void {
    this.menuElement.remove();
    this.starfieldCanvas.remove();
    document.getElementById('main-menu-styles')?.remove();
    if (this.animationId) cancelAnimationFrame(this.animationId);
  }
}
