import * as THREE from 'three';

/**
 * Explosion effect
 */
class Explosion {
  private particles: THREE.Points;
  private velocities: Float32Array;
  private age: number = 0;
  private maxAge: number = 1;
  public isActive: boolean = true;

  constructor(position: THREE.Vector3, size: number = 1) {
    const particleCount = 50;
    const geometry = new THREE.BufferGeometry();

    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    this.velocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;

      // Start at explosion center
      positions[i3] = position.x;
      positions[i3 + 1] = position.y;
      positions[i3 + 2] = position.z;

      // Random outward velocity
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 20 + Math.random() * 30;

      this.velocities[i3] = Math.sin(phi) * Math.cos(theta) * speed * size;
      this.velocities[i3 + 1] = Math.sin(phi) * Math.sin(theta) * speed * size;
      this.velocities[i3 + 2] = Math.cos(phi) * speed * size;

      // Orange/yellow colors
      colors[i3] = 1;
      colors[i3 + 1] = 0.3 + Math.random() * 0.5;
      colors[i3 + 2] = 0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 2 * size,
      vertexColors: true,
      transparent: true,
      opacity: 1,
    });

    this.particles = new THREE.Points(geometry, material);
  }

  public getObject(): THREE.Object3D {
    return this.particles;
  }

  public update(deltaTime: number): void {
    this.age += deltaTime;

    if (this.age >= this.maxAge) {
      this.isActive = false;
      return;
    }

    const positions = this.particles.geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < positions.length; i += 3) {
      positions[i] += this.velocities[i] * deltaTime;
      positions[i + 1] += this.velocities[i + 1] * deltaTime;
      positions[i + 2] += this.velocities[i + 2] * deltaTime;

      // Slow down
      this.velocities[i] *= 0.98;
      this.velocities[i + 1] *= 0.98;
      this.velocities[i + 2] *= 0.98;
    }

    this.particles.geometry.attributes.position.needsUpdate = true;

    // Fade out
    const material = this.particles.material as THREE.PointsMaterial;
    material.opacity = 1 - this.age / this.maxAge;
  }

  public dispose(): void {
    this.particles.geometry.dispose();
    (this.particles.material as THREE.Material).dispose();
  }
}

/**
 * Warp trail effect
 */
class WarpTrail {
  private lines: THREE.LineSegments;
  private age: number = 0;
  private maxAge: number = 0.5;
  public isActive: boolean = true;

  constructor(direction: THREE.Vector3) {
    const lineCount = 30;
    const positions: number[] = [];
    const colors: number[] = [];

    for (let i = 0; i < lineCount; i++) {
      // Random position around center
      const x = (Math.random() - 0.5) * 50;
      const y = (Math.random() - 0.5) * 30;
      const z = -Math.random() * 100;

      // Line extends in travel direction
      const length = 10 + Math.random() * 20;

      positions.push(x, y, z);
      positions.push(x + direction.x * length, y + direction.y * length, z + direction.z * length);

      // Blue/cyan color
      colors.push(0, 0.8, 1);
      colors.push(0, 0.5, 0.8);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
    });

    this.lines = new THREE.LineSegments(geometry, material);
  }

  public getObject(): THREE.Object3D {
    return this.lines;
  }

  public update(deltaTime: number): void {
    this.age += deltaTime;

    if (this.age >= this.maxAge) {
      this.isActive = false;
      return;
    }

    // Move lines
    const positions = this.lines.geometry.attributes.position.array as Float32Array;
    for (let i = 2; i < positions.length; i += 3) {
      positions[i] += 200 * deltaTime;
    }
    this.lines.geometry.attributes.position.needsUpdate = true;

    // Fade
    const material = this.lines.material as THREE.LineBasicMaterial;
    material.opacity = 0.8 * (1 - this.age / this.maxAge);
  }

  public dispose(): void {
    this.lines.geometry.dispose();
    (this.lines.material as THREE.Material).dispose();
  }
}

/**
 * VFXSystem - Manages visual effects
 */
export class VFXSystem {
  private scene: THREE.Scene;
  private explosions: Explosion[] = [];
  private warpTrails: WarpTrail[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Create explosion at position
   */
  public createExplosion(position: THREE.Vector3, size: number = 1): void {
    const explosion = new Explosion(position, size);
    this.explosions.push(explosion);
    this.scene.add(explosion.getObject());
  }

  /**
   * Create warp trail effect
   */
  public createWarpTrail(direction: THREE.Vector3): void {
    const trail = new WarpTrail(direction);
    this.warpTrails.push(trail);
    this.scene.add(trail.getObject());
  }

  /**
   * Update all effects
   */
  public update(deltaTime: number): void {
    // Update explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const explosion = this.explosions[i];
      explosion.update(deltaTime);

      if (!explosion.isActive) {
        this.scene.remove(explosion.getObject());
        explosion.dispose();
        this.explosions.splice(i, 1);
      }
    }

    // Update warp trails
    for (let i = this.warpTrails.length - 1; i >= 0; i--) {
      const trail = this.warpTrails[i];
      trail.update(deltaTime);

      if (!trail.isActive) {
        this.scene.remove(trail.getObject());
        trail.dispose();
        this.warpTrails.splice(i, 1);
      }
    }
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    for (const explosion of this.explosions) {
      this.scene.remove(explosion.getObject());
      explosion.dispose();
    }
    this.explosions = [];

    for (const trail of this.warpTrails) {
      this.scene.remove(trail.getObject());
      trail.dispose();
    }
    this.warpTrails = [];
  }
}
