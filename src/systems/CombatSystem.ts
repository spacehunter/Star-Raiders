import * as THREE from 'three';
import { Enemy, EnemyType } from '../entities/Enemy';
import { PhotonTorpedo } from '../entities/PhotonTorpedo';
import { GameState, DifficultyLevel } from '../game/GameState';
import { SectorSystem } from './SectorSystem';

/**
 * CombatSystem - Manages enemies, combat, and targeting
 */
export class CombatSystem {
  private scene: THREE.Scene;
  private gameState: GameState;
  private sectorSystem: SectorSystem;

  // Enemies in current sector
  private enemies: Enemy[] = [];

  // Targeting
  private currentTargetIndex: number = -1;

  constructor(scene: THREE.Scene, gameState: GameState, sectorSystem: SectorSystem) {
    this.scene = scene;
    this.gameState = gameState;
    this.sectorSystem = sectorSystem;
  }

  /**
   * Spawn enemies for current sector
   */
  public spawnEnemiesForSector(): void {
    // Clear existing enemies
    this.clearEnemies();

    const sector = this.sectorSystem.getSector(
      this.gameState.sectorX,
      this.gameState.sectorY
    );

    if (!sector || sector.enemies <= 0) return;

    // Determine enemy types based on difficulty
    const enemyCount = sector.enemies;

    for (let i = 0; i < enemyCount; i++) {
      // Determine type based on difficulty and random chance
      let type: EnemyType;
      const roll = Math.random();

      switch (this.gameState.difficulty) {
        case DifficultyLevel.NOVICE:
          type = EnemyType.FIGHTER;
          break;
        case DifficultyLevel.PILOT:
          type = roll < 0.8 ? EnemyType.FIGHTER : EnemyType.CRUISER;
          break;
        case DifficultyLevel.WARRIOR:
          if (roll < 0.6) type = EnemyType.FIGHTER;
          else if (roll < 0.9) type = EnemyType.CRUISER;
          else type = EnemyType.BASESTAR;
          break;
        case DifficultyLevel.COMMANDER:
          if (roll < 0.4) type = EnemyType.FIGHTER;
          else if (roll < 0.7) type = EnemyType.CRUISER;
          else type = EnemyType.BASESTAR;
          break;
        default:
          type = EnemyType.FIGHTER;
      }

      // Random position around the player
      const angle = Math.random() * Math.PI * 2;
      const distance = 50 + Math.random() * 150;
      const height = (Math.random() - 0.5) * 50;

      const position = new THREE.Vector3(
        Math.cos(angle) * distance,
        height,
        Math.sin(angle) * distance
      );

      const enemy = new Enemy(type, position);
      this.enemies.push(enemy);
      this.scene.add(enemy.getObject());
    }

    // Auto-select first target
    if (this.enemies.length > 0) {
      this.currentTargetIndex = 0;
    }
  }

  /**
   * Clear all enemies from scene
   */
  public clearEnemies(): void {
    for (const enemy of this.enemies) {
      this.scene.remove(enemy.getObject());
      enemy.dispose();
    }
    this.enemies = [];
    this.currentTargetIndex = -1;
  }

  /**
   * Get current target
   */
  public getCurrentTarget(): Enemy | null {
    if (this.currentTargetIndex >= 0 && this.currentTargetIndex < this.enemies.length) {
      const target = this.enemies[this.currentTargetIndex];
      if (target.isActive) {
        return target;
      }
    }
    // Find next active target (no recursive call to avoid stack overflow)
    return this.selectNextTarget();
  }

  /**
   * Select nearest enemy as target (T key)
   */
  public selectNearestTarget(playerPosition: THREE.Vector3): Enemy | null {
    let nearest: Enemy | null = null;
    let nearestDistance = Infinity;

    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i];
      if (!enemy.isActive) continue;

      const distance = playerPosition.distanceTo(enemy.getPosition());
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = enemy;
        this.currentTargetIndex = i;
      }
    }

    return nearest;
  }

  /**
   * Cycle to next target (M key)
   */
  public selectNextTarget(): Enemy | null {
    if (this.enemies.length === 0) return null;

    // Find next active enemy
    const startIndex = this.currentTargetIndex;
    let index = (startIndex + 1) % this.enemies.length;

    while (index !== startIndex) {
      if (this.enemies[index].isActive) {
        this.currentTargetIndex = index;
        return this.enemies[index];
      }
      index = (index + 1) % this.enemies.length;
    }

    // Check if start is still valid
    if (this.enemies[startIndex]?.isActive) {
      return this.enemies[startIndex];
    }

    this.currentTargetIndex = -1;
    return null;
  }

  /**
   * Check torpedo collisions with enemies
   */
  public checkTorpedoCollisions(torpedoes: PhotonTorpedo[]): Enemy[] {
    const destroyed: Enemy[] = [];

    for (const torpedo of torpedoes) {
      if (!torpedo.isActive) continue;

      for (const enemy of this.enemies) {
        if (!enemy.isActive) continue;

        if (torpedo.checkCollision(enemy.getPosition(), enemy.getCollisionRadius())) {
          // Hit!
          torpedo.deactivate();

          if (enemy.takeDamage(1)) {
            // Enemy destroyed
            destroyed.push(enemy);
            this.gameState.enemiesDestroyed++;

            // Update sector
            this.sectorSystem.removeEnemy(
              this.gameState.sectorX,
              this.gameState.sectorY
            );
          }

          break;
        }
      }
    }

    return destroyed;
  }

  /**
   * Update all enemies
   */
  public update(deltaTime: number, playerPosition: THREE.Vector3): void {
    for (const enemy of this.enemies) {
      enemy.update(deltaTime, playerPosition);
    }

    // Remove destroyed enemies from scene after animation
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.isDestroyed) {
        this.scene.remove(enemy.getObject());
        enemy.dispose();
        this.enemies.splice(i, 1);

        // Update target index
        if (this.currentTargetIndex >= i) {
          this.currentTargetIndex = Math.max(0, this.currentTargetIndex - 1);
        }
      }
    }
  }

  /**
   * Check if any enemy should fire
   */
  public getEnemyFiring(currentTime: number, playerPosition: THREE.Vector3): Enemy | null {
    for (const enemy of this.enemies) {
      if (enemy.shouldFire(currentTime, playerPosition)) {
        return enemy;
      }
    }
    return null;
  }

  /**
   * Get active enemy count
   */
  public getActiveEnemyCount(): number {
    return this.enemies.filter((e) => e.isActive).length;
  }

  /**
   * Get all enemies
   */
  public getEnemies(): Enemy[] {
    return this.enemies;
  }

  /**
   * Apply player movement to all enemies (relative motion)
   */
  public applyPlayerMovement(displacement: THREE.Vector3): void {
    for (const enemy of this.enemies) {
      if (enemy.isActive) {
        enemy.getObject().position.add(displacement);
      }
    }
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.clearEnemies();
  }
}
