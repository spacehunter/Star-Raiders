import { Vec3 } from '../core/vec3';

/**
 * Photon torpedo (ship frame). Phase 5 replaces the flight rules with §17.7 (alternating
 * barrels, 23-loop refire, 255-loop life, homing); the renderer draws it as a purple blob.
 */
export class PhotonTorpedo {
  private readonly centerPosition: Vec3;
  private readonly velocity: Vec3;
  private age: number = 0;
  private readonly maxAge: number = 3; // seconds
  private readonly speed: number = 110; // units per second
  public isActive: boolean = true;

  constructor(position: Vec3, direction: Vec3) {
    this.centerPosition = position.clone();
    this.velocity = direction.clone().normalize().multiplyScalar(this.speed);
  }

  /** The live position (moved by turning and flying like every space object). */
  public get position(): Vec3 {
    return this.centerPosition;
  }

  public getPosition(): Vec3 {
    return this.centerPosition.clone();
  }

  public update(deltaTime: number): void {
    if (!this.isActive) return;
    this.centerPosition.add(this.velocity.clone().multiplyScalar(deltaTime));
    this.age += deltaTime;
    if (this.age >= this.maxAge) this.isActive = false;
  }

  public checkCollision(targetPosition: Vec3, targetRadius: number): boolean {
    return this.centerPosition.distanceTo(targetPosition) < targetRadius + 0.2;
  }

  public deactivate(): void {
    this.isActive = false;
  }

  public dispose(): void {}
}
