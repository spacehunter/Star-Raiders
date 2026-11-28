import { Vec3 } from '../core/vec3';
import { EnemyType } from './Enemy';

/**
 * Zylon torpedo (ship frame). Phase 5 replaces it with the §17.7 rules (one at a time, 62-loop
 * life, per-level homing); the renderer draws it as a small blob.
 */
export interface EnemyProjectileConfig {
  speed: number;
  damage: number;
}

export const PROJECTILE_CONFIGS: Record<EnemyType, EnemyProjectileConfig> = {
  FIGHTER: { speed: 180, damage: 100 },
  CRUISER: { speed: 150, damage: 200 },
  BASESTAR: { speed: 120, damage: 350 },
};

const HIT_RADIUS = 0.2;

export class EnemyProjectile {
  public readonly position: Vec3;
  private readonly velocity: Vec3;
  private age: number = 0;
  private readonly maxAge: number = 4; // seconds
  private readonly damage: number;
  public isActive: boolean = true;
  public sourceType: EnemyType;

  constructor(position: Vec3, direction: Vec3, enemyType: EnemyType) {
    this.sourceType = enemyType;
    const config = PROJECTILE_CONFIGS[enemyType];
    this.damage = config.damage;
    this.position = position.clone();
    this.velocity = direction.clone().normalize().multiplyScalar(config.speed);
  }

  public getPosition(): Vec3 {
    return this.position.clone();
  }

  public getDamage(): number {
    return this.damage;
  }

  public update(deltaTime: number): void {
    if (!this.isActive) return;
    this.position.add(this.velocity.clone().multiplyScalar(deltaTime));
    this.age += deltaTime;
    if (this.age >= this.maxAge) this.isActive = false;
  }

  public checkCollision(targetPosition: Vec3, targetRadius: number): boolean {
    return this.position.distanceTo(targetPosition) < targetRadius + HIT_RADIUS;
  }

  public deactivate(): void {
    this.isActive = false;
  }

  public dispose(): void {}
}
