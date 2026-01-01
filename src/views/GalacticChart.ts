import { SectorSystem } from '../systems/SectorSystem';
import { GameState } from '../game/GameState';
import { EnergySystem } from '../systems/EnergySystem';
import { StarbaseAttackSystem } from '../systems/StarbaseAttackSystem';

/**
 * GalacticChart - 2D overlay displaying the 8x8 sector grid
 *authentic Atari 800 style
 */
export class GalacticChart {
  private container: HTMLElement;
  private chartElement: HTMLElement;
  private sectorSystem: SectorSystem;
  private gameState: GameState;
  private energySystem: EnergySystem;
  private starbaseAttackSystem: StarbaseAttackSystem | null = null;

  private cursorX: number = 4;
  private cursorY: number = 4;
  private isVisible: boolean = false;

  constructor(
    container: HTMLElement,
    sectorSystem: SectorSystem,
    gameState: GameState,
    energySystem: EnergySystem
  ) {
    this.container = container;
    this.sectorSystem = sectorSystem;
    this.gameState = gameState;
    this.energySystem = energySystem;

    this.chartElement = this.createChart();
    this.container.appendChild(this.chartElement);
    this.addStyles();

    // Initialize cursor to current sector
    this.cursorX = gameState.sectorX;
    this.cursorY = gameState.sectorY;

    // Hide initially
    this.hide();
  }

  /**
  /**
   * Create the chart HTML structure
   */
  private createChart(): HTMLElement {
    const chart = document.createElement('div');
    chart.className = 'galactic-chart';
    chart.innerHTML = `
      <div class="chart-header-bar">
        <span class="chart-title">GALACTIC CHART</span>
      </div>
      <div class="chart-main">
        <div class="chart-grid"></div>
      </div>
      <div class="chart-footer">
        <div class="footer-row top-row">
           <div class="info-group">
             <span class="label">WARP ENERGY:</span>
             <span class="value warp-cost">0000</span>
           </div>
           <div class="info-group">
             <span class="label">TARGETS:</span>
             <span class="value total-enemies">00</span>
           </div>
           <div class="info-group dc-group">
             <span class="label">DC:</span>
             <span class="dc-indicators">
                <span class="dc-char" data-sys="P">P</span>
                <span class="dc-char" data-sys="E">E</span>
                <span class="dc-char" data-sys="S">S</span>
                <span class="dc-char" data-sys="C">C</span>
                <span class="dc-char" data-sys="L">L</span>
                <span class="dc-char" data-sys="R">R</span>
             </span>
           </div>
        </div>
        <div class="footer-row bottom-row">
           <div class="info-group centered">
              <span class="label">STAR DATE:</span>
              <span class="value star-date">00.00</span>
           </div>
        </div>
      </div>
    `;

    // Create grid cells
    const grid = chart.querySelector('.chart-grid')!;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const cell = document.createElement('div');
        cell.className = 'chart-cell';
        cell.dataset.x = x.toString();
        cell.dataset.y = y.toString();
        grid.appendChild(cell);
      }
    }

    return chart;
  }

  /* Sprite Patterns (8x8 grids, X = pixel, . = empty) */
  private static readonly SPRITES = {
    STARBASE: [ // 5x5 centered
      ". . . . . . . .",
      ". . . . . . . .",
      ". . X . X . X .",
      ". . . X X X . .",
      ". . X X X X X .",
      ". . . X X X . .",
      ". . X . X . X .",
      ". . . . . . . ."
    ],
    ENEMY_1: [ // Left-pointing ship (centered, shifted down +1)
      ". . . . . . . .",
      ". . . . . . . .",
      ". . X X . . . .",
      ". . . X X . . .",
      ". . X X X X X .",
      ". . . X X . . .",
      ". . X X . . . .",
      ". . . . . . . ."
    ],
    ENEMY_2: [ // Three dashes (centered, shifted down +1)
      ". . . . . . . .",
      ". . . . . . . .",
      ". . . . X X X .",
      ". . . . . . . .",
      ". . X X X . . .",
      ". . . . . . . .",
      ". . . X X X . .",
      ". . . . . . . ."
    ],
    ENEMY_3: [ // Stacked dashes (centered, shifted down +1)
      ". . . . . . . .",
      ". . . . . . . .",
      ". . . X X . . .",
      ". . . . . . . .",
      ". . X X . X X .",
      ". . . . . . . .",
      ". . . . X X . .",
      ". . . . . . . ."
    ],
    ENEMY_4: [ // Diamond 4-fleet (centered, shifted down +1)
      ". . . . . . . .",
      ". . . . . . . .",
      ". . . X X . . .",
      ". . X X X X . .",
      ". X X . . X X .",
      ". . X X X X . .",
      ". . . X X . . .",
      ". . . . . . . ."
    ]
  };

  /**
   * Helper to generate box-shadow CSS from a pattern
   */
  private generateBoxShadow(pattern: string[], pixelSize: number = 0.4): string {
    let shadows: string[] = [];
    pattern.forEach((row, y) => {
      // Remove spaces to handle "X . X" formats if user adds extra spaces for readability
      // But standard format is likely "X" or "." character by character?
      // User said "string is an 8x8 string". Let's assume input is array of strings.
      // We'll iterate characters.
      const chars = row.replace(/\s+/g, '').split(''); // Remove whitespace delimiters if any

      chars.forEach((char, x) => {
        if (char === 'X') {
          // x * pixelSize, y * pixelSize
          shadows.push(`${x * pixelSize}vh ${y * pixelSize}vh 0 0 #CEFFFF`);
        }
      });
    });
    return shadows.join(',');
  }

  /**
   * Add CSS styles
   */
  private addStyles(): void {
    if (document.getElementById('galactic-chart-styles')) return;

    // Generate sprite CSS
    const starbaseShadow = this.generateBoxShadow(GalacticChart.SPRITES.STARBASE);
    const enemy1Shadow = this.generateBoxShadow(GalacticChart.SPRITES.ENEMY_1);
    const enemy2Shadow = this.generateBoxShadow(GalacticChart.SPRITES.ENEMY_2);
    const enemy3Shadow = this.generateBoxShadow(GalacticChart.SPRITES.ENEMY_3);
    const enemy4Shadow = this.generateBoxShadow(GalacticChart.SPRITES.ENEMY_4);

    const style = document.createElement('style');
    style.id = 'galactic-chart-styles';
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

      .galactic-chart {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: #2B608A; /* Authentic Atari Blue */
        z-index: 200;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        padding-bottom: 5vh;
        box-sizing: border-box;
        image-rendering: pixelated;
        font-family: 'Press Start 2P', monospace;
      }

      /* Black Header Bar */
      .chart-header-bar {
        width: 100%;
        background: #000000;
        padding: 2vh 0;
        margin-bottom: 2vh;
        text-align: center;
        border-bottom: 0.5vh solid #000;
      }

      .chart-title {
        font-size: 3.5vh;
        color: #CEFFFF; /* Light Cyan */
        text-transform: uppercase;
        letter-spacing: 0.5vw;
      }

      .chart-main {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
      }

      .chart-grid {
        display: grid;
        grid-template-columns: repeat(8, 1fr);
        grid-template-rows: repeat(8, 1fr);
        height: 65vh; /* Larger grid */
        width: 80vh;  /* Wide aspect ratio */
        background: transparent;
        border: 0.4vh solid #55AAFF;
        margin-top: 0.4vh; /* Up 1px */
        margin-left: 0.4vh; /* Right 1px (Adjusted from 0.8vh) */
      }

      .chart-cell {
        border: 0.4vh solid #55AAFF;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        background: transparent;
      }

      /* Active Cursor */
      .chart-cell.cursor {
        box-shadow: inset 0 0 0 0.5vh #BAFF00; /* Bright Green Highlighting */
        background-color: rgba(186, 255, 0, 0.2);
      }

      /* Footer Styling */
      .chart-footer {
        width: 90%;
        max-width: 1200px;
        color: #CEFFFF;
      }

      .footer-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5vh;
        font-size: 2.5vh;
      }

      .bottom-row {
        justify-content: center;
      }

      .info-group {
        display: flex;
        gap: 1.5vw;
        align-items: center;
      }

      .label { color: #CEFFFF; }
      .value { color: #CEFFFF; } 

      /* DC Indicators */
      .dc-group { display: flex; gap: 1vw; }
      .dc-indicators {
        display: flex;
        gap: 0.5vw;
      }
      .dc-char { color: #CEFFFF; }
      .dc-char.damaged { color: #FF5555; }
      .dc-char.destroyed { color: #000000; text-shadow: none; }

      /* --- SPRITES --- */
      /* 
         Sprite Container: Explicit 8x8 Grid Size 
         Grid Unit = 0.4vh
         Size = 8 * 0.4vh = 3.2vh
      */
      .sprite {
        position: relative; /* Relative to cell (which is flex centered) */
        width: 3.2vh; 
        height: 3.2vh;
        background: transparent;
        transform: scale(2.8); /* Scale the whole 8x8 grid */
        top: -0.4vh; /* Counteract grid 0.4vh */
        left: -0.4vh; /* Counteract grid 0.4vh */
      }
      
      /* The Pixel Renderer */
      .sprite::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 0.4vh; 
        height: 0.4vh;
        background: transparent;
        /* box-shadow will be applied here dynamically */
      }

      .starbase-sprite::after {
        box-shadow: ${starbaseShadow};
        color: #CEFFFF;
      }
      
      .starbase-attacked .starbase-sprite::after {
        animation: blink-shadow 0.5s infinite;
      }

      @keyframes blink-shadow {
        0%, 100% {
          color: #FF0000;
          box-shadow: ${starbaseShadow.replace(/#CEFFFF/g, '#FF0000')};
        }
        50% {
          color: #FF0000;
          box-shadow: none;
        }
      }

      /* Starbase being strategically targeted (enemies moving to surround) */
      .starbase-targeted {
        background-color: rgba(255, 165, 0, 0.15);
      }

      .starbase-targeted .starbase-sprite::after {
        box-shadow: ${starbaseShadow.replace(/#CEFFFF/g, '#FFA500')};
        animation: pulse-orange 1.5s infinite;
      }

      @keyframes pulse-orange {
        0%, 100% {
          box-shadow: ${starbaseShadow.replace(/#CEFFFF/g, '#FFA500')};
        }
        50% {
          box-shadow: ${starbaseShadow.replace(/#CEFFFF/g, '#FF6600')};
        }
      }

      /* Starbase surrounded (destruction countdown active) */
      .starbase-surrounded {
        background-color: rgba(255, 0, 0, 0.25);
        animation: danger-pulse 0.5s infinite;
      }

      .starbase-surrounded .starbase-sprite::after {
        box-shadow: ${starbaseShadow.replace(/#CEFFFF/g, '#FF0000')};
        animation: rapid-blink 0.25s infinite;
      }

      @keyframes danger-pulse {
        0%, 100% { background-color: rgba(255, 0, 0, 0.25); }
        50% { background-color: rgba(255, 0, 0, 0.5); }
      }

      @keyframes rapid-blink {
        0%, 100% {
          box-shadow: ${starbaseShadow.replace(/#CEFFFF/g, '#FF0000')};
        }
        50% {
          box-shadow: ${starbaseShadow.replace(/#CEFFFF/g, '#FFFF00')};
        }
      }

      .enemy-sprite.count-1::after {
        box-shadow: ${enemy1Shadow};
      }
      
      .enemy-sprite.count-2::after {
        box-shadow: ${enemy2Shadow};
      }

      .enemy-sprite.count-3::after {
        box-shadow: ${enemy3Shadow};
      }

      .enemy-sprite.count-4::after {
        box-shadow: ${enemy4Shadow};
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Show the chart
   */
  public show(): void {
    this.isVisible = true;
    this.chartElement.style.display = 'flex';
    this.cursorX = this.gameState.sectorX;
    this.cursorY = this.gameState.sectorY;
    this.update();
  }

  /**
   * Hide the chart
   */
  public hide(): void {
    this.isVisible = false;
    this.chartElement.style.display = 'none';
  }

  /**
   * Toggle visibility
   */
  public toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Move cursor
   */
  public moveCursor(dx: number, dy: number): void {
    const newX = Math.max(0, Math.min(7, this.cursorX + dx));
    const newY = Math.max(0, Math.min(7, this.cursorY + dy));
    this.cursorX = newX;
    this.cursorY = newY;
    this.update();
  }

  /**
   * Get current cursor position
   */
  public getCursorPosition(): { x: number; y: number } {
    return { x: this.cursorX, y: this.cursorY };
  }

  /**
   * Check if chart is visible
   */
  public get visible(): boolean {
    return this.isVisible;
  }

  /**
   * Set the starbase attack system reference for displaying attack status
   */
  public setStarbaseAttackSystem(system: StarbaseAttackSystem): void {
    this.starbaseAttackSystem = system;
  }

  /**
   * Update the chart display
   */
  public update(): void {
    if (!this.isVisible) return;

    const cells = this.chartElement.querySelectorAll('.chart-cell');
    cells.forEach((cell) => {
      const cellEl = cell as HTMLElement;
      const x = parseInt(cellEl.dataset.x || '0');
      const y = parseInt(cellEl.dataset.y || '0');
      const sector = this.sectorSystem.getSector(x, y);

      // Reset classes
      cellEl.classList.remove('current-sector', 'cursor', 'has-starbase', 'starbase-attacked', 'starbase-targeted', 'starbase-surrounded');
      cellEl.textContent = '';

      // Clear any existing sprites
      cellEl.querySelectorAll('.sprite').forEach(sprite => sprite.remove());

      // Cursor position
      if (x === this.cursorX && y === this.cursorY) {
        cellEl.classList.add('cursor');
      }

      // Sector content
      // Original uses symbols: < (enemy), * (base), . (visited?), etc.
      // We will match the logic but use authentic styling.
      if (sector) {
        // Starbase
        if (sector.hasStarbase && !sector.starbaseDestroyed) {
          this.renderSprite(cellEl, 'starbase');
          cellEl.classList.add('has-starbase');

          // Check if this starbase is being strategically attacked
          if (this.starbaseAttackSystem) {
            const attack = this.starbaseAttackSystem.getCurrentAttack();
            if (attack && attack.targetSector.x === x && attack.targetSector.y === y) {
              cellEl.classList.add('starbase-targeted');
              if (attack.isSurrounded) {
                cellEl.classList.add('starbase-surrounded');
              }
            }
          }

          if (sector.enemies > 0) {
            cellEl.classList.add('starbase-attacked');
          }
        } else if (sector.enemies > 0) {
          // 1-3 enemies or fleet
          // Render specific enemy count sprite
          const count = Math.min(sector.enemies, 4); // Cap at 4 for sprite logic
          this.renderSprite(cellEl, 'enemy', count);
        }
      }
    });

    // Update Footer Info
    const warpCostEl = this.chartElement.querySelector('.warp-cost');
    const totalEnemiesEl = this.chartElement.querySelector('.total-enemies');
    const starDateEl = this.chartElement.querySelector('.star-date');

    // Warp Cost
    if (warpCostEl) {
      const cost = this.energySystem.calculateHyperwarpCost(
        this.gameState.sectorX,
        this.gameState.sectorY,
        this.cursorX,
        this.cursorY
      );
      warpCostEl.textContent = cost.toString().padStart(4, '0');
    }

    // Targets (Total Enemies Remaining in Galaxy)
    if (totalEnemiesEl) {
      // Assume totalRemaining = total - destroyed
      const remaining = this.gameState.totalEnemies - this.gameState.enemiesDestroyed;
      totalEnemiesEl.textContent = remaining.toString().padStart(2, '0');
    }

    // Star Date
    if (starDateEl) {
      starDateEl.textContent = this.gameState.starDate.toFixed(2);
    }

    // Damage Control (DC) Indicators
    const dcMap: Record<string, boolean> = {
      'P': this.gameState.damage.photonTorpedoes,
      'E': this.gameState.damage.engines,
      'S': this.gameState.damage.shields,
      'C': this.gameState.damage.attackComputer,
      'L': this.gameState.damage.longRangeScan,
      'R': this.gameState.damage.subSpaceRadio
    };

    const dcChars = this.chartElement.querySelectorAll('.dc-char');
    dcChars.forEach((el) => {
      const char = (el as HTMLElement).dataset.sys!;
      const isDamaged = dcMap[char];

      el.classList.remove('damaged', 'destroyed');
      if (isDamaged) {
        el.classList.add('damaged');
      }
    });
  }

  /**
   * Render a pixel art sprite into a cell
   */
  private renderSprite(container: HTMLElement, type: 'starbase' | 'enemy', count: number = 1): void {
    const sprite = document.createElement('div');
    sprite.className = `sprite ${type}-sprite count-${count}`;

    if (type === 'enemy') {
      // Create pips for each enemy (up to 4 for visual stack)
      const visualCount = Math.min(count, 4);
      for (let i = 0; i < visualCount; i++) {
        const pip = document.createElement('div');
        pip.className = 'enemy-pip';
        sprite.appendChild(pip);
      }
    }

    container.appendChild(sprite);
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    if (this.chartElement.parentElement) {
      this.chartElement.parentElement.removeChild(this.chartElement);
    }
    const styles = document.getElementById('galactic-chart-styles');
    if (styles) {
      styles.remove();
    }
  }
}
