import * as THREE from 'three';
import { EnemyType } from './Enemy';

/**
 * Configuration for enemy projectiles per enemy type
 */
export interface EnemyProjectileConfig {
  speed: number;
  damage: number;
  color: number;
  size: number;
}

/**
 * Projectile configurations for each enemy type
 *
 * BALANCE TUNING (verified 2026-01-02):
 *
 * Speed values (player torpedo = 200 u/s, player max = 450 u/s):
 * - Fighter: 180 u/s - fast, requires quick reactions but dodgeable
 * - Cruiser: 150 u/s - medium speed, visible threat
 * - Basestar: 120 u/s - slow but menacing, easier to dodge but punishing
 *
 * All projectiles are slower than player torpedoes, giving player tactical advantage.
 * Player can outrun all projectiles at impulse 4+ (200 u/s).
 *
 * Damage values (shields absorb 70%, so player takes 30%):
 * - Fighter: 100 (30 with shields) - chip damage, dangerous in groups
 * - Cruiser: 200 (60 with shields) - significant threat
 * - Basestar: 350 (105 with shields) - major damage, respect the fortress
 *
 * NOVICE balance (9999 energy, 50% lead accuracy, 1.4x fire rate multiplier):
 * - Fighter effective DPS: ~24 damage/sec (unshielded), ~7/sec (shielded)
 * - Very survivable, forgiving for new players learning mechanics
 *
 * COMMANDER balance (8000 energy, 95% lead accuracy, 0.65x fire rate multiplier):
 * - Fighter effective DPS: ~97 damage/sec (unshielded), ~29/sec (shielded)
 * - Challenging but fair with active piloting and shield management
 *
 * Visual distinctiveness (color-coded threats):
 * - Fighter: Green (0x00ff88) - small, fast streaks
 * - Cruiser: Purple (0xff00ff) - medium, ominous bolts
 * - Basestar: Gold (0xffd700) - large, menacing orbs
 *
 * Size affects both visibility and collision detection radius.
 */
export const PROJECTILE_CONFIGS: Record<EnemyType, EnemyProjectileConfig> = {
  FIGHTER: { speed: 180, damage: 100, color: 0x00ff88, size: 0.12 },
  CRUISER: { speed: 150, damage: 200, color: 0xff00ff, size: 0.18 },
  BASESTAR: { speed: 120, damage: 350, color: 0xffd700, size: 0.25 },
};

// Make globally accessible for runtime balance tuning during development
// Usage in browser console:
//   PROJECTILE_CONFIGS.FIGHTER.damage = 80  // reduce fighter damage
//   PROJECTILE_CONFIGS.BASESTAR.speed = 100 // slow down basestar projectiles
if (typeof window !== 'undefined') {
  (window as any).PROJECTILE_CONFIGS = PROJECTILE_CONFIGS;
}

/**
 * EnemyProjectile - Projectile fired by enemy ships at the player
 */
export class EnemyProjectile {
  private mesh: THREE.Mesh;
  private velocity: THREE.Vector3;
  private age: number = 0;
  private maxAge: number = 4; // Seconds before despawning (longer than player torpedoes)
  private damage: number;
  public isActive: boolean = true;
  public sourceType: EnemyType;

  constructor(position: THREE.Vector3, direction: THREE.Vector3, enemyType: EnemyType) {
    this.sourceType = enemyType;
    const config = PROJECTILE_CONFIGS[enemyType];
    this.damage = config.damage;

    // Create projectile geometry - elongated sphere with glow effect
    const geometry = new THREE.SphereGeometry(config.size, 8, 8);
    geometry.scale(1, 1, 2); // Elongate

    // Bright emissive material with type-specific color
    const material = new THREE.MeshBasicMaterial({
      color: config.color,
      transparent: true,
      opacity: 0.9,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(position);

    // Align projectile to face direction of travel
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction.normalize());
    this.mesh.quaternion.copy(quaternion);

    // Set velocity
    this.velocity = direction.normalize().multiplyScalar(config.speed);

    // Add glow effect using a larger transparent sphere
    const glowGeometry = new THREE.SphereGeometry(config.size * 2.5, 8, 8);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: config.color,
      transparent: true,
      opacity: 0.35,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    this.mesh.add(glow);
  }

  /**
   * Get the Three.js object
   */
  public getObject(): THREE.Object3D {
    return this.mesh;
  }

  /**
   * Get current position
   */
  public getPosition(): THREE.Vector3 {
    return this.mesh.position.clone();
  }

  /**
   * Get damage value for this projectile
   */
  public getDamage(): number {
    return this.damage;
  }

  /**
   * Update projectile position
   */
  public update(deltaTime: number): void {
    if (!this.isActive) return;

    // Move projectile
    this.mesh.position.add(this.velocity.clone().multiplyScalar(deltaTime));

    // Age the projectile
    this.age += deltaTime;
    if (this.age >= this.maxAge) {
      this.isActive = false;
    }

    // Fade out as it ages
    const material = this.mesh.material as THREE.MeshBasicMaterial;
    material.opacity = 0.9 * (1 - this.age / this.maxAge);
  }

  /**
   * Check collision with a target (simple sphere collision)
   */
  public checkCollision(targetPosition: THREE.Vector3, targetRadius: number): boolean {
    const config = PROJECTILE_CONFIGS[this.sourceType];
    const distance = this.mesh.position.distanceTo(targetPosition);
    return distance < targetRadius + config.size;
  }

  /**
   * Deactivate the projectile (e.g., on hit)
   */
  public deactivate(): void {
    this.isActive = false;
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.children.forEach((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    });
  }
}
