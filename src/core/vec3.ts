/**
 * A small mutable 3D vector (the subset of the old THREE.Vector3 API the simulation uses).
 *
 * Coordinates are in the ship frame of the ROM (MANUAL_SPEC §17.13, R:ROTATE): our starship sits
 * at the origin, +x points right, +y up and +z in the flight direction. Turning rotates every
 * object around the origin; flying forward moves every object toward -z.
 */
export class Vec3 {
  public x: number;
  public y: number;
  public z: number;

  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x: number, y: number, z: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  copy(v: Vec3): this {
    return this.set(v.x, v.y, v.z);
  }

  clone(): Vec3 {
    return new Vec3(this.x, this.y, this.z);
  }

  add(v: Vec3): this {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }

  sub(v: Vec3): this {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }

  multiplyScalar(s: number): this {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }

  divideScalar(s: number): this {
    return this.multiplyScalar(1 / s);
  }

  negate(): this {
    return this.multiplyScalar(-1);
  }

  dot(v: Vec3): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  crossVectors(a: Vec3, b: Vec3): this {
    return this.set(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  }

  cross(v: Vec3): this {
    return this.crossVectors(this.clone(), v);
  }

  length(): number {
    return Math.hypot(this.x, this.y, this.z);
  }

  normalize(): this {
    const l = this.length();
    return l > 0 ? this.divideScalar(l) : this;
  }

  distanceTo(v: Vec3): number {
    return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z);
  }
}

/** Position and heading of a space object (replaces THREE.Object3D for the simulation). */
export class Transform {
  public readonly position = new Vec3();
  /** Heading, kept for AI code that spins idle ships; not drawn. */
  public readonly rotation = { x: 0, y: 0, z: 0 };

  /** Ships face what they look at; the 2D renderer draws no facing, so this is a no-op. */
  lookAt(_target: Vec3): void {}
}
