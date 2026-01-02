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
 * - Fighter: Fast, small green projectiles, lower damage
 * - Cruiser: Medium speed, purple projectiles, medium damage
 * - Basestar: Slower, large gold projectiles, high damage
 */
export const PROJECTILE_CONFIGS: Record<EnemyType, EnemyProjectileConfig> = {
  FIGHTER: { speed: 180, damage: 100, color: 0x00ff88, size: 0.12 },
  CRUISER: { speed: 150, damage: 200, color: 0xff00ff, size: 0.18 },
  BASESTAR: { speed: 120, damage: 350, color: 0xffd700, size: 0.25 },
};

// Make globally accessible for console testing/tuning
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
