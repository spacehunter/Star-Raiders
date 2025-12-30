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
   * Create the attack computer HTML
   */
  private createDisplay(): HTMLElement {
    const display = document.createElement('div');
    display.className = 'attack-computer';
    display.innerHTML = `
      <div class="computer-frame">
        <div class="indicator indicator-a-left"></div>
        <div class="indicator indicator-a-right"></div>
        <div class="indicator indicator-b-left"></div>
        <div class="indicator indicator-b-right"></div>
        <div class="indicator indicator-c"></div>
        <div class="targeting-reticle">
          <div class="reticle-ring"></div>
          <div class="reticle-cross-h"></div>
          <div class="reticle-cross-v"></div>
        </div>
      </div>
      <div class="target-info">
        <span class="target-type"></span>
        <span class="target-range"></span>
      </div>
    `;

    return display;
  }

  /**
   * Add CSS styles
   */
  private addStyles(): void {
    if (document.getElementById('attack-computer-styles')) return;

    const style = document.createElement('style');
    style.id = 'attack-computer-styles';
    style.textContent = `
      .attack-computer {
        position: fixed;
        bottom: 100px;
        right: 20px;
        width: 150px;
        height: 150px;
        z-index: 100;
      }

      .computer-frame {
        width: 100%;
        height: 100%;
        border: 2px solid #00ffff;
        background: rgba(0, 20, 40, 0.6);
        position: relative;
      }

      .indicator {
        position: absolute;
        background: #00ff00;
        opacity: 0;
        transition: opacity 0.1s;
      }

      .indicator.active {
        opacity: 1;
      }

      /* A indicators - top corners (horizontal lock) */
      .indicator-a-left {
        top: 10px;
        left: 10px;
        width: 20px;
        height: 4px;
      }

      .indicator-a-right {
        top: 10px;
        right: 10px;
        width: 20px;
        height: 4px;
      }

      /* B indicators - middle sides (horizontal + vertical) */
      .indicator-b-left {
        top: 50%;
        left: 10px;
        width: 4px;
        height: 20px;
        transform: translateY(-50%);
      }

      .indicator-b-right {
        top: 50%;
        right: 10px;
        width: 4px;
        height: 20px;
        transform: translateY(-50%);
      }

      /* C indicator - bottom center (full lock) */
      .indicator-c {
        bottom: 10px;
        left: 50%;
        width: 30px;
        height: 4px;
        transform: translateX(-50%);
        background: #ff0000;
      }

      .indicator-c.active {
        animation: pulse 0.3s infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      .targeting-reticle {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 40px;
        height: 40px;
      }

      .reticle-ring {
        position: absolute;
        width: 100%;
        height: 100%;
        border: 2px solid #00ffff;
        border-radius: 50%;
      }

      .reticle-cross-h,
      .reticle-cross-v {
        position: absolute;
        background: #00ffff;
      }

      .reticle-cross-h {
        width: 100%;
        height: 2px;
        top: 50%;
        transform: translateY(-50%);
      }

      .reticle-cross-v {
        width: 2px;
        height: 100%;
        left: 50%;
        transform: translateX(-50%);
      }

      .target-info {
        position: absolute;
        bottom: -25px;
        left: 0;
        right: 0;
        text-align: center;
        font-family: 'Courier New', monospace;
        font-size: 10px;
        color: #00ffff;
      }

      .target-type {
        display: block;
        color: #ff0000;
        font-weight: bold;
      }

      .target-range {
        display: block;
        color: #00ff00;
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
    playerDirection: THREE.Vector3
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
