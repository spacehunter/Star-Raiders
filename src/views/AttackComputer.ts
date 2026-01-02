import * as THREE from 'three';
import { Enemy } from '../entities/Enemy';
import { GameState } from '../game/GameState';

/**
 * Lock-on indicators
 * A - Horizontal alignment
 * B - Horizontal + Vertical alignment
 * C - Full lock (optimal range)
 */
export const LockIndicator = {
  NONE: 'NONE',
  A: 'A',
  B: 'B',
  C: 'C',
} as const;

export type LockIndicator = (typeof LockIndicator)[keyof typeof LockIndicator];

/**
 * AttackComputer - Targeting overlay for combat
 */
export class AttackComputer {
  private container: HTMLElement;
  private computerElement: HTMLElement;
  private gameState: GameState;

  // Targeting
  private currentTarget: Enemy | null = null;
  private lockIndicator: LockIndicator = LockIndicator.NONE;

  // Thresholds (in radians)
  private horizontalThreshold: number = 0.15; // ~8.5 degrees
  private verticalThreshold: number = 0.15;
  private optimalRange: number = 50;

  constructor(container: HTMLElement, gameState: GameState) {
    this.container = container;
    this.gameState = gameState;

    this.computerElement = this.createDisplay();
    this.container.appendChild(this.computerElement);
    this.addStyles();
  }

  /**
   * Create the attack computer HTML - Enhanced with proximity radar
   * Layout:  A       A
   *          B   +   B
   *              C
   *          [RADAR]
   */
  private createDisplay(): HTMLElement {
    const display = document.createElement('div');
    display.className = 'attack-computer';
    display.innerHTML = `
      <div class="computer-frame">
        <div class="indicator indicator-a-left">A</div>
        <div class="indicator indicator-a-right">A</div>
        <div class="indicator indicator-b-left">B</div>
        <div class="indicator indicator-b-right">B</div>
        <div class="indicator indicator-c">C</div>
        <div class="targeting-reticle">
          <div class="reticle-cross-h"></div>
          <div class="reticle-cross-v"></div>
        </div>
        <div class="proximity-radar">
          <svg class="radar-grid" viewBox="0 0 100 100" preserveAspectRatio="none">
            <!-- Grid lines -->
            <line x1="50" y1="0" x2="50" y2="100" class="grid-line" />
            <line x1="0" y1="50" x2="100" y2="50" class="grid-line" />
            <!-- Diagonal guides -->
            <line x1="0" y1="0" x2="100" y2="100" class="grid-line-diagonal" />
            <line x1="100" y1="0" x2="0" y2="100" class="grid-line-diagonal" />
            <!-- Concentric range circles -->
            <circle cx="50" cy="50" r="20" class="range-circle" />
            <circle cx="50" cy="50" r="40" class="range-circle" />
          </svg>
          <div class="radar-center-dot"></div>
          <div class="enemy-markers"></div>
        </div>
      </div>
      <div class="target-info">
        <span class="target-type"></span>
        <span class="target-range"></span>
      </div>
      <div class="tactical-info">
        <span class="closest-threat"></span>
        <span class="sector-coords"></span>
      </div>
    `;

    return display;
  }

  /**
   * Add CSS styles - 1979 Atari 800 CHUNKY PIXELATED tactical display
   */
  private addStyles(): void {
    if (document.getElementById('attack-computer-styles')) return;

    const style = document.createElement('style');
    style.id = 'attack-computer-styles';
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

      .attack-computer {
        position: fixed;
        bottom: 14vh;
        right: 2vw;
        width: 28vh;
        height: 36vh;
        z-index: 100;
        /* PIXELATED rendering */
        image-rendering: -moz-crisp-edges;
        image-rendering: -webkit-crisp-edges;
        image-rendering: pixelated;
        image-rendering: crisp-edges;
      }

      .computer-frame {
        width: 100%;
        height: 100%;
        border: 0.6vh solid #00FFFF;
        background: #000000;
        position: relative;
        /* Minimal glow - keep edges crisp and blocky */
        box-shadow: 0 0 0.5vh rgba(0, 255, 255, 0.4);
        /* Simple rectangular frame - no fancy clipping */
        box-sizing: border-box;
      }

      /* BLOCKY corner decorations - chunky squares */
      .computer-frame::before,
      .computer-frame::after {
        content: '';
        position: absolute;
        width: 2vh;
        height: 2vh;
        border: 0.4vh solid #00FFFF;
        box-shadow: 0 0 0.3vh #00FFFF;
        background: #000000;
      }

      .computer-frame::before {
        top: 1.2vh;
        left: 1.2vh;
        border-right: none;
        border-bottom: none;
      }

      .computer-frame::after {
        bottom: 1.2vh;
        right: 1.2vh;
        border-left: none;
        border-top: none;
      }

      /* CHUNKY BLOCKY INDICATORS - Pixelated font - INCREASED SIZE */
      .indicator {
        position: absolute;
        font-family: 'Press Start 2P', monospace;
        font-size: 3vh;
        font-weight: normal;
        color: #002222;
        /* Force pixelated rendering */
        -webkit-font-smoothing: none;
        -moz-osx-font-smoothing: grayscale;
        text-shadow: none;
        /* No smooth transitions - instant changes */
        transition: none;
        z-index: 10;
        letter-spacing: 0.1vw;
      }

      .indicator.active {
        color: #00FFFF;
        /* Minimal glow, keep it blocky */
        text-shadow:
          0.2vh 0.2vh 0 #000000,
          0 0 0.5vh #00FFFF;
        animation: lock-pulse 0.8s infinite steps(2);
      }

      @keyframes lock-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }

      /* A indicators - top corners (horizontal lock) - BIGGER */
      .indicator-a-left {
        top: 2vh;
        left: 2.5vh;
      }

      .indicator-a-right {
        top: 2vh;
        right: 2.5vh;
      }

      /* B indicators - middle sides (horizontal + vertical) - BIGGER */
      .indicator-b-left {
        top: 50%;
        left: 2.5vh;
        transform: translateY(-50%);
      }

      .indicator-b-right {
        top: 50%;
        right: 2.5vh;
        transform: translateY(-50%);
      }

      /* C indicator - bottom center (full lock) - BIGGER, BLOCKIER */
      .indicator-c {
        bottom: 20vh;
        left: 50%;
        transform: translateX(-50%);
        color: #220000;
        font-size: 3.2vh;
      }

      .indicator-c.active {
        color: #FF0000;
        /* Blocky red glow */
        text-shadow:
          0.25vh 0.25vh 0 #000000,
          0 0 0.7vh #FF0000;
        animation: critical-lock 0.4s infinite steps(2);
      }

      @keyframes critical-lock {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.7;
        }
      }

      /* CHUNKY targeting reticle */
      .targeting-reticle {
        position: absolute;
        top: 7vh;
        left: 50%;
        transform: translateX(-50%);
        width: 5vh;
        height: 5vh;
        z-index: 5;
      }

      .reticle-cross-h,
      .reticle-cross-v {
        position: absolute;
        background: #00FFFF;
        /* Minimal glow, keep crisp */
        box-shadow: 0 0 0.2vh #00FFFF;
      }

      /* THICKER cross bars for chunky look */
      .reticle-cross-h {
        width: 100%;
        height: 0.5vh;
        top: 50%;
        transform: translateY(-50%);
      }

      .reticle-cross-v {
        width: 0.5vh;
        height: 100%;
        left: 50%;
        transform: translateX(-50%);
      }

      /* MUCH LARGER PROXIMITY RADAR - 1979 blocky tactical display */
      .proximity-radar {
        position: absolute;
        bottom: 2vh;
        left: 50%;
        transform: translateX(-50%);
        /* DOUBLED SIZE - much more prominent! */
        width: 24vh;
        height: 16vh;
        border: 0.5vh solid #00FFFF;
        background: rgba(0, 20, 20, 0.8);
        box-shadow: inset 0 0 0.5vh rgba(0, 255, 255, 0.2);
        /* Pixelated rendering */
        image-rendering: pixelated;
      }

      .radar-grid {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        opacity: 0.5;
        /* Force crisp SVG rendering */
        shape-rendering: crispEdges;
      }

      /* THICKER grid lines for better visibility */
      .grid-line {
        stroke: #00FFFF;
        stroke-width: 1;
        stroke-dasharray: 3, 3;
        fill: none;
        shape-rendering: crispEdges;
      }

      .grid-line-diagonal {
        stroke: #00FFFF;
        stroke-width: 0.6;
        stroke-dasharray: 2, 4;
        fill: none;
        opacity: 0.4;
        shape-rendering: crispEdges;
      }

      /* MORE PROMINENT range circles */
      .range-circle {
        stroke: #00FFFF;
        stroke-width: 0.8;
        fill: none;
        opacity: 0.4;
        shape-rendering: crispEdges;
      }

      /* BIGGER center dot - player position */
      .radar-center-dot {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 1vh;
        height: 1vh;
        background: #00FFFF;
        /* Blocky square instead of circle */
        border-radius: 0;
        box-shadow: 0 0 0.3vh #00FFFF;
        z-index: 3;
      }

      .enemy-markers {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 2;
      }

      /* MUCH BIGGER, BLOCKIER enemy markers with size-based distance */
      .enemy-marker {
        position: absolute;
        transform: translate(-50%, -50%);
        pointer-events: none;
        image-rendering: pixelated;
        /* Base size - will be scaled by distance in JS */
      }

      /* Fighter - CHUNKY cyan triangle (pointing up) */
      .enemy-marker.fighter {
        width: 0;
        height: 0;
        /* MUCH BIGGER triangular shape */
        border-left: 1.2vh solid transparent;
        border-right: 1.2vh solid transparent;
        border-bottom: 2vh solid #00FFFF;
        /* Minimal glow, keep edges crisp */
        filter: drop-shadow(0 0 0.4vh #00FFFF);
        animation: marker-blink 1.2s infinite steps(2);
      }

      /* Cruiser - CHUNKY magenta square */
      .enemy-marker.cruiser {
        width: 2vh;
        height: 2vh;
        background: #FF00FF;
        /* Blocky square, no rounded corners */
        border-radius: 0;
        filter: drop-shadow(0 0 0.4vh #FF00FF);
        animation: marker-blink 1.2s infinite steps(2);
      }

      /* Basestar - CHUNKY gold octagon (more like a blocky hexagon) */
      .enemy-marker.basestar {
        width: 2.5vh;
        height: 2.5vh;
        background: #FFD700;
        /* Simplified blocky shape instead of perfect octagon */
        clip-path: polygon(
          25% 0%, 75% 0%,
          100% 25%, 100% 75%,
          75% 100%, 25% 100%,
          0% 75%, 0% 25%
        );
        filter: drop-shadow(0 0 0.5vh #FFD700);
        animation: marker-blink-slow 2s infinite steps(2);
      }

      /* BLOCKY stepped animation - no smooth transitions */
      @keyframes marker-blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }

      @keyframes marker-blink-slow {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      /* Targeted enemy - CHUNKY pulse effect */
      .enemy-marker.targeted {
        animation: marker-targeted 0.6s infinite steps(2) !important;
      }

      @keyframes marker-targeted {
        0%, 100% {
          opacity: 1;
          filter: brightness(1.5);
        }
        50% {
          opacity: 0.7;
          filter: brightness(1);
        }
      }

      /* CHUNKY PIXELATED target info display - INCREASED READABILITY */
      .target-info {
        position: absolute;
        bottom: -6vh;
        left: 0;
        right: 0;
        text-align: center;
        font-family: 'Press Start 2P', monospace;
        font-size: 1.5vh;
        font-weight: normal;
        color: #00FFFF;
        /* Force pixelated font rendering */
        -webkit-font-smoothing: none;
        -moz-osx-font-smoothing: grayscale;
        text-shadow:
          0.15vh 0.15vh 0 #000000,
          0 0 0.3vh #00FFFF;
        line-height: 1.4;
      }

      .target-type {
        display: block;
        color: #FF0000;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 0.15vw;
        text-shadow:
          0.15vh 0.15vh 0 #000000,
          0 0 0.4vh #FF0000;
        margin-bottom: 0.3vh;
      }

      .target-range {
        display: block;
        color: #BAFF00;
        text-shadow:
          0.15vh 0.15vh 0 #000000,
          0 0 0.4vh #BAFF00;
        letter-spacing: 0.1vw;
      }

      /* TACTICAL INFO - Additional combat intelligence - INCREASED READABILITY */
      .tactical-info {
        position: absolute;
        top: 1.2vh;
        left: 1.2vh;
        right: 1.2vh;
        font-family: 'Press Start 2P', monospace;
        font-size: 1.6vh;
        font-weight: normal;
        -webkit-font-smoothing: none;
        -moz-osx-font-smoothing: grayscale;
        z-index: 15;
        line-height: 1.4;
      }

      .closest-threat {
        display: block;
        color: #FF0000;
        text-shadow:
          0.15vh 0.15vh 0 #000000,
          0 0 0.4vh #FF0000;
        margin-bottom: 0.5vh;
        letter-spacing: 0.1vw;
      }

      .sector-coords {
        display: block;
        color: #00FFFF;
        text-shadow:
          0.15vh 0.15vh 0 #000000,
          0 0 0.3vh #00FFFF;
        font-size: 1.4vh;
        letter-spacing: 0.1vw;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Set current target
   */
  public setTarget(enemy: Enemy | null): void {
    this.currentTarget = enemy;
  }

  /**
   * Get current target
   */
  public getTarget(): Enemy | null {
    return this.currentTarget;
  }

  /**
   * Calculate lock-on status
   */
  public calculateLock(
    playerPosition: THREE.Vector3,
    playerDirection: THREE.Vector3,
    targetPosition: THREE.Vector3
  ): LockIndicator {
    // Vector from player to target
    const toTarget = targetPosition.clone().sub(playerPosition);
    const distance = toTarget.length();
    toTarget.normalize();

    // Calculate angles
    const forward = playerDirection.clone().normalize();

    // Horizontal angle (yaw)
    const forwardFlat = new THREE.Vector3(forward.x, 0, forward.z).normalize();
    const toTargetFlat = new THREE.Vector3(toTarget.x, 0, toTarget.z).normalize();
    const horizontalAngle = Math.acos(Math.max(-1, Math.min(1, forwardFlat.dot(toTargetFlat))));

    // Vertical angle (pitch)
    const verticalAngle = Math.abs(Math.asin(toTarget.y) - Math.asin(forward.y));

    // Determine lock level
    if (horizontalAngle > this.horizontalThreshold) {
      return LockIndicator.NONE;
    }

    if (verticalAngle > this.verticalThreshold) {
      return LockIndicator.A; // Horizontal only
    }

    if (distance > this.optimalRange) {
      return LockIndicator.B; // Horizontal + Vertical
    }

    return LockIndicator.C; // Full lock
  }

  /**
   * Update the display
   */
  public update(
    playerPosition: THREE.Vector3,
    playerDirection: THREE.Vector3,
    allEnemies?: Enemy[]
  ): void {
    // Check if attack computer is damaged
    if (this.gameState.damage.attackComputer) {
      this.computerElement.style.display = 'none';
      return;
    }

    this.computerElement.style.display = 'block';

    // Clear indicators
    this.lockIndicator = LockIndicator.NONE;

    // Update target info
    const targetType = this.computerElement.querySelector('.target-type') as HTMLElement;
    const targetRange = this.computerElement.querySelector('.target-range') as HTMLElement;
    const closestThreat = this.computerElement.querySelector('.closest-threat') as HTMLElement;
    const sectorCoords = this.computerElement.querySelector('.sector-coords') as HTMLElement;

    // Update sector coordinates
    if (sectorCoords) {
      const sectorX = Math.floor(this.gameState.sectorX);
      const sectorY = Math.floor(this.gameState.sectorY);
      sectorCoords.textContent = `SEC ${sectorX},${sectorY}`;
    }

    // Find closest enemy for threat indicator
    let closestEnemy: Enemy | null = null;
    let closestDistance = Infinity;

    if (allEnemies) {
      allEnemies.forEach(enemy => {
        if (enemy.isActive) {
          const dist = playerPosition.distanceTo(enemy.getPosition());
          if (dist < closestDistance) {
            closestDistance = dist;
            closestEnemy = enemy;
          }
        }
      });
    }

    // Update closest threat indicator
    if (closestThreat) {
      if (closestEnemy && closestDistance < 200) {
        closestThreat.textContent = `THREAT ${Math.floor(closestDistance)}`;
      } else {
        closestThreat.textContent = '';
      }
    }

    if (this.currentTarget && this.currentTarget.isActive) {
      const targetPos = this.currentTarget.getPosition();
      const distance = playerPosition.distanceTo(targetPos);

      // Calculate lock
      this.lockIndicator = this.calculateLock(playerPosition, playerDirection, targetPos);

      // Update info display
      targetType.textContent = `ZYLON ${this.currentTarget.getType()}`;
      targetRange.textContent = `RANGE: ${Math.floor(distance)}`;
    } else {
      targetType.textContent = 'NO TARGET';
      targetRange.textContent = '';
      this.currentTarget = null;
    }

    // Update indicators
    this.updateIndicators();

    // Update proximity radar with all enemies
    if (allEnemies) {
      this.updateProximityRadar(playerPosition, playerDirection, allEnemies);
    }
  }

  /**
   * Update proximity radar to show enemy positions
   */
  private updateProximityRadar(
    playerPosition: THREE.Vector3,
    playerDirection: THREE.Vector3,
    enemies: Enemy[]
  ): void {
    const markersContainer = this.computerElement.querySelector('.enemy-markers') as HTMLElement;
    if (!markersContainer) return;

    // Clear existing markers
    markersContainer.innerHTML = '';

    // Create player's right and up vectors for screen space projection
    const playerUp = new THREE.Vector3(0, 1, 0);
    const playerRight = new THREE.Vector3().crossVectors(playerDirection, playerUp).normalize();
    const actualUp = new THREE.Vector3().crossVectors(playerRight, playerDirection).normalize();

    // Process each active enemy
    enemies.forEach((enemy) => {
      if (!enemy.isActive) return;

      const enemyPos = enemy.getPosition();
      const toEnemy = enemyPos.clone().sub(playerPosition);
      const distance = toEnemy.length();

      // Only show enemies within reasonable range
      if (distance > 300) return;

      // Project enemy position onto player's view plane
      const forward = toEnemy.dot(playerDirection);
      const right = toEnemy.dot(playerRight);
      const up = toEnemy.dot(actualUp);

      // Convert to radar coordinates (center is player position)
      // X: -1 (left) to +1 (right), Y: -1 (down) to +1 (up)
      // Scale by distance for depth perception
      const radarX = (right / 150) * 50 + 50; // Map to 0-100%
      const radarY = -(up / 150) * 50 + 50; // Map to 0-100%, inverted Y

      // Only show enemies roughly in front (forward > -50)
      if (forward < -50) return;

      // Clamp to radar bounds
      const clampedX = Math.max(5, Math.min(95, radarX));
      const clampedY = Math.max(5, Math.min(95, radarY));

      // Create marker element
      const marker = document.createElement('div');
      marker.className = `enemy-marker ${enemy.getType().toLowerCase()}`;

      // Highlight if this is the current target
      if (this.currentTarget === enemy) {
        marker.classList.add('targeted');
      }

      marker.style.left = `${clampedX}%`;
      marker.style.top = `${clampedY}%`;

      // SIZE-BASED DISTANCE INDICATION: Closer = Larger
      // Scale from 0.5x (far) to 2x (very close)
      // Distance range: 0-300, inverse scaling
      const distanceRatio = Math.max(0, Math.min(1, distance / 300));
      const scale = 2.0 - (distanceRatio * 1.5); // 2.0 at 0 distance, 0.5 at 300 distance

      // Apply scale transform while preserving the translate(-50%, -50%) centering
      marker.style.transform = `translate(-50%, -50%) scale(${scale})`;

      markersContainer.appendChild(marker);
    });
  }

  /**
   * Update indicator visibility
   */
  private updateIndicators(): void {
    const aLeft = this.computerElement.querySelector('.indicator-a-left');
    const aRight = this.computerElement.querySelector('.indicator-a-right');
    const bLeft = this.computerElement.querySelector('.indicator-b-left');
    const bRight = this.computerElement.querySelector('.indicator-b-right');
    const c = this.computerElement.querySelector('.indicator-c');

    // Reset all
    [aLeft, aRight, bLeft, bRight, c].forEach((el) => el?.classList.remove('active'));

    // Activate indicators based on lock level (cumulative)
    if (this.lockIndicator === LockIndicator.A ||
        this.lockIndicator === LockIndicator.B ||
        this.lockIndicator === LockIndicator.C) {
      aLeft?.classList.add('active');
      aRight?.classList.add('active');
    }

    if (this.lockIndicator === LockIndicator.B ||
        this.lockIndicator === LockIndicator.C) {
      bLeft?.classList.add('active');
      bRight?.classList.add('active');
    }

    if (this.lockIndicator === LockIndicator.C) {
      c?.classList.add('active');
    }
  }

  /**
   * Get current lock indicator
   */
  public getLockIndicator(): LockIndicator {
    return this.lockIndicator;
  }

  /**
   * Get hit probability based on lock
   */
  public getHitProbability(): number {
    switch (this.lockIndicator) {
      case LockIndicator.C:
        return 0.9;
      case LockIndicator.B:
        return 0.6;
      case LockIndicator.A:
        return 0.3;
      default:
        return 0.1;
    }
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    if (this.computerElement.parentElement) {
      this.computerElement.parentElement.removeChild(this.computerElement);
    }
    const styles = document.getElementById('attack-computer-styles');
    if (styles) {
      styles.remove();
    }
  }
}
