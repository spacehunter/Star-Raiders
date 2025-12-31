import { GameState } from '../game/GameState';

/**
 * ControlPanel - Authentic Atari 800 Star Raiders HUD
 *
 * Original layout (blue banner at bottom):
 * Top row:    V:00   K:00   E:9875   T:1
 * Bottom row: θ:+00  Φ:-02  R:+043
 *
 * Colors:
 * - V, K, θ, Φ labels/values: Pink/salmon (#ff9999)
 * - E label/value: Yellow/green (#ccff00)
 * - T, R label/value: Cyan (#00ffff)
 * - Background: Solid blue (#3388cc)
 */
export class ControlPanel {
  private container: HTMLElement;
  private panelElement: HTMLElement;
  private gameState: GameState;

  // UI element references
  private velocityValue!: HTMLElement;
  private killsValue!: HTMLElement;
  private energyValue!: HTMLElement;
  private targetsValue!: HTMLElement;
  private thetaValue!: HTMLElement;
  private phiValue!: HTMLElement;
  private rangeValue!: HTMLElement;
  private messageDisplay!: HTMLElement;

  // Tracking values for display
  private currentTheta: number = 0;
  private currentPhi: number = 0;
  private currentRange: number = 0;

  constructor(container: HTMLElement, gameState: GameState) {
    this.container = container;
    this.gameState = gameState;

    // Create main panel
    this.panelElement = this.createPanel();
    this.container.appendChild(this.panelElement);

    // Create message display (separate to avoid transform context of panel)
    this.messageDisplay = document.createElement('div');
    this.messageDisplay.className = 'message-display';
    this.container.appendChild(this.messageDisplay);

    this.cacheElements();
  }

  /**
   * Cache references to dynamic elements
   */
  private cacheElements(): void {
    this.velocityValue = this.panelElement.querySelector('.vel-value')!;
    this.killsValue = this.panelElement.querySelector('.kills-value')!;
    this.energyValue = this.panelElement.querySelector('.energy-value')!;
    this.targetsValue = this.panelElement.querySelector('.targets-value')!;
    this.thetaValue = this.panelElement.querySelector('.theta-value')!;
    this.phiValue = this.panelElement.querySelector('.phi-value')!;
    this.rangeValue = this.panelElement.querySelector('.range-value')!;
    // Message display is already set in constructor
  }

  /**
   * Create the control panel HTML - Authentic Atari 800 style
   */
  private createPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'control-panel';
    panel.innerHTML = `
      <div class="panel-content">
        <div class="panel-row top-row">
          <span class="stat-group cyan">
            <span class="stat-label">V:</span><span class="stat-value vel-value">00</span>
          </span>
          <span class="stat-group cyan">
            <span class="stat-label">K:</span><span class="stat-value kills-value">00</span>
          </span>
          <span class="stat-group energy">
            <span class="stat-label">E:</span><span class="stat-value energy-value">9999</span>
          </span>
          <span class="stat-group cyan">
            <span class="stat-label">T:</span><span class="stat-value targets-value">0</span>
          </span>
        </div>
        <div class="panel-row bottom-row">
          <span class="stat-group cyan">
            <span class="stat-label">θ:</span><span class="stat-value theta-value">+00</span>
          </span>
          <span class="stat-group cyan">
            <span class="stat-label">Φ:</span><span class="stat-value phi-value">+00</span>
          </span>
          <span class="stat-group cyan">
            <span class="stat-label">R:</span><span class="stat-value range-value">+000</span>
          </span>
        </div>
      </div>
      <!-- Message display moved out -->
      <div class="crosshair"></div>
    `;

    this.addStyles();
    return panel;
  }

  /**
   * Add CSS styles - Authentic Atari 800 pixel look
   */
  private addStyles(): void {
    if (document.getElementById('control-panel-styles')) return;

    const style = document.createElement('style');
    style.id = 'control-panel-styles';
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

      .control-panel {
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100vw;
        background: #2B608A;
        z-index: 100;
        image-rendering: pixelated;
        /* Full-width rectangle - no rounded corners, authentic Atari 800 style */
        border-radius: 0;
        box-sizing: border-box;
      }

      .panel-content {
        /* Taller bar with more space below text - matches Atari 800 screenshot */
        padding: 2vh 3vw 6vh 3vw;
      }

      .panel-row {
        display: flex;
        justify-content: center;
        align-items: center;
        margin: 0.5vh 0;
        gap: 4vw;
      }

      .stat-group {
        display: flex;
        align-items: center;
      }

      .stat-label, .stat-value {
        font-family: 'Press Start 2P', monospace;
        font-size: 3vh;
        font-weight: normal;
        letter-spacing: 0.1vw;
        line-height: 1;
        text-shadow: 0.25vh 0.25vh 0 #000000;
      }
      
      .stat-label {
        margin-right: 0.5vw;
      }

      .stat-value {
        min-width: 4vw;
        text-align: left;
      }

      /* Color classes matching original Atari 800 screenshot */
      /* Cyan-ish White for general stats */
      .stat-group.cyan .stat-label,
      .stat-group.cyan .stat-value {
        color: #CEFFFF; 
      }

      /* Distinct Yellow-Green for Energy */
      .stat-group.energy .stat-label,
      .stat-group.energy .stat-value {
        color: #BAFF00;
      }

      .message-display {
        position: fixed;
        top: 10vh;
        left: 50%;
        transform: translateX(-50%);
        font-family: 'Press Start 2P', monospace;
        font-size: 3vh;
        color: #FF5555;
        text-shadow: 0.25vh 0.25vh 0 #000;
        z-index: 1000;
        text-align: center;
        pointer-events: none;
        width: 100%;
      }

      .message-display:not(:empty) {
        animation: blink 0.5s infinite;
      }

      @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }

      .crosshair {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 4vh;
        height: 4vh;
        pointer-events: none;
        z-index: 99;
      }

      .crosshair::before,
      .crosshair::after {
        content: '';
        position: absolute;
        background: rgba(43, 96, 138, 0.6);
      }

      .crosshair::before {
        width: 0.25vh;
        height: 2vh;
        left: 50%;
        transform: translateX(-50%);
      }

      .crosshair::after {
        width: 2vh;
        height: 0.25vh;
        top: 50%;
        transform: translateY(-50%);
      }

      /* Shield active indicator */
      .control-panel.shields-active {
         background: #3B709A; /* Lighter blue when shielded */
         box-shadow: inset 0 0 20px rgba(186, 255, 0, 0.3); /* Subtle inner glow */
      }
      
      /* Hints */
      .control-hints {
        display: none; /* Hide hints to be more immersive/authentic */
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Format number with sign (+/-)
   */
  private formatSigned(value: number, digits: number = 2): string {
    const sign = value >= 0 ? '+' : '-';
    const absVal = Math.abs(Math.floor(value));
    return sign + absVal.toString().padStart(digits, '0');
  }

  /**
   * Update the control panel display
   */
  public update(): void {
    // V: Velocity (engine speed)
    this.velocityValue.textContent = Math.floor(this.gameState.engineSpeed).toString().padStart(2, '0');

    // K: Kills (enemies destroyed)
    this.killsValue.textContent = this.gameState.enemiesDestroyed.toString().padStart(2, '0');

    // E: Energy
    this.energyValue.textContent = Math.floor(this.gameState.energy).toString();

    // T: Targets remaining (will be updated externally)
    // Keep current value unless updated

    // θ: Theta (horizontal angle to target)
    this.thetaValue.textContent = this.formatSigned(this.currentTheta);

    // Φ: Phi (vertical angle to target)
    this.phiValue.textContent = this.formatSigned(this.currentPhi);

    // R: Range to target
    this.rangeValue.textContent = this.formatSigned(this.currentRange, 3);

    // Shield indicator
    if (this.gameState.shieldsActive) {
      this.panelElement.classList.add('shields-active');
    } else {
      this.panelElement.classList.remove('shields-active');
    }
  }

  /**
   * Update targeting data (θ, Φ, R)
   */
  public updateTargetData(theta: number, phi: number, range: number): void {
    this.currentTheta = theta;
    this.currentPhi = phi;
    this.currentRange = range;
  }

  /**
   * Update targets remaining
   */
  public updateTargetsRemaining(count: number): void {
    this.targetsValue.textContent = count.toString();
  }

  /**
   * Show a message in the center of the screen
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
    const hints = this.container.querySelector('.control-hints');
    if (hints) {
      hints.remove();
    }
  }
}
