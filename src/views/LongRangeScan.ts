import { SectorSystem } from '../systems/SectorSystem';
import { GameState } from '../game/GameState';
import { CombatSystem } from '../systems/CombatSystem';
import { Starbase } from '../entities/Starbase';

/**
 * LongRangeScan - Tactical view of current sector showing object positions
 * Authentic Atari 800 Style
 */
export class LongRangeScan {
  private container: HTMLElement;
  private scanElement: HTMLElement;
  private gameState: GameState;

  // Real world data access
  private combatSystem: CombatSystem;
  private getStarbase: () => Starbase | null;
  private getPlayerRotation: () => number;

  private isVisible: boolean = false;
  private animationId: number | null = null;
  private lastTime: number = 0;

  // Starfield
  private stars: Array<{ x: number; y: number; brightness: number }> = [];
  private readonly NUM_STARS = 40;

  constructor(
    container: HTMLElement,
    sectorSystem: SectorSystem,
    gameState: GameState,
    combatSystem: CombatSystem,
    getStarbase: () => Starbase | null,
    getPlayerRotation: () => number
  ) {
    this.container = container;
    // sectorSystem available if needed in future
    void sectorSystem;
    this.gameState = gameState;
    this.combatSystem = combatSystem;
    this.getStarbase = getStarbase;
    this.getPlayerRotation = getPlayerRotation;

    this.scanElement = this.createScan();
    this.container.appendChild(this.scanElement);
    this.addStyles();

    this.initStars();

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
      </div>
      <div class="scan-viewport">
        <!-- Starfield Layer -->
        <div class="scan-starfield"></div>
        <!-- Central Player Ship -->
        <div class="scan-player-sprite"></div>
        <!-- Changing grid/objects will be injected here -->
        <div class="scan-objects-layer"></div>
      </div>
      <!-- Note: No footer here. The global ControlPanel provides the stats at the bottom. -->
    `;

    return scan;
  }

  /**
   * Initialize random stars in World Space
   */
  private initStars(): void {
    this.stars = [];
    const RANGE = 500;
    for (let i = 0; i < this.NUM_STARS; i++) {
      this.stars.push({
        x: (Math.random() - 0.5) * 2 * RANGE, // -500 to 500
        y: (Math.random() - 0.5) * 2 * RANGE, // Actually Z in world space
        brightness: Math.random() * 0.5 + 0.5
      });
    }

    // Create DOM elements once
    const starfield = this.scanElement.querySelector('.scan-starfield');
    if (starfield) {
      starfield.innerHTML = '';
      this.stars.forEach(() => {
        const el = document.createElement('div');
        el.className = 'scan-star';
        // Initial position hidden until update
        el.style.opacity = '0';
        starfield.appendChild(el);
      });
    }
  }

  /**
   * Add CSS styles
   */
  private addStyles(): void {
    if (document.getElementById('long-range-scan-styles')) return;

    const style = document.createElement('style');
    style.id = 'long-range-scan-styles';
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

      .long-range-scan {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: #2B608A;
        z-index: 50;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding-top: 2vh;
        box-sizing: border-box;
        image-rendering: pixelated;
        font-family: 'Press Start 2P', monospace;
      }

      .scan-header {
        width: 100%;
        text-align: center;
        margin-bottom: 2vh;
        color: #FFFFFF;
        font-size: 3vh;
        text-shadow: 0.5vh 0.5vh 0 #000;
        text-transform: uppercase;
      }
      
      .scan-title {
        color: #CEFFFF;
      }

      .scan-viewport {
        position: relative;
        width: 60vh;
        height: 60vh;
        border: 0.5vh solid rgba(85, 170, 255, 0.3);
        margin-bottom: 2vh;
        overflow: hidden;
      }
      
      /* Center Crosshair lines */
      .scan-viewport::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 0;
        width: 100%;
        height: 0.25vh;
        background: rgba(85, 170, 255, 0.2);
        transform: translateY(-50%);
        z-index: 5;
      }
      
      .scan-viewport::after {
        content: '';
        position: absolute;
        left: 50%;
        top: 0;
        height: 100%;
        width: 0.25vh;
        background: rgba(85, 170, 255, 0.2);
        transform: translateX(-50%);
        z-index: 5;
      }
      
      /* Starfield */
      .scan-starfield {
        position: absolute;
        width: 100%;
        height: 100%;
        top: 0;
        left: 0;
        z-index: 1; /* Behind objects */
      }
      
      .scan-star {
        position: absolute;
        width: 2px;
        height: 2px;
        background: #FFFFFF;
        border-radius: 50%;
      }

      /* Player Ship Sprite */
      .scan-player-sprite {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 4px;
        height: 4px;
        color: #FFFFFF; 
        box-shadow: 
           0 -4px 0 0, /* Top nose */
           -4px 0 0 0, 0 0 0 0, 4px 0 0 0, /* Wings */
           -4px 4px 0 0, 4px 4px 0 0; /* Rear engines */
        background: transparent;
        /* Scale it up slightly to match the larger grid feeling? */
        transform: translate(-50%, -50%) scale(1.5); 
        z-index: 10;
      }

      .scan-objects-layer {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10;
      }

      .scan-obj {
        position: absolute;
        width: 4px;
        height: 4px;
        transform: translate(-50%, -50%);
      }

      /* Enemy Blip */
      .scan-obj.enemy {
        color: #00FFFF;
        background: #00FFFF;
        box-shadow: 0 0 4px #00FFFF;
        width: 6px;
        height: 6px;
        border-radius: 50%; 
      }

      /* Starbase */
      .scan-obj.starbase {
        color: #BAFF00;
        background: #BAFF00;
        width: 8px;
        height: 8px;
        box-shadow: 0 0 4px #BAFF00;
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
    this.scanElement.style.display = 'flex';
    // this.generateObjectPositions(); // Deprecated
    this.update();

    // Start animation loop
    this.lastTime = performance.now();
    this.animationLoop(this.lastTime);
  }

  /**
   * Hide the scan
   */
  public hide(): void {
    this.isVisible = false;
    this.scanElement.style.display = 'none';
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Animation toggle
   */
  private animationLoop(timestamp: number): void {
    if (!this.isVisible) return;

    const deltaTime = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    this.updateStarfield(deltaTime);
    this.update(); // Re-render everything after starfield update

    this.animationId = requestAnimationFrame((t) => this.animationLoop(t));
  }

  /**
   * Update star world positions based on engine speed (simulating movement)
   */
  private updateStarfield(deltaTime: number): void {
    const speed = this.gameState.engineSpeed;
    if (speed <= 0) return;

    // Movement Logic replicates Game.ts updatePlayerMovement
    // Stars move opposite to player heading
    const moveSpeed = speed * 10 * deltaTime;

    // Player Rotation tells us which way is "Forward" in World Space
    // 0 = -Z (North). 90 = -X (West). etc.
    const rotation = this.getPlayerRotation();
    // Forward Vector from rotation
    // x = -sin(rot), z = -cos(rot). (Standard 3D forward from Y-rot)
    const dirX = -Math.sin(rotation);
    const dirZ = -Math.cos(rotation);

    // Displacement
    const dx = dirX * moveSpeed;
    const dz = dirZ * moveSpeed;

    const RANGE = 500;

    this.stars.forEach(star => {
      // Star moves opposite to ship
      star.x -= dx;
      star.y -= dz; // star.y is World Z

      // Wrap around in World Space
      if (star.x > RANGE) star.x -= RANGE * 2;
      if (star.x < -RANGE) star.x += RANGE * 2;
      if (star.y > RANGE) star.y -= RANGE * 2;
      if (star.y < -RANGE) star.y += RANGE * 2;
    });
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
   * (Removed generateObjectPositions - LRS now uses real entity data)
   */

  /**
   * Update the scan display
   */
  public update(): void {
    if (!this.isVisible) return;

    // Get Player Rotation
    const rotationRad = this.getPlayerRotation();
    // Precalc rotation matrix
    // We want to rotate the WORLD by -rotationRad
    // x' = x cos(-th) - z sin(-th) = x cos - z (-sin) = x cos + z sin
    // z' = x sin(-th) + z cos(-th) = x (-sin) + z cos = -x sin + z cos
    const cos = Math.cos(rotationRad);
    const sin = Math.sin(rotationRad);

    // Player Sprite is Fixed Up (Heads-Up Display)
    const playerSprite = this.scanElement.querySelector('.scan-player-sprite') as HTMLElement;
    if (playerSprite) {
      playerSprite.style.transform = `translate(-50%, -50%) scale(1.5)`;
    }

    // Update Objects (Read from Real World)
    const layer = this.scanElement.querySelector('.scan-objects-layer');
    if (layer) {
      layer.innerHTML = ''; // Clear

      // Map scale: range +/- 500 units
      const RANGE = 500;

      // Shared Projection: Transform World Coords directly to Screen Coords (Heads-Up)
      const renderObj = (worldX: number, worldZ: number, _type: string, _extraStyle: string = '') => {
        const rx = worldX * cos - worldZ * sin;
        const rz = worldX * sin + worldZ * cos;

        // Map x/z to 0..1 (0.5 is center)
        const px = 0.5 + (rx / RANGE) * 0.5;
        const py = 0.5 + (rz / RANGE) * 0.5;

        // Only render if in range
        if (px >= 0 && px <= 1 && py >= 0 && py <= 1) {
          // Stars are managed differently in DOM (they exist in a separate layer), 
          // but to sync them perfectly we should maybe just clear/render them here too?
          // Actually, the previous implementation had stars in '.scan-starfield'. 
          // Let's update the existing star elements instead of creating new ones.
          return { px, py, visible: true };
        }
        return { px: 0, py: 0, visible: false };
      };

      // 1. Update Stars (already in DOM, just move them)
      const starElements = this.scanElement.querySelectorAll('.scan-star');
      this.stars.forEach((star, index) => {
        const result = renderObj(star.x, star.y, 'star');
        const el = starElements[index] as HTMLElement;
        if (el) {
          if (result.visible) {
            el.style.left = `${result.px * 100}%`;
            el.style.top = `${result.py * 100}%`;
            el.style.opacity = star.brightness.toString();
          } else {
            el.style.opacity = '0'; // Hide if out of bounds (shouldn't happen often with wrap)
          }
        }
      });

      // 2. Render Enemies and Base (Create new elements as before)
      // Helper for DOM creation
      const createBlip = (worldX: number, worldZ: number, type: string) => {
        const result = renderObj(worldX, worldZ, type);
        if (result.visible) {
          const element = document.createElement('div');
          element.className = `scan-obj ${type}`;
          element.style.left = `${result.px * 100}%`;
          element.style.top = `${result.py * 100}%`;
          layer.appendChild(element);
        }
      };

      const enemies = this.combatSystem.getEnemies();
      for (const enemy of enemies) {
        if (!enemy.isActive) continue;
        const pos = enemy.getPosition();
        createBlip(pos.x, pos.z, 'enemy');
      }

      const starbase = this.getStarbase();
      if (starbase) {
        const pos = starbase.getObject().position;
        createBlip(pos.x, pos.z, 'starbase');
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
