import { SectorSystem } from '../systems/SectorSystem';
import { GameState } from '../game/GameState';
import { EnergySystem } from '../systems/EnergySystem';

/**
 * GalacticChart - 2D overlay displaying the 8x8 sector grid
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
      <div class="chart-grid"></div>
      <div class="chart-info">
        <div class="info-row">
          <span class="info-label">CURSOR:</span>
          <span class="info-value cursor-pos">4,4</span>
        </div>
        <div class="info-row">
          <span class="info-label">ENEMIES:</span>
          <span class="info-value sector-enemies">0</span>
        </div>
        <div class="info-row">
          <span class="info-label">HYPERWARP COST:</span>
          <span class="info-value warp-cost">0</span>
        </div>
      </div>
      <div class="chart-legend">
        <span>* STARBASE</span>
        <span>&lt; 1 ENEMY</span>
        <span>= 2 ENEMIES</span>
        <span>&gt; 3 ENEMIES</span>
        <span>\u2265 FLEET</span>
      </div>
      <div class="chart-controls">
        <span>ARROWS: MOVE CURSOR</span>
        <span>H: HYPERWARP</span>
        <span>G: CLOSE</span>
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
      .galactic-chart {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 20, 40, 0.95);
        border: 3px solid #00ffff;
        padding: 20px;
        font-family: 'Courier New', monospace;
        color: #00ffff;
        z-index: 200;
        min-width: 400px;
      }

      .chart-header {
        text-align: center;
        margin-bottom: 15px;
      }

      .chart-title {
        font-size: 18px;
        font-weight: bold;
        color: #ffffff;
        text-transform: uppercase;
        letter-spacing: 4px;
      }

      .chart-grid {
        display: grid;
        grid-template-columns: repeat(8, 40px);
        grid-template-rows: repeat(8, 40px);
        gap: 2px;
        background: #001a1a;
        padding: 5px;
        border: 1px solid #008888;
        margin-bottom: 15px;
      }

      .chart-cell {
        background: #002030;
        border: 1px solid #004040;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        font-weight: bold;
        color: #00ffff;
        position: relative;
      }

      .chart-cell.current-sector {
        background: #004060;
        border-color: #00ffff;
      }

      .chart-cell.cursor {
        box-shadow: inset 0 0 0 2px #ffff00;
        animation: cursor-blink 0.5s infinite;
      }

      @keyframes cursor-blink {
        0%, 100% { box-shadow: inset 0 0 0 2px #ffff00; }
        50% { box-shadow: inset 0 0 0 2px #888800; }
      }

      .chart-cell.has-starbase {
        color: #00ff00;
      }

      .chart-cell.starbase-attacked {
        color: #ff0000;
        animation: attack-blink 0.3s infinite;
      }

      @keyframes attack-blink {
        0%, 100% { color: #ff0000; }
        50% { color: #ff8800; }
      }

      .chart-info {
        display: flex;
        flex-direction: column;
        gap: 5px;
        margin-bottom: 15px;
        padding: 10px;
        background: #001520;
        border: 1px solid #004040;
      }

      .info-row {
        display: flex;
        justify-content: space-between;
      }

      .info-label {
        color: #008888;
        font-size: 12px;
      }

      .info-value {
        color: #00ff00;
        font-size: 14px;
        font-weight: bold;
      }

      .chart-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        font-size: 10px;
        color: #008888;
        margin-bottom: 10px;
      }

      .chart-controls {
        display: flex;
        gap: 15px;
        font-size: 10px;
        color: #ffff00;
        justify-content: center;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Show the chart
   */
  public show(): void {
    this.isVisible = true;
    this.chartElement.style.display = 'block';
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

      // Current player sector
      if (x === this.gameState.sectorX && y === this.gameState.sectorY) {
        cellEl.classList.add('current-sector');
      }

      // Cursor position
      if (x === this.cursorX && y === this.cursorY) {
        cellEl.classList.add('cursor');
      }

      // Sector content
      if (sector) {
        const symbol = this.sectorSystem.getSectorSymbol(x, y);
        cellEl.textContent = symbol;

        if (sector.hasStarbase && !sector.starbaseDestroyed) {
          cellEl.classList.add('has-starbase');
          if (sector.enemies > 0) {
            cellEl.classList.add('starbase-attacked');
          }
        }
      }
    });

    // Update info panel
    const cursorPos = this.chartElement.querySelector('.cursor-pos');
    const sectorEnemies = this.chartElement.querySelector('.sector-enemies');
    const warpCost = this.chartElement.querySelector('.warp-cost');

    if (cursorPos) {
      cursorPos.textContent = `${this.cursorX},${this.cursorY}`;
    }

    const sector = this.sectorSystem.getSector(this.cursorX, this.cursorY);
    if (sectorEnemies && sector) {
      sectorEnemies.textContent = sector.enemies.toString();
    }

    if (warpCost) {
      const cost = this.energySystem.calculateHyperwarpCost(
        this.gameState.sectorX,
        this.gameState.sectorY,
        this.cursorX,
        this.cursorY
      );
      warpCost.textContent = cost.toString();
    }
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
