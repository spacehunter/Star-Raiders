import { SectorSystem } from '../systems/SectorSystem';
import { GameState } from '../game/GameState';

/**
 * LongRangeScan - Tactical view of current sector showing object positions
 */
export class LongRangeScan {
  private container: HTMLElement;
  private scanElement: HTMLElement;
  private sectorSystem: SectorSystem;
  private gameState: GameState;

  private isVisible: boolean = false;

  // Simulated object positions within sector
  private objectPositions: Array<{ type: 'enemy' | 'starbase'; x: number; y: number }> = [];

  constructor(
    container: HTMLElement,
    sectorSystem: SectorSystem,
    gameState: GameState
  ) {
    this.container = container;
    this.sectorSystem = sectorSystem;
    this.gameState = gameState;

    this.scanElement = this.createScan();
    this.container.appendChild(this.scanElement);
    this.addStyles();

    this.hide();
  }

  /**
   * Create the scan HTML structure
   */
  private createScan(): HTMLElement {
    const scan = document.createElement('div');
    scan.className = 'long-range-scan';
    scan.innerHTML = `
      <div class="scan-header">
        <span class="scan-title">LONG RANGE SCAN</span>
        <span class="scan-sector">SECTOR 4,4</span>
      </div>
      <div class="scan-grid">
        <div class="scan-player"></div>
      </div>
      <div class="scan-legend">
        <span class="legend-item"><span class="player-dot"></span> YOUR SHIP</span>
        <span class="legend-item"><span class="enemy-dot"></span> ZYLON</span>
        <span class="legend-item"><span class="starbase-dot"></span> STARBASE</span>
      </div>
      <div class="scan-info">
        <span>ENEMIES IN SECTOR: <span class="enemy-count">0</span></span>
      </div>
      <div class="scan-controls">
        <span>L: CLOSE SCAN</span>
      </div>
    `;

    return scan;
  }

  /**
   * Add CSS styles
   */
  private addStyles(): void {
    if (document.getElementById('long-range-scan-styles')) return;

    const style = document.createElement('style');
    style.id = 'long-range-scan-styles';
    style.textContent = `
      .long-range-scan {
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
      }

      .scan-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 15px;
      }

      .scan-title {
        font-size: 16px;
        font-weight: bold;
        color: #ffffff;
      }

      .scan-sector {
        font-size: 14px;
        color: #00ff00;
      }

      .scan-grid {
        width: 300px;
        height: 300px;
        background: #001020;
        border: 2px solid #004040;
        position: relative;
        margin-bottom: 15px;
        overflow: hidden;
      }

      /* Grid lines */
      .scan-grid::before {
        content: '';
        position: absolute;
        top: 0;
        left: 50%;
        width: 1px;
        height: 100%;
        background: rgba(0, 255, 255, 0.2);
      }

      .scan-grid::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 0;
        width: 100%;
        height: 1px;
        background: rgba(0, 255, 255, 0.2);
      }

      .scan-player {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 12px;
        height: 12px;
        background: #4488ff;
        border: 2px solid #ffffff;
        border-radius: 50%;
        z-index: 10;
      }

      .scan-object {
        position: absolute;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        transform: translate(-50%, -50%);
      }

      .scan-object.enemy {
        background: #00ffff;
        box-shadow: 0 0 5px #00ffff;
      }

      .scan-object.starbase {
        background: #00ff00;
        width: 14px;
        height: 14px;
        border-radius: 2px;
        box-shadow: 0 0 8px #00ff00;
      }

      .scan-legend {
        display: flex;
        gap: 20px;
        font-size: 10px;
        margin-bottom: 10px;
        justify-content: center;
      }

      .legend-item {
        display: flex;
        align-items: center;
        gap: 5px;
      }

      .player-dot {
        width: 8px;
        height: 8px;
        background: #4488ff;
        border: 1px solid #ffffff;
        border-radius: 50%;
      }

      .enemy-dot {
        width: 8px;
        height: 8px;
        background: #00ffff;
        border-radius: 50%;
      }

      .starbase-dot {
        width: 8px;
        height: 8px;
        background: #00ff00;
        border-radius: 2px;
      }

      .scan-info {
        text-align: center;
        font-size: 12px;
        margin-bottom: 10px;
      }

      .enemy-count {
        color: #ff0000;
        font-weight: bold;
      }

      .scan-controls {
        text-align: center;
        font-size: 10px;
        color: #ffff00;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Show the scan
   */
  public show(): void {
    if (this.gameState.damage.longRangeScan) {
      return; // Can't use if damaged
    }

    this.isVisible = true;
    this.scanElement.style.display = 'block';
    this.generateObjectPositions();
    this.update();
  }

  /**
   * Hide the scan
   */
  public hide(): void {
    this.isVisible = false;
    this.scanElement.style.display = 'none';
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
   * Check if scan is visible
   */
  public get visible(): boolean {
    return this.isVisible;
  }

  /**
   * Generate random positions for objects in current sector
   */
  private generateObjectPositions(): void {
    this.objectPositions = [];

    const sector = this.sectorSystem.getSector(
      this.gameState.sectorX,
      this.gameState.sectorY
    );

    if (!sector) return;

    // Add enemies at random positions
    for (let i = 0; i < sector.enemies; i++) {
      // Distribute enemies around the player, not too close
      const angle = Math.random() * Math.PI * 2;
      const distance = 0.3 + Math.random() * 0.5; // 30-80% from center
      this.objectPositions.push({
        type: 'enemy',
        x: 0.5 + Math.cos(angle) * distance * 0.4,
        y: 0.5 + Math.sin(angle) * distance * 0.4,
      });
    }

    // Add starbase if present
    if (sector.hasStarbase && !sector.starbaseDestroyed) {
      // Place starbase in a fixed location relative to sector
      const hash = (sector.x * 8 + sector.y) * 12345;
      const sbX = 0.2 + (hash % 100) / 100 * 0.6;
      const sbY = 0.2 + ((hash * 7) % 100) / 100 * 0.6;
      this.objectPositions.push({
        type: 'starbase',
        x: sbX,
        y: sbY,
      });
    }
  }

  /**
   * Update the scan display
   */
  public update(): void {
    if (!this.isVisible) return;

    // Update sector label
    const sectorLabel = this.scanElement.querySelector('.scan-sector');
    if (sectorLabel) {
      sectorLabel.textContent = `SECTOR ${this.gameState.sectorX},${this.gameState.sectorY}`;
    }

    // Update enemy count
    const sector = this.sectorSystem.getSector(
      this.gameState.sectorX,
      this.gameState.sectorY
    );
    const enemyCount = this.scanElement.querySelector('.enemy-count');
    if (enemyCount && sector) {
      enemyCount.textContent = sector.enemies.toString();
    }

    // Clear existing objects (except player)
    const grid = this.scanElement.querySelector('.scan-grid');
    if (grid) {
      const objects = grid.querySelectorAll('.scan-object');
      objects.forEach((obj) => obj.remove());

      // Add objects
      for (const obj of this.objectPositions) {
        const element = document.createElement('div');
        element.className = `scan-object ${obj.type}`;
        element.style.left = `${obj.x * 100}%`;
        element.style.top = `${obj.y * 100}%`;
        grid.appendChild(element);
      }
    }
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    if (this.scanElement.parentElement) {
      this.scanElement.parentElement.removeChild(this.scanElement);
    }
    const styles = document.getElementById('long-range-scan-styles');
    if (styles) {
      styles.remove();
    }
  }
}
