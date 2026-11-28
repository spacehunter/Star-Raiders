import { Transform, Vec3 } from '../core/vec3';

/**
 * Starbase - friendly station for docking, repairs and refuelling.
 * Drawn as a placeholder blob until its ROM sprite and docking rules arrive (Phases 5 and 10).
 */
export class Starbase {
  private readonly mesh = new Transform();

  public isActive: boolean = true;
  public isDestroyed: boolean = false;

  constructor(position: Vec3) {
    this.mesh.position.copy(position);
  }

  /** Position holder (ship frame). */
  public getObject(): Transform {
    return this.mesh;
  }

  public getPosition(): Vec3 {
    return this.mesh.position.clone();
  }

  public getDockingRadius(): number {
    return 50;
  }

  public isInDockingRange(playerPosition: Vec3): boolean {
    return this.mesh.position.distanceTo(playerPosition) < this.getDockingRadius();
  }

  /** Within range and at speed key 2 or below. */
  public canDock(playerPosition: Vec3, playerSpeed: number): boolean {
    if (!this.isActive || this.isDestroyed) return false;
    if (playerSpeed > 2) return false;
    return this.isInDockingRange(playerPosition);
  }

  public update(_deltaTime: number): void {}

  public destroy(): void {
    this.isDestroyed = true;
    this.isActive = false;
  }

  public dispose(): void {}
}
