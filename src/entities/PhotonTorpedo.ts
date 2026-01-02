import * as THREE from 'three';

/**
 * PhotonTorpedo - Projectile fired by the player
 * Uses particle system for scrambled energy ball visual effect
 */
export class PhotonTorpedo {
  private particles: THREE.Points;
  private centerPosition: THREE.Vector3;
  private velocity: THREE.Vector3;
  private age: number = 0;
  private maxAge: number = 3; // Seconds before despawning
  private speed: number = 200; // Units per second
  private particleCount: number = 20;
  public isActive: boolean = true;

  constructor(position: THREE.Vector3, direction: THREE.Vector3) {
    // Store center position for collision detection and particle positioning
    this.centerPosition = position.clone();

    // Create particle geometry using BufferGeometry
    const geometry = new THREE.BufferGeometry();

    const positions = new Float32Array(this.particleCount * 3);
    const colors = new Float32Array(this.particleCount * 3);

    // Initialize particles around the center position
    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;

      // Random spherical offset from center
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = Math.random() * 0.3;

      positions[i3] = this.centerPosition.x + radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = this.centerPosition.y + radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = this.centerPosition.z + radius * Math.cos(phi);

      // Cyan/blue colors for photon energy (#00FFFF to #0088FF range)
      colors[i3] = 0; // R
      colors[i3 + 1] = 0.5 + Math.random() * 0.5; // G (0.5-1.0)
      colors[i3 + 2] = 1; // B
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Create PointsMaterial for particle rendering
    const material = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
    });

    this.particles = new THREE.Points(geometry, material);

    // Set velocity
    this.velocity = direction.normalize().multiplyScalar(this.speed);
  }

  /**
   * Get the Three.js object
   */
  public getObject(): THREE.Object3D {
    return this.particles;
  }

  /**
   * Get current position
   */
  public getPosition(): THREE.Vector3 {
    return this.centerPosition.clone();
  }

  /**
   * Update torpedo position
   */
  public update(deltaTime: number): void {
    if (!this.isActive) return;

    // Move center position
    this.centerPosition.add(this.velocity.clone().multiplyScalar(deltaTime));

    // Update particle positions with scrambled effect
    const positions = this.particles.geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;

      // Random spherical offset from center (scrambled effect)
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = Math.random() * 0.3;

      positions[i3] = this.centerPosition.x + radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = this.centerPosition.y + radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = this.centerPosition.z + radius * Math.cos(phi);
    }

    this.particles.geometry.attributes.position.needsUpdate = true;

    // Age the torpedo
    this.age += deltaTime;
    if (this.age >= this.maxAge) {
      this.isActive = false;
    }

    // Fade out as it ages
    const material = this.particles.material as THREE.PointsMaterial;
    material.opacity = 0.9 * (1 - this.age / this.maxAge);
  }

  /**
   * Check collision with a target (simple sphere collision)
   */
  public checkCollision(targetPosition: THREE.Vector3, targetRadius: number): boolean {
    const distance = this.centerPosition.distanceTo(targetPosition);
    return distance < targetRadius + 0.3; // 0.3 is the particle scatter radius
  }

  /**
   * Deactivate the torpedo (e.g., on hit)
   */
  public deactivate(): void {
    this.isActive = false;
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.particles.geometry.dispose();
    (this.particles.material as THREE.Material).dispose();
  }
}
