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
  private shieldValue!: HTMLElement;
  private damageValue!: HTMLElement;
  private viewModeIndicator!: HTMLElement;
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
    this.shieldValue = this.panelElement.querySelector('.shield-value')!;
    this.damageValue = this.panelElement.querySelector('.damage-value')!;
    this.viewModeIndicator = this.panelElement.querySelector('.view-mode-indicator')!;
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
        <div class="view-mode-indicator">F</div>
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
          <span class="stat-group shield-display">
            <span class="stat-label">S:</span><span class="stat-value shield-value">---</span>
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
          <span class="stat-group damage-indicator">
            <span class="stat-value damage-value">OK</span>
          </span>
        </div>
      </div>
      <!-- Message display moved out -->
      <div class="crosshair"></div>
      <div class="hyperwarp-marker"></div>
    `;

    this.addStyles();
    return panel;
  }

  /**
   * Add CSS styles - Authentic 1979 Atari 800 PIXELATED, CHUNKY aesthetic
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
        background: #000000;
        border-top: 0.8vh solid #00FFFF;
        z-index: 100;
        /* CRITICAL: Pixelated rendering for chunky blocky aesthetic */
        image-rendering: -moz-crisp-edges;
        image-rendering: -webkit-crisp-edges;
        image-rendering: pixelated;
        image-rendering: crisp-edges;
        box-sizing: border-box;
        /* Solid border, minimal glow */
        box-shadow: 0 -0.2vh 0.5vh rgba(0, 255, 255, 0.3);
      }

      .panel-content {
        padding: 2.8vh 3vw 3.2vh 3vw;
        position: relative;
        background: #000000;
      }

      /* ENHANCED CRT scanline effect - more prominent for retro feel */
      .panel-content::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: repeating-linear-gradient(
          0deg,
          rgba(0, 0, 0, 0.4) 0px,
          transparent 1px,
          transparent 2px,
          rgba(0, 0, 0, 0.4) 2px
        );
        pointer-events: none;
        z-index: 1;
      }

      .panel-row {
        display: flex;
        justify-content: center;
        align-items: center;
        margin: 1.2vh 0;
        gap: 5vw;
        position: relative;
        z-index: 2;
      }

      .stat-group {
        display: flex;
        align-items: center;
        position: relative;
      }

      /* Remove decorative brackets - keep it pure and minimal */
      .stat-group::before {
        display: none;
      }

      .stat-label, .stat-value {
        /* CHUNKY PIXELATED FONT - Press Start 2P for authentic look */
        font-family: 'Press Start 2P', monospace;
        font-size: 2.4vh;
        font-weight: normal;
        letter-spacing: 0.25vw;
        line-height: 1;
        /* NO smooth text rendering - force pixelated blocky appearance */
        -webkit-font-smoothing: none;
        -moz-osx-font-smoothing: grayscale;
        font-smooth: never;
        text-rendering: geometricPrecision;
        /* Minimal glow - pure solid color emphasis */
        text-shadow: 0.15vh 0.15vh 0 #000000;
        text-transform: uppercase;
        /* Force chunky pixel grid alignment */
        transform: translateZ(0);
        image-rendering: pixelated;
      }

      .stat-label {
        margin-right: 1vw;
      }

      .stat-value {
        min-width: 6vw;
        text-align: left;
        font-variant-numeric: tabular-nums;
      }

      /* PURE CYAN - Authentic Atari 800 color, solid, high-contrast */
      .stat-group.cyan .stat-label,
      .stat-group.cyan .stat-value {
        color: #00FFFF;
        /* Subtle glow for CRT phosphor effect */
        text-shadow:
          0.15vh 0.15vh 0 #000000,
          0 0 0.3vh #00FFFF;
      }

      /* Energy in PURE YELLOW-GREEN - blocky, bright */
      .stat-group.energy .stat-label,
      .stat-group.energy .stat-value {
        color: #BAFF00;
        text-shadow:
          0.15vh 0.15vh 0 #000000,
          0 0 0.4vh #BAFF00;
      }

      /* Energy color coding based on level */
      .stat-group.energy.low .stat-value {
        color: #FF0000;
        text-shadow:
          0.15vh 0.15vh 0 #000000,
          0 0 0.5vh #FF0000;
        animation: energy-alert 0.8s infinite steps(2);
      }

      .stat-group.energy.medium .stat-value {
        color: #FFFF00;
        text-shadow:
          0.15vh 0.15vh 0 #000000,
          0 0 0.4vh #FFFF00;
      }

      @keyframes energy-alert {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      /* Shield display */
      .stat-group.shield-display .stat-label,
      .stat-group.shield-display .stat-value {
        color: #00FFFF;
        text-shadow:
          0.15vh 0.15vh 0 #000000,
          0 0 0.3vh #00FFFF;
      }

      .stat-group.shield-display.active .stat-value {
        color: #BAFF00;
        text-shadow:
          0.15vh 0.15vh 0 #000000,
          0 0 0.4vh #BAFF00;
      }

      /* Damage indicator */
      .stat-group.damage-indicator .stat-value {
        color: #00FFFF;
        text-shadow:
          0.15vh 0.15vh 0 #000000,
          0 0 0.3vh #00FFFF;
        font-size: 2.2vh;
      }

      .stat-group.damage-indicator.damaged .stat-value {
        color: #FF0000;
        text-shadow:
          0.15vh 0.15vh 0 #000000,
          0 0 0.5vh #FF0000;
        animation: damage-blink 1s infinite steps(2);
      }

      @keyframes damage-blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }

      /* View mode indicator */
      .view-mode-indicator {
        position: absolute;
        top: 0.8vh;
        left: 1.5vw;
        font-family: 'Press Start 2P', monospace;
        font-size: 2.5vh;
        font-weight: normal;
        color: #00FFFF;
        -webkit-font-smoothing: none;
        -moz-osx-font-smoothing: grayscale;
        text-shadow:
          0.2vh 0.2vh 0 #000000,
          0 0 0.4vh #00FFFF;
        z-index: 3;
        letter-spacing: 0.2vw;
      }

      .message-display {
        position: fixed;
        top: 10vh;
        left: 50%;
        transform: translateX(-50%);
        /* CHUNKY PIXELATED FONT - INCREASED SIZE */
        font-family: 'Press Start 2P', monospace;
        font-size: 3vh;
        font-weight: normal;
        color: #FF0000;
        /* Blocky pixel rendering */
        -webkit-font-smoothing: none;
        -moz-osx-font-smoothing: grayscale;
        text-shadow:
          0.2vh 0.2vh 0 #000000,
          0 0 0.6vh #FF0000;
        z-index: 1000;
        text-align: center;
        pointer-events: none;
        width: 100%;
        letter-spacing: 0.35vw;
      }

      .message-display:not(:empty) {
        animation: blink-alert 0.8s infinite steps(2);
      }

      @keyframes blink-alert {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
      }

      /* CHUNKY BLOCKY CROSSHAIR - Pixelated style */
      .crosshair {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 6vh;
        height: 6vh;
        pointer-events: none;
        z-index: 99;
        image-rendering: pixelated;
      }

      .crosshair::before,
      .crosshair::after {
        content: '';
        position: absolute;
        background: #00FFFF;
        /* Minimal glow - keep it crisp */
        box-shadow: 0 0 0.2vh #00FFFF;
      }

      /* Vertical line with gaps - THICKER for blocky look */
      .crosshair::before {
        width: 0.5vh;
        height: 100%;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(
          to bottom,
          #00FFFF 0%,
          #00FFFF 35%,
          transparent 35%,
          transparent 65%,
          #00FFFF 65%,
          #00FFFF 100%
        );
      }

      /* Horizontal line with gaps - THICKER for blocky look */
      .crosshair::after {
        width: 100%;
        height: 0.5vh;
        top: 50%;
        transform: translateY(-50%);
        background: linear-gradient(
          to right,
          #00FFFF 0%,
          #00FFFF 35%,
          transparent 35%,
          transparent 65%,
          #00FFFF 65%,
          #00FFFF 100%
        );
      }

      /* CHUNKY Hyperwarp Target Marker - Blocky cross */
      .hyperwarp-marker {
        display: none;
        position: fixed;
        top: 50%;
        left: 50%;
        width: 6vh;
        height: 6vh;
        pointer-events: none;
        z-index: 98;
        transform: translate(-50%, -50%);
        image-rendering: pixelated;
      }

      /* Blocky cross with thick arms */
      .hyperwarp-marker::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 2vh;
        height: 2vh;
        background: transparent;
        /* Chunky thick cross arms */
        box-shadow:
           0 -2vh 0 -0.4vh #CEFFFF,
           0 2vh 0 -0.4vh #CEFFFF,
           -2vh 0 0 -0.4vh #CEFFFF,
           2vh 0 0 -0.4vh #CEFFFF,
           0 0 0 0.6vh #CEFFFF;
      }

      .hyperwarp-marker {
         filter: drop-shadow(0 0 1px #000);
      }

      /* Shield active - BLOCKY color change, no smooth transitions */
      .control-panel.shields-active {
         border-top-color: #BAFF00;
         box-shadow: 0 -0.2vh 0.8vh rgba(186, 255, 0, 0.5);
         animation: shield-pulse 1.2s infinite steps(2);
      }

      @keyframes shield-pulse {
        0%, 100% {
          border-top-color: #BAFF00;
        }
        50% {
          border-top-color: #00FFFF;
        }
      }

      .control-hints {
        display: none;
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

    // E: Energy with color coding
    const energy = Math.floor(this.gameState.energy);
    this.energyValue.textContent = energy.toString();

    const energyGroup = this.energyValue.parentElement?.parentElement;
    if (energyGroup) {
      energyGroup.classList.remove('low', 'medium');
      if (energy < 1000) {
        energyGroup.classList.add('low');
      } else if (energy < 3000) {
        energyGroup.classList.add('medium');
      }
    }

    // T: Targets remaining (will be updated externally)
    // Keep current value unless updated

    // S: Shield display
    const shieldGroup = this.shieldValue.parentElement?.parentElement;
    if (this.gameState.shieldsActive) {
      this.shieldValue.textContent = 'ON';
      shieldGroup?.classList.add('active');
      this.panelElement.classList.add('shields-active');
    } else {
      this.shieldValue.textContent = '---';
      shieldGroup?.classList.remove('active');
      this.panelElement.classList.remove('shields-active');
    }

    // θ: Theta (horizontal angle to target)
    this.thetaValue.textContent = this.formatSigned(this.currentTheta);

    // Φ: Phi (vertical angle to target)
    this.phiValue.textContent = this.formatSigned(this.currentPhi);

    // R: Range to target
    this.rangeValue.textContent = this.formatSigned(this.currentRange, 3);

    // Damage indicator
    const damageGroup = this.damageValue.parentElement;
    const hasDamage = Object.values(this.gameState.damage).some(d => d);

    if (hasDamage) {
      this.damageValue.textContent = 'DMG';
      damageGroup?.classList.add('damaged');
    } else {
      this.damageValue.textContent = 'OK';
      damageGroup?.classList.remove('damaged');
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
   * Update view mode indicator
   * @param mode 'F' (Front), 'A' (Aft), 'G' (Galactic Chart), 'L' (Long Range Scan)
   */
  public updateViewMode(mode: 'F' | 'A' | 'G' | 'L'): void {
    if (this.viewModeIndicator) {
      this.viewModeIndicator.textContent = mode;
    }
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
   * Set visibility of the Hyperwarp Target Marker
   */
  public setHyperwarpMarkerVisible(visible: boolean): void {
    const marker = this.panelElement.querySelector('.hyperwarp-marker') as HTMLElement;
    if (marker) {
      marker.style.display = visible ? 'block' : 'none';
    }
  }

  /**
   * Update position of the Hyperwarp Target Marker
   * @param x Horizontal offset (0 is center)
   * @param y Vertical offset (0 is center)
   */
  public updateHyperwarpMarker(x: number, y: number): void {
    const marker = this.panelElement.querySelector('.hyperwarp-marker') as HTMLElement;
    if (marker) {
      // Use CSS transformtranslate to position relative to center
      // 50% start + offset (vh)
      // x, y are in 'screen units' passed from game logic. 
      // Let's assume Game passes roughly pixel or VH offsets.
      // Or normalized -1 to 1?
      // Let's assume input is in 'screen percentage' or similar magnitude for now.
      // Actually, easier to let Game logic drive the offset in VH units.
      marker.style.transform = `translate(calc(-50% + ${x}vh), calc(-50% + ${y}vh))`;
    }
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
