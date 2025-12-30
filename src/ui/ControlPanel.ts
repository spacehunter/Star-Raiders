import { GameState, ViewMode } from '../game/GameState';

/**
 * ControlPanel - HUD overlay displaying game state
 *
 * Layout (based on original Star Raiders):
 * - Energy level (numerical + bar)
 * - Current speed (0-9)
 * - Current view indicator
 * - Star date
 * - Damage indicators
 * - Shield status
 */
export class ControlPanel {
  private container: HTMLElement;
  private panelElement: HTMLElement;
  private gameState: GameState;

  // UI elements
  private energyValue: HTMLElement;
  private energyBar: HTMLElement;
  private speedValue: HTMLElement;
  private viewIndicator: HTMLElement;
  private starDateValue: HTMLElement;
  private shieldIndicator: HTMLElement;
  private damageIndicators: HTMLElement;
  private messageDisplay: HTMLElement;

  constructor(container: HTMLElement, gameState: GameState) {
    this.container = container;
    this.gameState = gameState;
    this.panelElement = this.createPanel();
    this.container.appendChild(this.panelElement);

    // Store references to dynamic elements
    this.energyValue = this.panelElement.querySelector('.energy-value')!;
    this.energyBar = this.panelElement.querySelector('.energy-bar-fill')!;
    this.speedValue = this.panelElement.querySelector('.speed-value')!;
    this.viewIndicator = this.panelElement.querySelector('.view-indicator')!;
    this.starDateValue = this.panelElement.querySelector('.stardate-value')!;
    this.shieldIndicator = this.panelElement.querySelector('.shield-indicator')!;
    this.damageIndicators = this.panelElement.querySelector('.damage-indicators')!;
    this.messageDisplay = this.panelElement.querySelector('.message-display')!;
  }

  /**
   * Create the control panel HTML
   */
  private createPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'control-panel';
    panel.innerHTML = `
      <div class="panel-left">
        <div class="panel-section energy-section">
          <span class="label">ENERGY</span>
          <span class="energy-value">9999</span>
          <div class="energy-bar">
            <div class="energy-bar-fill"></div>
          </div>
        </div>
        <div class="panel-section">
          <span class="label">VELOCITY</span>
          <span class="speed-value">0</span>
        </div>
      </div>
      <div class="panel-center">
        <div class="message-display"></div>
        <div class="view-indicator">FRONT VIEW</div>
        <div class="shield-indicator"></div>
      </div>
      <div class="panel-right">
        <div class="panel-section">
          <span class="label">STAR DATE</span>
          <span class="stardate-value">2850.0</span>
        </div>
        <div class="panel-section">
          <span class="label">SECTOR</span>
          <span class="sector-value">4,4</span>
        </div>
        <div class="damage-indicators"></div>
      </div>
      <div class="crosshair"></div>
    `;

    // Add styles
    this.addStyles();

    return panel;
  }

  /**
   * Add CSS styles for the control panel
   */
  private addStyles(): void {
    // Check if styles already exist
    if (document.getElementById('control-panel-styles')) return;

    const style = document.createElement('style');
    style.id = 'control-panel-styles';
    style.textContent = `
      .control-panel {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 80px;
        background: linear-gradient(to bottom, rgba(0, 40, 60, 0.9), rgba(0, 20, 40, 0.95));
        border-top: 2px solid #00ffff;
        display: flex;
        justify-content: space-between;
        padding: 8px 20px;
        font-family: 'Courier New', monospace;
        color: #00ffff;
        z-index: 100;
      }

      .panel-left, .panel-right {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 200px;
      }

      .panel-center {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        flex: 1;
      }

      .panel-section {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .label {
        font-size: 10px;
        color: #008888;
        min-width: 70px;
      }

      .energy-value, .speed-value, .stardate-value, .sector-value {
        font-size: 18px;
        font-weight: bold;
        color: #00ff00;
        min-width: 50px;
      }

      .energy-section {
        flex-direction: column;
        align-items: flex-start;
      }

      .energy-bar {
        width: 180px;
        height: 12px;
        background: #001a1a;
        border: 1px solid #00ffff;
        margin-top: 4px;
      }

      .energy-bar-fill {
        height: 100%;
        background: linear-gradient(to right, #00ff00, #00cc00);
        width: 100%;
        transition: width 0.2s, background 0.5s;
      }

      .energy-bar-fill.low {
        background: linear-gradient(to right, #ff0000, #cc0000);
      }

      .energy-bar-fill.warning {
        background: linear-gradient(to right, #ffff00, #cccc00);
      }

      .view-indicator {
        font-size: 14px;
        font-weight: bold;
        color: #ffffff;
        text-transform: uppercase;
        padding: 4px 16px;
        background: rgba(0, 100, 100, 0.5);
        border: 1px solid #00ffff;
      }

      .shield-indicator {
        font-size: 12px;
        color: #00ffff;
        margin-top: 4px;
        height: 16px;
      }

      .shield-indicator.active {
        color: #00ff00;
        animation: pulse 1s infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      .message-display {
        font-size: 14px;
        color: #ff0000;
        height: 20px;
        font-weight: bold;
        animation: blink 0.5s infinite;
      }

      @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }

      .damage-indicators {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 4px;
      }

      .damage-item {
        font-size: 9px;
        color: #ff0000;
        background: rgba(255, 0, 0, 0.2);
        padding: 2px 6px;
        border: 1px solid #ff0000;
      }

      .crosshair {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 30px;
        height: 30px;
        pointer-events: none;
        z-index: 99;
      }

      .crosshair::before,
      .crosshair::after {
        content: '';
        position: absolute;
        background: rgba(0, 255, 255, 0.7);
      }

      .crosshair::before {
        width: 2px;
        height: 30px;
        left: 14px;
        top: 0;
      }

      .crosshair::after {
        width: 30px;
        height: 2px;
        left: 0;
        top: 14px;
      }

      .control-hints {
        position: fixed;
        top: 10px;
        left: 10px;
        font-family: 'Courier New', monospace;
        font-size: 11px;
        color: rgba(0, 255, 255, 0.6);
        z-index: 100;
      }

      .control-hints div {
        margin-bottom: 2px;
      }
    `;
    document.head.appendChild(style);

    // Add control hints
    const hints = document.createElement('div');
    hints.className = 'control-hints';
    hints.innerHTML = `
      <div>CLICK TO ENABLE MOUSE CONTROL</div>
      <div>SPACE: FIRE • S: SHIELDS • 0-9: SPEED</div>
      <div>F: FRONT VIEW • A: AFT VIEW</div>
    `;
    this.container.appendChild(hints);
  }

  /**
   * Update the control panel display
   */
  public update(): void {
    // Update energy
    const energy = Math.floor(this.gameState.energy);
    this.energyValue.textContent = energy.toString();

    const energyPercent = (this.gameState.energy / this.gameState.maxEnergy) * 100;
    this.energyBar.style.width = `${energyPercent}%`;

    // Update energy bar color
    this.energyBar.classList.remove('low', 'warning');
    if (energyPercent < 20) {
      this.energyBar.classList.add('low');
    } else if (energyPercent < 40) {
      this.energyBar.classList.add('warning');
    }

    // Update speed
    this.speedValue.textContent = this.gameState.engineSpeed.toString();

    // Update view indicator
    const viewLabels: Record<ViewMode, string> = {
      [ViewMode.FRONT]: 'FRONT VIEW',
      [ViewMode.AFT]: 'AFT VIEW',
      [ViewMode.GALACTIC_CHART]: 'GALACTIC CHART',
      [ViewMode.LONG_RANGE_SCAN]: 'LONG RANGE SCAN',
    };
    this.viewIndicator.textContent = viewLabels[this.gameState.currentView];

    // Update star date
    this.starDateValue.textContent = this.gameState.starDate.toFixed(1);

    // Update sector
    const sectorValue = this.panelElement.querySelector('.sector-value');
    if (sectorValue) {
      sectorValue.textContent = `${this.gameState.sectorX},${this.gameState.sectorY}`;
    }

    // Update shield indicator
    if (this.gameState.shieldsActive) {
      this.shieldIndicator.textContent = '[ SHIELDS ACTIVE ]';
      this.shieldIndicator.classList.add('active');
    } else {
      this.shieldIndicator.textContent = '';
      this.shieldIndicator.classList.remove('active');
    }

    // Update damage indicators
    this.updateDamageIndicators();
  }

  /**
   * Update damage indicator display
   */
  private updateDamageIndicators(): void {
    const damageLabels: Record<string, string> = {
      engines: 'ENGINES',
      shields: 'SHIELDS',
      photonTorpedoes: 'WEAPONS',
      subSpaceRadio: 'RADIO',
      longRangeScan: 'LR SCAN',
      attackComputer: 'COMPUTER',
    };

    let html = '';
    for (const [key, label] of Object.entries(damageLabels)) {
      if (this.gameState.damage[key as keyof typeof this.gameState.damage]) {
        html += `<span class="damage-item">${label}</span>`;
      }
    }
    this.damageIndicators.innerHTML = html;
  }

  /**
   * Show a message in the message display area
   */
  public showMessage(message: string, duration: number = 3000): void {
    this.messageDisplay.textContent = message;
    setTimeout(() => {
      if (this.messageDisplay.textContent === message) {
        this.messageDisplay.textContent = '';
      }
    }, duration);
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    if (this.panelElement.parentElement) {
      this.panelElement.parentElement.removeChild(this.panelElement);
    }
    const styles = document.getElementById('control-panel-styles');
    if (styles) {
      styles.remove();
    }
  }
}
