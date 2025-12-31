import { SectorSystem } from '../systems/SectorSystem';
import { GameState } from '../game/GameState';
import { EnergySystem } from '../systems/EnergySystem';

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
   * Create the chart HTML structure
   */
  private createChart(): HTMLElement {
    const chart = document.createElement('div');
    chart.className = 'galactic-chart';
    chart.innerHTML = `
      <div class="chart-header">
        <span class="chart-title">GALACTIC CHART</span>
      </div>
      <div class="chart-container">
        <div class="chart-grid"></div>
      </div>
      <div class="chart-footer">
        <div class="footer-row">
          <div class="footer-col">
             <span class="label">WARP ENERGY:</span>
             <span class="value warp-cost">0000</span>
          </div>
          <div class="footer-col" style="flex: 2; text-align: center;">
             <span class="label">TARGETS:</span>
             <span class="value total-enemies">00</span>
          </div>
          <div class="footer-col dc-col">
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
        <div class="footer-row">
           <div class="footer-col">
              <span class="label">STAR DATE:</span>
              <span class="value star-date">00.00</span>
           </div>
           <div class="footer-col" style="text-align: right;">
              <!-- Empty or extra info -->
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

  /**
   * Add CSS styles
   */
  private addStyles(): void {
    if (document.getElementById('galactic-chart-styles')) return;

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
        background: #2B608A;
        z-index: 200;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        padding-top: 2vh;
        box-sizing: border-box;
        image-rendering: pixelated;
      }

      .chart-header {
        margin-bottom: 1vh;
        width: 100%;
        text-align: center;
      }

      .chart-title {
        font-family: 'Press Start 2P', monospace;
        font-size: 3vh;
        color: #CEFFFF;
        text-shadow: 0.5vh 0.5vh 0 #000;
        text-transform: uppercase;
      }

      .chart-container {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        max-height: 70vh;
      }

      .chart-grid {
        display: grid;
        grid-template-columns: repeat(8, 1fr);
        grid-template-rows: repeat(8, 1fr);
        height: 60vh;
        width: 60vh; 
        gap: 0;
        border: 0.5vh solid #CEFFFF;
        background: transparent;
      }

      .chart-cell {
        border: 0.25vh solid #55AAFF;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Press Start 2P', monospace;
        font-size: 2vh;
        color: #CEFFFF;
        position: relative;
        text-shadow: 0.25vh 0.25vh 0 #000;
      }

      .chart-cell.cursor {
        background-color: rgba(206, 255, 255, 0.3);
        box-shadow: inset 0 0 0 4px #FFFF00;
      }

      .chart-cell.has-starbase {
        color: #BAFF00; /* Green/Yellow for starbase */
        font-size: 32px;
      }
      
      .chart-cell.starbase-attacked {
        color: #FF0000;
        animation: blink 0.5s infinite;
      }

      @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
      }

      .chart-footer {
        width: 80%;
        max-width: 800px;
        margin-bottom: 40px;
        font-family: 'Press Start 2P', monospace;
        color: #CEFFFF;
      }

      .footer-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 20px;
        font-size: 20px;
      }

      .footer-col {
        display: flex;
        gap: 15px;
        align-items: center;
      }

      .label {
        color: #CEFFFF;
      }

      .value {
        color: #BAFF00;
      }
      
      .dc-indicators {
        display: flex;
        gap: 8px;
        background: #000; /* DC usually has black back? Or transparent */
        padding: 0 5px;
      }
      
      .dc-char {
        color: #BAFF00; /* Green = OK */
      }
      
      .dc-char.damaged {
        color: #FF5555; /* Red = Damaged */
      }
      
      .dc-char.destroyed {
        color: #000000;
        text-shadow: none;
        opacity: 0.2;
      }
      
      /* Sprites */
      .sprite {
        width: 1px;
        height: 1px;
        position: absolute;
      }
      
      /* Starbase Sprite - Authentic 8-point star */
      /* Pattern from screenshot: 3x3 core with 1px tips ? */
      /* Looks like a 5x5 grid:
         . . X . .
         . X X X .
         X X X X X
         . X X X .
         . . X . .
         Color appears light blue/white in screenshot, not yellow.
      */
      .starbase-sprite {
        background: transparent;
        color: #CEFFFF; /* Light Cyan/White */
        transform: scale(4); /* Larger scale */
        box-shadow: 
          0 0 0 1px, /* Center */
          0 -2px 0 0, /* Top tip */
          0 2px 0 0, /* Bot tip */
          -2px 0 0 0, /* Left tip */
          2px 0 0 0, /* Right tip */
          -1px -1px 0 0, 0px -1px 0 0, 1px -1px 0 0,
          -1px 0 0 0, 1px 0 0 0,
          -1px 1px 0 0, 0px 1px 0 0, 1px 1px 0 0;
      }
      
      /* Enemy Sprite (Zylon Fighter) */
      .enemy-sprite {
         color: #FFFFFF;
         transform: scale(4);
      }
      
      /* 1 Enemy: Left-facing fighter shape */
      /*
        . X .
        X X .
        X X X  <-- Wing back?
        X X .
        . X .
      */
      .enemy-sprite.count-1 {
         box-shadow:
           0 0 0 1px,
           -1px 0 0 0, 
           0 -1px 0 0, -1px -1px 0 0,
           0 1px 0 0, -1px 1px 0 0,
           1px 0 0 0; /* Nose */
      }
      
      /* 2 Enemies: Two small blips */
      .enemy-sprite.count-2 {
         box-shadow:
           -2px -2px 0 1px,
           2px 2px 0 1px;
      }
      
      /* 3 Enemies: Three blips */
      .enemy-sprite.count-3 {
        box-shadow:
           -2px -3px 0 1px,
           2px -3px 0 1px,
           0px 2px 0 1px;
      }
      
      /* Fleet (4+): Four blips block */
      .enemy-sprite.count-4 {
         box-shadow:
            -2px -2px 0 1px, 2px -2px 0 1px,
            -2px 2px 0 1px, 2px 2px 0 1px;
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
      cellEl.classList.remove('current-sector', 'cursor', 'has-starbase', 'starbase-attacked');
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
