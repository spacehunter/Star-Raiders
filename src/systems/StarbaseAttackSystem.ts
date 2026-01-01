import { SectorSystem } from './SectorSystem';
import { DifficultyLevel } from '../game/GameState';

/**
 * Represents the state of an ongoing starbase attack
 */
export interface StarbaseAttackState {
  targetSector: { x: number; y: number };
  isSurrounded: boolean;
  surroundedTimestamp: number | null; // When starbase became surrounded (in game time)
  hasNotifiedSurrounded: boolean;
}

/**
 * StarbaseAttackSystem - Manages strategic enemy behavior to surround and destroy starbases
 *
 * Strategy:
 * 1. Select one starbase as the current attack target
 * 2. Move enemies from nearby sectors to the 4 adjacent sectors (up/down/left/right)
 * 3. Once all 4 adjacent sectors have enemies, the starbase is "surrounded"
 * 4. After 5 minutes of being surrounded, the starbase is destroyed
 * 5. Only one starbase can be targeted at a time
 */
export class StarbaseAttackSystem {
  private sectorSystem: SectorSystem;
  private currentAttack: StarbaseAttackState | null = null;
  private difficulty: DifficultyLevel;

  // Timer constants
  private static readonly DESTRUCTION_TIME = 300; // 5 minutes in seconds
  private static readonly MOVEMENT_INTERVAL = 30; // Seconds between enemy movements

  private lastMovementTime: number = 0;
  private gameTime: number = 0;

  // Callback for broadcasting messages
  private onMessage: ((message: string, duration?: number) => void) | null = null;

  constructor(sectorSystem: SectorSystem, difficulty: DifficultyLevel) {
    this.sectorSystem = sectorSystem;
    this.difficulty = difficulty;
  }

  /**
   * Set the message callback for broadcasting alerts
   */
  public setMessageCallback(callback: (message: string, duration?: number) => void): void {
    this.onMessage = callback;
  }

  /**
   * Broadcast a message to the player
   */
  private broadcast(message: string, duration?: number): void {
    if (this.onMessage) {
      this.onMessage(message, duration);
    }
  }

  /**
   * Get the 4 adjacent sectors (up, down, left, right) for a given position
   */
  private getAdjacentSectors(x: number, y: number): { x: number; y: number }[] {
    const adjacent: { x: number; y: number }[] = [];
    const directions = [
      { dx: 0, dy: -1 }, // Up
      { dx: 0, dy: 1 },  // Down
      { dx: -1, dy: 0 }, // Left
      { dx: 1, dy: 0 },  // Right
    ];

    for (const dir of directions) {
      const nx = x + dir.dx;
      const ny = y + dir.dy;
      // Check bounds
      if (nx >= 0 && nx < SectorSystem.GRID_SIZE && ny >= 0 && ny < SectorSystem.GRID_SIZE) {
        adjacent.push({ x: nx, y: ny });
      }
    }

    return adjacent;
  }

  /**
   * Check if a starbase at the given position is surrounded
   * A starbase is surrounded when all 4 adjacent sectors have at least 1 enemy
   */
  private isStarbaseSurrounded(x: number, y: number): boolean {
    const adjacent = this.getAdjacentSectors(x, y);

    // If starbase is at edge/corner, it has fewer than 4 adjacent sectors
    // In that case, ALL available adjacent sectors must have enemies
    for (const pos of adjacent) {
      const sector = this.sectorSystem.getSector(pos.x, pos.y);
      if (!sector || sector.enemies === 0) {
        return false;
      }
    }

    return adjacent.length > 0;
  }

  /**
   * Find the best starbase to target for attack
   * Prioritizes starbases that are:
   * 1. Not already destroyed
   * 2. Have enemies in nearby sectors (easier to surround)
   */
  private selectTargetStarbase(): { x: number; y: number } | null {
    const sectors = this.sectorSystem.getAllSectors();
    let bestTarget: { x: number; y: number; score: number } | null = null;

    for (let y = 0; y < SectorSystem.GRID_SIZE; y++) {
      for (let x = 0; x < SectorSystem.GRID_SIZE; x++) {
        const sector = sectors[y][x];

        if (sector.hasStarbase && !sector.starbaseDestroyed) {
          // Calculate attack score based on nearby enemy presence
          let score = 0;
          const adjacent = this.getAdjacentSectors(x, y);

          for (const pos of adjacent) {
            const adjSector = this.sectorSystem.getSector(pos.x, pos.y);
            if (adjSector && adjSector.enemies > 0) {
              score += adjSector.enemies;
            }
          }

          // Also consider enemies within 2 sectors (reinforcement potential)
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              if (Math.abs(dx) + Math.abs(dy) === 2) { // Manhattan distance 2
                const nearSector = this.sectorSystem.getSector(x + dx, y + dy);
                if (nearSector && nearSector.enemies > 0) {
                  score += nearSector.enemies * 0.5;
                }
              }
            }
          }

          if (!bestTarget || score > bestTarget.score) {
            bestTarget = { x, y, score };
          }
        }
      }
    }

    return bestTarget ? { x: bestTarget.x, y: bestTarget.y } : null;
  }

  /**
   * Move one enemy from a source sector to a target sector
   */
  private moveEnemy(fromX: number, fromY: number, toX: number, toY: number): boolean {
    const fromSector = this.sectorSystem.getSector(fromX, fromY);
    const toSector = this.sectorSystem.getSector(toX, toY);

    if (!fromSector || !toSector || fromSector.enemies === 0) {
      return false;
    }

    // Move enemy: decrement source, increment destination
    fromSector.enemies--;
    toSector.enemies++;

    return true;
  }

  /**
   * Execute strategic enemy movements to surround the target starbase
   */
  private executeStrategicMovement(): void {
    if (!this.currentAttack) return;

    const target = this.currentAttack.targetSector;
    const adjacent = this.getAdjacentSectors(target.x, target.y);

    // Find adjacent sectors that need enemies
    const needsEnemies: { x: number; y: number }[] = [];
    for (const pos of adjacent) {
      const sector = this.sectorSystem.getSector(pos.x, pos.y);
      if (sector && sector.enemies === 0) {
        needsEnemies.push(pos);
      }
    }

    if (needsEnemies.length === 0) {
      // Already surrounded, no movement needed
      return;
    }

    // For each sector that needs enemies, find the nearest sector with spare enemies
    for (const targetPos of needsEnemies) {
      const sourcePos = this.findNearestEnemySource(targetPos.x, targetPos.y, target);
      if (sourcePos) {
        this.moveEnemy(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y);
      }
    }
  }

  /**
   * Find the nearest sector with enemies that can be moved toward the target
   * Excludes the starbase sector itself and prefers sectors with multiple enemies
   */
  private findNearestEnemySource(
    destX: number,
    destY: number,
    starbasePos: { x: number; y: number }
  ): { x: number; y: number } | null {
    const sectors = this.sectorSystem.getAllSectors();
    let best: { x: number; y: number; distance: number; enemies: number } | null = null;

    for (let y = 0; y < SectorSystem.GRID_SIZE; y++) {
      for (let x = 0; x < SectorSystem.GRID_SIZE; x++) {
        const sector = sectors[y][x];

        // Skip if no enemies, is the starbase sector, or is the destination
        if (sector.enemies === 0) continue;
        if (x === starbasePos.x && y === starbasePos.y) continue;
        if (x === destX && y === destY) continue;

        // Don't steal enemies from adjacent sectors that already have them
        // (we want to maintain the surround)
        const isAdjacent = this.getAdjacentSectors(starbasePos.x, starbasePos.y)
          .some(pos => pos.x === x && pos.y === y);
        if (isAdjacent && sector.enemies <= 1) continue;

        const distance = Math.abs(x - destX) + Math.abs(y - destY);

        // Prefer closer sectors and sectors with more enemies (to spare)
        const score = distance - (sector.enemies * 0.1);

        if (!best || score < best.distance - (best.enemies * 0.1)) {
          best = { x, y, distance, enemies: sector.enemies };
        }
      }
    }

    return best ? { x: best.x, y: best.y } : null;
  }

  /**
   * Get the current attack state (for UI display)
   */
  public getCurrentAttack(): StarbaseAttackState | null {
    return this.currentAttack;
  }

  /**
   * Get remaining time before starbase destruction (in seconds)
   * Returns null if not surrounded
   */
  public getDestructionTimeRemaining(): number | null {
    if (!this.currentAttack || !this.currentAttack.isSurrounded || !this.currentAttack.surroundedTimestamp) {
      return null;
    }

    const elapsed = this.gameTime - this.currentAttack.surroundedTimestamp;
    const remaining = StarbaseAttackSystem.DESTRUCTION_TIME - elapsed;
    return Math.max(0, remaining);
  }

  /**
   * Update the attack system
   * @param deltaTime Time since last update in seconds
   * @param _playerSectorX Player's current sector X (reserved for future use)
   * @param _playerSectorY Player's current sector Y (reserved for future use)
   */
  public update(deltaTime: number, _playerSectorX: number, _playerSectorY: number): void {
    this.gameTime += deltaTime;

    // Only active on higher difficulties
    if (this.difficulty === DifficultyLevel.NOVICE) {
      return;
    }

    // If no current attack, try to select a target
    if (!this.currentAttack) {
      // Movement interval check - don't constantly try to select
      if (this.gameTime - this.lastMovementTime < StarbaseAttackSystem.MOVEMENT_INTERVAL) {
        return;
      }
      this.lastMovementTime = this.gameTime;

      const target = this.selectTargetStarbase();
      if (target) {
        this.currentAttack = {
          targetSector: target,
          isSurrounded: false,
          surroundedTimestamp: null,
          hasNotifiedSurrounded: false,
        };
      }
      return;
    }

    // Check if target starbase is still valid
    const targetSector = this.sectorSystem.getSector(
      this.currentAttack.targetSector.x,
      this.currentAttack.targetSector.y
    );

    if (!targetSector || !targetSector.hasStarbase || targetSector.starbaseDestroyed) {
      // Target destroyed or invalid, clear attack
      this.currentAttack = null;
      return;
    }

    // Execute strategic movements periodically
    if (this.gameTime - this.lastMovementTime >= StarbaseAttackSystem.MOVEMENT_INTERVAL) {
      this.lastMovementTime = this.gameTime;

      // More aggressive movement on harder difficulties
      const movementCount = this.difficulty === DifficultyLevel.COMMANDER ? 2 : 1;
      for (let i = 0; i < movementCount; i++) {
        this.executeStrategicMovement();
      }
    }

    // Check if starbase is now surrounded
    const isSurrounded = this.isStarbaseSurrounded(
      this.currentAttack.targetSector.x,
      this.currentAttack.targetSector.y
    );

    if (isSurrounded && !this.currentAttack.isSurrounded) {
      // Just became surrounded
      this.currentAttack.isSurrounded = true;
      this.currentAttack.surroundedTimestamp = this.gameTime;
      this.currentAttack.hasNotifiedSurrounded = false;
    } else if (!isSurrounded && this.currentAttack.isSurrounded) {
      // No longer surrounded (player destroyed enemies)
      this.currentAttack.isSurrounded = false;
      this.currentAttack.surroundedTimestamp = null;
      this.currentAttack.hasNotifiedSurrounded = false;
    }

    // Broadcast warning when surrounded (once)
    if (this.currentAttack.isSurrounded && !this.currentAttack.hasNotifiedSurrounded) {
      this.broadcast(
        `ALERT: STARBASE AT SECTOR ${this.currentAttack.targetSector.x + 1},${this.currentAttack.targetSector.y + 1} SURROUNDED!`,
        5000
      );
      this.currentAttack.hasNotifiedSurrounded = true;
    }

    // Check destruction timer
    if (this.currentAttack.isSurrounded && this.currentAttack.surroundedTimestamp) {
      const elapsed = this.gameTime - this.currentAttack.surroundedTimestamp;

      // Periodic warnings
      const timeRemaining = StarbaseAttackSystem.DESTRUCTION_TIME - elapsed;
      if (timeRemaining <= 60 && timeRemaining > 59) {
        this.broadcast('WARNING: STARBASE DESTRUCTION IN 1 MINUTE!', 3000);
      } else if (timeRemaining <= 30 && timeRemaining > 29) {
        this.broadcast('CRITICAL: STARBASE DESTRUCTION IN 30 SECONDS!', 3000);
      }

      if (elapsed >= StarbaseAttackSystem.DESTRUCTION_TIME) {
        // Destroy the starbase
        this.sectorSystem.destroyStarbase(
          this.currentAttack.targetSector.x,
          this.currentAttack.targetSector.y
        );

        this.broadcast(
          `STARBASE AT SECTOR ${this.currentAttack.targetSector.x + 1},${this.currentAttack.targetSector.y + 1} DESTROYED!`,
          5000
        );

        // Clear attack state - will select new target next cycle
        this.currentAttack = null;
      }
    }
  }

  /**
   * Reset the system for a new game
   */
  public reset(difficulty: DifficultyLevel): void {
    this.difficulty = difficulty;
    this.currentAttack = null;
    this.lastMovementTime = 0;
    this.gameTime = 0;
  }
}
